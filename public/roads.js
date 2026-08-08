/*
 * roads.js — on-road routing over GTA V's own vehicle path nodes.
 *
 * Loads public/roads.bin (built by scripts/build-roads.mjs), snaps both ends of
 * a trip to the nearest road node and runs A* between them, so the line drawn
 * on the map follows the roads instead of cutting across country.
 *
 * The graph is ~66k nodes / ~71k edges, which A* crosses in a few milliseconds,
 * but the file is 1.1 MB so it is fetched lazily — the first route request pays
 * for it, and everything else works before it arrives.
 */

const FREEWAY = 1, SLOW = 2;

/* Road class nudges the cost so routes prefer highways over dirt tracks the way
   a driver would. These are preferences, not speeds. */
const WEIGHT_FREEWAY = 0.75;
const WEIGHT_SLOW = 1.35;

const CELL = 128;            // spatial index cell size, world units

let graph = null;            // resolved graph, once loaded
let loading = null;          // in-flight promise

/** Fetch and unpack roads.bin. Resolves to null if it is not deployed. */
export function loadRoads(url = './roads.bin') {
  if (graph) return Promise.resolve(graph);
  if (loading) return loading;

  loading = fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('HTTP ' + res.status))))
    .then((buf) => {
      const header = new Uint32Array(buf, 0, 4);
      if (header[0] !== 0x54544d52) throw new Error('bad magic in roads.bin');
      const n = header[2];
      const edgeCount = header[3];

      // Check the size up front. Otherwise a layout mismatch surfaces as a
      // RangeError from the last typed-array view and looks like "no routing"
      // rather than "the file is wrong" — which cost me an hour once already.
      const alignPad = (4 - ((16 + n * 5) % 4)) % 4;
      const expected = 16 + n * 5 + alignPad + (n + 1) * 4 + edgeCount * 4;
      if (buf.byteLength !== expected) {
        throw new Error(`roads.bin is ${buf.byteLength} bytes, expected ${expected} ` +
          `for ${n} nodes / ${edgeCount} links — rebuild it with scripts/build-roads.mjs`);
      }

      let off = 16;
      const px = new Int16Array(buf, off, n);        off += n * 2;
      const py = new Int16Array(buf, off, n);        off += n * 2;
      const flags = new Uint8Array(buf, off, n);     off += n;
      // Uint32Array needs 4-byte alignment; the flags block can leave us odd.
      const pad = (4 - (off % 4)) % 4;               off += pad;
      const offsets = new Uint32Array(buf, off, n + 1); off += (n + 1) * 4;
      const targets = new Uint32Array(buf, off, edgeCount);

      graph = { n, px, py, flags, offsets, targets, grid: buildGrid(n, px, py) };
      return graph;
    })
    .catch((err) => {
      console.warn('[tt-map] road graph unavailable, falling back to straight lines:', err.message);
      graph = null;
      return null;
    });

  return loading;
}

export const roadsReady = () => graph !== null;

/* ------------------------------ spatial index ---------------------------- */

function buildGrid(n, px, py) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (px[i] < minX) minX = px[i];
    if (px[i] > maxX) maxX = px[i];
    if (py[i] < minY) minY = py[i];
    if (py[i] > maxY) maxY = py[i];
  }
  // Work in the packed half-unit space; CELL is in world units.
  const step = CELL * 2;
  const cols = Math.floor((maxX - minX) / step) + 1;
  const rows = Math.floor((maxY - minY) / step) + 1;

  const counts = new Uint32Array(cols * rows);
  const cellOf = (i) =>
    Math.floor((py[i] - minY) / step) * cols + Math.floor((px[i] - minX) / step);

  for (let i = 0; i < n; i++) counts[cellOf(i)]++;
  const starts = new Uint32Array(cols * rows + 1);
  for (let c = 0; c < cols * rows; c++) starts[c + 1] = starts[c] + counts[c];
  const items = new Uint32Array(n);
  const cursor = starts.slice(0, cols * rows);
  for (let i = 0; i < n; i++) items[cursor[cellOf(i)]++] = i;

  return { minX, minY, cols, rows, step, starts, items };
}

/** Nearest graph node to a world position, searching outward ring by ring. */
function nearest(g, x, y) {
  const { grid, px, py } = g;
  const qx = x * 2, qy = y * 2;
  const cx = Math.floor((qx - grid.minX) / grid.step);
  const cy = Math.floor((qy - grid.minY) / grid.step);

  let best = -1;
  let bestD = Infinity;

  for (let ring = 0; ring < 40; ring++) {
    for (let gy = cy - ring; gy <= cy + ring; gy++) {
      if (gy < 0 || gy >= grid.rows) continue;
      for (let gx = cx - ring; gx <= cx + ring; gx++) {
        if (gx < 0 || gx >= grid.cols) continue;
        // Only the newly added rim each ring, not the filled square again.
        if (ring > 0 && gx > cx - ring && gx < cx + ring && gy > cy - ring && gy < cy + ring) continue;
        const c = gy * grid.cols + gx;
        for (let k = grid.starts[c]; k < grid.starts[c + 1]; k++) {
          const i = grid.items[k];
          const dx = px[i] - qx, dy = py[i] - qy;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
    // One clear ring past a hit guarantees nothing closer is left.
    if (best >= 0 && ring > 0) break;
  }
  return best;
}

/* --------------------------------- A* ------------------------------------ */

/** Binary min-heap keyed by f-score; plenty for a graph this size. */
class Heap {
  constructor() { this.ids = []; this.keys = []; }
  get size() { return this.ids.length; }
  push(id, key) {
    this.ids.push(id); this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.#swap(i, p); i = p;
    }
  }
  pop() {
    const top = this.ids[0];
    const lastId = this.ids.pop(), lastKey = this.keys.pop();
    if (this.ids.length) {
      this.ids[0] = lastId; this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < this.ids.length && this.keys[l] < this.keys[s]) s = l;
        if (r < this.ids.length && this.keys[r] < this.keys[s]) s = r;
        if (s === i) break;
        this.#swap(i, s); i = s;
      }
    }
    return top;
  }
  #swap(a, b) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

/**
 * Road route between two world positions.
 *
 * Returns `{ points, distance, snapped }`, or null when the graph is not
 * loaded or the two ends are not connected by road (different landmasses —
 * Cayo Perico, for one). Callers should fall back to a straight line.
 */
export function route(from, to, opts = {}) {
  const g = graph;
  if (!g) return null;

  const start = nearest(g, from.x, from.y);
  const goal = nearest(g, to.x, to.y);
  if (start < 0 || goal < 0) return null;
  if (start === goal) {
    return { points: [from, to], distance: Math.hypot(to.x - from.x, to.y - from.y), snapped: 0 };
  }

  const { px, py, flags, offsets, targets, n } = g;
  const gx = px[goal], gy = py[goal];
  const h = (i) => Math.hypot(px[i] - gx, py[i] - gy);

  const gScore = new Float64Array(n).fill(Infinity);
  const cameFrom = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new Heap();

  gScore[start] = 0;
  open.push(start, h(start));

  // Bounded so a pathological request can never hang the UI thread.
  const maxExpansions = opts.maxExpansions || 250000;
  let expansions = 0;
  let found = false;

  while (open.size) {
    const current = open.pop();
    if (closed[current]) continue;
    if (current === goal) { found = true; break; }
    closed[current] = 1;
    if (++expansions > maxExpansions) break;

    for (let k = offsets[current]; k < offsets[current + 1]; k++) {
      const next = targets[k];
      if (closed[next]) continue;
      const dx = px[next] - px[current], dy = py[next] - py[current];
      let step = Math.hypot(dx, dy);
      const f = flags[next];
      if (f & FREEWAY) step *= WEIGHT_FREEWAY;
      else if (f & SLOW) step *= WEIGHT_SLOW;

      const tentative = gScore[current] + step;
      if (tentative < gScore[next]) {
        gScore[next] = tentative;
        cameFrom[next] = current;
        open.push(next, tentative + h(next));
      }
    }
  }

  if (!found) return null;

  // Walk back, converting the packed half-units to world coordinates.
  const chain = [];
  for (let i = goal; i !== -1; i = cameFrom[i]) chain.push({ x: px[i] / 2, y: py[i] / 2 });
  chain.reverse();

  // Stitch the real endpoints on — you are rarely stood exactly on a node.
  const head = chain[0];
  const tail = chain[chain.length - 1];
  const snapped = Math.max(
    Math.hypot(head.x - from.x, head.y - from.y),
    Math.hypot(tail.x - to.x, tail.y - to.y)
  );
  const points = simplify([from, ...chain, to], 4);

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return { points, distance, snapped };
}

/** Ramer–Douglas–Peucker, to keep long routes from becoming thousands of SVG points. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0, idx = -1;
    const ax = points[first].x, ay = points[first].y;
    const bx = points[last].x, by = points[last].y;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;

    for (let i = first + 1; i < last; i++) {
      const d = Math.abs((points[i].x - ax) * dy - (points[i].y - ay) * dx) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

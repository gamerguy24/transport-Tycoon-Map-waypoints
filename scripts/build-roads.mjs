/*
 * Builds public/roads.bin — a compact road graph for on-road routing.
 *
 * Source: https://github.com/DurtyFree/gta-v-data-dumps (nodes.zip), the game's
 * own vehicle path nodes. That dump is a 147 MB JSON; almost all of it is
 * per-node metadata we do not need. This keeps three things — position, road
 * class, and who connects to whom — and packs them into typed arrays, which
 * comes out around 1.5 MB.
 *
 * Node ids in the dump are per-area and connections do not name the area, so
 * links are resolved by exact position instead.
 *
 *   node --max-old-space-size=8192 scripts/build-roads.mjs [path/to/nodes.json]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || join(root, '.roads-tmp', 'nodes.json');

if (!existsSync(src)) {
  console.error(`Missing ${src}\n\nFetch it first:\n` +
    `  mkdir -p .roads-tmp && cd .roads-tmp\n` +
    `  curl -L -o nodes.zip https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/nodes.zip\n` +
    `  unzip nodes.zip`);
  process.exit(1);
}

console.log('Reading the node dump (this takes a moment — it is 147 MB) …');
const areas = JSON.parse(readFileSync(src, 'utf8'));

/* --------- pass 1: every drivable node, keyed by exact position ---------- */

const key = (p) => `${p.X},${p.Y}`;
const index = new Map();     // "x,y" -> our node index
const xs = [];
const ys = [];
const flags = [];            // bit0 freeway, bit1 gravel/backroad, bit2 junction

const FREEWAY = 1, SLOW = 2, JUNCTION = 4;

function intern(node) {
  const k = key(node.Position);
  let i = index.get(k);
  if (i === undefined) {
    i = xs.length;
    index.set(k, i);
    xs.push(node.Position.X);
    ys.push(node.Position.Y);
    flags.push(
      (node.IsFreeway ? FREEWAY : 0) |
      ((node.IsGravelRoad || node.IsBackroad) ? SLOW : 0) |
      (node.IsJunction ? JUNCTION : 0)
    );
  }
  return i;
}

let skippedWater = 0;
const edges = [];            // [a, b] pairs, deduped later

for (const area of areas) {
  for (const node of area.Nodes || []) {
    // Water nodes are boat lanes. Boats and aircraft do not need road routing
    // and including them would let the router "drive" across the ocean.
    if (node.IsOnWater) { skippedWater++; continue; }
    const a = intern(node);
    for (const link of node.ConnectedNodes || []) {
      const other = link.Node;
      if (!other || other.IsOnWater) continue;
      edges.push([a, intern(other)]);
    }
  }
}

console.log(`  ${xs.length} drivable nodes, ${edges.length} raw links (${skippedWater} water nodes skipped)`);

/* ------------- pass 2: undirected adjacency in CSR layout --------------- */

const degree = new Uint32Array(xs.length);
const seen = new Set();
const kept = [];
for (const [a, b] of edges) {
  if (a === b) continue;
  const k = a < b ? `${a}:${b}` : `${b}:${a}`;
  if (seen.has(k)) continue;
  seen.add(k);
  kept.push([a, b]);
  degree[a]++;
  degree[b]++;
}

const offsets = new Uint32Array(xs.length + 1);
for (let i = 0; i < xs.length; i++) offsets[i + 1] = offsets[i] + degree[i];

const targets = new Uint32Array(offsets[xs.length]);
const cursor = offsets.slice(0, xs.length);
for (const [a, b] of kept) {
  targets[cursor[a]++] = b;
  targets[cursor[b]++] = a;
}

console.log(`  ${kept.length} unique edges`);

/* ------------------------------- pack ----------------------------------- */

// Positions are quantised to 0.5 units. The world spans about -4300..5700 on X
// and -6200..8300 on Y, so ×2 sits well inside Int16 and costs nothing useful.
const n = xs.length;
const px = new Int16Array(n);
const py = new Int16Array(n);
let clipped = 0;
for (let i = 0; i < n; i++) {
  const qx = Math.round(xs[i] * 2);
  const qy = Math.round(ys[i] * 2);
  if (qx < -32768 || qx > 32767 || qy < -32768 || qy > 32767) clipped++;
  px[i] = Math.max(-32768, Math.min(32767, qx));
  py[i] = Math.max(-32768, Math.min(32767, qy));
}
if (clipped) console.warn(`  WARNING: ${clipped} node(s) clipped by Int16 packing`);

const header = new Uint32Array([0x54544d52, 1, n, targets.length]); // "TTMR", v1

// The flags block is one byte per node, so it usually leaves the cursor on an
// odd offset. The reader maps the Uint32 blocks as zero-copy views, which needs
// 4-byte alignment — pad here or those views run off the end of the buffer.
const beforePad = 16 + px.byteLength + py.byteLength + n;
const pad = (4 - (beforePad % 4)) % 4;

const parts = [
  Buffer.from(header.buffer),
  Buffer.from(px.buffer),
  Buffer.from(py.buffer),
  Buffer.from(new Uint8Array(flags).buffer),
  Buffer.alloc(pad),
  Buffer.from(offsets.buffer),
  Buffer.from(targets.buffer)
];
const out = Buffer.concat(parts);
writeFileSync(join(root, 'public', 'roads.bin'), out);

console.log(`\nWrote public/roads.bin — ${(out.length / 1048576).toFixed(2)} MB`);
console.log(`  ${n} nodes · ${targets.length / 2} edges`);

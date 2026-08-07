/*
 * map.js — the interactive San Andreas / Cayo Perico map.
 *
 * Pure SVG. World coordinates are converted straight into viewBox units so a
 * marker's position in the SVG *is* the position you would drive to; there is no
 * second source of truth to keep in sync.
 */

import { WORLD, SAN_ANDREAS, CAYO_PERICO, ALAMO_SEA, LS_URBAN, HIGHWAYS, CATEGORIES } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** world -> viewBox units (y is flipped: game north is up) */
export const toView = (x, y) => ({ vx: x - WORLD.xMin, vy: WORLD.yMax - y });
/** viewBox units -> world */
export const toWorld = (vx, vy) => ({ x: vx + WORLD.xMin, y: WORLD.yMax - vy });

const FULL = {
  x: 0,
  y: 0,
  w: WORLD.xMax - WORLD.xMin,
  h: WORLD.yMax - WORLD.yMin
};

const el = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
};

const pathFrom = (points, close) => {
  const d = points.map(([x, y], i) => {
    const { vx, vy } = toView(x, y);
    return `${i ? 'L' : 'M'}${vx.toFixed(0)} ${vy.toFixed(0)}`;
  }).join(' ');
  return close ? d + ' Z' : d;
};

export class TycoonMap {
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.view = { ...FULL };
    this.markers = new Map();   // id -> { location, node }
    this.selectedId = null;
    this.tripIds = [];
    this.glyphScale = 1;        // counter-scale applied to pins/arrows on zoom

    this.svg = el('svg', {
      class: 'map-svg',
      viewBox: `${FULL.x} ${FULL.y} ${FULL.w} ${FULL.h}`,
      preserveAspectRatio: 'xMidYMid meet'
    });
    root.appendChild(this.svg);

    this.#buildBase();
    this.layerRoute   = el('g', { class: 'layer-route' });
    this.layerMarkers = el('g', { class: 'layer-markers' });
    this.layerLive    = el('g', { class: 'layer-live' });
    this.svg.append(this.layerRoute, this.layerMarkers, this.layerLive);

    this.#buildLive();
    this.#wireInteraction();
  }

  /* ------------------------------- base map ------------------------------ */

  #buildBase() {
    const defs = el('defs');
    const glow = el('filter', { id: 'mapGlow', x: '-30%', y: '-30%', width: '160%', height: '160%' });
    glow.appendChild(el('feGaussianBlur', { stdDeviation: '55', result: 'b' }));
    const merge = el('feMerge');
    merge.appendChild(el('feMergeNode', { in: 'b' }));
    merge.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
    glow.appendChild(merge);
    defs.appendChild(glow);
    this.svg.appendChild(defs);

    const base = el('g', { class: 'layer-base' });

    base.appendChild(el('rect', { class: 'map-ocean', x: FULL.x, y: FULL.y, width: FULL.w, height: FULL.h }));

    // Latitude / longitude grid every 1000 world units.
    const grid = el('g', { class: 'map-grid' });
    for (let x = Math.ceil(WORLD.xMin / 1000) * 1000; x < WORLD.xMax; x += 1000) {
      const { vx } = toView(x, 0);
      grid.appendChild(el('line', { x1: vx, y1: FULL.y, x2: vx, y2: FULL.y + FULL.h }));
    }
    for (let y = Math.ceil(WORLD.yMin / 1000) * 1000; y < WORLD.yMax; y += 1000) {
      const { vy } = toView(0, y);
      grid.appendChild(el('line', { x1: FULL.x, y1: vy, x2: FULL.x + FULL.w, y2: vy }));
    }
    base.appendChild(grid);

    base.appendChild(el('path', { class: 'map-land', filter: 'url(#mapGlow)', d: pathFrom(SAN_ANDREAS, true) }));
    base.appendChild(el('path', { class: 'map-land', d: pathFrom(CAYO_PERICO, true) }));
    base.appendChild(el('path', { class: 'map-urban', d: pathFrom(LS_URBAN, true) }));
    base.appendChild(el('path', { class: 'map-water', d: pathFrom(ALAMO_SEA, true) }));

    const roads = el('g', { class: 'map-roads' });
    for (const line of HIGHWAYS) roads.appendChild(el('path', { d: pathFrom(line, false) }));
    base.appendChild(roads);

    const label = (text, x, y, cls) => {
      const { vx, vy } = toView(x, y);
      const t = el('text', { class: 'map-label ' + cls, x: vx, y: vy });
      t.textContent = text;
      return t;
    };
    base.appendChild(label('SAN ANDREAS', 300, 2200, 'lbl-region'));
    base.appendChild(label('BLAINE COUNTY', 1500, 5300, 'lbl-sub'));
    base.appendChild(label('LOS SANTOS', -200, -1500, 'lbl-sub'));
    base.appendChild(label('CAYO PERICO', 4850, -5300, 'lbl-sub'));
    base.appendChild(label('PACIFIC OCEAN', -3500, -2200, 'lbl-sea'));

    this.svg.appendChild(base);
  }

  #buildLive() {
    this.playerNode = el('g', { class: 'live-player', visibility: 'hidden' });
    this.playerInner = el('g', { class: 'live-inner' });
    this.playerInner.appendChild(el('circle', { class: 'live-player-halo', r: 190 }));
    this.playerInner.appendChild(el('path', { class: 'live-player-arrow', d: 'M0 -150 L105 130 L0 70 L-105 130 Z' }));
    this.playerNode.appendChild(this.playerInner);
    this.layerLive.appendChild(this.playerNode);

    this.wpNode = el('g', { class: 'live-waypoint', visibility: 'hidden' });
    this.wpInner = el('g', { class: 'live-inner' });
    this.wpInner.appendChild(el('path', { d: 'M-120 -120 L120 120 M120 -120 L-120 120' }));
    this.wpInner.appendChild(el('circle', { r: 170, fill: 'none' }));
    this.wpNode.appendChild(this.wpInner);
    this.layerLive.appendChild(this.wpNode);
  }

  /* -------------------------------- markers ------------------------------ */

  setLocations(locations) {
    this.layerMarkers.textContent = '';
    this.markers.clear();
    for (const loc of locations) this.#addMarker(loc);
  }

  #addMarker(loc) {
    const { vx, vy } = toView(loc.x, loc.y);
    const cat = CATEGORIES[loc.c] || CATEGORIES.landmark;

    const g = el('g', { class: 'marker cat-' + loc.c, transform: `translate(${vx} ${vy})` });
    // Inner group is counter-scaled on zoom so pins keep a constant screen size.
    const inner = el('g', { class: 'marker-inner', transform: `scale(${this.glyphScale})` });
    inner.appendChild(el('circle', { class: 'marker-hit', r: 260 }));
    inner.appendChild(el('circle', { class: 'marker-ring', r: 150 }));
    inner.appendChild(el('circle', { class: 'marker-dot', r: 78, fill: cat.color }));

    const label = el('text', { class: 'marker-label', x: 0, y: -230 });
    label.textContent = loc.n;
    inner.appendChild(label);
    g.appendChild(inner);

    g.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.handlers.onSelect?.(loc.id);
    });
    g.addEventListener('mouseenter', () => this.handlers.onHover?.(loc));
    g.addEventListener('mouseleave', () => this.handlers.onHover?.(null));

    this.layerMarkers.appendChild(g);
    this.markers.set(loc.id, { location: loc, node: g });
  }

  setSelected(id) {
    if (this.selectedId && this.markers.has(this.selectedId)) {
      this.markers.get(this.selectedId).node.classList.remove('is-selected');
    }
    this.selectedId = id;
    const entry = id && this.markers.get(id);
    if (entry) {
      entry.node.classList.add('is-selected');
      this.layerMarkers.appendChild(entry.node); // raise to top
    }
    this.#redrawRoute();
  }

  setTrip(ids) {
    this.tripIds = ids;
    for (const [id, entry] of this.markers) {
      entry.node.classList.toggle('is-trip', ids.includes(id));
    }
    this.#redrawRoute();
  }

  #redrawRoute() {
    this.layerRoute.textContent = '';
    const points = [];
    if (this.player) points.push([this.player.x, this.player.y]);
    for (const id of this.tripIds) {
      const entry = this.markers.get(id);
      if (entry) points.push([entry.location.x, entry.location.y]);
    }
    if (points.length < 2) return;
    this.layerRoute.appendChild(el('path', {
      class: 'route-line',
      d: pathFrom(points, false),
      'stroke-width': 22 * this.glyphScale,
      'stroke-dasharray': `${90 * this.glyphScale} ${70 * this.glyphScale}`
    }));
  }

  /* --------------------------------- live -------------------------------- */

  setPlayer(pos) {
    this.player = pos;
    if (!pos) { this.playerNode.setAttribute('visibility', 'hidden'); return; }
    const { vx, vy } = toView(pos.x, pos.y);
    this.playerNode.setAttribute('transform', `translate(${vx} ${vy}) rotate(${-(pos.h || 0)})`);
    this.playerNode.setAttribute('visibility', 'visible');
    this.#redrawRoute();
  }

  setGameWaypoint(wp) {
    if (!wp) { this.wpNode.setAttribute('visibility', 'hidden'); return; }
    const { vx, vy } = toView(wp.x, wp.y);
    this.wpNode.setAttribute('transform', `translate(${vx} ${vy})`);
    this.wpNode.setAttribute('visibility', 'visible');
  }

  /* ------------------------------ interaction ---------------------------- */

  #applyView() {
    const v = this.view;
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);

    // Keep marker glyphs and text a constant on-screen size as we zoom in.
    const scale = v.w / FULL.w;
    if (Math.abs(scale - this.glyphScale) > 0.001) {
      this.glyphScale = scale;
      const transform = `scale(${scale})`;
      for (const { node } of this.markers.values()) {
        node.firstChild.setAttribute('transform', transform);
      }
      this.playerInner.setAttribute('transform', transform);
      this.wpInner.setAttribute('transform', transform);
      this.#redrawRoute();
    }
  }

  #clamp() {
    const v = this.view;
    const minW = FULL.w / 14;
    v.w = Math.min(FULL.w, Math.max(minW, v.w));
    v.h = v.w * (FULL.h / FULL.w);
    v.x = Math.min(FULL.w - v.w, Math.max(0, v.x));
    v.y = Math.min(FULL.h - v.h, Math.max(0, v.y));
  }

  #eventToView(ev) {
    const rect = this.svg.getBoundingClientRect();
    // preserveAspectRatio="meet" letterboxes; recover the drawn area.
    const scale = Math.min(rect.width / this.view.w, rect.height / this.view.h);
    const drawnW = this.view.w * scale;
    const drawnH = this.view.h * scale;
    const offX = (rect.width - drawnW) / 2;
    const offY = (rect.height - drawnH) / 2;
    return {
      vx: this.view.x + (ev.clientX - rect.left - offX) / scale,
      vy: this.view.y + (ev.clientY - rect.top - offY) / scale
    };
  }

  #wireInteraction() {
    this.svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const before = this.#eventToView(ev);
      const factor = ev.deltaY > 0 ? 1.25 : 0.8;
      this.view.w *= factor;
      this.#clamp();
      const after = this.#eventToView(ev);
      this.view.x += before.vx - after.vx;
      this.view.y += before.vy - after.vy;
      this.#clamp();
      this.#applyView();
    }, { passive: false });

    let dragging = null;
    this.svg.addEventListener('pointerdown', (ev) => {
      dragging = { ...this.#eventToView(ev), moved: false };
      this.svg.setPointerCapture(ev.pointerId);
    });
    this.svg.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const now = this.#eventToView(ev);
      const dx = dragging.vx - now.vx;
      const dy = dragging.vy - now.vy;
      if (Math.abs(dx) + Math.abs(dy) > this.view.w * 0.004) dragging.moved = true;
      this.view.x += dx;
      this.view.y += dy;
      this.#clamp();
      this.#applyView();
    });
    this.svg.addEventListener('pointerup', (ev) => {
      const wasDrag = dragging?.moved;
      dragging = null;
      this.svg.releasePointerCapture?.(ev.pointerId);
      if (!wasDrag) {
        const { vx, vy } = this.#eventToView(ev);
        this.handlers.onMapClick?.(toWorld(vx, vy));
      }
    });
    this.svg.addEventListener('pointercancel', () => { dragging = null; });
  }

  /** Zoom the view onto a world position. `span` is the width in world units. */
  focus(x, y, span = 3000) {
    const { vx, vy } = toView(x, y);
    this.view.w = span;
    this.#clamp();
    this.view.x = vx - this.view.w / 2;
    this.view.y = vy - this.view.h / 2;
    this.#clamp();
    this.#applyView();
  }

  reset() {
    this.view = { ...FULL };
    this.#applyView();
  }
}

/*
 * minimap.js — a GTA-style minimap that lives on top of the game.
 *
 * This is the piece that stays on screen once the main UI is hidden. It rides
 * the same tiles and the same projection as the big map, but it is not a map
 * you browse: it locks to the player, and the destination it points at is
 * whatever you picked in the UI.
 *
 * Rotation works the way the game's own minimap does — the tile and marker
 * panes are rotated by the player's heading and the arrow stays pointing up.
 * That means Leaflet's own hit-testing would be wrong, so the minimap is
 * entirely non-interactive and all input is handled on the frame around it.
 */

import { CRS, gameLatLng, makeTileLayer } from './map.js';
import { CATEGORIES } from './data.js';

const SIZES = { s: 190, m: 250, l: 320 };

export class MiniMap {
  constructor(root, opts = {}) {
    this.root = root;                       // the outer frame
    this.viewport = root.querySelector('.mm-viewport');
    this.canvas = root.querySelector('.mm-canvas');
    this.opts = { zoom: 6, rotate: true, size: 'm', corner: 'br', ...opts };
    this.locations = [];
    this.markers = new Map();
    this.target = null;
    this.player = null;

    this.map = L.map(this.canvas, {
      crs: CRS,
      renderer: L.svg({ padding: 1 }),
      zoomControl: false,
      attributionControl: false,
      minZoom: 3,
      maxZoom: 9,
      zoomSnap: 1,
      // Every interaction is off: the frame owns input, and a rotated Leaflet
      // container hit-tests in the wrong place anyway.
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      inertia: false,
      fadeAnimation: false,
      zoomAnimation: false
    });

    makeTileLayer().addTo(this.map);
    this.layerPins = L.layerGroup().addTo(this.map);
    this.layerRoute = L.layerGroup().addTo(this.map);

    this.playerDot = L.marker(gameLatLng(0, 0), {
      interactive: false,
      icon: L.divIcon({ className: 'mm-player', html: '<i></i>', iconSize: [20, 20], iconAnchor: [10, 10] })
    }).addTo(this.map);

    this.map.setView(gameLatLng(0, 0), this.opts.zoom);
    this.applySize();
  }

  /* ------------------------------- geometry ------------------------------ */

  applySize() {
    const px = SIZES[this.opts.size] || SIZES.m;
    this.root.style.setProperty('--mm-size', px + 'px');
    this.root.dataset.corner = this.opts.corner;
    // A rotating square must be big enough that its corners never expose the
    // edge of the viewport: √2 × the visible size, centred.
    const inner = Math.ceil(px * Math.SQRT2);
    this.canvas.style.width = inner + 'px';
    this.canvas.style.height = inner + 'px';
    this.canvas.style.margin = `${-(inner - px) / 2}px 0 0 ${-(inner - px) / 2}px`;
    this.map.invalidateSize({ animate: false });
    this.recentre();
  }

  setZoom(z) {
    this.opts.zoom = Math.max(4, Math.min(9, z));
    this.map.setZoom(this.opts.zoom, { animate: false });
    this.recentre();
    return this.opts.zoom;
  }

  setRotate(on) {
    this.opts.rotate = on;
    this.#applyRotation();
  }

  #applyRotation() {
    const deg = this.opts.rotate && this.player ? -(this.player.h || 0) : 0;
    this.canvas.style.transform = `rotate(${deg}deg)`;
    // The arrow lives inside the rotating canvas, so undo the rotation on it —
    // that is what keeps "forward" pointing up the screen.
    this.canvas.style.setProperty('--mm-counter', `${-deg}deg`);
    this.root.classList.toggle('is-rotating', this.opts.rotate);
  }

  recentre() {
    if (!this.player) return;
    this.map.setView(gameLatLng(this.player.x, this.player.y), this.opts.zoom, { animate: false });
  }

  /* -------------------------------- content ------------------------------ */

  setLocations(locations) {
    this.locations = locations;
    this.#rebuildPins();
  }

  /** Only pins within range are drawn — the whole catalogue would be mush. */
  #rebuildPins() {
    this.layerPins.clearLayers();
    this.markers.clear();
    if (!this.player) return;

    const range = 3200;
    for (const loc of this.locations) {
      if (Math.abs(loc.x - this.player.x) > range || Math.abs(loc.y - this.player.y) > range) continue;
      const cat = CATEGORIES[loc.c] || CATEGORIES.landmark;
      const marker = L.circleMarker(gameLatLng(loc.x, loc.y), {
        radius: 4,
        weight: 1.5,
        color: 'rgba(0,0,0,.8)',
        fillColor: cat.color,
        fillOpacity: 1,
        interactive: false,
        className: 'mm-pin'
      }).addTo(this.layerPins);
      this.markers.set(loc.id, marker);
    }

    if (this.target) {
      const marker = this.markers.get(this.target.id);
      if (marker) marker.setStyle({ radius: 7, color: '#ffb84d', weight: 2.5 });
    }
  }

  setPlayer(pos) {
    const first = !this.player;
    const moved = !this.player || Math.hypot(pos.x - this.player.x, pos.y - this.player.y) > 120;
    this.player = pos;
    this.playerDot.setLatLng(gameLatLng(pos.x, pos.y));
    this.recentre();
    this.#applyRotation();
    if (first || moved) this.#rebuildPins();
    this.#drawTarget();
  }

  setTarget(loc) {
    this.target = loc;
    this.#rebuildPins();
    this.#drawTarget();
  }

  /**
   * The target readout. When it is off the edge of the minimap we clamp a
   * chevron to the rim pointing at it, which is the only way a 250px window
   * can tell you about something 6 km away.
   */
  #drawTarget() {
    const label = this.root.querySelector('.mm-target');
    const chevron = this.root.querySelector('.mm-chevron');
    this.layerRoute.clearLayers();

    if (!this.target || !this.player) {
      label.hidden = true;
      chevron.hidden = true;
      return;
    }

    const dx = this.target.x - this.player.x;
    const dy = this.target.y - this.player.y;
    const dist = Math.hypot(dx, dy);

    label.hidden = false;
    label.querySelector('.mm-target-name').textContent = this.target.n;
    label.querySelector('.mm-target-dist').textContent =
      dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m';

    L.polyline(
      [gameLatLng(this.player.x, this.player.y), gameLatLng(this.target.x, this.target.y)],
      { color: '#ffb84d', weight: 2, opacity: .85, dashArray: '5 5', interactive: false }
    ).addTo(this.layerRoute);

    // Is it inside the visible window?
    const here = this.map.latLngToContainerPoint(gameLatLng(this.player.x, this.player.y));
    const there = this.map.latLngToContainerPoint(gameLatLng(this.target.x, this.target.y));
    const px = Math.hypot(there.x - here.x, there.y - here.y);
    const radius = (SIZES[this.opts.size] || SIZES.m) / 2;

    if (px < radius - 14) { chevron.hidden = true; return; }

    // Screen bearing: north-up unless the map is rotating with the player.
    let bearing = Math.atan2(dx, dy) * 180 / Math.PI;
    if (this.opts.rotate) bearing -= (this.player.h || 0);
    chevron.hidden = false;
    chevron.style.transform =
      `translate(-50%, -50%) rotate(${bearing}deg) translateY(${-(radius - 13)}px)`;
  }
}

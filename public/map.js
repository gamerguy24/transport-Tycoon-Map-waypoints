/*
 * map.js — the real San Andreas map, on tiles.
 *
 * Renders the actual GTA V / Transport Tycoon map imagery with Leaflet instead
 * of a drawn silhouette. Tiles live in /tiles (see scripts/fetch-tiles.mjs).
 *
 * The projection is the one the community live map uses, so a pin placed at a
 * game coordinate lands exactly where that coordinate is in game:
 *
 *     pixelX = 2^zoom * ( 0.005175 * gameX + 34.38     )
 *     pixelY = 2^zoom * (-0.005173 * gameY + 46.79355  )
 *
 * with 288px tiles named {z}_{x}_{y}.jpg. Credit: ttmap by Nova+
 * (https://github.com/supernovaplus/ttmap), map data by glitchdetector.
 */

import { CATEGORIES } from './data.js';

const TILE_SIZE = 288;
const MIN_ZOOM = 3;
const MAX_NATIVE_ZOOM = 7;
const MAX_ZOOM = 9;              // beyond 7 Leaflet upscales the z7 tiles

const T = { a: 0.005175, b: 34.38, c: -0.005173, d: 46.79355 };

/* The full pyramid spans these game coordinates — derived from the transform,
   used to stop the player panning off into empty grey. */
const span = 72;                 // pixel extent at zoom 0, i.e. 2^z * 72 total
const worldX = [-T.b / T.a, (span - T.b) / T.a];
const worldY = [(span - T.d) / T.c, -T.d / T.c];

/**
 * Game coords are carried as Leaflet LatLng with lat = X and lng = Y. That is
 * what the upstream projection expects and it keeps every call site honest:
 * anything going into Leaflet is `latLng(x, y)`.
 */
export const CRS = L.extend({}, L.CRS.Simple, {
  projection: {
    project: (latlng) => new L.Point(latlng.lat, latlng.lng),
    unproject: (point) => new L.LatLng(point.x, point.y),
    bounds: new L.Bounds([-180, -90], [180, 90])
  },
  transformation: new L.Transformation(T.a, T.b, T.c, T.d)
});

export const gameLatLng = (x, y) => L.latLng(x, y);

/*
 * Where the tiles come from.
 *
 * Self-hosted (`./tiles/`) is the default and the fast path. The CDN fallback
 * exists because the imagery is bulk art that not every deployment will carry —
 * a git-based Cloudflare deploy of a checkout without `npm run tiles`, say. The
 * app switching itself over beats showing the player an empty rectangle.
 *
 * Override with ?tiles=<url template> if you host your own.
 */
export const TILE_LOCAL = './tiles/{z}_{x}_{y}.jpg';
export const TILE_CDN =
  'https://cdn.jsdelivr.net/gh/supernovaplus/ttmap@master/images/maps/dark-mode-tiles/{z}_{x}_{y}.jpg';

const tileLayers = new Set();
let tileBase = new URL(location.href).searchParams.get('tiles') || TILE_LOCAL;

/**
 * Repoint every tile layer at a different source.
 *
 * `setUrl` alone is not enough: the failed tiles from the previous source are
 * "loaded" as far as Leaflet is concerned (they resolved to errorTileUrl) and
 * survive in the zoom-animation container, so the map keeps showing blanks.
 * Detaching and re-attaching the layer throws all of that away.
 */
export function setTileBase(url) {
  tileBase = url;
  for (const layer of tileLayers) {
    const owner = layer._ttMap;
    layer.setUrl(url, true);
    if (owner) { owner.removeLayer(layer); owner.addLayer(layer); }
  }
}

export const getTileBase = () => tileBase;

/** One definition of the tile layer, shared by the big map and the minimap. */
export function makeTileLayer() {
  const layer = L.tileLayer(tileBase, {
    tileSize: TILE_SIZE,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxNativeZoom: MAX_NATIVE_ZOOM,
    minNativeZoom: MIN_ZOOM,
    noWrap: true,
    keepBuffer: 3,
    className: 'tt-tiles',
    // Without explicit bounds Leaflet asks for tiles beyond the edge of the
    // pyramid and the viewport fills with broken images.
    bounds: L.latLngBounds(gameLatLng(-6566, -4735), gameLatLng(7166, 8906)),
    errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  });
  // Remember which map it is on so setTileBase can re-attach it cleanly.
  layer.on('add', (ev) => { layer._ttMap = ev.target._map; });
  tileLayers.add(layer);
  return layer;
}

/**
 * Pick a working tile source before the player notices. Tries the current base,
 * then the CDN. Resolves to the base that worked, or null if neither did.
 */
/**
 * Attach georeferenced patch images over the tiles.
 *
 * Each returns its Leaflet layer so calibration can move it live. Images that
 * fail to load are skipped rather than left as broken boxes on the map — the
 * overlay list is allowed to name art that does not exist yet.
 */
export function addOverlays(map, overlays, { pane = 'ttOverlay', zIndex = 250 } = {}) {
  if (!map.getPane(pane)) {
    map.createPane(pane);
    map.getPane(pane).style.zIndex = zIndex;
    map.getPane(pane).style.pointerEvents = 'none';
  }

  const made = new Map();
  for (const o of overlays) {
    if (o.enabled === false) continue;
    const layer = L.imageOverlay(o.url, boundsOf(o.bounds), {
      opacity: o.opacity ?? 1,
      pane,
      interactive: false,
      className: 'tt-overlay'
    });
    // Only attach once we know the image exists, and never attach it stretched:
    // hand-written bounds will not match the image's aspect ratio, and a map
    // squashed to a smear is worse than the stale tiles underneath.
    const probe = new Image();
    probe.onload = () => {
      lockAspect(o, probe.naturalWidth / probe.naturalHeight);
      layer.setBounds(boundsOf(o.bounds));
      layer.addTo(map);
    };
    probe.src = o.url;
    made.set(o.id, layer);
  }
  return made;
}

/**
 * Force an overlay's world bounds to the image's own aspect ratio, keeping the
 * centre and the width. Mutates `o.bounds`, so both maps and the calibration
 * panel stay in agreement.
 */
export function lockAspect(o, imageAspect) {
  if (!Number.isFinite(imageAspect) || imageAspect <= 0) return o.bounds;
  const b = o.bounds;
  const width = Math.abs(b.x2 - b.x1);
  const height = width / imageAspect;
  const cy = (b.y1 + b.y2) / 2;
  // y1 is the northern edge, so it is the larger world Y.
  b.y1 = cy + height / 2;
  b.y2 = cy - height / 2;
  o.aspect = imageAspect;
  return b;
}

export const boundsOf = (b) => L.latLngBounds(gameLatLng(b.x1, b.y1), gameLatLng(b.x2, b.y2));

export function resolveTileBase() {
  const probe = (base) => new Promise((resolve) => {
    const url = base.replace('{z}', '3').replace('{x}', '0').replace('{y}', '0');
    const img = new Image();
    const done = (ok) => { img.onload = img.onerror = null; resolve(ok); };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    // A hung request should not leave the map blank forever.
    setTimeout(() => done(false), 8000);
    img.src = url;
  });

  return (async () => {
    if (await probe(tileBase)) return tileBase;
    if (tileBase !== TILE_CDN && await probe(TILE_CDN)) {
      setTileBase(TILE_CDN);
      return TILE_CDN;
    }
    return null;
  })();
}

export class TycoonMap {
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.markers = new Map();
    this.selectedId = null;
    this.tripIds = [];
    this.player = null;

    this.map = L.map(root, {
      crs: CRS,
      // SVG, not canvas: markers become real DOM nodes, so they can be styled
      // with the rest of the HUD and hit-tested individually.
      renderer: L.svg(),
      zoomControl: false,
      attributionControl: false,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomSnap: 0.5,
      wheelPxPerZoomLevel: 90,
      maxBounds: L.latLngBounds(
        gameLatLng(worldX[0], worldY[0]),
        gameLatLng(worldX[1], worldY[1])
      ),
      maxBoundsViscosity: 0.85
    });

    makeTileLayer().addTo(this.map);

    this.layerRoute   = L.layerGroup().addTo(this.map);
    this.layerMarkers = L.layerGroup().addTo(this.map);
    this.layerLive    = L.layerGroup().addTo(this.map);

    this.reset();
    this.#buildLive();

    // Handle for tests and for poking at the projection from the console.
    window.__ttmap = this.map;

    this.map.on('click', (ev) => {
      this.handlers.onMapClick?.({ x: ev.latlng.lat, y: ev.latlng.lng });
    });
    this.map.on('zoomend', () => this.#scaleMarkers());
  }

  /* --------------------------------- live -------------------------------- */

  #buildLive() {
    this.playerMarker = L.marker(gameLatLng(0, 0), {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: 'live-player-icon',
        html: '<span class="lp-halo"></span><span class="lp-arrow"></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    });

    this.wpMarker = L.marker(gameLatLng(0, 0), {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: 'live-waypoint-icon',
        html: '<span>✕</span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    });
  }

  setPlayer(pos) {
    this.player = pos;
    if (!pos) { this.layerLive.removeLayer(this.playerMarker); return; }
    this.playerMarker.setLatLng(gameLatLng(pos.x, pos.y));
    if (!this.layerLive.hasLayer(this.playerMarker)) this.playerMarker.addTo(this.layerLive);
    const arrow = this.playerMarker.getElement()?.querySelector('.lp-arrow');
    if (arrow) arrow.style.transform = `rotate(${pos.h || 0}deg)`;
    this.#redrawRoute();
  }

  setGameWaypoint(wp) {
    if (!wp) { this.layerLive.removeLayer(this.wpMarker); return; }
    this.wpMarker.setLatLng(gameLatLng(wp.x, wp.y));
    if (!this.layerLive.hasLayer(this.wpMarker)) this.wpMarker.addTo(this.layerLive);
  }

  /* -------------------------------- markers ------------------------------ */

  setLocations(locations) {
    this.layerMarkers.clearLayers();
    this.markers.clear();
    for (const loc of locations) this.#addMarker(loc);
    this.#scaleMarkers();
    this.setSelected(this.selectedId);
    this.setTrip(this.tripIds);
  }

  #addMarker(loc) {
    const cat = CATEGORIES[loc.c] || CATEGORIES.landmark;
    const marker = L.circleMarker(gameLatLng(loc.x, loc.y), {
      radius: 5,
      color: 'rgba(0,0,0,.75)',
      weight: 1.5,
      fillColor: cat.color,
      fillOpacity: 1,
      className: 'tt-marker cat-' + loc.c,
      bubblingMouseEvents: false
    });

    marker.bindTooltip(loc.n, { direction: 'top', offset: [0, -8], className: 'tt-tip' });
    marker.on('click', (ev) => {
      L.DomEvent.stop(ev);
      this.handlers.onSelect?.(loc.id);
    });
    marker.on('mouseover', () => this.handlers.onHover?.(loc));
    marker.on('mouseout', () => this.handlers.onHover?.(null));

    marker.addTo(this.layerMarkers);
    this.markers.set(loc.id, { location: loc, marker });
  }

  setSelected(id) {
    const previous = this.selectedId && this.markers.get(this.selectedId);
    if (previous) previous.marker.setStyle({ color: 'rgba(0,0,0,.75)', weight: 1.5 });

    this.selectedId = id;
    const entry = id && this.markers.get(id);
    if (entry) {
      entry.marker.setStyle({ color: '#38d6b0', weight: 3 });
      entry.marker.bringToFront();
    }
    this.#scaleMarkers();
    this.#redrawRoute();
  }

  setTrip(ids) {
    this.tripIds = ids || [];
    this.#redrawRoute();
  }

  /** Road-following polyline from the router, or null to fall back to lines. */
  setRoutePath(points) {
    this.routePath = points;
    this.#redrawRoute();
  }

  #redrawRoute() {
    this.layerRoute.clearLayers();

    // A real road route wins; the dashed straight line is only the fallback for
    // when there is no road between the two ends (or the graph has not loaded).
    if (this.routePath && this.routePath.length > 1) {
      L.polyline(this.routePath.map((p) => gameLatLng(p.x, p.y)), {
        color: '#ffb84d', weight: 3.5, opacity: .95, lineJoin: 'round', lineCap: 'round',
        interactive: false
      }).addTo(this.layerRoute);
      return;
    }

    const points = [];
    if (this.player) points.push(gameLatLng(this.player.x, this.player.y));
    for (const id of this.tripIds) {
      const entry = this.markers.get(id);
      if (entry) points.push(gameLatLng(entry.location.x, entry.location.y));
    }
    if (points.length < 2) return;
    L.polyline(points, {
      color: '#ffb84d', weight: 2.5, opacity: .9, dashArray: '7 6', interactive: false
    }).addTo(this.layerRoute);
  }

  /* ------------------------------- viewport ------------------------------ */

  /** `span` is the width in game units we want roughly in view. */
  focus(x, y, gameSpan = 3000) {
    const half = gameSpan / 2;
    this.map.fitBounds(
      L.latLngBounds(gameLatLng(x - half, y - half), gameLatLng(x + half, y + half)),
      { animate: false, maxZoom: MAX_NATIVE_ZOOM }
    );
  }

  /** Frame the mainland. Cayo Perico is off to the south-east; pan or search. */
  reset() {
    this.map.fitBounds(
      L.latLngBounds(gameLatLng(-3600, -4000), gameLatLng(4400, 8100)),
      { animate: false, padding: [6, 6] }
    );
  }

  /** Pins shrink when zoomed out so dense Los Santos stays readable. */
  #scaleMarkers() {
    const z = this.map.getZoom();
    const r = z <= 3.5 ? 3 : z <= 4.5 ? 4 : z <= 5.5 ? 5 : z <= 6.5 ? 6 : 7;
    for (const [id, { marker }] of this.markers) {
      marker.setRadius(id === this.selectedId ? r + 4 : r);
    }
  }

  /** Leaflet needs telling when its container changes size. */
  invalidate() {
    this.map.invalidateSize({ animate: false });
  }
}

/*
 * game.js — the bridge between this web app and the Transport Tycoon game client.
 *
 * How Tycoon User Applications work (see the in-game readme served at
 * http://server.tycoon.community:30125/status/config/user-apps):
 *
 *   - The player presses F1, types this app's URL, and the client loads it in an
 *     iframe inside the game window.
 *   - The app SENDS commands with  window.parent.postMessage({ type, ...args }, '*')
 *   - The app RECEIVES state with  window.addEventListener('message', e => e.data.data)
 *     where `data` is a flat bag of changed key/value pairs. Ask for the whole
 *     cache with { type: 'getData' }.
 *
 * Nothing here talks to any server — the app is 100% static and offline-capable
 * once the page has loaded.
 */

/** Send a raw command object to the game client. */
export function send(msg) {
  try {
    window.parent.postMessage(msg, '*');
  } catch (err) {
    console.warn('[tt-map] postMessage failed', err);
  }
}

/* ---- Commands (thin, typed wrappers over the documented command list) ---- */

export const cmd = {
  setWaypoint: (x, y)          => send({ type: 'setWaypoint', x, y }),
  sendCommand: (command)       => send({ type: 'sendCommand', command }),
  notification: (text)         => send({ type: 'notification', text }),
  info: (text, time = 8)       => send({ type: 'info', text, time }),
  popup: (title, text)         => send({ type: 'popup', title, text }),
  oneliner: (text)             => send({ type: 'oneliner', text }),
  message: (text)              => send({ type: 'message', text }),
  sfx: (id)                    => send({ type: 'sfx', sfx: id }),
  getData: ()                  => send({ type: 'getData' }),
  getNamedData: (keys)         => send({ type: 'getNamedData', keys }),
  close: ()                    => send({ type: 'close' }),
  pin: ()                      => send({ type: 'pin' }),
  shareLocalData: (key, value) => send({ type: 'shareLocalData', key, value }),
  shareServerData: (key, value)=> send({ type: 'shareServerData', key, value }),
  registerTrigger: (trigger, name) => send({ type: 'registerTrigger', trigger, name }),

  /* Map blips */
  buildBlip: (o) => send({
    type: 'buildBlip',
    id: o.id, x: o.x, y: o.y,
    sprite: o.sprite ?? 1,
    color: o.color ?? 0,
    alwaysVisible: o.alwaysVisible ?? true,
    route: o.route ?? false,
    ticked: o.ticked ?? false,
    name: o.name ?? 'Waypoint'
  }),
  removeBlip: (id)             => send({ type: 'removeBlip', id }),
  setBlipPosition: (id, x, y)  => send({ type: 'setBlipPosition', id, x, y }),
  setBlipRoute: (id, route)    => send({ type: 'setBlipRoute', id, route }),
  setBlipName: (id, name)      => send({ type: 'setBlipName', id, name }),
  setBlipColour: (id, color)   => send({ type: 'setBlipColour', id, color }),
  setBlipSprite: (id, sprite)  => send({ type: 'setBlipSprite', id, sprite }),
  showTickOnBlip: (id, ticked) => send({ type: 'showTickOnBlip', id, ticked }),
  showNumberOnBlip: (id, number) => send({ type: 'showNumberOnBlip', id, number })
};

/* ------------------------------ State store ------------------------------ */

/**
 * Live mirror of the game's data cache. Keys are documented in the user-apps
 * readme (user_id, name, job_title, wallet, bank, pos_x, pos_y, pos_h, zone,
 * street, vehicleName, fuel, waypoint_x, focused, tabbed, trigger_*, ...).
 */
export const state = Object.create(null);

const listeners = new Set();
const triggerHandlers = new Map();

/** Subscribe to state changes. `fn(changedKeys, state)`. Returns unsubscribe. */
export function onData(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Subscribe to a keybind trigger, e.g. onTrigger('square', fn). */
export function onTrigger(name, fn) {
  triggerHandlers.set('trigger_' + name, fn);
}

/** True when running inside the game (i.e. embedded in the client's iframe). */
export const inGame = window.parent !== window;

window.addEventListener('message', (event) => {
  const payload = event.data;
  if (!payload || typeof payload !== 'object' || !payload.data) return;

  const changed = [];
  for (const key in payload.data) {
    const value = payload.data[key];
    if (key.startsWith('trigger_')) {
      const handler = triggerHandlers.get(key);
      if (handler) handler(value);
      continue; // triggers are events, not state
    }
    state[key] = value;
    changed.push(key);
  }
  if (changed.length) {
    for (const fn of listeners) {
      try { fn(changed, state); } catch (err) { console.error('[tt-map]', err); }
    }
  }
});

/* -------------------------------- Helpers -------------------------------- */

export const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Player world position, or null until the client has sent one. */
export function playerPos() {
  if (state.pos_x === undefined || state.pos_y === undefined) return null;
  return { x: num(state.pos_x), y: num(state.pos_y), z: num(state.pos_z), h: num(state.pos_h) };
}

/** The waypoint the player currently has set on the pause map, if any. */
export function gameWaypoint() {
  if (!state.waypoint || state.waypoint_x === undefined) return null;
  return { x: num(state.waypoint_x), y: num(state.waypoint_y) };
}

export function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Compass bearing from `a` to `b`, in degrees, 0 = north. */
export function bearing(a, b) {
  const deg = Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI;
  return (deg + 360) % 360;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compassPoint(deg) {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

/** Rough travel-time estimate, in seconds, from what the player is driving. */
export function eta(metres) {
  const vehicle = state.vehicle;
  const cls = String(state.vehicleClassName || '').toLowerCase();
  let kmh = 8; // on foot
  if (vehicle && vehicle !== 'onFoot') {
    if (cls.includes('plane')) kmh = 320;
    else if (cls.includes('heli')) kmh = 200;
    else if (cls.includes('boat')) kmh = 90;
    else if (cls.includes('truck') || cls.includes('commercial')) kmh = 75;
    else if (cls.includes('super') || cls.includes('sport')) kmh = 150;
    else kmh = 100;
  }
  return metres / (kmh / 3.6);
}

export function formatDistance(metres) {
  return metres >= 1000
    ? (metres / 1000).toFixed(metres >= 10000 ? 0 : 1) + ' km'
    : Math.round(metres) + ' m';
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.round(seconds / 60);
  if (m < 1) return '<1 min';
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

/*
 * app.js — UI controller for the TT Waypoint Map user application.
 */

import { LOCATIONS, SURVEY_TARGETS, CATEGORIES, JOBS } from './data.js';
import { TTMAP_PLACES } from './places-ttmap.js';
import { TycoonMap } from './map.js';
import { MiniMap } from './minimap.js';
import {
  cmd, state, onData, onTrigger, inGame,
  playerPos, gameWaypoint, distance2d, bearing, compassPoint,
  eta, formatDistance, formatDuration, num
} from './game.js';

/* =========================== persisted store =========================== */

const STORE_KEY = 'ttmap.v1';

const defaults = {
  favourites: [],        // location ids
  custom: [],            // { id, n, c:'custom', x, y, d, p:'exact' }
  overrides: {},         // id -> { x, y } corrections to built-in pins
  trip: [],              // ordered location ids
  surveyed: [],          // { id, targetId, n, c, x, y } captured survey targets
  cats: null,            // null = all categories on
  sort: 'dist',
  favOnly: false,
  autoAdvance: true,
  hidden: false,         // the app's own hide, independent of the client's
  corner: 'tl',          // where the collapsed handle sits
  mini: true,            // minimap on by default — it is the point of the app
  miniZoom: 6,
  miniRotate: true,
  miniSize: 'm',
  miniCorner: 'br'
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
}

const store = load();

const uid = () => 'cw-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);

/* ============================== catalogue ============================== */

/**
 * Built-ins (with any user coordinate corrections), the survey targets the
 * player has actually stood on, and their own saved pins. Survey targets that
 * have not been captured yet deliberately do not appear — they have no
 * coordinate, so there is nothing to navigate to.
 */
function catalogue() {
  const built = LOCATIONS.concat(TTMAP_PLACES).map((loc) => {
    const fix = store.overrides[loc.id];
    return fix ? { ...loc, x: fix.x, y: fix.y, p: 'exact', fixed: true } : loc;
  });
  const surveyed = store.surveyed.map((s) => ({ ...s, p: 'exact', surveyed: true }));
  return built.concat(surveyed, store.custom);
}

let CATALOG = catalogue();
const byId = (id) => CATALOG.find((l) => l.id === id);

function refreshCatalog() {
  CATALOG = catalogue();
  map.setLocations(CATALOG);
  map.setSelected(selectedId);
  map.setTrip(store.trip);
  renderList();
  renderDetail();
  renderTrip();
  renderSurvey();
  if (store.mini) { mini.setLocations(CATALOG); mini.setTarget(miniTarget()); }
}

/* ================================ DOM ================================= */

const $ = (id) => document.getElementById(id);

const dom = {
  search: $('search'), results: $('results'), listCount: $('listCount'),
  catChips: $('catChips'), detail: $('detail'), mapWrap: $('mapWrap'),
  mapTip: $('mapTip'), tripList: $('tripList'), tripSummary: $('tripSummary'),
  statusConn: $('statusConn'), blipCount: $('blipCount'),
  pinnedHud: $('pinnedHud'), phName: $('phName'), phDist: $('phDist'), phDir: $('phDir'),
  miniHandle: $('miniHandle'), miniText: $('miniText'),
  modal: $('modal'), modalTitle: $('modalTitle'), modalBody: $('modalBody'),
  modalOk: $('modalOk'), modalCancel: $('modalCancel')
};

/* =============================== app state ============================= */

let selectedId = null;
let activeCats = store.cats ? new Set(store.cats) : new Set(Object.keys(CATEGORIES));
let mapPick = null;               // raw coordinate picked by clicking the map
const activeBlips = new Map();    // blipId -> label

/* ================================= map ================================= */

const map = new TycoonMap(dom.mapWrap, {
  onSelect: (id) => select(id),
  onHover: (loc) => {
    if (!loc) { dom.mapTip.hidden = true; return; }
    dom.mapTip.hidden = false;
    dom.mapTip.innerHTML = `<b>${escapeHtml(loc.n)}</b> · ${CATEGORIES[loc.c].label}
      <br>${loc.x.toFixed(0)}, ${loc.y.toFixed(0)}${distanceSuffix(loc)}`;
  },
  onMapClick: (world) => {
    mapPick = { x: Math.round(world.x), y: Math.round(world.y) };
    selectedId = null;
    map.setSelected(null);
    renderDetail();
    renderList();
  }
});

/* ================================ minimap ============================== */

const mini = new MiniMap($('minimap'), {
  zoom: store.miniZoom,
  rotate: store.miniRotate,
  size: store.miniSize,
  corner: store.miniCorner
});

/** What the minimap points at: your selection, else the next trip stop. */
function miniTarget() {
  return (selectedId && byId(selectedId)) || byId(store.trip[0]) || null;
}

function syncMini() {
  $('minimap').hidden = !store.mini;
  $('btnMini').classList.toggle('is-on', store.mini);
  if (!store.mini) return;
  mini.setLocations(CATALOG);
  mini.setTarget(miniTarget());
  const me = playerPos();
  if (me) mini.setPlayer(me);
  mini.applySize();
}

function distanceSuffix(loc) {
  const me = playerPos();
  return me ? ` · ${formatDistance(distance2d(me, loc))}` : '';
}

/* ============================ category chips =========================== */

function renderChips() {
  dom.catChips.textContent = '';
  const allOn = activeCats.size === Object.keys(CATEGORIES).length;

  const all = document.createElement('button');
  all.className = 'chip' + (allOn ? ' is-on' : '');
  all.textContent = 'ALL';
  if (allOn) all.style.background = 'var(--text-dim)';
  all.onclick = () => {
    activeCats = allOn ? new Set() : new Set(Object.keys(CATEGORIES));
    persistCats();
  };
  dom.catChips.appendChild(all);

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const on = activeCats.has(key);
    const chip = document.createElement('button');
    chip.className = 'chip' + (on ? ' is-on' : '');
    if (on) chip.style.background = cat.color;
    chip.innerHTML = `<span class="chip-dot" style="background:${on ? 'rgba(0,0,0,.55)' : cat.color}"></span>${cat.short}`;
    chip.title = cat.label;
    chip.onclick = () => {
      if (on) activeCats.delete(key); else activeCats.add(key);
      persistCats();
    };
    dom.catChips.appendChild(chip);
  }
}

function persistCats() {
  store.cats = [...activeCats];
  save();
  renderChips();
  renderList();
}

/* =============================== the list ============================== */

function visibleLocations() {
  const q = dom.search.value.trim().toLowerCase();
  const me = playerPos();

  let list = CATALOG.filter((loc) => {
    if (!activeCats.has(loc.c)) return false;
    if (store.favOnly && !store.favourites.includes(loc.id)) return false;
    if (!q) return true;
    return (loc.n + ' ' + (loc.d || '') + ' ' + CATEGORIES[loc.c].label).toLowerCase().includes(q);
  });

  if (store.sort === 'dist' && me) {
    list = list.map((l) => ({ l, d: distance2d(me, l) }))
               .sort((a, b) => a.d - b.d)
               .map((e) => e.l);
  } else {
    list = list.slice().sort((a, b) => a.n.localeCompare(b.n));
  }
  return list;
}

function renderList() {
  const list = visibleLocations();
  const me = playerPos();
  if (me) lastSortPos = { x: me.x, y: me.y };
  dom.listCount.textContent = `${list.length} destination${list.length === 1 ? '' : 's'}`;

  const scrollTop = dom.results.scrollTop;
  dom.results.textContent = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'results-empty';
    li.textContent = 'Nothing matches those filters.';
    dom.results.appendChild(li);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const loc of list) {
    const cat = CATEGORIES[loc.c];
    const fav = store.favourites.includes(loc.id);

    const li = document.createElement('li');
    li.className = 'row' + (loc.id === selectedId ? ' is-active' : '');
    li.dataset.id = loc.id;
    li.innerHTML = `
      <span class="row-dot" style="background:${cat.color}"></span>
      <span class="row-main">
        <span class="row-name">${escapeHtml(loc.n)}</span>
        <span class="row-sub">${escapeHtml(loc.d || cat.label)}</span>
      </span>
      <span class="row-right">
        <span class="row-dist">${me ? formatDistance(distance2d(me, loc)) : '—'}</span>
        <span class="row-star${fav ? ' is-on' : ''}" title="Favourite">${fav ? '★' : '☆'}</span>
      </span>`;

    li.onclick = (ev) => {
      if (ev.target.classList.contains('row-star')) { toggleFavourite(loc.id); return; }
      select(loc.id);
    };
    li.ondblclick = () => setWaypointTo(loc);
    frag.appendChild(li);
  }
  dom.results.appendChild(frag);
  dom.results.scrollTop = scrollTop;
}

let lastSortPos = null;

/*
 * Distances change constantly. Rewriting 100+ rows every frame would fight the
 * player's scrolling, so we update the numbers in place against each row's own
 * id — never against a freshly sorted list, which would pair the wrong distance
 * with the wrong name — and only re-sort once they have actually travelled.
 */
function refreshDistances() {
  const me = playerPos();
  if (!me) return;

  if (store.sort === 'dist' && (!lastSortPos || distance2d(lastSortPos, me) > 500)) {
    renderList();
    return;
  }

  for (const row of dom.results.querySelectorAll('.row')) {
    const loc = byId(row.dataset.id);
    if (loc) row.querySelector('.row-dist').textContent = formatDistance(distance2d(me, loc));
  }
}

/* ============================== selection ============================== */

function select(id) {
  selectedId = id;
  mapPick = null;
  map.setSelected(id);
  if (store.mini) mini.setTarget(miniTarget());
  renderList();
  renderDetail();
}

function renderDetail() {
  if (mapPick) return renderPickDetail();

  const loc = selectedId && byId(selectedId);
  if (!loc) {
    dom.detail.innerHTML = `
      <div class="empty-state">
        <div class="empty-mark">◎</div>
        <p>Pick a destination from the list or click a pin on the map.</p>
      </div>`;
    return;
  }

  const cat = CATEGORIES[loc.c];
  const me = playerPos();
  const dist = me ? distance2d(me, loc) : null;
  const brg = me ? bearing(me, loc) : null;
  const fav = store.favourites.includes(loc.id);
  const inTrip = store.trip.includes(loc.id);
  const removable = loc.c === 'custom' || loc.surveyed;
  const blipOn = activeBlips.has(blipIdFor(loc));

  dom.detail.innerHTML = `
    <span class="d-cat"><span class="chip-dot" style="background:${cat.color}"></span>${cat.label}</span>
    <h2 class="d-name">${escapeHtml(loc.n)}</h2>
    <p class="d-desc">${escapeHtml(loc.d || '')}</p>

    <div class="d-stats">
      <div class="d-stat"><b>${dist === null ? '—' : formatDistance(dist)}</b><span>Distance</span></div>
      <div class="d-stat"><b>${brg === null ? '—' : compassPoint(brg)}</b><span>Heading</span></div>
      <div class="d-stat"><b>${dist === null ? '—' : formatDuration(eta(dist))}</b><span>Est. time</span></div>
    </div>

    <div class="d-actions">
      <button class="btn btn-primary btn-wide" data-act="waypoint">SET WAYPOINT</button>
      <button class="btn" data-act="blip">${blipOn ? 'REMOVE BLIP' : 'ADD BLIP'}</button>
      <button class="btn" data-act="route">GPS ROUTE</button>
      <button class="btn btn-ghost" data-act="trip">${inTrip ? '− FROM TRIP' : '+ TO TRIP'}</button>
      <button class="btn btn-ghost" data-act="fav">${fav ? '★ FAVOURITE' : '☆ FAVOURITE'}</button>
      <button class="btn btn-ghost btn-wide" data-act="recapture">SNAP TO MY POSITION</button>
      ${removable ? '<button class="btn btn-ghost btn-danger btn-wide" data-act="delete">DELETE WAYPOINT</button>' : ''}
    </div>

    <div class="d-coords">
      <span>X ${loc.x.toFixed(0)} · Y ${loc.y.toFixed(0)}</span>
      <span class="${loc.p === 'exact' ? 'badge-exact' : 'badge-approx'}">
        ${loc.surveyed ? 'SURVEYED' : loc.fixed ? 'YOUR FIX' : loc.p === 'exact' ? 'VERIFIED' : 'APPROX'}
      </span>
    </div>`;

  dom.detail.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = () => detailAction(btn.dataset.act, loc);
  });
}

function renderPickDetail() {
  const me = playerPos();
  const dist = me ? distance2d(me, mapPick) : null;
  dom.detail.innerHTML = `
    <span class="d-cat"><span class="chip-dot" style="background:var(--amber)"></span>Map pick</span>
    <h2 class="d-name">Raw coordinate</h2>
    <p class="d-desc">Anywhere you click on the map is a valid waypoint.</p>
    <div class="d-stats">
      <div class="d-stat"><b>${mapPick.x}</b><span>World X</span></div>
      <div class="d-stat"><b>${mapPick.y}</b><span>World Y</span></div>
      <div class="d-stat"><b>${dist === null ? '—' : formatDistance(dist)}</b><span>Distance</span></div>
    </div>
    <div class="d-actions">
      <button class="btn btn-primary btn-wide" data-act="pick-waypoint">SET WAYPOINT</button>
      <button class="btn btn-wide" data-act="pick-save">SAVE AS MY WAYPOINT</button>
    </div>`;

  dom.detail.querySelector('[data-act="pick-waypoint"]').onclick = () => {
    cmd.setWaypoint(mapPick.x, mapPick.y);
    cmd.notification(`~y~Waypoint set~s~ — ${mapPick.x}, ${mapPick.y}`);
    cmd.sfx(3);
  };
  dom.detail.querySelector('[data-act="pick-save"]').onclick = async () => {
    const name = await askText('Name this waypoint', 'e.g. Secret fishing spot');
    if (!name) return;
    addCustom(name, mapPick.x, mapPick.y, 'Picked from the map');
  };
}

function detailAction(act, loc) {
  switch (act) {
    case 'waypoint': setWaypointTo(loc); break;
    case 'blip':     toggleBlip(loc); break;
    case 'route':    routeTo(loc); break;
    case 'trip':     toggleTrip(loc.id); break;
    case 'fav':      toggleFavourite(loc.id); break;
    case 'recapture': snapToMe(loc); break;
    case 'delete':   loc.surveyed ? undoSurvey(loc.id) : deleteCustom(loc.id); break;
  }
}

/* ============================== game actions =========================== */

function setWaypointTo(loc) {
  cmd.setWaypoint(loc.x, loc.y);
  const me = playerPos();
  const detail = me ? ` (${formatDistance(distance2d(me, loc))})` : '';
  cmd.notification(`~g~Waypoint:~s~ ${loc.n}${detail}`);
  cmd.sfx(3);
}

const blipIdFor = (loc) => 'ttmap_' + loc.id;

function toggleBlip(loc, opts = {}) {
  const id = blipIdFor(loc);
  if (activeBlips.has(id) && !opts.force) {
    cmd.removeBlip(id);
    activeBlips.delete(id);
  } else {
    const cat = CATEGORIES[loc.c];
    cmd.buildBlip({
      id, x: loc.x, y: loc.y,
      sprite: cat.sprite, color: cat.blip,
      alwaysVisible: true, route: !!opts.route, ticked: false,
      name: loc.n
    });
    activeBlips.set(id, loc.n);
  }
  renderBlipCount();
  renderDetail();
}

function routeTo(loc) {
  const id = blipIdFor(loc);
  // Only one GPS line at a time, or the route drawn in game becomes soup.
  for (const other of activeBlips.keys()) cmd.setBlipRoute(other, false);
  if (!activeBlips.has(id)) toggleBlip(loc, { force: true, route: true });
  else cmd.setBlipRoute(id, true);
  cmd.setWaypoint(loc.x, loc.y);
  cmd.info(`GPS routed to ${loc.n}`, 8);
  cmd.sfx(5);
  renderDetail();
}

function clearBlips() {
  for (const id of activeBlips.keys()) cmd.removeBlip(id);
  activeBlips.clear();
  renderBlipCount();
  renderDetail();
  cmd.notification('~r~Cleared~s~ all TT Map blips');
}

function renderBlipCount() {
  const n = activeBlips.size;
  dom.blipCount.textContent = n
    ? `${n} blip${n === 1 ? '' : 's'} placed by this app.`
    : 'No blips placed by this app.';
  $('btnBlipsClear').disabled = n === 0;
}

/* ============================== favourites ============================= */

function toggleFavourite(id) {
  const i = store.favourites.indexOf(id);
  if (i >= 0) store.favourites.splice(i, 1);
  else store.favourites.push(id);
  save();
  renderList();
  renderDetail();
}

function nearestFavourite() {
  const me = playerPos();
  if (!me || !store.favourites.length) return null;
  return store.favourites
    .map(byId)
    .filter(Boolean)
    .map((l) => ({ l, d: distance2d(me, l) }))
    .sort((a, b) => a.d - b.d)[0]?.l ?? null;
}

/* ============================ custom waypoints ========================= */

function addCustom(name, x, y, note) {
  const loc = {
    id: uid(), n: name, c: 'custom',
    x: Math.round(x), y: Math.round(y),
    d: note || 'Saved by you', p: 'exact'
  };
  store.custom.push(loc);
  save();
  refreshCatalog();
  select(loc.id);
  cmd.notification(`~g~Saved~s~ ${name}`);
  cmd.sfx(6);
}

function deleteCustom(id) {
  store.custom = store.custom.filter((l) => l.id !== id);
  store.trip = store.trip.filter((t) => t !== id);
  store.favourites = store.favourites.filter((f) => f !== id);
  save();
  selectedId = null;
  refreshCatalog();
}

/** Correct a built-in pin using the player's real position. */
function snapToMe(loc) {
  const me = playerPos();
  if (!me) { cmd.notification('~r~No position yet~s~ — move around once.'); return; }
  const mine = store.custom.find((l) => l.id === loc.id)
            || store.surveyed.find((l) => l.id === loc.id);
  if (mine) {
    mine.x = Math.round(me.x);
    mine.y = Math.round(me.y);
  } else {
    store.overrides[loc.id] = { x: Math.round(me.x), y: Math.round(me.y) };
  }
  save();
  refreshCatalog();
  cmd.notification(`~g~Updated~s~ ${loc.n} → ${Math.round(me.x)}, ${Math.round(me.y)}`);
}

/* ================================ survey =============================== */

let armedTargetId = null;

const surveyCount = (targetId) => store.surveyed.filter((s) => s.targetId === targetId).length;

/** Targets still worth visiting: never captured, or captured but repeatable. */
function openTargets() {
  return SURVEY_TARGETS.filter((t) => t.multi || surveyCount(t.id) === 0);
}

function armTarget(id) {
  armedTargetId = armedTargetId === id ? null : id;
  renderSurvey();
  renderPinnedTracker();
}

/** Write the player's current position into the armed survey target. */
function captureSurvey() {
  const target = SURVEY_TARGETS.find((t) => t.id === armedTargetId);
  if (!target) return;

  const me = playerPos();
  if (!me) { cmd.notification('~r~No position from the game yet.'); return; }

  const n = surveyCount(target.id);
  const loc = {
    id: uid(),
    targetId: target.id,
    n: target.multi && n > 0 ? `${target.n} #${n + 1}` : target.n,
    c: target.c,
    x: Math.round(me.x),
    y: Math.round(me.y),
    d: [state.street, state.zoneName].filter(Boolean).join(', ') || 'Surveyed in game'
  };
  store.surveyed.push(loc);
  save();
  refreshCatalog();

  cmd.notification(`~g~Mapped:~s~ ${loc.n}`);
  cmd.sfx(6);

  // Single-shot targets are done; repeatable ones stay armed so you can walk a
  // row of ATMs without touching the mouse between each one.
  if (!target.multi) armedTargetId = null;
  renderSurvey();
}

function undoSurvey(id) {
  store.surveyed = store.surveyed.filter((s) => s.id !== id);
  store.trip = store.trip.filter((t) => t !== id);
  store.favourites = store.favourites.filter((f) => f !== id);
  save();
  if (selectedId === id) selectedId = null;
  refreshCatalog();
  renderSurvey();
}

function renderSurvey() {
  const open = openTargets();
  const done = SURVEY_TARGETS.length - SURVEY_TARGETS.filter((t) => surveyCount(t.id) === 0).length;

  $('surveyProgress').textContent =
    `${done}/${SURVEY_TARGETS.length} named · ${store.surveyed.length} pin${store.surveyed.length === 1 ? '' : 's'}`;

  const target = SURVEY_TARGETS.find((t) => t.id === armedTargetId);
  $('surveyArmed').hidden = !target;
  if (target) $('surveyArmedName').textContent = target.n;
  $('btnSurveyCapture').disabled = !target;
  $('btnSurveyClear').disabled = !target;

  const list = $('surveyList');
  list.textContent = '';
  if (!open.length) {
    const li = document.createElement('li');
    li.className = 'trip-empty';
    li.textContent = 'Everything on the list has been mapped. Nice work — hit EXPORT.';
    list.appendChild(li);
    return;
  }

  for (const t of open) {
    const count = surveyCount(t.id);
    const li = document.createElement('li');
    li.className = 'survey-item' + (t.id === armedTargetId ? ' is-armed' : '');
    li.innerHTML = `
      <span class="chip-dot" style="background:${CATEGORIES[t.c].color}"></span>
      <span class="survey-name">${escapeHtml(t.n)}</span>
      ${count ? `<span class="survey-count">${count}</span>` : ''}`;
    li.onclick = () => armTarget(t.id);
    list.appendChild(li);
  }
}

/* ============================== trip planner =========================== */

function toggleTrip(id) {
  const i = store.trip.indexOf(id);
  if (i >= 0) store.trip.splice(i, 1);
  else store.trip.push(id);
  save();
  map.setTrip(store.trip);
  if (store.mini) mini.setTarget(miniTarget());
  renderTrip();
  renderDetail();
}

function renderTrip() {
  const stops = store.trip.map(byId).filter(Boolean);
  dom.tripList.textContent = '';

  if (!stops.length) {
    const li = document.createElement('li');
    li.className = 'trip-empty';
    li.textContent = 'No stops. Add destinations to build a multi-drop run.';
    dom.tripList.appendChild(li);
    dom.tripSummary.textContent = 'empty';
  } else {
    stops.forEach((loc, i) => {
      const li = document.createElement('li');
      li.className = 'trip-item' + (i === 0 ? ' is-next' : '');
      li.innerHTML = `
        <span class="trip-idx">${i + 1}</span>
        <span class="trip-name">${escapeHtml(loc.n)}</span>
        <button class="trip-x" title="Remove">✕</button>`;
      li.querySelector('.trip-x').onclick = (ev) => { ev.stopPropagation(); toggleTrip(loc.id); };
      li.onclick = () => select(loc.id);
      dom.tripList.appendChild(li);
    });
    dom.tripSummary.textContent = `${stops.length} stop${stops.length === 1 ? '' : 's'} · ${formatDistance(tripLength(stops))}`;
  }

  $('btnTripStart').disabled = stops.length === 0;
  $('btnTripClear').disabled = stops.length === 0;
}

function tripLength(stops) {
  const me = playerPos();
  let total = 0;
  let from = me || stops[0];
  for (const stop of stops) { total += distance2d(from, stop); from = stop; }
  return total;
}

function routeToNextStop() {
  const next = store.trip.map(byId).filter(Boolean)[0];
  if (!next) return;
  routeTo(next);
}

/** Drop the leading stop once the player physically reaches it. */
function checkArrival() {
  if (!store.autoAdvance || !store.trip.length) return;
  const me = playerPos();
  if (!me) return;
  const next = byId(store.trip[0]);
  if (!next || distance2d(me, next) > 80) return;

  store.trip.shift();
  save();
  map.setTrip(store.trip);
  renderTrip();
  cmd.sfx(2);

  const following = byId(store.trip[0]);
  if (following) {
    cmd.oneliner(`Arrived at ${next.n} — next: ${following.n}`);
    routeTo(following);
  } else {
    cmd.popup('Trip complete', `Last stop reached: ${next.n}`);
    cmd.sfx(16);
  }
}

/* ============================== export/import ========================== */

function exportJson() {
  const payload = JSON.stringify({
    version: 1,
    exported: new Date().toISOString(),
    favourites: store.favourites,
    custom: store.custom,
    surveyed: store.surveyed,
    overrides: store.overrides
  }, null, 2);
  openModal({
    title: 'Export waypoints',
    body: `<p>Copy this somewhere safe, paste it into another machine's Import box, or send
           the <code>surveyed</code> array over so the coordinates ship in <code>data.js</code>
           for everyone.</p>
           <textarea id="ioBox" spellcheck="false"></textarea>`,
    okLabel: 'DONE',
    onOpen: () => { const t = $('ioBox'); t.value = payload; t.select(); },
    onOk: () => true
  });
}

function importJson() {
  openModal({
    title: 'Import waypoints',
    body: `<p>Paste an export below. Your own waypoints and coordinate fixes are merged in; nothing is deleted.</p>
           <textarea id="ioBox" spellcheck="false" placeholder="{ …exported json… }"></textarea>`,
    okLabel: 'IMPORT',
    onOk: () => {
      try {
        const data = JSON.parse($('ioBox').value);
        const known = new Set(store.custom.map((c) => c.id));
        for (const loc of data.custom || []) {
          if (!known.has(loc.id)) store.custom.push({ ...loc, c: 'custom' });
        }
        const surveyedIds = new Set(store.surveyed.map((s) => s.id));
        for (const loc of data.surveyed || []) {
          if (!surveyedIds.has(loc.id)) store.surveyed.push(loc);
        }
        Object.assign(store.overrides, data.overrides || {});
        for (const f of data.favourites || []) {
          if (!store.favourites.includes(f)) store.favourites.push(f);
        }
        save();
        refreshCatalog();
        cmd.notification('~g~Waypoints imported');
        return true;
      } catch {
        cmd.notification('~r~Import failed~s~ — that is not valid JSON');
        return false;
      }
    }
  });
}

/* ================================ modal ================================ */

let modalOnOk = null;

function openModal({ title, body, okLabel = 'OK', cancelLabel = 'CANCEL', onOpen, onOk }) {
  dom.modalTitle.textContent = title;
  dom.modalBody.innerHTML = body;
  dom.modalOk.textContent = okLabel;
  dom.modalCancel.textContent = cancelLabel;
  dom.modal.hidden = false;
  modalOnOk = onOk;
  onOpen?.();
}

function closeModal() {
  dom.modal.hidden = true;
  modalOnOk = null;
}

dom.modalOk.onclick = () => { if (!modalOnOk || modalOnOk() !== false) closeModal(); };
dom.modalCancel.onclick = closeModal;

function askText(title, placeholder) {
  return new Promise((resolve) => {
    let settled = false;
    openModal({
      title,
      body: `<input class="input" id="askBox" placeholder="${escapeHtml(placeholder)}" autocomplete="off">`,
      okLabel: 'SAVE',
      onOpen: () => {
        const input = $('askBox');
        input.focus();
        input.onkeydown = (ev) => { if (ev.key === 'Enter') dom.modalOk.click(); };
      },
      onOk: () => {
        const value = $('askBox').value.trim();
        if (!value) return false;
        settled = true;
        resolve(value);
        return true;
      }
    });
    dom.modalCancel.addEventListener('click', () => { if (!settled) resolve(null); }, { once: true });
  });
}

/** Every job on the server, and where to go to take it. */
function showJobs() {
  const centres = CATALOG.filter((l) => l.id.startsWith('jc-'));
  const me = playerPos();
  const nearest = me
    ? centres.map((l) => ({ l, d: distance2d(me, l) })).sort((a, b) => a.d - b.d)[0]
    : null;

  openModal({
    title: `Jobs (${JOBS.length})`,
    okLabel: 'CLOSE',
    cancelLabel: 'JOB CENTRES',
    body: `
      <p>Every job is taken at a <b>Job Centre</b> — the orange briefcases on the map.
      ${nearest ? `Your nearest is <b>${escapeHtml(nearest.l.n)}</b>,
        ${formatDistance(nearest.d)} away.` : ''}</p>
      <table class="jobs-table">
        <tr><th>Job</th><th>Requires</th><th>What you do</th></tr>
        ${JOBS.map((j) => `<tr>
          <td><b>${escapeHtml(j.n)}</b></td>
          <td>${j.req === 'None' ? '<span class="job-free">—</span>' : escapeHtml(j.req)}</td>
          <td>${escapeHtml(j.d)}</td></tr>`).join('')}
      </table>`,
    onOk: () => true
  });

  // "Job Centres" filters the list down to them rather than just closing.
  dom.modalCancel.onclick = () => {
    closeModal();
    activeCats = new Set(['hq']);
    dom.search.value = 'job centre';
    persistCats();
    if (nearest) select(nearest.l.id);
    dom.modalCancel.onclick = closeModal;
  };
}

function showHelp() {
  openModal({
    title: 'TT Waypoint Map — help',
    okLabel: 'GOT IT',
    cancelLabel: 'CLOSE',
    body: `
      <h4>Getting around</h4>
      <ul>
        <li>Click a destination, then <code>SET WAYPOINT</code> to drop the in-game marker.</li>
        <li><code>GPS ROUTE</code> also places a map blip and draws the driving line.</li>
        <li>Double-click any row in the list to set a waypoint in one go.</li>
        <li>Scroll to zoom the map, drag to pan, click open ground to pick a raw coordinate.</li>
      </ul>
      <h4>Trips</h4>
      <ul>
        <li>Add several stops, then <code>ROUTE TO NEXT</code>. Get within 80&nbsp;m and the app
            ticks that stop off and routes you to the following one.</li>
      </ul>
      <h4>Coordinates</h4>
      <ul>
        <li>Pins marked <span class="badge-approx">APPROX</span> are map estimates —
            drive there and press <code>SNAP TO MY POSITION</code> to correct them permanently.</li>
        <li><code>＋ HERE</code> saves wherever you are standing; <code>＋ MAP WAYPOINT</code>
            saves the marker you placed on the pause map.</li>
      </ul>
      <h4>Survey</h4>
      <ul>
        <li>The Survey list holds real Transport Tycoon places — Trucking HQ, Logging Camp,
            McKenzie Export, the <code>Market (…)</code> family and so on — that we know by
            name but not by coordinate, so they ship unmapped rather than guessed.</li>
        <li>Click one to arm it, drive there, and press <b>Square</b> (or <code>CAPTURE HERE</code>).
            It becomes a normal destination straight away.</li>
        <li>Names with many locations (ATMs, gas stations) stay armed and number themselves,
            so you can collect a whole row without touching the mouse.</li>
        <li><code>EXPORT</code> when you are done — that JSON is how the coordinates get
            shared with everyone else.</li>
      </ul>
      <h4>The minimap</h4>
      <ul>
        <li>Pick a destination here, then press <code>HIDE</code> and drive by the minimap —
            that is what it is for. It stays on screen when the panel does not.</li>
        <li>It locks to you and turns with your heading. Your pick is ringed in amber with a
            line to it, and a chevron on the rim once it is off the edge.</li>
        <li>Controls appear on hover: zoom, rotate, size, corner, and <code>▣</code> to
            reopen this panel without <code>F1</code>. <code>M</code> toggles it entirely.</li>
      </ul>
      <h4>Getting it out of the way</h4>
      <ul>
        <li><code>HIDE</code> (or <code>H</code>) collapses the app to a small handle. It keeps
            running while hidden — trips still auto-advance, notifications still fire — and one
            click brings it back. Right-click the handle to move it to another corner.</li>
        <li>Hidden <i>and</i> pinned draws nothing at all, for a completely clean screen.
            Bind <b>TT Map: show / hide</b> in <i>Settings → Keybinds → FiveM</i> to toggle it
            back without leaving the driver's seat.</li>
        <li><code>CLOSE</code> is different: that hands the app back to the game client, and
            you need <code>F1</code> to retrieve it — same as the client's own Hide button.</li>
      </ul>
      <h4>Keys</h4>
      <ul>
        <li><code>F1</code> bring this app back into focus · <code>Esc</code> pin it and return to driving</li>
        <li><code>H</code> hide / show · <code>/</code> jump to search</li>
        <li>Bind <b>Square / Triangle / Circle / Cross</b> in
            <i>Settings → Keybinds → FiveM</i> for waypoint, next stop, clear blips and nearest favourite.</li>
      </ul>`
  });
}

/* ============================== live updates =========================== */

function renderHud() {
  const set = (id, value, label) => {
    const chip = $(id);
    chip.querySelector('b').textContent = value || '—';
    if (label) chip.querySelector('span').textContent = label;
  };

  set('hudPlayer', state.name ? `${state.name}` : '—',
      state.user_id !== undefined ? `ID ${state.user_id}` : 'Player');
  set('hudJob', state.job_title || state.job_name || state.job || '—', 'Job');

  const where = [state.street, state.zoneName].filter(Boolean).join(', ');
  set('hudZone', where || '—', 'Location');

  const vehicle = state.vehicle && state.vehicle !== 'onFoot'
    ? [state.vehicleMake, state.vehicleName].filter(Boolean).join(' ') || state.vehicle
    : 'On foot';
  const fuel = state.fuel !== undefined && vehicle !== 'On foot'
    ? `Fuel ${Math.round(num(state.fuel))}%` : 'Vehicle';
  set('hudVehicle', vehicle, fuel);

  const money = (v) => '$' + Math.round(num(v)).toLocaleString('en-US');
  set('hudCash', state.wallet !== undefined ? `${money(state.wallet)} / ${money(state.bank)}` : '—');
}

/* ============================== visibility ============================= */

/*
 * Two switches, applied in one place so they can never disagree:
 *   is-pinned — the client gave control back to the game
 *   is-hidden — our own HIDE button
 * See the table in styles.css for the four resulting states.
 */
function applyVisibility() {
  const pinned = isTruthy(state.pinned) && !isTruthy(state.focused);
  document.body.classList.toggle('is-pinned', pinned);
  document.body.classList.toggle('is-hidden', store.hidden);
  dom.miniHandle.dataset.corner = store.corner;
  $('btnHide').classList.toggle('is-on', store.hidden);
  renderPinnedTracker();
  renderMiniHandle();
}

function setHidden(hidden) {
  store.hidden = hidden;
  save();
  applyVisibility();
  if (hidden) {
    cmd.info('TT Map hidden — click the handle, or bind "TT Map: show/hide" in Keybinds.', 6);
  }
}

/** What the collapsed handle says: whatever you would want at a glance. */
function renderMiniHandle() {
  if (!store.hidden) return;
  const armed = SURVEY_TARGETS.find((t) => t.id === armedTargetId);
  const target = (selectedId && byId(selectedId)) || byId(store.trip[0]);
  const me = playerPos();

  let text = 'Map';
  let live = false;
  if (armed) {
    text = 'Survey: ' + armed.n;
    live = true;
  } else if (target && me) {
    text = `${target.n} · ${formatDistance(distance2d(me, target))}`;
    live = true;
  } else if (target) {
    text = target.n;
    live = true;
  }
  dom.miniText.textContent = text;
  dom.miniHandle.classList.toggle('has-target', live);
}

function renderPinnedTracker() {
  const me = playerPos();

  // Surveying takes over the strip: while armed you are driving specifically to
  // stand on that thing, so the distance to some other destination is noise.
  const armed = SURVEY_TARGETS.find((t) => t.id === armedTargetId);
  if (armed) {
    dom.pinnedHud.hidden = false;
    dom.pinnedHud.classList.add('is-survey');
    dom.phName.textContent = 'Survey: ' + armed.n;
    dom.phDist.textContent = me ? `${Math.round(me.x)}, ${Math.round(me.y)}` : '—';
    dom.phDir.textContent = 'press ◻ to capture';
    return;
  }
  dom.pinnedHud.classList.remove('is-survey');

  const target = (selectedId && byId(selectedId)) || byId(store.trip[0]);
  if (!target || !me) { dom.pinnedHud.hidden = true; return; }
  dom.pinnedHud.hidden = false;
  dom.phName.textContent = target.n;
  dom.phDist.textContent = formatDistance(distance2d(me, target));
  dom.phDir.textContent = compassPoint(bearing(me, target));
}

let listRefreshDue = 0;

onData((changed) => {
  if (dom.statusConn.textContent !== 'Connected to game client') {
    dom.statusConn.textContent = 'Connected to game client';
    dom.statusConn.classList.add('is-live');
  }

  renderHud();

  const moved = changed.includes('pos_x') || changed.includes('pos_y');
  if (moved) {
    const me = playerPos();
    map.setPlayer(me);
    if (store.mini) mini.setPlayer(me);
    checkArrival();
    renderPinnedTracker();
    renderMiniHandle();
    // Distances tick over at most once a second — the client sends position far faster.
    const now = Date.now();
    if (now > listRefreshDue) {
      listRefreshDue = now + 1000;
      refreshDistances();
      if (selectedId || mapPick) renderDetail();
      renderTrip();
    }
  }

  if (changed.includes('waypoint') || changed.includes('waypoint_x') || changed.includes('waypoint_y')) {
    map.setGameWaypoint(gameWaypoint());
  }

  // The client tells us when it takes control back, so we can shrink out of the way.
  if (changed.includes('pinned') || changed.includes('focused') || changed.includes('hidden')) {
    applyVisibility();
  }
});

const isTruthy = (v) => v === true || v === 'true';

/* ============================== interactions =========================== */

dom.search.addEventListener('input', () => renderList());

$('btnSort').onclick = () => {
  store.sort = store.sort === 'dist' ? 'name' : 'dist';
  save();
  $('btnSort').title = `Sorting by ${store.sort === 'dist' ? 'distance' : 'name'}`;
  renderList();
};

$('btnFavOnly').onclick = () => {
  store.favOnly = !store.favOnly;
  save();
  $('btnFavOnly').classList.toggle('is-on', store.favOnly);
  renderList();
};

/* ---------------------------- minimap controls -------------------------- */

$('btnMini').onclick = () => {
  store.mini = !store.mini;
  save();
  syncMini();
};

$('minimap').addEventListener('click', (ev) => {
  const action = ev.target.dataset?.mm;
  if (!action) return;
  const bar = $('minimap').querySelector('.mm-bar');

  if (action === 'zoomin')  store.miniZoom = mini.setZoom(store.miniZoom + 1);
  if (action === 'zoomout') store.miniZoom = mini.setZoom(store.miniZoom - 1);
  if (action === 'rotate') {
    store.miniRotate = !store.miniRotate;
    mini.setRotate(store.miniRotate);
    bar.querySelector('[data-mm="rotate"]').classList.toggle('is-on', store.miniRotate);
  }
  if (action === 'size') {
    const sizes = ['s', 'm', 'l'];
    store.miniSize = sizes[(sizes.indexOf(store.miniSize) + 1) % sizes.length];
    mini.opts.size = store.miniSize;
    mini.applySize();
  }
  if (action === 'corner') {
    const corners = ['br', 'bl', 'tl', 'tr'];
    store.miniCorner = corners[(corners.indexOf(store.miniCorner) + 1) % corners.length];
    mini.opts.corner = store.miniCorner;
    mini.applySize();
  }
  // The minimap is usable with the UI hidden, so it needs its own way back in.
  if (action === 'open') setHidden(false);
  save();
});

$('btnJobs').onclick = showJobs;
$('btnMapReset').onclick = () => map.reset();
$('btnMapPlayer').onclick = () => {
  const me = playerPos();
  if (me) map.focus(me.x, me.y, 3000);
  else cmd.notification('~r~No position from the game yet.');
};
$('btnMapSel').onclick = () => {
  const loc = selectedId && byId(selectedId);
  if (loc) map.focus(loc.x, loc.y, 2500);
};

$('btnTripStart').onclick = routeToNextStop;
$('btnTripClear').onclick = () => {
  store.trip = [];
  save();
  map.setTrip([]);
  renderTrip();
  renderDetail();
};
$('tripAuto').checked = store.autoAdvance;
$('tripAuto').onchange = (ev) => { store.autoAdvance = ev.target.checked; save(); };

$('btnCapturePos').onclick = async () => {
  const me = playerPos();
  if (!me) { cmd.notification('~r~No position from the game yet.'); return; }
  const name = await askText('Name this waypoint', state.street || state.zoneName || 'New waypoint');
  if (name) addCustom(name, me.x, me.y, state.zoneName || 'Captured in game');
};

$('btnCaptureWp').onclick = async () => {
  const wp = gameWaypoint();
  if (!wp) { cmd.notification('~r~Set a marker on the pause map first.'); return; }
  const name = await askText('Name this waypoint', 'Map marker');
  if (name) addCustom(name, wp.x, wp.y, 'From your map marker');
};

$('btnSurveyCapture').onclick = captureSurvey;
$('btnSurveyClear').onclick = () => { armedTargetId = null; renderSurvey(); };

$('btnExport').onclick = exportJson;
$('btnImport').onclick = importJson;
$('btnBlipsClear').onclick = clearBlips;
$('btnHelp').onclick = showHelp;
$('btnHide').onclick = () => setHidden(true);
$('btnPin').onclick = () => cmd.pin();
$('btnClose').onclick = () => cmd.close();

dom.miniHandle.onclick = () => setHidden(false);
dom.miniHandle.oncontextmenu = (ev) => {
  ev.preventDefault();
  const corners = ['tl', 'tr', 'br', 'bl'];
  store.corner = corners[(corners.indexOf(store.corner) + 1) % corners.length];
  save();
  applyVisibility();
};

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (!dom.modal.hidden) { closeModal(); return; }
    cmd.pin();                      // hand control back to the game, stay on screen
    return;
  }
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (ev.key === '/' && !typing) { ev.preventDefault(); dom.search.focus(); dom.search.select(); }
  if ((ev.key === 'h' || ev.key === 'H') && !typing) { ev.preventDefault(); setHidden(!store.hidden); }
  if ((ev.key === 'm' || ev.key === 'M') && !typing) {
    ev.preventDefault();
    store.mini = !store.mini;
    save();
    syncMini();
  }
  if (ev.key === 'Enter' && document.activeElement === dom.search) {
    const first = visibleLocations()[0];
    if (first) { select(first.id); setWaypointTo(first); }
  }
});

/* -------------------------- in-game key triggers ------------------------ */

onTrigger('square', () => {
  // While a survey target is armed the key belongs to surveying — that is the
  // whole point of arming one, and you are usually standing still on the spot.
  if (armedTargetId) { captureSurvey(); return; }
  const loc = (selectedId && byId(selectedId)) || byId(store.trip[0]);
  if (loc) setWaypointTo(loc);
  else cmd.notification('~r~TT Map:~s~ nothing selected');
});
onTrigger('triangle', () => {
  if (store.trip.length) routeToNextStop();
  else cmd.notification('~r~TT Map:~s~ your trip is empty');
});
onTrigger('circle', () => clearBlips());
onTrigger('cross', () => {
  const fav = nearestFavourite();
  if (fav) routeTo(fav);
  else cmd.notification('~r~TT Map:~s~ no favourites saved');
});

/* Also expose named triggers so they show up in the FiveM keybind menu. */
onTrigger('ttmap_waypoint', () => {
  const loc = selectedId && byId(selectedId);
  if (loc) setWaypointTo(loc);
});
onTrigger('ttmap_next', routeToNextStop);

/*
 * Show/hide from a bound key. This is the reason the app has its own hide at
 * all: the client's Hide button needs F1 to undo, whereas this toggles from a
 * single keypress while you keep driving.
 */
onTrigger('ttmap_hide', () => setHidden(!store.hidden));

/* ================================ helpers ============================== */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ================================= boot ================================ */

function boot() {
  if (!inGame) {
    document.body.classList.add('is-standalone');
    dom.statusConn.textContent = 'Preview mode — not running inside the game client';
  }

  $('btnFavOnly').classList.toggle('is-on', store.favOnly);
  $('btnSort').title = `Sorting by ${store.sort === 'dist' ? 'distance' : 'name'}`;

  renderChips();
  map.setLocations(CATALOG);
  map.setTrip(store.trip);
  renderList();
  renderTrip();
  renderDetail();
  renderHud();
  renderBlipCount();
  renderSurvey();
  applyVisibility();
  syncMini();
  $('minimap').querySelector('[data-mm="rotate"]').classList.toggle('is-on', store.miniRotate);

  // Leaflet measures its container on construction; the grid may still have
  // been settling, so re-measure once layout is final and on every resize.
  requestAnimationFrame(() => { map.invalidate(); map.reset(); mini.applySize(); });
  window.addEventListener('resize', () => { map.invalidate(); mini.applySize(); });

  // Tell the player plainly if the map imagery was never fetched, rather than
  // leaving them staring at an empty grey rectangle.
  const probe = new Image();
  probe.onerror = () => document.querySelector('.panel-map').classList.add('tiles-missing');
  probe.src = './tiles/3_0_0.jpg';

  // Ask the client for its whole cache, and register our extra keybinds.
  cmd.getData();
  cmd.registerTrigger('ttmap_waypoint', 'TT Map: waypoint to selection');
  cmd.registerTrigger('ttmap_next', 'TT Map: route to next trip stop');
  cmd.registerTrigger('ttmap_hide', 'TT Map: show / hide');

  // The client only pushes changes; a slow first frame can miss the initial burst.
  setTimeout(() => cmd.getData(), 1500);
}

boot();

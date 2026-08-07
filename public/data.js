/*
 * Transport Tycoon — Waypoint Map
 * Static catalog of destinations + the stylised San Andreas / Cayo Perico base map.
 *
 * COORDINATES ARE GAME-WORLD X / Y (the same pair `setWaypoint` takes).
 *
 * `p` = precision:
 *    "exact"  — taken from the official Tycoon user-app sample or captured in game
 *    "approx" — community / map-derived, good enough to drive to, may be off by a
 *               few dozen metres. Fix any of them in-game with "Capture position"
 *               (the app writes the correction to your browser storage and you can
 *               export it back into this file).
 */

/*
 * Categories mirror the blip legend the game itself shows on the pause map
 * (Trucking HQ, Market (…), Loan Office, Sandstone Collector, Boost Zones …)
 * rather than generic GTA V groupings, so the filter chips line up with what a
 * player already recognises in game.
 *
 * `blip` is a FiveM blip colour id. `sprite` is deliberately 1 (the plain marker)
 * everywhere: a wrong sprite number silently draws the wrong icon in game, and
 * these have not been verified on a live server. The full sprite list is in the
 * FiveM docs if you want to specialise them.
 */
export const CATEGORIES = {
  hq:       { label: 'HQs & Hubs',        short: 'HQ',      color: '#ffd166', blip: 5,  sprite: 1 },
  work:     { label: 'Job Sites',         short: 'Work',    color: '#6ee7b7', blip: 2,  sprite: 1 },
  market:   { label: 'Markets & Shops',   short: 'Market',  color: '#a78bfa', blip: 27, sprite: 1 },
  vehicle:  { label: 'Vehicle Services',  short: 'Vehicle', color: '#60a5fa', blip: 3,  sprite: 1 },
  money:    { label: 'Money',             short: 'Money',   color: '#86efac', blip: 11, sprite: 1 },
  boost:    { label: 'Zones & Alerts',    short: 'Zones',   color: '#f0abfc', blip: 8,  sprite: 1 },
  airport:  { label: 'Airports',          short: 'Air',     color: '#38bdf8', blip: 38, sprite: 1 },
  dock:     { label: 'Docks & Marinas',   short: 'Water',   color: '#22d3ee', blip: 15, sprite: 1 },
  city:     { label: 'Cities & Towns',    short: 'Towns',   color: '#e5e7eb', blip: 0,  sprite: 1 },
  landmark: { label: 'Landmarks',         short: 'Marks',   color: '#fb923c', blip: 17, sprite: 1 },
  island:   { label: 'Islands',           short: 'Isles',   color: '#fca5a5', blip: 19, sprite: 1 },
  custom:   { label: 'My Waypoints',      short: 'Mine',    color: '#ff5fd2', blip: 6,  sprite: 1 }
};

/** Blip colour presets that are safe across FiveM builds. */
export const BLIP_COLORS = [
  { id: 0,  name: 'White'      }, { id: 1,  name: 'Red'    },
  { id: 2,  name: 'Green'      }, { id: 3,  name: 'Blue'   },
  { id: 5,  name: 'Yellow'     }, { id: 15, name: 'Cyan'   },
  { id: 17, name: 'Orange'     }, { id: 27, name: 'Purple' },
  { id: 38, name: 'Deep Blue'  }, { id: 46, name: 'Dark Blue' }
];

/*
 * Every job on the server, from the wiki's Job Center page. Jobs are taken at a
 * Job Centre (the orange briefcases) rather than at a fixed spot of their own,
 * so each one lists where its work actually happens instead of a coordinate.
 */
export const JOBS = [
  { n: 'Trucker',            req: 'None',        d: 'Haul cargo between depots, warehouses and industry across the state.' },
  { n: 'PostOP Driver',      req: 'None',        d: 'Deliver parcels on set routes. Higher Strength recommended.' },
  { n: 'Bus Driver',         req: 'None',        d: 'Run passenger routes between towns and city stops.' },
  { n: 'Train Conductor',    req: 'None',        d: 'Drive freight and passenger rail across San Andreas.' },
  { n: 'Airline Pilot',      req: 'None',        d: 'Fly passengers between airports, working up to airliners.' },
  { n: 'Cargo Pilot',        req: 'Strength 9',  d: 'Fly freight between airports, working up to cargo planes.' },
  { n: 'Helicopter Pilot',   req: 'None',        d: 'Rotary charter and transport work.' },
  { n: 'Leisure Pilot',      req: 'None',        d: 'Casual flying with no contract pressure.' },
  { n: 'Fisher',             req: 'None',        d: 'Fish the coast, the Alamo Sea and the deep water. Strength helps.' },
  { n: 'Farmer',             req: 'None',        d: 'Harvest crops and work the fields around Grapeseed.' },
  { n: 'Garbage Collector',  req: 'None',        d: 'Run refuse routes through the city and county.' },
  { n: 'Wildlife Hunter',    req: 'None',        d: 'Hunt game in the northern wilderness. Strength helps.' },
  { n: 'Mechanic',           req: 'None',        d: 'Answer repair callouts from other players.' },
  { n: 'EMS / Paramedic',    req: 'Strength 5',  d: 'Respond to medical calls and revive players.' },
  { n: 'Firefighter',        req: 'None',        d: 'Respond to fire callouts from the stations.' },
  { n: 'Street Racer',       req: 'None',        d: 'Compete in races around the map.' },
  { n: 'Unemployed',         req: 'None',        d: 'No active job — free to do whatever you like.' }
];

export const LOCATIONS = [
  /* ------------------------------------------------------------------ *
   * JOB CENTRES — where you pick up / change a job
   * ------------------------------------------------------------------ */
  { id: 'jc-lifeinvader',  n: 'Job Centre — Lifeinvader',        c: 'hq'       , x: -1078, y: -250,  p: 'approx', d: 'Lifeinvader HQ, Rockford Hills' },
  { id: 'jc-mazebank',     n: 'Job Centre — Maze Bank Tower',    c: 'hq'       , x: -75,   y: -819,  p: 'approx', d: 'Downtown Los Santos' },
  { id: 'jc-legion',       n: 'Job Centre — Legion Square',      c: 'hq'       , x: 195,   y: -934,  p: 'approx', d: 'Central Los Santos' },
  { id: 'jc-lsia',         n: 'Job Centre — LSIA',               c: 'hq'       , x: -1037, y: -2737, p: 'approx', d: 'Los Santos International terminal' },
  { id: 'jc-ssia',         n: 'Job Centre — Sandy Shores Air',   c: 'hq'       , x: 1729,  y: 3308,  p: 'approx', d: 'Sandy Shores Airfield' },
  { id: 'jc-sandyhosp',    n: 'Job Centre — Sandy Shores Hosp.', c: 'hq'       , x: 1839,  y: 3672,  p: 'approx', d: 'Sandy Shores Medical Center' },
  { id: 'jc-grapeseed',    n: 'Job Centre — Grapeseed',          c: 'hq'       , x: 1698,  y: 4809,  p: 'approx', d: 'Grapeseed town centre' },
  { id: 'jc-paleto',       n: 'Job Centre — Paleto Bay Clinic',  c: 'hq'       , x: -247,  y: 6331,  p: 'approx', d: 'Paleto Bay Care Center' },
  { id: 'jc-vespucci',     n: 'Job Centre — Vespucci',           c: 'hq'       , x: -1224, y: -1490, p: 'approx', d: 'Vespucci Beach' },
  { id: 'jc-harmony',      n: 'Job Centre — Harmony',            c: 'hq'       , x: 275,   y: 2820,  p: 'approx', d: 'Harmony, Grand Senora Desert' },
  { id: 'jc-paletopd',     n: 'Job Centre — Paleto Sheriff',     c: 'hq'       , x: -448,  y: 6013,  p: 'approx', d: 'Paleto Bay Sheriff Office' },
  { id: 'jc-port',         n: 'Job Centre — Port of LS',         c: 'hq'       , x: 1085,  y: -2940, p: 'approx', d: 'Terminal docks' },

  /* ------------------------------------------------------------------ *
   * JOB SITES — where the actual work happens
   * ------------------------------------------------------------------ */
  { id: 'jb-truck-port',   n: 'Trucking — Port Depot',           c: 'work', x: 1085,  y: -2940, p: 'approx', d: 'Main cargo depot, Terminal' },
  { id: 'jb-truck-cypress',n: 'Trucking — Cypress Flats Yard',   c: 'work', x: 800,   y: -1900, p: 'approx', d: 'Industrial yard, East LS' },
  { id: 'jb-truck-paleto', n: 'Trucking — Paleto Depot',         c: 'work', x: -290,  y: 6110,  p: 'approx', d: 'North island cargo run' },
  { id: 'jb-truck-sandy',  n: 'Trucking — Sandy Shores Yard',    c: 'work', x: 1690,  y: 3600,  p: 'approx', d: 'Desert cargo run' },
  { id: 'jb-postop-ls',    n: 'PostOP — Los Santos Depot',       c: 'work', x: 74,    y: 111,   p: 'approx', d: 'Mail sorting, Vinewood' },
  { id: 'jb-postop-paleto',n: 'PostOP — Paleto Depot',           c: 'work', x: -400,  y: 6200,  p: 'approx', d: 'North mail route' },
  { id: 'jb-garbage',      n: 'Garbage — LS Depot',              c: 'work', x: -322,  y: -1545, p: 'approx', d: 'Refuse depot, La Puerta' },
  { id: 'jb-bus-ls',       n: 'Bus — Dashound Terminal',         c: 'work', x: 449,   y: -603,  p: 'approx', d: 'Downtown bus terminal' },
  { id: 'jb-bus-paleto',   n: 'Bus — Paleto Stop',               c: 'work', x: -180,  y: 6400,  p: 'approx', d: 'Northern bus loop' },
  { id: 'jb-train',        n: 'Train — LS Rail Yard',            c: 'work', x: 250,   y: -2500, p: 'approx', d: 'Freight rail depot' },
  { id: 'jb-train-north',  n: 'Train — North Yard',              c: 'work', x: 2650,  y: 2800,  p: 'approx', d: 'Desert rail siding' },
  { id: 'jb-farm-grape',   n: 'Farming — Grapeseed Fields',      c: 'work', x: 2200,  y: 4900,  p: 'approx', d: 'Crop harvesting' },
  { id: 'jb-farm-mckenzie',n: 'Farming — McKenzie Farm',         c: 'work', x: 2450,  y: 4750,  p: 'approx', d: 'Barn / silo' },
  { id: 'jb-fish-paleto',  n: 'Fishing — Paleto Pier',           c: 'work', x: -275,  y: 6635,  p: 'approx', d: 'North coast fishing' },
  { id: 'jb-fish-ls',      n: 'Fishing — LS Marina',             c: 'work', x: -808,  y: -1367, p: 'approx', d: 'Puerto Del Sol marina' },
  { id: 'jb-fish-alamo',   n: 'Fishing — Alamo Sea',             c: 'work', x: 1300,  y: 4200,  p: 'approx', d: 'Freshwater spot' },
  { id: 'jb-hunt',         n: 'Hunting — Chiliad Wilderness',    c: 'work', x: -1130, y: 4940,  p: 'approx', d: 'Wildlife hunting grounds' },
  { id: 'jb-hunt-gordo',   n: 'Hunting — Mount Gordo',           c: 'work', x: 2870,  y: 5900,  p: 'approx', d: 'North-east hunting' },
  { id: 'jb-mech',         n: 'Mechanic — LS Customs',           c: 'work', x: -337,  y: -136,  p: 'approx', d: 'Repair callouts' },
  { id: 'jb-fire-ls',      n: 'Firefighter — LS Fire Station',   c: 'work', x: 1193,  y: -1473, p: 'approx', d: 'Davis fire station' },
  { id: 'jb-fire-paleto',  n: 'Firefighter — Paleto Station',    c: 'work', x: -379,  y: 6120,  p: 'approx', d: 'North fire station' },
  { id: 'jb-ems-pillbox',  n: 'EMS — Pillbox Hospital',          c: 'work', x: 298,   y: -1448, p: 'approx', d: 'Main LS hospital' },
  { id: 'jb-ems-central',  n: 'EMS — Central LS Medical',        c: 'work', x: 340,   y: -585,  p: 'approx', d: 'Downtown hospital' },
  { id: 'jb-race-airport', n: 'Racing — LSIA Circuit',           c: 'work', x: -1200, y: -2700, p: 'approx', d: 'Street race start' },
  { id: 'jb-race-vinewood',n: 'Racing — Vinewood Hills',         c: 'work', x: 400,   y: 1200,  p: 'approx', d: 'Hill climb route' },
  { id: 'jb-heli',         n: 'Helicopter — Higgins Helitours',  c: 'work', x: -723,  y: -1462, p: 'approx', d: 'Heli charter pad' },

  /* ------------------------------------------------------------------ *
   * AIRPORTS & AIRSTRIPS
   * ------------------------------------------------------------------ */
  { id: 'ap-lsia',         n: 'LSIA — Passenger Terminal',       c: 'airport', x: -1037, y: -2737, p: 'approx', d: 'Los Santos International' },
  { id: 'ap-lsia-cargo',   n: 'LSIA — Cargo & Hangars',          c: 'airport', x: -1145, y: -2870, p: 'approx', d: 'Freight apron' },
  { id: 'ap-lsia-rwy',     n: 'LSIA — Main Runway',              c: 'airport', x: -1336, y: -3044, p: 'approx', d: 'Runway threshold' },
  { id: 'ap-ssia',         n: 'Sandy Shores Airfield',           c: 'airport', x: 1729,  y: 3308,  p: 'approx', d: 'SSIA — desert strip' },
  { id: 'ap-mckenzie',     n: 'McKenzie Field (Grapeseed)',      c: 'airport', x: 2121,  y: 4805,  p: 'approx', d: 'Northern strip' },
  { id: 'ap-zancudo',      n: 'Fort Zancudo Airbase',            c: 'airport', x: -2360, y: 3250,  p: 'approx', d: 'Military airfield — restricted' },
  { id: 'ap-cayo',         n: 'Cayo Perico Airstrip',            c: 'airport', x: 4456,  y: -4484, p: 'approx', d: 'Island runway' },
  { id: 'ap-helitours',    n: 'Higgins Helitours Pad',           c: 'airport', x: -723,  y: -1462, p: 'approx', d: 'Coastal heliport' },
  { id: 'ap-mazepad',      n: 'Maze Bank Rooftop Pad',           c: 'airport', x: -75,   y: -819,  p: 'approx', d: 'Downtown helipad' },
  { id: 'ap-hospitalpad',  n: 'Central Hospital Helipad',        c: 'airport', x: 351,   y: -588,  p: 'approx', d: 'EMS pad' },

  /* ------------------------------------------------------------------ *
   * DOCKS, PORTS & MARINAS
   * ------------------------------------------------------------------ */
  { id: 'dk-terminal',     n: 'Port of Los Santos — Terminal',   c: 'dock', x: 1085,  y: -2940, p: 'approx', d: 'Container cranes' },
  { id: 'dk-elysian',      n: 'Elysian Island Docks',            c: 'dock', x: 220,   y: -2650, p: 'approx', d: 'West port' },
  { id: 'dk-marina',       n: 'Puerto Del Sol Marina',           c: 'dock', x: -808,  y: -1367, p: 'approx', d: 'LS pleasure marina' },
  { id: 'dk-delperro',     n: 'Del Perro Pier',                  c: 'dock', x: -1850, y: -1231, p: 'approx', d: 'Beach pier' },
  { id: 'dk-paleto',       n: 'Paleto Bay Pier',                 c: 'dock', x: -275,  y: 6635,  p: 'approx', d: 'North coast dock' },
  { id: 'dk-catfish',      n: 'Catfish View Dock',               c: 'dock', x: 1300,  y: 4200,  p: 'approx', d: 'Alamo Sea launch' },
  { id: 'dk-chumash',      n: 'Chumash Boat Ramp',               c: 'dock', x: -3242, y: 1005,  p: 'approx', d: 'West coast launch' },
  { id: 'dk-cayo',         n: 'Cayo Perico Main Dock',           c: 'dock', x: 4930,  y: -5150, p: 'approx', d: 'Island harbour' },

  /* ------------------------------------------------------------------ *
   * CITIES & TOWNS
   * ------------------------------------------------------------------ */
  { id: 'ct-ls',           n: 'Los Santos (city centre)',        c: 'city', x: 228,   y: -878,  p: 'exact',  d: 'From the official Tycoon sample app' },
  { id: 'ct-sandy',        n: 'Sandy Shores',                    c: 'city', x: 1601,  y: 3662,  p: 'exact',  d: 'From the official Tycoon sample app' },
  { id: 'ct-paleto',       n: 'Paleto Bay',                      c: 'city', x: -267,  y: 6231,  p: 'exact',  d: 'From the official Tycoon sample app' },
  { id: 'ct-grapeseed',    n: 'Grapeseed',                       c: 'city', x: 1698,  y: 4809,  p: 'approx', d: 'Farming town' },
  { id: 'ct-harmony',      n: 'Harmony',                         c: 'city', x: 275,   y: 2820,  p: 'approx', d: 'Desert crossroads' },
  { id: 'ct-chumash',      n: 'Chumash',                         c: 'city', x: -3242, y: 1005,  p: 'approx', d: 'West coast village' },
  { id: 'ct-vespucci',     n: 'Vespucci Beach',                  c: 'city', x: -1224, y: -1490, p: 'approx', d: 'Boardwalk' },
  { id: 'ct-rockford',     n: 'Rockford Hills',                  c: 'city', x: -1300, y: -400,  p: 'approx', d: 'Upmarket district' },
  { id: 'ct-mirrorpark',   n: 'Mirror Park',                     c: 'city', x: 1080,  y: -650,  p: 'approx', d: 'East LS' },
  { id: 'ct-davis',        n: 'Davis',                           c: 'city', x: 100,   y: -1900, p: 'approx', d: 'South LS' },
  { id: 'ct-strawberry',   n: 'Strawberry',                      c: 'city', x: 200,   y: -1650, p: 'approx', d: 'South LS' },
  { id: 'ct-lamesa',       n: 'La Mesa',                         c: 'city', x: 800,   y: -1900, p: 'approx', d: 'Industrial East LS' },
  { id: 'ct-vinewood',     n: 'Vinewood',                        c: 'city', x: 300,   y: 200,   p: 'approx', d: 'Hollywood strip' },
  { id: 'ct-paletocove',   n: 'Paleto Cove',                     c: 'city', x: -2100, y: 5000,  p: 'approx', d: 'North-west coast' },

  /* ------------------------------------------------------------------ *
   * LANDMARKS
   * ------------------------------------------------------------------ */
  { id: 'lm-mazebank',     n: 'Maze Bank Tower',                 c: 'landmark', x: -75,   y: -819,  p: 'approx', d: 'Tallest building in LS' },
  { id: 'lm-uniondep',     n: 'Union Depository',                c: 'landmark', x: 2,     y: -667,  p: 'approx', d: 'Downtown vault' },
  { id: 'lm-casino',       n: 'Diamond Casino & Resort',         c: 'landmark', x: 925,   y: 46,    p: 'approx', d: 'East Vinewood' },
  { id: 'lm-vinewoodsign', n: 'Vinewood Sign',                   c: 'landmark', x: 711,   y: 1198,  p: 'approx', d: 'Hilltop letters' },
  { id: 'lm-observatory',  n: 'Galileo Observatory',             c: 'landmark', x: -438,  y: 1075,  p: 'approx', d: 'Vinewood Hills' },
  { id: 'lm-kortz',        n: 'Kortz Center',                    c: 'landmark', x: -2243, y: 264,   p: 'approx', d: 'Cliffside museum' },
  { id: 'lm-chiliad',      n: 'Mount Chiliad Summit',            c: 'landmark', x: 450,   y: 5566,  p: 'approx', d: 'Highest point — cable car' },
  { id: 'lm-gordo',        n: 'Mount Gordo',                     c: 'landmark', x: 2870,  y: 5900,  p: 'approx', d: 'North-east peak' },
  { id: 'lm-josiah',       n: 'Mount Josiah',                    c: 'landmark', x: -600,  y: 4400,  p: 'approx', d: 'Central-north peak' },
  { id: 'lm-bolingbroke',  n: 'Bolingbroke Penitentiary',        c: 'landmark', x: 1845,  y: 2585,  p: 'approx', d: 'Desert prison' },
  { id: 'lm-humanelabs',   n: 'Humane Labs & Research',          c: 'landmark', x: 3540,  y: 3675,  p: 'approx', d: 'East coast facility' },
  { id: 'lm-powerstation', n: 'Palmer-Taylor Power Station',     c: 'landmark', x: 2740,  y: 1550,  p: 'approx', d: 'Desert power plant' },
  { id: 'lm-windfarm',     n: 'RON Alternates Wind Farm',        c: 'landmark', x: 2350,  y: 1830,  p: 'approx', d: 'Turbine field' },
  { id: 'lm-cluckin',      n: 'Cluckin Bell Factory',            c: 'landmark', x: -70,   y: 6250,  p: 'approx', d: 'Paleto processing plant' },
  { id: 'lm-sawmill',      n: 'Paleto Sawmill',                  c: 'landmark', x: -530,  y: 5340,  p: 'approx', d: 'Timber mill' },
  { id: 'lm-altruist',     n: 'Altruist Camp',                   c: 'landmark', x: -1130, y: 4940,  p: 'approx', d: 'Chiliad wilderness' },
  { id: 'lm-alamo',        n: 'Alamo Sea',                       c: 'landmark', x: 900,   y: 4000,  p: 'approx', d: 'Inland lake' },
  { id: 'lm-raton',        n: 'Raton Canyon',                    c: 'landmark', x: -1600, y: 4400,  p: 'approx', d: 'River gorge' },
  { id: 'lm-zancudoriver', n: 'Zancudo River',                   c: 'landmark', x: -300,  y: 3000,  p: 'approx', d: 'Marshland' },
  { id: 'lm-tongva',       n: 'Tongva Hills',                    c: 'landmark', x: -1600, y: 2200,  p: 'approx', d: 'Vineyard country' },
  { id: 'lm-banham',       n: 'Banham Canyon',                   c: 'landmark', x: -2900, y: 1600,  p: 'approx', d: 'West cliffs' },
  { id: 'lm-pacificbluffs',n: 'Pacific Bluffs',                  c: 'landmark', x: -3000, y: 300,   p: 'approx', d: 'Coastal golf country' },
  { id: 'lm-chaparral',    n: 'Great Chaparral',                 c: 'landmark', x: -100,  y: 1900,  p: 'approx', d: 'Scrubland' },
  { id: 'lm-senora',       n: 'Grand Senora Desert',             c: 'landmark', x: 1200,  y: 2700,  p: 'approx', d: 'Open desert' },
  { id: 'lm-cassidy',      n: 'Cassidy Creek',                   c: 'landmark', x: -400,  y: 4400,  p: 'approx', d: 'North river' },
  { id: 'lm-zancudobase',  n: 'Fort Zancudo',                    c: 'landmark', x: -2360, y: 3250,  p: 'approx', d: 'Military base' },

  /* ------------------------------------------------------------------ *
   * ISLANDS
   * ------------------------------------------------------------------ */
  { id: 'is-cayo',         n: 'Cayo Perico',                     c: 'island', x: 4840,  y: -5175, p: 'approx', d: 'Main island, south-east of San Andreas' },
  { id: 'is-cayo-beach',   n: 'Cayo Perico — Main Beach',        c: 'island', x: 4890,  y: -4400, p: 'approx', d: 'Party beach / north shore' },
  { id: 'is-cayo-compound',n: 'Cayo Perico — El Rubio Compound', c: 'island', x: 5000,  y: -5750, p: 'approx', d: 'Purchasable business' },
  { id: 'is-cayo-village', n: 'Cayo Perico — Village',           c: 'island', x: 4500,  y: -4750, p: 'approx', d: 'Island settlement' },
  { id: 'is-elysian',      n: 'Elysian Island',                  c: 'island', x: 180,   y: -2450, p: 'approx', d: 'Port island south of LS — see also its docks' },
  { id: 'is-terminal',     n: 'Terminal Island',                 c: 'island', x: 1200,  y: -2700, p: 'approx', d: 'Container port island — see also the Port of LS' },

  /* ------------------------------------------------------------------ *
   * SERVICES
   * ------------------------------------------------------------------ */
  { id: 'sv-lscustoms',    n: 'Los Santos Customs — Burton',     c: 'vehicle', x: -337,  y: -136,  p: 'approx', d: 'Repair & modify' },
  { id: 'sv-lscustoms-s',  n: 'Los Santos Customs — La Mesa',    c: 'vehicle', x: 731,   y: -1088, p: 'approx', d: 'Repair & modify' },
  { id: 'sv-lscustoms-n',  n: 'Beeker\'s Garage — Paleto',       c: 'vehicle', x: 111,   y: 6626,  p: 'approx', d: 'North repair shop' },
  { id: 'sv-fuel-ls',      n: 'Fuel — Strawberry Ave',           c: 'market' , x: 265,   y: -1261, p: 'approx', d: 'City fuel stop' },
  { id: 'sv-fuel-sandy',   n: 'Fuel — Sandy Shores',             c: 'market' , x: 1701,  y: 3760,  p: 'approx', d: 'Desert fuel stop' },
  { id: 'sv-fuel-paleto',  n: 'Fuel — Paleto Bay',               c: 'market' , x: 160,   y: 6642,  p: 'approx', d: 'North fuel stop' },
  { id: 'sv-fuel-grape',   n: 'Fuel — Grapeseed',                c: 'market' , x: 1701,  y: 4933,  p: 'approx', d: 'Farm fuel stop' },
  { id: 'sv-bank-central', n: 'Bank — Legion Square',            c: 'money'  , x: 149,   y: -1040, p: 'approx', d: 'Fleeca branch' },
  { id: 'sv-bank-paleto',  n: 'Bank — Paleto Bay',               c: 'money'  , x: -104,  y: 6469,  p: 'approx', d: 'Blaine County branch' },
  { id: 'sv-bank-sandy',   n: 'Bank — Sandy Shores',             c: 'money'  , x: 1175,  y: 2706,  p: 'approx', d: 'Desert branch' }
];

/* ==================================================================== *
 * SURVEY TARGETS — real Transport Tycoon places, with no coordinates yet
 *
 * These names come straight off the in-game pause-map blip legend. The server
 * knows exactly where they are; this app does not, and there is no API that
 * hands them over. So instead of shipping guesses that would send you to the
 * wrong side of the county, they start unmapped: open Survey, drive to one,
 * press the capture key, and it becomes a real pin with exact coordinates.
 *
 * `multi: true` marks a name that exists many times over (37 ATMs, a gas
 * station in every town) — capturing one leaves it in the list so you can
 * collect the rest as you come across them.
 * ==================================================================== */

export const SURVEY_TARGETS = [
  /* HQs & hubs */
  { id: 'sv-trucking-hq',   n: 'Trucking HQ',              c: 'hq' },
  { id: 'sv-pigs-hq',       n: 'P.I.G.S HQ',               c: 'hq' },
  { id: 'sv-city-hall',     n: 'City Hall',                c: 'hq' },
  { id: 'sv-faction-hq',    n: 'Faction HQ',               c: 'hq',      multi: true },
  { id: 'sv-marketplace',   n: 'Marketplace',              c: 'hq' },
  { id: 'sv-supercomputer', n: 'Supercomputer',            c: 'hq' },
  { id: 'sv-spawn-select',  n: 'Spawn Selector',           c: 'hq',      multi: true },

  /* Job sites named in the trucking / job route list */
  { id: 'sv-logging',       n: 'Logging Camp',             c: 'work' },
  { id: 'sv-sorting',       n: 'Sorting Facility',         c: 'work' },
  { id: 'sv-mckenzie-exp',  n: 'McKenzie Export',          c: 'work' },
  { id: 'sv-sugar-mill',    n: 'Lombart Bay Sugar Mill',   c: 'work' },
  { id: 'sv-bristols',      n: 'Bristols Storage',         c: 'work' },
  { id: 'sv-recycling',     n: 'Recycling Plant',          c: 'work',    multi: true },
  { id: 'sv-sandstone',     n: 'Sandstone Collector',      c: 'work',    multi: true },
  { id: 'sv-prospecting',   n: 'Prospecting Site',         c: 'work',    multi: true },

  /* Markets — the Market (…) family from the legend */
  { id: 'sv-mkt-country',   n: 'Market (Country Club)',    c: 'market',  multi: true },
  { id: 'sv-mkt-equipment', n: 'Market (Equipment)',       c: 'market',  multi: true },
  { id: 'sv-mkt-farmer',    n: 'Market (Farmer Shop)',     c: 'market',  multi: true },
  { id: 'sv-mkt-fishing',   n: 'Market (Fishing / Diving)',c: 'market',  multi: true },
  { id: 'sv-mkt-gas',       n: 'Market (Gas Station)',     c: 'market',  multi: true },
  { id: 'sv-mkt-general',   n: 'Market (General Store)',   c: 'market',  multi: true },
  { id: 'sv-mkt-holiday',   n: 'Market (Holiday Shop)',    c: 'market',  multi: true },
  { id: 'sv-mkt-mechanic',  n: 'Market (Mechanic)',        c: 'market',  multi: true },
  { id: 'sv-mkt-medical',   n: 'Market (Medical Center)',  c: 'market',  multi: true },
  { id: 'sv-mkt-pizza',     n: 'Market (Pizza)',           c: 'market',  multi: true },
  { id: 'sv-mkt-vip',       n: 'Market (Premium / VIP)',   c: 'market',  multi: true },
  { id: 'sv-mkt-permits',   n: 'Market (Traffic Permits)', c: 'market',  multi: true },
  { id: 'sv-clothing',      n: 'Clothing Store',           c: 'market',  multi: true },

  /* Vehicle services */
  { id: 'sv-aircraft-shop', n: 'Aircraft Shop',            c: 'vehicle', multi: true },
  { id: 'sv-boat-shop',     n: 'Boat Shop',                c: 'vehicle', multi: true },
  { id: 'sv-lsc',           n: 'Los Santos Customs',       c: 'vehicle', multi: true },
  { id: 'sv-repair',        n: 'Repair Shop',              c: 'vehicle', multi: true },
  { id: 'sv-booster',       n: 'Vehicle Booster',          c: 'vehicle', multi: true },

  /* Money */
  { id: 'sv-atm',           n: 'ATM',                      c: 'money',   multi: true },
  { id: 'sv-loan',          n: 'Loan Office',              c: 'money',   multi: true },
  { id: 'sv-bonus-coll',    n: 'Bonus Collector',          c: 'money',   multi: true },
  { id: 'sv-business-bonus',n: 'Business Bonus',           c: 'money',   multi: true },

  /* Zones & alerts */
  { id: 'sv-exp-boost',     n: 'EXP Boost Zone',           c: 'boost',   multi: true },
  { id: 'sv-craft-boost',   n: 'Crafting Boost Zone',      c: 'boost',   multi: true },
  { id: 'sv-speed-trap',    n: 'Speed Trap',               c: 'boost',   multi: true }
];

/* ==================================================================== *
 * BASE MAP GEOMETRY
 * Stylised outlines in game-world coordinates. Not survey-accurate — it
 * exists to give the pins a recognisable shape to sit on.
 * ==================================================================== */

export const WORLD = { xMin: -4400, xMax: 6200, yMin: -6600, yMax: 7700 };

/*
 * Coastline, clockwise from the north-west. The vertices are pinned to places
 * that genuinely sit on the shore — Del Perro Pier, Chumash, Paleto Bay, LSIA,
 * the Port of LS, Humane Labs, Fort Zancudo — so pins land on the right side of
 * the water even though the curve between them is freehand.
 */
export const SAN_ANDREAS = [
  [-1750, 6100], [-1350, 6500], [-800, 6720], [-270, 6700], [350, 6620],
  [900, 6500], [1500, 6250], [2100, 6250], [2700, 6100], [3150, 5750],
  [3400, 5150], [3620, 4400], [3700, 3700], [3550, 3000], [3300, 2300],
  [3050, 1500], [2900, 700], [2800, -100], [2700, -900], [2450, -1700],
  [2150, -2350], [1800, -2850], [1450, -3200], [900, -3380], [300, -3400],
  [-350, -3250], [-950, -3080], [-1500, -2700], [-1750, -2200], [-1700, -1700],
  [-1900, -1250], [-2250, -750], [-2600, -100], [-2950, 550], [-3250, 1050],
  [-3400, 1700], [-3380, 2400], [-3150, 3000], [-2950, 3450], [-2800, 4000],
  [-2550, 4550], [-2250, 5050], [-2000, 5600]
];

export const CAYO_PERICO = [
  [4300, -4450], [4700, -4250], [5150, -4300], [5450, -4600], [5580, -5050],
  [5500, -5550], [5250, -5950], [4850, -6120], [4450, -6000], [4200, -5600],
  [4120, -5100]
];

/** Alamo Sea — inland lake. Sandy Shores sits just off its south-east shore. */
export const ALAMO_SEA = [
  [150, 3900], [400, 4420], [950, 4700], [1400, 4600], [1600, 4200],
  [1450, 3650], [1150, 3350], [600, 3350], [250, 3600]
];

/** Rough urban footprint of Los Santos, drawn as a lighter block. */
export const LS_URBAN = [
  [-1950, -1200], [-1500, -400], [-900, -100], [0, 100], [900, -100],
  [1500, -700], [1600, -1500], [1200, -2300], [400, -2900], [-600, -2900],
  [-1400, -2300], [-1900, -1800]
];

/** Main highway ring (Route 1 / 68) — stylised. */
export const HIGHWAYS = [
  [ [-1850, -1250], [-1400, -300], [-900, 600], [-700, 1600], [-500, 2600],
    [-400, 3600], [-500, 4600], [-350, 5500], [-260, 6230] ],
  [ [-260, 6230], [600, 6300], [1400, 5900], [1900, 5100], [2100, 4300],
    [1900, 3500], [1700, 2700], [1500, 1800], [1200, 900], [700, -200],
    [300, -900], [100, -1800], [-200, -2600], [-1000, -2740] ],
  [ [1700, 3300], [2600, 2900], [3100, 2200], [3400, 1500] ]
];

# Map overlays

Georeferenced patch images for regions where the base tiles are out of date.

The tiles come from the community live map, last re-rendered in 2024. The strip
north of the San Andreas coast still shows **Liberty City**, which the server
removed pre-wipe and replaced with **Roxwood County**.

## Current state

`roxwood.png` is a crop of an in-game pause-map screenshot. It shows the right
roads, but it is a screenshot: the pause map is semi-transparent, so scenery
bleeds through, the blips and the map cursor are baked in, and the position is
not yet calibrated. Good enough to navigate by, not pretty.

A clean replacement would be the map texture rather than a screenshot.

## Adding or replacing the image

1. Capture the area from the in-game pause map (F9 / pause → zoom to Roxwood).
   A straight-down screenshot with no HUD works best; crop to just the land.
2. Run `node scripts/prep-overlay.mjs <your.png>` — it crops to the map and
   feathers the edges, writing `roxwood.png` here.
3. Run the app with `?calibrate` on the URL, e.g.
   `http://127.0.0.1:8787/?calibrate`.
4. **Shift-drag** the map to move the overlay and **shift-wheel** to resize it,
   until your live player arrow sits where you actually are. Or nudge
   `x1/y1/x2/y2` by hand until the overlay's roads line up with the tiles either
   side of it, then paste the printed snippet into `OVERLAYS` in
   `public/data.js`.

`x1,y1` is the north-west corner and `x2,y2` the south-east, in game-world
coordinates — the same numbers `setWaypoint` takes.

An overlay whose image is missing is skipped, so the app is happy with this
directory empty.

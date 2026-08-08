# Map overlays

Georeferenced patch images for regions where the base tiles are out of date.

The tiles come from the community live map, last re-rendered in 2024. The strip
north of the San Andreas coast still shows **Liberty City**, which the server
removed pre-wipe and replaced with **Roxwood County**.

## Adding the Roxwood image

1. Capture the area from the in-game pause map (F9 / pause → zoom to Roxwood).
   A straight-down screenshot with no HUD works best; crop to just the land.
2. Save it here as `roxwood.png`.
3. Run the app with `?calibrate` on the URL, e.g.
   `http://127.0.0.1:8787/?calibrate`.
4. Nudge `x1/y1/x2/y2` until the overlay's roads line up with the tiles either
   side of it, then paste the printed snippet into `OVERLAYS` in
   `public/data.js`.

`x1,y1` is the north-west corner and `x2,y2` the south-east, in game-world
coordinates — the same numbers `setWaypoint` takes.

An overlay whose image is missing is skipped, so the app is happy with this
directory empty.

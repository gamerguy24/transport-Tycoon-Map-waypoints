/*
 * Downloads the Transport Tycoon map tiles into public/tiles/.
 *
 * The tiles come from the community live map, ttmap.eu
 * (https://github.com/supernovaplus/ttmap), which in turn renders Rockstar's
 * GTA V map art. That repository ships no licence file, and the underlying art
 * is Rockstar's, so the tiles are NOT committed to this repo — you fetch them
 * yourself, and you decide whether hosting them is appropriate for you.
 *
 * Credits carried over from the source project's data/credits.txt:
 *   TTmap by Nova+           https://github.com/supernovaplus/
 *   Map data by glitchdetector
 *   Map help: Morfik, Rock and Hike
 *
 *   node scripts/fetch-tiles.mjs [--set dark|color] [--max-zoom 7]
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync, readdirSync, renameSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const set = argOf('--set', 'dark');
const maxZoom = Number(argOf('--max-zoom', '7'));
const srcDir = `${set}-mode-tiles`;
const repo = 'supernovaplus/ttmap';
const branch = argOf('--branch', 'master');
const tarball = `https://codeload.github.com/${repo}/tar.gz/refs/heads/${branch}`;

const work = join(root, '.tiles-tmp');
const dest = join(root, 'public', 'tiles');

console.log(`Fetching ${set}-mode tiles (zoom ≤ ${maxZoom}) …`);

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

// One tarball beats 1,366 individual requests against raw.githubusercontent.
console.log('  downloading archive …');
execFileSync('curl', ['-sL', '--fail', tarball, '-o', 'ttmap.tar.gz'], { cwd: work, stdio: 'inherit' });

console.log('  extracting …');
// Relative paths with cwd, because GNU tar (Git Bash) reads an absolute
// "D:\..." as a host:path remote spec while Windows' bundled bsdtar does not.
execFileSync('tar', [
  '-xzf', 'ttmap.tar.gz',
  '--strip-components=3',
  `ttmap-${branch}/images/maps/${srcDir}`
], { cwd: work, stdio: 'inherit' });

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

let kept = 0;
let skipped = 0;
let bytes = 0;
for (const file of readdirSync(join(work, srcDir))) {
  const match = /^(\d+)_(\d+)_(\d+)\.jpg$/.exec(file);
  if (!match) continue;
  if (Number(match[1]) > maxZoom) { skipped++; continue; }
  const from = join(work, srcDir, file);
  bytes += statSync(from).size;
  renameSync(from, join(dest, file));
  kept++;
}

rmSync(work, { recursive: true, force: true });

if (!kept) {
  console.error('No tiles extracted — the upstream layout may have changed.');
  process.exit(1);
}

console.log(`\nDone: ${kept} tiles, ${(bytes / 1048576).toFixed(1)} MB in public/tiles/`);
if (skipped) console.log(`      ${skipped} tiles above zoom ${maxZoom} skipped`);
console.log('These are not committed — see .gitignore and the README.');

/*
 * Runs scripts/prep-overlay.html in headless Chrome to turn a raw pause-map
 * screenshot into a cropped, alpha-masked overlay, and reports the world size
 * derived from the map's own scale bar.
 *
 *   node scripts/prep-overlay.mjs <input.png> [output.png]
 *
 * Chrome is used because the work is all canvas pixel pushing and the project
 * has no image libraries; adding one just for this is not worth it.
 */

import { copyFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(process.argv[2] || '');
const output = resolve(process.argv[3] || join(root, 'public', 'overlays', 'roxwood.png'));

if (!input || !existsSync(input)) {
  console.error('usage: node scripts/prep-overlay.mjs <input.png> [output.png]');
  process.exit(1);
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((p) => existsSync(p));

if (!CHROME) { console.error('Chrome not found — needed for canvas processing.'); process.exit(1); }

// Chrome will not read a file:// image into a canvas from another file:// page
// without --allow-file-access-from-files; a scratch dir keeps them together.
const work = join(root, '.overlay-tmp');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
copyFileSync(input, join(work, 'input.png'));
copyFileSync(join(root, 'scripts', 'prep-overlay.html'), join(work, 'prep.html'));

const port = 9444;
const profile = join(work, 'profile');
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `file:///${join(work, 'prep.html').replace(/\\/g, '/')}?src=./input.png`
], { stdio: 'ignore', detached: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.url.includes('prep.html'));
    } catch { /* still starting */ }
  }
  if (!target) throw new Error('Chrome did not start');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const evaluate = (expression) => new Promise((res) => {
    const myId = ++id;
    pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method: 'Runtime.evaluate',
      params: { expression, returnByValue: true } }));
  });

  let result = null;
  for (let i = 0; i < 30 && !result; i++) {
    await sleep(500);
    const r = await evaluate('window.__result ? JSON.stringify(window.__result) : null');
    const v = r.result?.result?.value;
    if (v) result = JSON.parse(v);
  }
  ws.close();
  if (!result) throw new Error('processing timed out');
  if (result.error) throw new Error(result.error);

  const b64 = result.png.replace(/^data:image\/png;base64,/, '');
  writeFileSync(output, Buffer.from(b64, 'base64'));

  console.log(`source        ${result.source.w} x ${result.source.h}`);
  console.log(`cropped to    ${result.crop.w} x ${result.crop.h}  (at ${result.crop.x}, ${result.crop.y})`);
  console.log(`scale bar     ${result.scaleBarPx} px`);
  console.log(`resolution    ${result.unitsPerPixel?.toFixed(3)} world units per pixel`);
  if (result.worldSize) {
    console.log(`world size    ${result.worldSize.w} x ${result.worldSize.h} units`);
    console.log('\nThat size is exact — it comes from the map\'s own scale bar. Only the');
    console.log('position still needs pinning down: run the app with ?calibrate and');
    console.log('shift-drag the overlay until your player arrow lands where you are stood.');
  }
  console.log(`\nwrote ${output}`);
} finally {
  try { chrome.kill(); } catch { /* already gone */ }
  try { execSync('taskkill /F /PID ' + chrome.pid, { stdio: 'ignore' }); } catch { /* not windows / gone */ }
  // Chrome holds the profile directory open for a moment after exit; failing to
  // delete scratch must never lose the result we just wrote.
  await sleep(800);
  try { rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); }
  catch { console.warn(`(left ${work} behind — Chrome still had it open)`); }
}

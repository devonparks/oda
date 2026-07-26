/**
 * Colour grading A/B — against the live park, measured on the same surface.
 *
 * I had twice reasoned my way to a colour-space answer and twice been wrong,
 * so this stops reasoning and compares pixels. It parks the LIVE three.js park
 * and the NEW engine at the same world position looking the same way, samples
 * a patch of the same grass out of each framebuffer, and prints the RGB. Then
 * it sweeps the new engine's grading and shoots each variant to look at.
 *
 *   node tools/engine/probe_grade.mjs
 */
import { boot, shoot, peek, settle, SHOT_DIR } from './probe_lib.mjs';
import { createRequire } from 'module';
import path from 'node:path';
const req = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/node_modules/');
const puppeteer = req('puppeteer');

// A wide, flat, unambiguous patch of park lawn, and a camera that fills the
// frame with it — nothing else in shot to average in.
const FROM = [2, 3.2, 26];
const AT = [2, 0, 18];
const PATCH = [440, 470, 400, 220];      // x, y, w, h in the 1280x800 frame

// ── the live park ────────────────────────────────────────────────────────
const b2 = await puppeteer.launch({ channel: 'chrome', headless: true, defaultViewport: { width: 1280, height: 800 } });
const p2 = await b2.newPage();
await p2.evaluateOnNewDocument(() => {
  localStorage.setItem('amgWorldQuality', 'high');
  localStorage.setItem('amgWorldOnboarded', '1');
});
await p2.goto('http://localhost:3457/world/index.html', { waitUntil: 'domcontentloaded' });
await p2.waitForSelector('#enterBtn', { visible: true, timeout: 60000 });
await p2.click('#enterBtn');
await p2.waitForFunction(() => window.__world?.state?.player, { timeout: 120000 });
await settle(p2, 1200);

const live = await p2.evaluate((from, at, patch) => {
  const w = window.__world.world;
  document.getElementById('hud')?.classList.add('hidden');
  // Freeze the camera where we want it: main.js re-aims it from the player
  // every frame, so park the player there and stop the follow by overriding.
  w.camera.position.set(from[0], from[1], from[2]);
  w.camera.lookAt(at[0], at[1], at[2]);
  w.renderer.render(w.scene, w.camera);
  const gl = w.renderer.getContext();
  const [x, y, pw, ph] = patch;
  const px = new Uint8Array(pw * ph * 4);
  gl.readPixels(x, gl.drawingBufferHeight - y - ph, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
  const n = px.length / 4;
  return {
    rgb: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
    toneMapping: w.renderer.toneMapping, exposure: w.renderer.toneMappingExposure,
  };
}, FROM, AT, PATCH);
await p2.screenshot({ path: path.join(SHOT_DIR, 'grade_00_LIVE_threejs.png') });
await b2.close();
console.log('\nLIVE three.js park  grass rgb', live.rgb, ` (toneMapping ${live.toneMapping}, exposure ${live.exposure})`);

// ── the new engine, swept ────────────────────────────────────────────────
const { browser, page } = await boot({ log: false });

const VARIANTS = [
  { name: 'A_no_tone', grade: { tone: false, sky: 1.5, sun: 2.2 } },
  { name: 'B_aces_115', grade: { tone: true, exposure: 1.15, sky: 1.5, sun: 2.2 } },
  { name: 'C_aces_160', grade: { tone: true, exposure: 1.6, sky: 1.5, sun: 2.2 } },
  { name: 'D_aces_200', grade: { tone: true, exposure: 2.0, sky: 1.8, sun: 2.6 } },
  { name: 'E_no_tone_dim', grade: { tone: false, sky: 1.0, sun: 1.5 } },
];

console.log('\nnew engine:');
let best = null;
for (const v of VARIANTS) {
  await peek(page, (g) => window.__engine.grade(g), v.grade);
  const rgb = await (async () => {
    await peek(page, (f, a) => window.__engine.look(f, a), FROM, AT);
    await peek(page, () => document.getElementById('hud')?.classList.add('hidden'));
    await settle(page, 300);
    return peek(page, (p) => window.__engine.sample(p[0], p[1], p[2], p[3]), PATCH);
  })();
  const dist = Math.hypot(rgb[0] - live.rgb[0], rgb[1] - live.rgb[1], rgb[2] - live.rgb[2]);
  console.log(`  ${v.name.padEnd(14)} rgb ${JSON.stringify(rgb).padEnd(18)} distance from live ${dist.toFixed(1)}`);
  if (!best || dist < best.dist) best = { ...v, rgb, dist };
  await shoot(page, 'grade_' + v.name, { from: FROM, at: AT });
}
console.log(`\nclosest to the live park: ${best.name} (distance ${best.dist.toFixed(1)})`);
console.log('Now LOOK at the shots — closest-by-number is a shortlist, not a verdict.\n');
await browser.close();

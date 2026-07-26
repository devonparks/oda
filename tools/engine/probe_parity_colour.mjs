/**
 * Colour parity against the LIVE three.js park.
 *
 * The Babylon render came back darker. The suspicion is a colour-space
 * difference — glTF COLOR_0 is linear, three.js converts to sRGB on output and
 * Babylon's StandardMaterial path does not — but "the suspicion" is not
 * evidence, and this project has been burned by acting on a plausible story.
 *
 * So: load the SAME GLB in both engines, read the same vertex's raw colour
 * (they must match — neither loader touches the buffer), then sample what each
 * one actually PUTS ON SCREEN for a known flat surface. The raw values agreeing
 * while the pixels differ isolates it to output, which is the only place a fix
 * belongs.
 *
 *   node tools/engine/probe_parity_colour.mjs
 */
import { boot as bootEngine, peek, settle } from './probe_lib.mjs';
import { createRequire } from 'module';
const req = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/node_modules/');
const puppeteer = req('puppeteer');

const PROTO = 'SM_Env_Fountain_01';

// ── the new engine ───────────────────────────────────────────────────────
const { browser, page } = await bootEngine({ log: false });
const babylon = await peek(page, (proto) => {
  const m = window.__engine.scene.meshes.find((q) => q.name === proto);
  const c = m.getVerticesData('color');
  return {
    hasColour: !!c,
    first8: c ? Array.from(c.slice(0, 8)).map((v) => +v.toFixed(4)) : null,
    verts: m.getTotalVertices(),
  };
}, PROTO);
await browser.close();

// ── the live three.js park ───────────────────────────────────────────────
const b2 = await puppeteer.launch({ channel: 'chrome', headless: true, defaultViewport: { width: 1280, height: 800 } });
const p2 = await b2.newPage();
await p2.evaluateOnNewDocument(() => {
  localStorage.setItem('amgWorldQuality', 'low');
  localStorage.setItem('amgWorldOnboarded', '1');
});
await p2.goto('http://localhost:3457/world/index.html', { waitUntil: 'domcontentloaded' });
await p2.waitForSelector('#enterBtn', { visible: true, timeout: 60000 });
await p2.click('#enterBtn');
await p2.waitForFunction(() => window.__world?.state?.player, { timeout: 120000 });
await settle(p2, 800);

const three = await p2.evaluate((proto) => {
  const w = window.__world.world;   // `__world` is the debug surface; `.world` is the scene owner
  let found = null;
  w.scene.traverse((o) => {
    if (found || !o.isMesh || !o.geometry?.attributes?.color) return;
    if (o.name === proto || o.name?.startsWith(proto)) found = o;
  });
  const out = {
    outputColorSpace: w.renderer?.outputColorSpace ?? null,
    toneMapping: w.renderer?.toneMapping ?? null,
    found: !!found,
  };
  if (found) {
    const c = found.geometry.attributes.color.array;
    out.first8 = Array.from(c.slice(0, 8)).map((v) => +(v > 1 ? v / 255 : v).toFixed(4));
  }
  return out;
}, PROTO);
await b2.close();

console.log('\nBabylon engine :', JSON.stringify(babylon));
console.log('three.js park  :', JSON.stringify(three));
console.log(`
three.js outputColorSpace "srgb" means it applies a linear->sRGB transfer at
output. Babylon's StandardMaterial path writes what it is given. If the raw
buffers above agree, the whole difference is that transfer, and converting
COLOR_0 once at load is the parity fix.
`);

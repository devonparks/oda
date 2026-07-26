/**
 * AMG World probe harness — boots the real park in real Chrome via puppeteer.
 *
 * The in-app browser pane freezes rAF, so the world never steps there; every
 * verification in this project runs through here instead. Usage:
 *
 *   import { bootWorld } from './probe_lib.mjs';
 *   const { browser, page } = await bootWorld();
 *   ... page.evaluate(() => window.__world.state...) ...
 *   await browser.close();
 *
 * Requires the dev server: python -m http.server 3457 from the repo root
 * (launch.json name `amghub2`). Puppeteer is borrowed from Drop4's
 * node_modules via createRequire — ESM ignores NODE_PATH.
 *
 * Synthetic key events must be dispatched on document.body, not window:
 * main.js's handler calls e.target.matches(...) and window has no .matches.
 */
import { createRequire } from 'module';
const req = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/node_modules/');
export const puppeteer = req('puppeteer');

export const URL_WORLD = 'http://localhost:3457/world/index.html';

export async function bootWorld({ headless = true, quality = 'low', log = true } = {}) {
  const browser = await puppeteer.launch({
    channel: 'chrome',            // the real installed Chrome, not the cache
    headless,
    args: ['--window-size=1280,800', '--mute-audio'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => {
    logs.push(m.text());
    if (log && /\[world\]|error/i.test(m.text())) console.log('  [page]', m.text());
  });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  // low quality = no shadows and less fog work; probes measure, they don't look
  await page.evaluateOnNewDocument((q) => {
    localStorage.setItem('amgWorldQuality', q);
    localStorage.setItem('amgWorldOnboarded', '1');
    localStorage.removeItem('amgWorldPos');       // deterministic spawn
  }, quality);

  await page.goto(URL_WORLD, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#enterBtn', { visible: true, timeout: 60000 });
  await page.click('#enterBtn');
  await page.waitForFunction(
    () => window.__world && window.__world.state && window.__world.state.player,
    { timeout: 120000 },
  );
  // let a few frames run so rides/zones/heightfield all exist
  await sleep(600);
  return { browser, page, logs };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Press-and-release a key on document.body (where main.js listens). */
export async function tapKey(page, code, ms = 90) {
  await page.evaluate((c) => {
    const ev = (type) => document.body.dispatchEvent(
      new KeyboardEvent(type, { code: c, bubbles: true }));
    ev('keydown');
  }, code);
  await sleep(ms);
  await page.evaluate((c) => {
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
  }, code);
}

/** Hold a key down (input.js keeps it until keyup). */
export async function keyDown(page, code) {
  await page.evaluate((c) => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
  }, code);
}
export async function keyUp(page, code) {
  await page.evaluate((c) => {
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
  }, code);
}

/** Teleport and settle. */
export async function tp(page, x, z, settleMs = 500) {
  await page.evaluate((x2, z2) => window.__world.tp(x2, z2), x, z);
  await sleep(settleMs);
}

/**
 * AMG World Engine probe harness — boots the Babylon engine in real Chrome.
 *
 * Devon's rule, and the reason this file is the first tool in the directory:
 * *"you're not visually auditing the changes."* Numbers said "on the chain"
 * while the picture showed a hand holding air, and the picture was right. So
 * every probe here ends in a screenshot that gets LOOKED at, not just a
 * console.log that gets read.
 *
 * The in-app browser pane freezes requestAnimationFrame, so the world never
 * steps there — `channel: 'chrome'` drives the real installed browser.
 *
 * Requires the static server:  python -m http.server 3457   (launch.json `amghub2`)
 *
 *   import { boot, shoot } from './probe_lib.mjs';
 *   const { browser, page } = await boot();
 *   await shoot(page, 'swings', { from: [4, 2, 12], at: [4, 1, 15] });
 *   await browser.close();
 */
import { createRequire } from 'module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Puppeteer is borrowed from Drop4's node_modules — ESM ignores NODE_PATH, so
// this has to be an explicit createRequire against a real path.
const req = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/node_modules/');
export const puppeteer = req('puppeteer');

export const URL_ENGINE = 'http://localhost:3457/engine/index.html';
export const SHOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '_shots');

/**
 * Boot the engine and wait until `window.__engine.ready`.
 * @param {{headless?:boolean, dev?:boolean, width?:number, height?:number, log?:boolean}} opts
 */
export async function boot({ headless = true, dev = false, npc = false, width = 1280, height = 800, log = true } = {}) {
  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless,
    args: [`--window-size=${width},${height}`, '--mute-audio', '--enable-unsafe-swiftshader'],
    defaultViewport: { width, height },
  });
  const page = await browser.newPage();
  const logs = [];
  const errors = [];
  page.on('console', (m) => {
    logs.push(m.text());
    if (log && /\[engine\]|\[park\]|error/i.test(m.text())) console.log('  [page]', m.text());
  });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message); });

  /**
   * NPCs are OFF unless a probe asks for them. They wander and sit on real
   * prop-database seats, which is the point of them — and which would make
   * every other probe non-deterministic: `probe_props` mounts all 32 props,
   * and a bench with a kid already on it correctly refuses.
   */
  const qs = [];
  if (dev) qs.push('dev');
  if (!npc) qs.push('npc=0');
  await page.goto(URL_ENGINE + (qs.length ? '?' + qs.join('&') : ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__engine && window.__engine.ready, { timeout: 120000 })
    .catch(async () => {
      // Boot failed — surface the real reason rather than a bare timeout.
      const msg = await page.evaluate(() => document.getElementById('fatalMsg')?.textContent || '');
      throw new Error('engine did not boot.\n' + (msg || errors.join('\n') || logs.slice(-12).join('\n')));
    });
  await settle(page, 500);
  return { browser, page, logs, errors };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait for `frames` rendered frames — more honest than a fixed sleep. */
export async function settle(page, ms = 300, frames = 3) {
  await sleep(ms);
  await page.evaluate((n) => new Promise((res) => {
    let i = 0;
    const tick = () => (++i >= n ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), frames);
}

/**
 * Point the camera and take a picture.
 *
 * The whole point of the harness. `from`/`at` are world coordinates in the
 * park's own right-handed space, so they can be copied straight out of
 * park_layout.json.
 *
 * @returns {string} the file written
 */
export async function shoot(page, name, { from, at, hideHud = true, settleMs = 350 } = {}) {
  if (from && at) await page.evaluate((f, a) => window.__engine.look(f, a), from, at);
  if (hideHud) await page.evaluate(() => { document.getElementById('hud')?.classList.add('hidden'); });
  await settle(page, settleMs);
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('  shot →', path.relative(process.cwd(), file));
  return file;
}

/** Read anything off the live engine. */
export const peek = (page, fn, ...args) => page.evaluate(fn, ...args);

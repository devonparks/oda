/**
 * Screenshot the pose harness with REAL Chrome (the in-app pane can't
 * composite WebGL). Uses Drop4's puppeteer install read-only via NODE_PATH:
 *
 *   NODE_PATH="C:/Users/devon/OneDrive/Desktop/Drop4/node_modules" \
 *     node tools/world/render_pose.mjs [outPng] [posesUrl]
 *
 * Requires the static server on :3456 (already running).
 */
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/');
const puppeteer = require('puppeteer');

const out = process.argv[2] || 'C:/Users/devon/OneDrive/Desktop/ODA/tools/world/_lab_render.png';
const poses = process.argv[3] || '/tools/world/_lab_poses.json';
const url = `http://localhost:3456/tools/world/render_pose.html?poses=${encodeURIComponent(poses)}&t=${Date.now()}`;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1100,1500'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1400 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page-err]', m.text()); });
  page.on('pageerror', (e) => console.log('[page-exc]', e.message));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction("document.title === 'RENDER-DONE'", { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: out, fullPage: true });
  console.log('screenshot:', out);
} finally {
  await browser.close();
}

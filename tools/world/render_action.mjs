/**
 * Screenshot the ACTION pose harness with real Chrome (the in-app pane can't
 * composite WebGL). Sibling of render_pose.mjs, pointed at render_action.html
 * and the amghub2 dev server on :3457.
 *
 *   node tools/world/bake_actions_v2.mjs poses          # write the pose json
 *   NODE_PATH="C:/Users/devon/OneDrive/Desktop/Drop4/node_modules" \
 *     node tools/world/render_action.mjs [outPng] [posesUrl]
 */
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/');
const puppeteer = require('puppeteer');

const out = process.argv[2] || 'C:/Users/devon/OneDrive/Desktop/ODA/tools/world/_action_render.png';
const poses = process.argv[3] || '/tools/world/_action_poses.json';
const url = `http://localhost:3457/tools/world/render_action.html?poses=${encodeURIComponent(poses)}&t=${Date.now()}`;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1200,1600'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1090, height: 1400 });
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

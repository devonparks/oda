/**
 * End-to-end proof of Express Mode: load the real Drop4 Hub page in real
 * Chrome, open Express, tap an emote, screenshot mid-playback.
 *   node arcade/drop4/tools/express_e2e.mjs [emoteLabel] [outPng]
 */
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/');
const puppeteer = require('puppeteer');

const emote = process.argv[2] || 'Wave';
const out = process.argv[3] || 'C:/Users/devon/OneDrive/Desktop/ODA/arcade/drop4/tools/_express_e2e.png';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=520,980'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 500, height: 950 });
  page.on('pageerror', (e) => console.log('[page-exc]', e.message));
  await page.goto('http://localhost:3456/arcade/drop4/index.html?t=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
  // open Express
  await page.evaluate(() => window.D4.showExpress());
  await page.waitForSelector('.d4x-emote', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500)); // let the GLB land
  // tap the emote by label
  const clicked = await page.evaluate((label) => {
    const btns = [...document.querySelectorAll('.d4x-emote')];
    const b = btns.find((x) => x.textContent.toLowerCase().includes(label.toLowerCase()));
    if (b) { b.click(); return b.textContent.trim(); }
    return null;
  }, emote);
  console.log('clicked:', clicked);
  await new Promise((r) => setTimeout(r, 900)); // mid-emote
  await page.screenshot({ path: out });
  console.log('screenshot:', out);
} finally {
  await browser.close();
}

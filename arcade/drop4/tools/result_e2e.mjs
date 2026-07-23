/**
 * E2E: play a real easy match until any result, then screenshot the result
 * screen with the celebration character mid-emote.
 *   node arcade/drop4/tools/result_e2e.mjs [outPng]
 */
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/devon/OneDrive/Desktop/Drop4/');
const puppeteer = require('puppeteer');

const out = process.argv[2] || 'C:/Users/devon/OneDrive/Desktop/ODA/arcade/drop4/tools/_result_e2e.png';

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
  await page.evaluate(() => window.D4.startCasual('easy'));
  await page.waitForSelector('#d4Canvas', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 800));

  // click columns until the result screen appears (win OR loss both celebrate)
  const done = await page.evaluate(async () => {
    const canvas = document.getElementById('d4Canvas');
    const rect = () => canvas.getBoundingClientRect();
    const clickCol = (fx) => {
      const r = rect();
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width * fx, clientY: r.top + r.height * 0.3, bubbles: true }));
    };
    // stack one column, fall back to others when full/blocked
    const cols = [0.30, 0.30, 0.30, 0.30, 0.44, 0.44, 0.44, 0.58, 0.58, 0.16, 0.16, 0.72, 0.72, 0.30, 0.44, 0.58, 0.86, 0.86, 0.16, 0.72, 0.30, 0.44, 0.58, 0.86, 0.16, 0.72, 0.30, 0.44];
    for (let i = 0; i < cols.length; i++) {
      if (document.getElementById('resultScreen').classList.contains('active')) return 'result at click ' + i;
      clickCol(cols[i]);
      await new Promise((r) => setTimeout(r, 1250)); // player drop + AI think/drop
    }
    for (let w = 0; w < 20; w++) {
      if (document.getElementById('resultScreen').classList.contains('active')) return 'result late';
      await new Promise((r) => setTimeout(r, 500));
    }
    return 'no result';
  });
  console.log('match:', done);
  await new Promise((r) => setTimeout(r, 1600)); // celebration mount + emote start
  const title = await page.evaluate(() => document.getElementById('resultTitle').textContent + ' / celeb canvas: ' + !!document.querySelector('#resultCelebration canvas'));
  console.log('result:', title);
  await page.screenshot({ path: out });
  console.log('screenshot:', out);
} finally {
  await browser.close();
}

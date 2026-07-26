import { bootWorld } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });
const res = await page.evaluate(() => {
  const col = window.__world.world.collision;
  const rows = [];
  for (let x = -4.5; x <= 3.01; x += 0.5) {
    rows.push({ x: +x.toFixed(1), g: +col.groundAt(x, -1.75, 2.6).toFixed(2), g2: +col.groundAt(x, -1.75, 0.4).toFixed(2) });
  }
  return rows;
});
console.log(JSON.stringify(res));
await browser.close();

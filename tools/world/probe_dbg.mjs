import { bootWorld } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });
const r = await page.evaluate(() => {
  const W = window.__world.world, R = window.__world.state.rides;
  return { animated: W.animatedProps.map(p=>p.userData.kind), zip: !!R.zip,
           monkeyBars: !!W.monkeyBars, slideData: W.slideData.length };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();

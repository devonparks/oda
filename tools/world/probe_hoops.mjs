import { bootWorld, sleep } from './probe_lib.mjs';
const SCRATCH = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page } = await bootWorld({ headless: true, log: false });
const hoops = await page.evaluate(() => {
  const rides = window.__world.state.rides;
  return rides.hoops.map((h) => ({
    lying: Math.abs(h.mesh.rotation.x - Math.PI / 2) < 0.2,
    y: +h.mesh.position.y.toFixed(2),
  }));
});
console.log(JSON.stringify(hoops));
await page.evaluate(() => {
  const w = window.__world;
  w.tp(-4.2, 1.4);
  w.state.world.camYaw = 2.6;
  w.state.world.camPitch = 0.55;
  w.state.world.camDist = 4.5;
});
await sleep(1500);
await page.screenshot({ path: SCRATCH + '/hoops_after.png' });
await browser.close();

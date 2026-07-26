/** Does the per-object park look like the park? Wide shots + counts. */
import { bootWorld, sleep } from './probe_lib.mjs';
const SC = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page, logs } = await bootWorld({ headless: true, log: false });
console.log(logs.filter((l) => /\[world\]/.test(l)).join('\n'));
const info = await page.evaluate(() => {
  const W = window.__world.world, S = window.__world.state;
  let shellTris = 0, propTris = 0;
  W.shell.traverse((o) => { if (o.isMesh) shellTris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  if (W.propBatch) propTris = W.propBatch.geometry.index ? W.propBatch.geometry.index.count / 3 : W.propBatch.geometry.attributes.position.count / 3;
  return {
    shellTris: Math.round(shellTris), propTris: Math.round(propTris),
    swingSeats: (W.swingSeats || []).length,
    spinners: S.rides.spinners.map((s) => ({ parts: s.group.children.length, at: [+s.group.position.x.toFixed(1), +s.group.position.z.toFixed(1)], seatR: +s.seatR.toFixed(2) })),
    animated: W.animatedProps.length,
    backdropLayers: W.backdrop ? W.backdrop.children.length : 0,
    draw: window.__world.stats().drawCalls,
  };
});
console.log(JSON.stringify(info, null, 1));
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  for (const g of window.__world.world.zoneMarkers) g.visible = false;
});
// wide view of the whole park
await page.evaluate(() => { const w = window.__world; w.tp(4, 0); const W = w.state.world; W.camYaw = 2.4; W.camPitch = 0.55; W.camDist = 14; });
await sleep(1400);
await page.screenshot({ path: SC + '/newpark_wide.png' });
// horizon check
await page.evaluate(() => { const W = window.__world.state.world; W.camYaw = 0.9; W.camPitch = 0.06; W.camDist = 10; });
await sleep(700);
await page.screenshot({ path: SC + '/newpark_horizon.png' });
// the swings
await page.evaluate(() => { const w = window.__world; w.tp(27.5, 27.5); const W = w.state.world; W.camYaw = 0; W.camPitch = 0.16; W.camDist = 6; });
await sleep(1400);
await page.screenshot({ path: SC + '/newpark_swings.png' });
await browser.close();

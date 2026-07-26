/** The engine slice: pick a bicycle, delete it, prove it's gone and restorable. */
import { bootWorld, sleep } from './probe_lib.mjs';
const SC='C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page, logs } = await bootWorld({ headless: true, log: false });
console.log(logs.filter(l=>/\[world\] (objects|backdrop)/.test(l)).join('\n'));

const res = await page.evaluate(() => {
  const W = window.__world.world, O = W.objects;
  const st = O.stats();
  // find every bicycle and the jeep by prefab
  const bikes = O.items.filter(i => /Bike_0/.test(i.name));
  const jeep = O.items.filter(i => /4x4/.test(i.name));
  const boards = O.items.filter(i => /Skateboard/.test(i.name));
  const before = [];
  for (const b of bikes.slice(0,1)) {
    const pos = b.mesh && b.mesh.geometry.attributes.position;
    before.push(pos ? Array.from(pos.array.slice(b.start*3, b.start*3+6)) : null);
  }
  return { st, bikes: bikes.length, jeepParts: jeep.length, boards: boards.length,
           sample: bikes[0] ? {name:bikes[0].name, prefab:bikes[0].prefab, kind:bikes[0].kind,
                               count:bikes[0].count, layer:bikes[0].layer} : null, before };
});
console.log(JSON.stringify(res, null, 1));

// delete ALL bikes, the jeep and the skateboards — exactly what Devon asked for
const del = await page.evaluate(() => {
  const W = window.__world.world, O = W.objects;
  let n = 0;
  for (const it of O.items) {
    if (/Bike_0|4x4|Skateboard|Scooter|Trike|Soapbox|Pogo|Red_Wagon/.test(it.name)) { O.setHidden(it, true); n++; }
  }
  return { removed: n, hidden: O.stats().hidden };
});
console.log('deleted:', JSON.stringify(del));

await page.evaluate(() => {
  document.getElementById('hud').style.display='none';
  for (const g of window.__world.world.zoneMarkers) g.visible=false;
  const w = window.__world; w.tp(1.7, 25.4);
  const W = w.state.world; W.camYaw = 2.2; W.camPitch = 0.42; W.camDist = 12;
});
await sleep(1500);
await page.screenshot({ path: SC+'/engine_skatepark_clean.png' });

// restore and confirm the geometry comes back byte-identical
const back = await page.evaluate(() => {
  const O = window.__world.world.objects;
  const bike = O.items.find(i => /Bike_0/.test(i.name));
  const cmp = () => Array.from(bike.mesh.geometry.attributes.position.array.slice(bike.start*3, bike.start*3+6));
  const whileHidden = cmp();
  for (const it of O.items) if (it.hidden) O.setHidden(it, false);
  return { whileHidden, restored: cmp(), hiddenNow: O.stats().hidden };
});
console.log('restore:', JSON.stringify(back));
await sleep(600);
await page.evaluate(() => { const w=window.__world; w.tp(1.7, 25.4); });
await sleep(1200);
await page.screenshot({ path: SC+'/engine_skatepark_full.png' });
await browser.close();

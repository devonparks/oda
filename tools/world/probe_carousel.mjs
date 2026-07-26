import { bootWorld, sleep } from './probe_lib.mjs';
const SCRATCH = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page, logs } = await bootWorld({ headless: true, log: false });
console.log(logs.filter((l) => /Rocker|carved/.test(l)).join('\n'));
const info = await page.evaluate(() => {
  const rides = window.__world.state.rides;
  return rides.spinners.map((it) => ({
    pos: [+it.group.position.x.toFixed(1), +it.group.position.z.toFixed(1)],
    parts: it.group.children.length,
    seatR: +it.seatR.toFixed(2), seatY: +it.deck.toFixed(2),
    radius: +it.radius.toFixed(2), faceOut: !!it.faceOut,
  }));
});
console.log(JSON.stringify(info, null, 1));
// ride the carousel and shoot it
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const it = rides.spinners.find((x) => Math.abs(x.group.position.x - -17) < 1);
  player.pos.set(it.group.position.x + 1.5, 1, it.group.position.z + 1.5);
  player.vel.y = 0;
  rides.begin(it.zone, player);
  await sleep2(400);
  // spin it a bit so the shot shows rotation engagement
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
  await sleep2(1200);
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true }));
  const w = window.__world.world;
  w.camYaw = player.yaw + 2.5; w.camPitch = 0.3; w.camDist = 5.5;
});
await sleep(600);
await page.screenshot({ path: SCRATCH + '/carousel_ride.png' });
const after = await page.evaluate(() => {
  const S = window.__world.state, rides = S.rides;
  const it = rides.spinners.find((x) => Math.abs(x.group.position.x - -17) < 1);
  return {
    spin: +it.spin.toFixed(2), rate: +it.rate.toFixed(2),
    riderR: +Math.hypot(S.player.pos.x - it.group.position.x, S.player.pos.z - it.group.position.z).toFixed(2),
    riderY: +S.player.pos.y.toFixed(2),
  };
});
console.log('ride:', JSON.stringify(after));
await browser.close();

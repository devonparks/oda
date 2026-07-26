import { bootWorld, sleep } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });
const res = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const v = rides.vehicles.find((x) => x.family === 'jeep');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(400);
  return {
    riding: rides.active?.kind === 'vehicle',
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
    pos: [player.pos.x, player.pos.y, player.pos.z].map((n) => +n.toFixed(2)),
  };
});
console.log(JSON.stringify(res));
await browser.close();

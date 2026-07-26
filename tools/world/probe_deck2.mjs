import { bootWorld, sleep } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });
const res = await page.evaluate(async () => {
  const col = window.__world.world.collision;
  const rows = [];
  for (let z = -4; z <= 2.01; z += 0.4) {
    let row = '';
    for (let x = -1; x <= 4.01; x += 0.4) {
      const g = col.groundAt(x, z, 2.75);
      row += g > 1.7 ? '#' : g > 0.9 ? '=' : g > 0.3 ? '-' : '.';
    }
    rows.push(`z${z.toFixed(1).padStart(5)} ${row}`);
  }
  // fresh spinner1 measure (nothing else active)
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const it = rides.spinners[0];
  player.pos.set(it.group.position.x + 1, 1, it.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(it.zone, player);
  await sleep2(400);
  const s1 = {
    riderR: +Math.hypot(player.pos.x - it.group.position.x, player.pos.z - it.group.position.z).toFixed(2),
    riderY: +player.pos.y.toFixed(2), seatR: +it.seatR.toFixed(2), seatY: +it.deck.toFixed(2),
  };
  return { rows, s1 };
});
for (const r of res.rows) console.log(r);
console.log('spinner1:', JSON.stringify(res.s1));
await browser.close();

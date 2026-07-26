import { bootWorld, sleep } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });
const res = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const trace = [];
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const snap = (tag) => trace.push({
    tag, t: Math.round(performance.now() % 100000),
    kind: rides.active?.kind ?? null, air: rides.active?.air ?? null,
    grind: !!rides.active?.grind,
    pos: [player.pos.x, player.pos.y, player.pos.z].map((n) => +n.toFixed(2)),
    speed: +player.speed.toFixed(2), grounded: player.grounded,
  });
  const v = rides.vehicles.find((x) => x.family === 'board');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  const line = rides.begin(v.zone, player);
  snap('begin:' + line);
  key('keydown', 'KeyW');
  for (let i = 0; i < 10; i++) { await sleep2(180); snap('ride' + i); }
  key('keydown', 'Space');
  await sleep2(100);
  key('keyup', 'Space');
  for (let i = 0; i < 14; i++) { await sleep2(120); snap('air' + i); }
  key('keyup', 'KeyW');
  snap('end');
  return trace;
});
for (const t of res) console.log(JSON.stringify(t));
await browser.close();

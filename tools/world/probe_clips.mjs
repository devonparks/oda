/** New clip wiring: board_push while skating, crawl on the tyre wall. */
import { bootWorld, sleep } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });

const res = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const out = {};

  // board: ride and check the push clip engages + is driven
  const v = rides.vehicles.find((x) => x.family === 'board');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(250);
  key('keydown', 'KeyW');
  await sleep2(1500);
  out.board = {
    clip: player.rig.emote ? player.rig.emote.info.id : null,
    playing: player.rig.isEmote ? player.rig.isEmote('board_push') : null,
  };
  key('keyup', 'KeyW');
  await sleep2(900);
  out.boardIdle = { clip: player.rig.emote ? player.rig.emote.info.id : null };
  // dismount (stopped now)
  key('keydown', 'Space'); await sleep2(120); key('keyup', 'Space');
  await sleep2(400);

  // tyre wall crawl: stand at its base, face it, E to climb
  player.pos.set(6.9, 0.1, 0.8);       // east side of the wall at (6.2, 0.8)
  player.vel.y = 0;
  player.yaw = player.targetYaw = Math.atan2(-1, 0);   // facing -x, at the wall
  await sleep2(400);
  const spot = rides.findClimb(player);
  out.tyreSpot = spot ? { x: +spot.x.toFixed(2), y: +spot.y.toFixed(2), z: +spot.z.toFixed(2) } : null;
  if (spot) {
    rides.begin({ ride: 'climb', spot }, player);
    await sleep2(500);
    out.tyre = {
      kind: rides.active?.kind, low: !!rides.active?.low,
      clip: player.rig.emote ? player.rig.emote.info.id : null,
    };
    // ride it to the top
    let done = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      if (!rides.active) { done = true; break; }
      await sleep2(100);
    }
    out.tyreDone = { done, y: +player.pos.y.toFixed(2), finite: Number.isFinite(player.pos.y) };
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();

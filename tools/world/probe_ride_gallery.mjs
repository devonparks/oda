/**
 * RIDE GALLERY — mount every ride in the park and take a CLOSE-UP screenshot
 * of each, so the poses get looked at, not just measured. Devon, playtest 8:
 * "you're not visually auditing the changes… actually verify the animations
 * and look at them." This is that audit, and it reruns after every fix.
 *
 * Output: scratchpad/gallery/<name>.png (one ¾ close-up per ride; the camera
 * boom points from the player TO the camera, so camYaw = rider yaw + offset).
 */
import { bootWorld, sleep } from './probe_lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad/gallery';
fs.mkdirSync(OUT, { recursive: true });

const { browser, page } = await bootWorld({ headless: true, log: false });

/** Frame the rider: camera at yawOff from their facing, close in. */
async function frame(yawOff = 2.45, dist = 3.0, pitch = 0.5) {
  await page.evaluate((yo, d, p) => {
    const w = window.__world.world, player = window.__world.state.player;
    w.camYaw = player.yaw + yo;
    w.camPitch = p;
    w.camDist = d;
  }, yawOff, dist, pitch);
  await sleep(450);
}
async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}
async function clearRide() {
  await page.evaluate(() => {
    const S = window.__world.state;
    if (S.rides.active?.kind === 'seesaw') S.rides.seesawSim.riders[S.rides.active.end] = null;
    S.rides.active = null;
    S.player.rig.forceLegEmote = false;
    S.player.rig.stopEmote && S.player.rig.stopEmote();
    S.seated = null;
  });
  await sleep(150);
}

// ── vehicles (one per family) ───────────────────────────────────────────────
const fams = await page.evaluate(() => [...new Set(window.__world.state.rides.vehicles.map((v) => v.family))]);
for (const fam of fams) {
  await page.evaluate(async (f) => {
    const S = window.__world.state, player = S.player, rides = S.rides;
    const v = rides.vehicles.find((x) => x.family === f);
    player.pos.set(v.group.position.x + 1, v.group.position.y + 0.5, v.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(v.zone, player);
  }, fam);
  await sleep(500);
  await frame(2.45, fam === 'jeep' ? 3.6 : 2.8);
  await shot('veh_' + fam);
  // a second angle for the board (the stance is the hot one)
  if (fam === 'board') { await frame(1.57, 2.6); await shot('veh_board_side'); }
  await clearRide();
}

// board MOVING (push cycle)
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const v = rides.vehicles.find((x) => x.family === 'board');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
});
await sleep(1100);
await frame(2.3, 2.9);
await shot('veh_board_pushing');
await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })));
await clearRide();

// ── spinners + coin rides ───────────────────────────────────────────────────
const nSpin = await page.evaluate(() => window.__world.state.rides.spinners.length);
for (let i = 0; i < nSpin; i++) {
  await page.evaluate(async (k) => {
    const S = window.__world.state, player = S.player, rides = S.rides;
    const it = rides.spinners[k];
    player.pos.set(it.group.position.x + 1, it.group.position.y + 0.5, it.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(it.zone, player);
  }, i);
  await sleep(500);
  await frame(2.45, 3.0);
  await shot('spinner_' + i);
  await clearRide();
}
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const it = rides.coinRides[0];
  player.pos.set(it.group.position.x + 1, it.group.position.y + 0.5, it.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(it.zone, player);
});
await sleep(700);
await frame(-2.2, 3.4, 0.4);
await shot('coinride');
await clearRide();

// ── seesaw (solo: my end must be DOWN) ──────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const m = rides.seesaw;
  player.pos.set(m.position.x + 1.2, 0.5, m.position.z);
  player.vel.y = 0;
  rides.begin(rides.zones.find((z) => z.id === 'seesaw'), player);
});
await sleep(1500);
await frame(2.0, 3.4);
await shot('seesaw_solo');
await clearRide();

// ── swing (close-up on the grip) ────────────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const z = rides.zones.find((zz) => zz.id === 'swing');
  player.pos.set(z.pos[0], 0.5, z.pos[1]);
  player.vel.y = 0;
  rides.begin(z, player);
});
await sleep(900);
await frame(2.45, 2.4, 0.12);
await shot('swing');
await frame(1.57, 2.2, 0.05);
await shot('swing_side');
await clearRide();

// ── slide mid-ride ──────────────────────────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const d = window.__world.world.slideData[0];
  rides.active = null;
  rides._beginSlide(player, { data: d });
});
await sleep(500);
await frame(2.2, 3.2);
await shot('slide_mid');
await clearRide();

// ── monkey bars mid-crossing ────────────────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const z = rides.zones.find((zz) => zz.ride === 'monkey');
  player.pos.set(z.pos[0], 1, z.pos[1]);
  player.vel.y = 0;
  rides.begin(z, player);
});
await sleep(1300);
await frame(2.45, 3.0, 0.05);
await shot('monkey_mid');
await clearRide();

// ── picnic table + bench ────────────────────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const z = rides.zones.find((zz) => zz.ride === 'tableseat');
  player.pos.set(z.pos[0], 1, z.pos[1]);
  player.vel.y = 0;
  rides.begin(z, player);
});
await sleep(600);
await frame(2.45, 2.6);
await shot('table_seat');
await clearRide();

await page.evaluate(() => {
  const S = window.__world.state;
  const seat = window.__world.world.seats[0];
  // sitDown is module-private; drive it via the zone route
  S.activeZone = seat;
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
});
await sleep(700);
await frame(2.45, 2.4);
await shot('bench_sit');
await page.evaluate(() => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
});
await sleep(300);
await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })));
await clearRide();

// ── tyre-wall crawl (mid-climb) ─────────────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  player.pos.set(6.9, 0.1, 0.8);
  player.vel.y = 0;
  player.yaw = player.targetYaw = Math.atan2(-1, 0);
  const spot = rides.findClimb(player);
  if (spot) rides.begin({ ride: 'climb', spot }, player);
});
await sleep(900);
await frame(2.45, 2.8, 0.1);
await shot('tyre_crawl');
await clearRide();

// ── crouch-crawl on the ground ──────────────────────────────────────────────
await page.evaluate(() => {
  window.__world.tp(4, 12);
});
await sleep(1200);
await page.evaluate(() => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
});
await sleep(800);
await frame(2.45, 2.6, 0.15);
await shot('crouch_crawl');
await page.evaluate(() => {
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', bubbles: true }));
});

// ── zip line mid-ride ───────────────────────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const z = rides.zip;
  rides.active = { kind: 'zip', from: z.a, to: z.b, u: 0.35, v: 2.5 };
  player.rig.forceLegEmote = true;
  player.playAction('monkey', null);
});
await sleep(500);
await frame(2.45, 3.2, 0.0);
await shot('zip_mid');
await clearRide();

// ── hula hoop in use ────────────────────────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const z = rides.zones.find((zz) => zz.ride === 'hoop');
  player.pos.set(z.pos[0], 0.5, z.pos[1]);
  player.vel.y = 0;
  rides.begin(z, player);
});
await sleep(900);
await frame(2.45, 2.6);
await shot('hula');
await clearRide();

console.log('gallery complete');
await browser.close();

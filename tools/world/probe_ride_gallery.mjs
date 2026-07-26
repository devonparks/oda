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

// A clean stage: the HUD (hotbar, toasts, zone prompt) covers the bottom of
// the frame, which is exactly where a seated kid's lap and seat are, and the
// floating zone signs draw THROUGH scenery. Both off for the audit.
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  document.getElementById('toastRail').style.display = 'none';
  for (const g of window.__world.world.zoneMarkers) g.visible = false;
});

/** Frame the rider: camera at yawOff from their facing, close in. */
async function frame(yawOff = 2.45, dist = 2.6, pitch = 0.16) {
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
/** Hide the static park (shell + merged props) — the gazebo roof and railing
 *  block every camera angle onto the coin rides inside it. The rides
 *  themselves are their own groups, so they stay. */
async function setScenery(on) {
  await page.evaluate((vis) => {
    const w = window.__world.world;
    w.shell.visible = vis;
    if (w.propBatch) w.propBatch.visible = vis;
  }, on);
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
  await frame(0.5, 3.2, 0.24);
  await shot('spinner_' + i);
  await clearRide();
}
const nCoin = await page.evaluate(() => window.__world.state.rides.coinRides.length);
for (let i = 0; i < nCoin; i++) {
  await page.evaluate(async (k) => {
    const S = window.__world.state, player = S.player, rides = S.rides;
    const it = rides.coinRides[k];
    player.pos.set(it.group.position.x + 1, it.group.position.y + 0.5, it.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(it.zone, player);
  }, i);
  await sleep(800);
  await setScenery(false);
  await frame(2.45, 2.6, 0.26);
  await shot('coinride_' + i);
  await frame(0.45, 2.6, 0.26);
  await shot('coinride_' + i + 'b');
  await setScenery(true);
  await clearRide();
}
// spring riders
const nRock = await page.evaluate(() => window.__world.state.rides.rockers.length);
for (let i = 0; i < nRock; i++) {
  await page.evaluate(async (k) => {
    const S = window.__world.state, player = S.player, rides = S.rides;
    const z = rides.zones.filter((zz) => zz.ride === 'rocker')[k];
    player.pos.set(z.pos[0], 1, z.pos[1]);
    player.vel.y = 0;
    rides.begin(z, player);
  }, i);
  await sleep(700);
  await frame(0.45, 2.1, 0.28);
  await shot('rocker_' + i);
  await clearRide();
}

// ── seesaw (solo: my end must be DOWN) ──────────────────────────────────────
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const m = rides.seesaw;
  player.pos.set(m.position.x + 1.2, 0.5, m.position.z);
  player.vel.y = 0;
  rides.begin(rides.zones.find((z) => z.id === 'seesaw'), player);
});
await sleep(1500);
await frame(0.5, 3.0, 0.20);
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
await frame(0.4, 2.4, 0.14);
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
await frame(2.2, 3.2, 0.20);
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
await frame(0.35, 2.4, 0.28);
await shot('table_seat');
await frame(1.8, 2.4, 0.28);
await shot('table_seat_b');
await clearRide();

await page.evaluate(() => {
  const S = window.__world.state;
  const seat = window.__world.world.seats[0];
  // sitDown is module-private; drive it via the zone route
  S.activeZone = seat;
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
});
await sleep(700);
await frame(0.35, 2.4, 0.28);
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

// ── numbers to pair with the pictures ──────────────────────────────────────
const nums = await page.evaluate(async () => {
  const S = window.__world.state, T = window.__world.THREE, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const buttY = () => player.pos.y + 0.2827 - 0.105;   // SEATED_PELVIS_Y - BUTT_BELOW
  for (let i = 0; i < rides.coinRides.length; i++) {
    const it = rides.coinRides[i];
    player.pos.set(it.group.position.x + 1, it.group.position.y + 0.5, it.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(it.zone, player);
    await sleep2(300);
    const w = it.saddle ? it.group.localToWorld(it.saddle.clone()) : null;
    out.push({ ride: 'coin' + i, saddleY: w ? +w.y.toFixed(3) : null,
      buttY: +buttY().toFixed(3), sink: w ? +(w.y - buttY()).toFixed(3) : null,
      offXZ: w ? +Math.hypot(player.pos.x - w.x, player.pos.z - w.z).toFixed(3) : null });
    rides.active = null; player.rig.forceLegEmote = false; player.rig.stopEmote && player.rig.stopEmote();
    await sleep2(80);
  }
  const rz = rides.zones.filter((z) => z.ride === 'rocker');
  for (let i = 0; i < rz.length; i++) {
    player.pos.set(rz[i].pos[0], 1, rz[i].pos[1]);
    player.vel.y = 0;
    rides.begin(rz[i], player);
    await sleep2(300);
    const m = rz[i].mesh;
    const w = m.userData.saddle ? m.localToWorld(m.userData.saddle.clone()) : null;
    out.push({ ride: 'rocker' + i, saddleY: w ? +w.y.toFixed(3) : null,
      buttY: +buttY().toFixed(3), sink: w ? +(w.y - buttY()).toFixed(3) : null,
      offXZ: w ? +Math.hypot(player.pos.x - w.x, player.pos.z - w.z).toFixed(3) : null });
    rides.active = null; player.rig.stopEmote && player.rig.stopEmote();
    await sleep2(80);
  }
  const tz = rides.zones.find((z) => z.ride === 'tableseat');
  player.pos.set(tz.pos[0], 1, tz.pos[1]);
  rides.begin(tz, player);
  await sleep2(300);
  out.push({ ride: 'table', saddleY: +tz.spot.y.toFixed(3), buttY: +buttY().toFixed(3),
    sink: +(tz.spot.y - buttY()).toFixed(3), offXZ: 0 });
  rides.active = null; player.rig.stopEmote && player.rig.stopEmote();
  return out;
});
console.log('seat numbers (sink = seat - butt; the bench standard is 0.065):');
for (const n of nums) console.log(' ', JSON.stringify(n));

console.log('gallery complete');
await browser.close();

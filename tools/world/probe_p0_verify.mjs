/**
 * P0 verification:
 *   A. rider-to-seat on every vehicle (expect ~0 everywhere now, incl. jeep)
 *   B. the jeep DRIVES: mount, hold W, body follows, no NaN
 *   C. water mask: known wet/dry points + every duck floats on water
 *   D. screenshots: mounted jeep + pond edge
 */
import { bootWorld, sleep, keyDown, keyUp } from './probe_lib.mjs';

const SCRATCH = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page } = await bootWorld({ headless: true });

// ── A. vehicle sweep ────────────────────────────────────────────────────────
const vehicles = await page.evaluate(async () => {
  const S = window.__world.state, T = window.__world.THREE;
  const player = S.player, rides = S.rides;
  const out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const v of rides.vehicles) {
    player.pos.set(v.group.position.x + 1, v.group.position.y + 0.5, v.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(v.zone, player);
    await sleep(350);
    const pb = new T.Box3();
    let best = null, bestArea = -1;
    for (const c of v.group.children) {
      pb.setFromObject(c);
      const area = (pb.max.x - pb.min.x) * (pb.max.z - pb.min.z);
      if (area > bestArea) { bestArea = area; best = c; }
    }
    pb.setFromObject(best);
    const cx = (pb.min.x + pb.max.x) / 2, cz = (pb.min.z + pb.max.z) / 2;
    out.push({
      family: v.family, zone: v.zone.id,
      riderToWidestCentre: +Math.hypot(player.pos.x - cx, player.pos.z - cz).toFixed(3),
      fwdOffset: +v.fwdOffset.toFixed(3),
      finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
    });
    rides.active = null;
    player.rig.forceLegEmote = false;
    player.rig.stopEmote && player.rig.stopEmote();
    player.pos.set(v.group.position.x + 2, 2, v.group.position.z + 2);
    await sleep(100);
  }
  return out;
});
console.log('\n=== A. rider-to-seat after fix ===');
for (const v of vehicles) console.log(JSON.stringify(v));

// ── B. drive the jeep ───────────────────────────────────────────────────────
const jeepStart = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const v = rides.vehicles.find((x) => x.family === 'jeep');
  if (!v) return { found: false };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  rides.begin(v.zone, player);
  await sleep(300);
  return {
    found: true, riding: rides.active && rides.active.kind === 'vehicle',
    start: [player.pos.x, player.pos.y, player.pos.z].map((n) => +n.toFixed(2)),
    bodyStart: v.group.position.toArray().map((n) => +n.toFixed(2)),
    yawDeg: +(v.yaw * 180 / Math.PI).toFixed(0),
    fwdOffset: +v.fwdOffset.toFixed(3),
    wheels: v.wheels.length,
  };
});
console.log('\n=== B. jeep mount ===');
console.log(JSON.stringify(jeepStart));

if (jeepStart.found && jeepStart.riding) {
  // screenshot the mounted rider before driving
  await page.evaluate(() => {
    const w = window.__world.world;
    w.camYaw = 2.2; w.camPitch = 0.35; w.camDist = 4.5;
  });
  await sleep(500);
  await page.screenshot({ path: SCRATCH + '/jeep_mounted.png' });

  await keyDown(page, 'KeyW');
  await sleep(1500);
  await keyUp(page, 'KeyW');
  const after = await page.evaluate(() => {
    const S = window.__world.state, player = S.player;
    const v = S.rides.vehicles.find((x) => x.family === 'jeep');
    return {
      pos: [player.pos.x, player.pos.y, player.pos.z].map((n) => +n.toFixed(2)),
      body: v.group.position.toArray().map((n) => +n.toFixed(2)),
      bodyToRider: +Math.hypot(
        player.pos.x - v.group.position.x, player.pos.z - v.group.position.z).toFixed(2),
      finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
      stillRiding: S.rides.active && S.rides.active.kind === 'vehicle',
    };
  });
  console.log('after 1.5s of W:', JSON.stringify(after));
  await page.screenshot({ path: SCRATCH + '/jeep_driving.png' });
  // hop off
  await page.evaluate(() => {
    const S = window.__world.state;
    S.rides.active = null;
    S.player.rig.forceLegEmote = false;
    S.player.rig.stopEmote && S.player.rig.stopEmote();
  });
}

// ── C. water mask ───────────────────────────────────────────────────────────
const water = await page.evaluate(() => {
  const W = window.__world.world;
  const w = W.water;
  const probes = [
    ['pond mid', 21.19, 0, 'wet'],
    ['north half', 21.19, 4, 'wet'],
    ['south shore (was false-wet)', 21.19, -4, 'dry'],
    ['north dirt', 21.19, 6.5, 'dry'],
    ['west edge', 16.5, 0.7, '?'],
    ['east edge', 26.0, 0.7, '?'],
    ['spawn (far)', 4, 14, 'dry'],
  ].map(([name, x, z, want]) => ({
    name, want, got: W.waterAt(x, z) != null ? 'wet' : 'dry',
  }));
  const ducks = (W.dynamics?.items || []).filter((i) => i.kind === 'floater')
    .map((d) => ({
      pos: [+d.pos.x.toFixed(1), +d.pos.z.toFixed(1)],
      onWater: W.waterAt(d.pos.x, d.pos.z) != null,
    }));
  return { water: { x: w.x, z: w.z, r: w.r, y: w.y, masked: !!w.mask }, probes, ducks };
});
console.log('\n=== C. water ===');
console.log(JSON.stringify(water, null, 1));

// wading check: stand on the south shore (dry) vs in the water (wet)
const wade = await page.evaluate(async () => {
  const S = window.__world.state, W = window.__world.world, player = S.player;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const at = async (x, z) => {
    window.__world.tp(x, z);
    await sleep(1600);            // tp drops from y=6; landing takes ~0.8s
    return { y: +player.pos.y.toFixed(2), wading: !!player.wading, grounded: !!player.grounded };
  };
  return {
    southShore: await at(21.19, -4),
    inWater: await at(21.19, 3),
  };
});
console.log('wading:', JSON.stringify(wade));

// pond screenshot
await page.evaluate(() => {
  const w = window.__world;
  w.tp(21.2, 8);
  w.state.world.camYaw = Math.PI;
  w.state.world.camPitch = 0.85;
  w.state.world.camDist = 14;
});
await sleep(900);
await page.screenshot({ path: SCRATCH + '/pond_after.png' });

await browser.close();

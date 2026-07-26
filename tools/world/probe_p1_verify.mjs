/**
 * P1 verification:
 *   A. seesaw solo — my end sinks, push launches, no NaN
 *   B. seesaw NPC  — a kid walks over, takes the other end, pushes back;
 *                    the plank alternates; player leaves → NPC released
 *   C. roundabout  — A and D spin opposite ways, S brakes
 *   D. skateboard  — kick-pulse speed, ollie + kickflip lifecycle, grind
 *   E. hoops       — lying on the grass, not standing
 */
import { bootWorld, sleep, keyDown, keyUp } from './probe_lib.mjs';

const SCRATCH = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page } = await bootWorld({ headless: true });

// ── A. seesaw solo ──────────────────────────────────────────────────────────
const solo = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const m = rides.seesaw;
  player.pos.set(m.position.x + 1.2, 0.5, m.position.z);
  player.vel.y = 0;
  const line = rides.begin(rides.zones.find((z) => z.id === 'seesaw'), player);
  await sleep2(1400);                       // my end should fall to the ground
  const sim = rides.seesawSim, end = rides.active.end;
  const sunk = sim.lift * end;
  // push off
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
  await sleep2(150);
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
  let peak = -1;
  const t0 = performance.now();
  while (performance.now() - t0 < 1800) {
    peak = Math.max(peak, sim.lift * end);
    await sleep2(40);
  }
  return {
    line, end, sunk: +sunk.toFixed(2), peakAfterPush: +peak.toFixed(2),
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
    riding: rides.active?.kind === 'seesaw',
  };
});
console.log('\n=== A. seesaw solo ===');
console.log(JSON.stringify(solo));

// ── B. seesaw NPC ───────────────────────────────────────────────────────────
const npc = await page.evaluate(async () => {
  const S = window.__world.state, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const m = rides.seesaw, sim = rides.seesawSim;
  // park a wandering kid near the seesaw so the recruiter can find one
  const n = S.npcs.npcs.find((x) => !x.controlled);
  if (!n) return { skip: 'no npcs spawned' };
  n.avatar.pos.set(m.position.x + 3, 0, m.position.z + 2);
  const t0 = performance.now();
  let recruited = false, rode = false;
  let minL = 1, maxL = -1, pushes = 0, lastV = 0;
  while (performance.now() - t0 < 16000) {
    if (sim.npc) recruited = true;
    if (sim.riders['1'] && sim.riders['-1']) {
      rode = true;
      minL = Math.min(minL, sim.lift); maxL = Math.max(maxL, sim.lift);
      if (Math.abs(sim.vel) > 2.5 && Math.abs(lastV) < 1) pushes++;
      lastV = sim.vel;
    }
    await sleep2(50);
  }
  // player hops off
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  await sleep2(120);
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
  await sleep2(800);
  return {
    recruited, bothRode: rode,
    liftRange: [+minL.toFixed(2), +maxL.toFixed(2)], pushes,
    npcReleased: !sim.npc && !n.controlled,
    ridersEmpty: !sim.riders['1'] && !sim.riders['-1'],
    playerOff: rides.active == null,
  };
});
console.log('\n=== B. seesaw with NPC ===');
console.log(JSON.stringify(npc));

// ── C. roundabout direction ─────────────────────────────────────────────────
const spin = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const zone = rides.zones.find((z) => z.ride === 'spinner');
  if (!zone) return { skip: 'no spinner' };
  player.pos.set(zone.pos[0] + 1, 1, zone.pos[1] + 1);
  rides.begin(zone, player);
  const key = async (code, ms) => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    await sleep2(ms);
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  };
  await key('KeyA', 1500);
  const rateA = zone.item.rate;
  await key('KeyD', 2500);
  const rateD = zone.item.rate;
  await key('KeyS', 2000);
  const rateS = zone.item.rate;
  // hop off (Space flings)
  await key('Space', 120);
  await sleep2(600);
  return {
    rateA: +rateA.toFixed(2), rateD: +rateD.toFixed(2), rateS: +rateS.toFixed(2),
    opposite: Math.sign(rateA) !== Math.sign(rateD),
    braked: Math.abs(rateS) < Math.abs(rateD),
    off: rides.active == null,
  };
});
console.log('\n=== C. roundabout ===');
console.log(JSON.stringify(spin));

// ── D. skateboard ───────────────────────────────────────────────────────────
const board = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const v = rides.vehicles.find((x) => x.family === 'board');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(250);
  // ride: sample speed for the pulse
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
  const speeds = [];
  for (let i = 0; i < 30; i++) { speeds.push(player.speed); await sleep2(60); }
  const sMin = Math.min(...speeds.slice(8)), sMax = Math.max(...speeds.slice(8));
  // ollie
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  await sleep2(100);
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
  await sleep2(120);
  const midAir = { air: !!rides.active?.air, vy: +player.vel.y.toFixed(1), rot: +v.group.rotation.z.toFixed(2) };
  await sleep2(1400);
  const landed = { air: !!rides.active?.air, rot: +v.group.rotation.z.toFixed(2), riding: rides.active?.kind === 'vehicle' };
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));

  // grind: drop onto rail_box_01 (c 8.75, 28.05, top 0.56, long in X) while riding
  const a = rides.active;
  a.air = true; a.trickT = 0; a.trickFlip = true;
  player.pos.set(8.75, 1.4, 28.05);
  player.vel.y = 0;
  player.yaw = player.targetYaw = Math.PI / 2;      // facing +x, along the rail
  await sleep2(500);
  const grinding = !!a.grind;
  const gx0 = player.pos.x;
  await sleep2(500);
  const slid = +(player.pos.x - gx0).toFixed(2);
  const yOnRail = +player.pos.y.toFixed(2);
  // ride it off the end
  let exited = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 3000) {
    if (!a.grind) { exited = true; break; }
    await sleep2(80);
  }
  await sleep2(900);
  return {
    pulse: { min: +sMin.toFixed(2), max: +sMax.toFixed(2), varies: sMax - sMin > 0.5 },
    midAir, landed, grinding, slid, yOnRail, exited,
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
  };
});
console.log('\n=== D. skateboard ===');
console.log(JSON.stringify(board));

// ── E. hoops ────────────────────────────────────────────────────────────────
const hoops = await page.evaluate(() => {
  const rides = window.__world.state.rides;
  return rides.hoops.map((h) => ({
    lying: Math.abs(h.mesh.rotation.x - Math.PI / 2) < 0.2,
    y: +h.mesh.position.y.toFixed(2),
  }));
});
console.log('\n=== E. hoops ===');
console.log(JSON.stringify(hoops));

// screenshots: seesaw with NPC riding + hoops on the lawn
await page.evaluate(() => {
  const w = window.__world;
  w.tp(-5.2, 0.2);
  w.state.world.camYaw = -1.2;
  w.state.world.camPitch = 0.4;
  w.state.world.camDist = 6;
});
await sleep(900);
await page.screenshot({ path: SCRATCH + '/hoops_after.png' });

await browser.close();

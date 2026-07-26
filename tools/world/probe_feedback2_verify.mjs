/**
 * Verify the second-playtest fixes:
 *   A. skate stance: feet ON the board line, body sideways
 *   B. swings: no live chain triangles left standing
 *   C. spinners: measured tyre/disc seats
 *   D. bike/trike: rider over the saddle (rear top band)
 *   E. jeep: carve counts + clean drive-away
 *   F. playground deck: holes filled
 *   G. crouch: state + clip + short capsule under the roof
 *   H. seesaw: snappier arc with a thump
 *   I. regression: every vehicle mounts
 */
import { bootWorld, sleep } from './probe_lib.mjs';
const SCRATCH = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page } = await bootWorld({ headless: true });

// ── A. skate stance ─────────────────────────────────────────────────────────
const stance = await page.evaluate(async () => {
  const S = window.__world.state, T = window.__world.THREE, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const v = rides.vehicles.find((x) => x.family === 'board');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(600);
  const bones = {};
  for (const n of ['Ball_L', 'Ball_R', 'Ankle_L', 'Ankle_R', 'Shoulder_L', 'Shoulder_R']) {
    player.model.traverse((o) => { if (o.name === n && !bones[n]) bones[n] = o.getWorldPosition(new T.Vector3()); });
  }
  const yaw = player.yaw;
  const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const along = (p) => (p.x - player.pos.x) * fwd.x + (p.z - player.pos.z) * fwd.z;
  const across = (p) => (p.x - player.pos.x) * fwd.z - (p.z - player.pos.z) * fwd.x;
  const pb = new T.Box3().setFromObject(v.group);
  const shoulderLine = {
    dAlong: +(along(bones.Shoulder_L) - along(bones.Shoulder_R)).toFixed(3),
    dAcross: +(across(bones.Shoulder_L) - across(bones.Shoulder_R)).toFixed(3),
  };
  const res = { clip: player.rig.emote?.info.id, deckTop: +pb.max.y.toFixed(3), shoulderLine };
  for (const n of ['Ball_L', 'Ball_R', 'Ankle_L', 'Ankle_R']) {
    res[n] = { along: +along(bones[n]).toFixed(3), across: +across(bones[n]).toFixed(3), y: +bones[n].y.toFixed(3) };
  }
  return res;
});
console.log('\n=== A. skate stance (want: feet along ±0.2, across ~0, shoulders spread ALONG) ===');
console.log(JSON.stringify(stance, null, 1));
await page.screenshot({ path: SCRATCH + '/stance_after.png' });

// ── B. swings ───────────────────────────────────────────────────────────────
const swings = await page.evaluate(() => {
  const W = window.__world.world, T = window.__world.THREE;
  let mesh = null;
  W.shell.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const m = mesh.matrixWorld;
  const pos = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  // any LIVE thin-vertical (chain-like) tris left in the swing bay?
  let chains = 0, dead = 0;
  for (let t = 0; t < idx.count / 3; t++) {
    const i0 = idx.getX(t * 3), i1 = idx.getX(t * 3 + 1), i2 = idx.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, i0).applyMatrix4(m);
    if (a.x < 26.3 || a.x > 28.7 || a.z < 24.1 || a.z > 25.9 || a.y < 0.3 || a.y > 2.2) continue;
    if (i0 === i1 || i1 === i2 || i0 === i2) { dead++; continue; }
    b.fromBufferAttribute(pos, i1).applyMatrix4(m);
    c.fromBufferAttribute(pos, i2).applyMatrix4(m);
    const ys = [a.y, b.y, c.y], xs = [a.x, b.x, c.x];
    if (Math.max(...ys) - Math.min(...ys) > 0.8 && Math.max(...xs) - Math.min(...xs) < 0.3) chains++;
  }
  return { liveChainTris: chains, deadTris: dead };
});
console.log('\n=== B. swings (want liveChainTris 0) ===');
console.log(JSON.stringify(swings));

// ── C. spinner seats ────────────────────────────────────────────────────────
const spinners = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  for (const it of rides.spinners) {
    player.pos.set(it.group.position.x + 1, 1, it.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(it.zone, player);
    await sleep2(350);
    out.push({
      pos: [+it.group.position.x.toFixed(1), +it.group.position.z.toFixed(1)],
      seatR: +it.seatR.toFixed(2), seatY: +it.deck.toFixed(2),
      riderR: +Math.hypot(player.pos.x - it.group.position.x, player.pos.z - it.group.position.z).toFixed(2),
      riderY: +player.pos.y.toFixed(2),
    });
    rides.active = null;
    player.rig.forceLegEmote = false;
    player.rig.stopEmote && player.rig.stopEmote();
    await sleep2(100);
  }
  return out;
});
console.log('\n=== C. spinner seats (want 4-tyre ~r0.66 y0.53; wheel ~r0.30 y0.50) ===');
console.log(JSON.stringify(spinners));

// screenshot the 4-tyre roundabout ridden
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const it = rides.spinners[0];
  player.pos.set(it.group.position.x + 1, 1, it.group.position.z + 1);
  rides.begin(it.zone, player);
  const w = window.__world.world;
  w.camYaw = 0.8; w.camPitch = 0.42; w.camDist = 4.5;
});
await sleep(700);
await page.screenshot({ path: SCRATCH + '/spinner_after.png' });
await page.evaluate(() => {
  const S = window.__world.state;
  S.rides.active = null;
  S.player.rig.forceLegEmote = false;
  S.player.rig.stopEmote && S.player.rig.stopEmote();
});

// ── D. bike/trike saddle ────────────────────────────────────────────────────
const saddle = await page.evaluate(async () => {
  const S = window.__world.state, T = window.__world.THREE, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  for (const v of rides.vehicles) {
    if (v.family !== 'bike' && v.family !== 'trike') continue;
    player.pos.set(v.group.position.x + 1, v.group.position.y + 0.5, v.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(v.zone, player);
    await sleep2(350);
    // saddle truth: rear-half top band of the widest part, measured now
    const pb = new T.Box3();
    let best = null, bestArea = -1;
    for (const c of v.group.children) {
      pb.setFromObject(c);
      const area = (pb.max.x - pb.min.x) * (pb.max.z - pb.min.z);
      if (area > bestArea) { bestArea = area; best = c; }
    }
    const mesh = best.isMesh ? best : best.children.find((m) => m.isMesh) || best;
    mesh.updateWorldMatrix(true, false);
    const posA = mesh.geometry.attributes.position;
    const vv = new T.Vector3();
    const fwd = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) };
    let maxY = -9;
    for (let i = 0; i < posA.count; i++) {
      vv.fromBufferAttribute(posA, i).applyMatrix4(mesh.matrixWorld);
      const along = (vv.x - v.group.position.x) * fwd.x + (vv.z - v.group.position.z) * fwd.z;
      if (along < 0.05 && vv.y > maxY) maxY = vv.y;
    }
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < posA.count; i++) {
      vv.fromBufferAttribute(posA, i).applyMatrix4(mesh.matrixWorld);
      const along = (vv.x - v.group.position.x) * fwd.x + (vv.z - v.group.position.z) * fwd.z;
      if (along < 0.05 && vv.y > maxY - 0.08) { sx += vv.x; sz += vv.z; n++; }
    }
    out.push({
      family: v.family, zone: v.zone.id,
      riderToSaddle: n ? +Math.hypot(player.pos.x - sx / n, player.pos.z - sz / n).toFixed(3) : null,
    });
    rides.active = null;
    player.rig.forceLegEmote = false;
    player.rig.stopEmote && player.rig.stopEmote();
    player.pos.set(v.group.position.x + 2, 2, v.group.position.z + 2);
    await sleep2(80);
  }
  return out;
});
console.log('\n=== D. rider-to-saddle (want ~0) ===');
console.log(JSON.stringify(saddle));

// screenshot a ridden bike
await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const v = rides.vehicles.find((x) => x.family === 'bike');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  rides.begin(v.zone, player);
  const w = window.__world.world;
  w.camYaw = player.yaw + 2.4; w.camPitch = 0.35; w.camDist = 4;
});
await sleep(700);
await page.screenshot({ path: SCRATCH + '/bike_after.png' });
await page.evaluate(() => {
  const S = window.__world.state;
  S.rides.active = null;
  S.player.rig.forceLegEmote = false;
  S.player.rig.stopEmote && S.player.rig.stopEmote();
});

// ── E. jeep drive-away ──────────────────────────────────────────────────────
const jeep = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const v = rides.vehicles.find((x) => x.family === 'jeep');
  if (!v) return { present: false };
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(300);
  key('keydown', 'KeyW');
  await sleep2(1200);
  key('keyup', 'KeyW');
  return { present: true, riding: rides.active?.kind === 'vehicle', pos: [player.pos.x, player.pos.z].map((n) => +n.toFixed(1)) };
});
console.log('\n=== E. jeep ===');
console.log(JSON.stringify(jeep));
await page.evaluate(() => {
  const w = window.__world.world;
  w.camYaw = 2.2; w.camPitch = 0.4; w.camDist = 5;
});
await sleep(600);
await page.screenshot({ path: SCRATCH + '/jeep_clean.png' });
await page.evaluate(async () => {
  const S = window.__world.state;
  S.rides.active = null;
  S.player.rig.forceLegEmote = false;
  S.player.rig.stopEmote && S.player.rig.stopEmote();
  // look at the old parking spot: the rock and grass should still be THERE
  window.__world.tp(-6.2, 16.5);
  const w = window.__world.world;
  w.camYaw = -2.2; w.camPitch = 0.45; w.camDist = 5;
});
await sleep(1200);
await page.screenshot({ path: SCRATCH + '/jeep_parkspot.png' });

// ── F. playground deck map ──────────────────────────────────────────────────
const deckMap = await page.evaluate(() => {
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
  return rows;
});
console.log('\n=== F. playground deck (holes should be # now) ===');
for (const r of deckMap) console.log(r);

// ── G. crouch ───────────────────────────────────────────────────────────────
const crouch = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  window.__world.tp(4, 14);
  await sleep2(1200);
  key('keydown', 'KeyX');
  await sleep2(500);
  const during = { crouching: !!player.crouching, clip: player.rig.emote?.info.id || null };
  // crouched walking is slow
  key('keydown', 'KeyW');
  await sleep2(800);
  const slowSpeed = +player.speed.toFixed(2);
  key('keyup', 'KeyW');
  key('keyup', 'KeyX');
  await sleep2(400);
  const after = { crouching: !!player.crouching, clip: player.rig.emote?.info.id || null };
  return { during, slowSpeed, after };
});
console.log('\n=== G. crouch (crawl clip while held, slow walk, clean release) ===');
console.log(JSON.stringify(crouch));

// ── H. seesaw arc ───────────────────────────────────────────────────────────
const seesaw = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const m = rides.seesaw;
  player.pos.set(m.position.x + 1.2, 0.5, m.position.z);
  player.vel.y = 0;
  rides.begin(rides.zones.find((z) => z.id === 'seesaw'), player);
  await sleep2(900);
  const sim = rides.seesawSim, end = rides.active.end;
  key('keydown', 'KeyW');
  await sleep2(120);
  key('keyup', 'KeyW');
  let peak = -1;
  const t0 = performance.now();
  let tPeak = 0;
  while (performance.now() - t0 < 1600) {
    const upE = sim.lift * end;
    if (upE > peak) { peak = upE; tPeak = performance.now() - t0; }
    await sleep2(30);
  }
  key('keydown', 'Space'); await sleep2(120); key('keyup', 'Space');
  await sleep2(500);
  return { peak: +peak.toFixed(2), msToPeak: Math.round(tPeak), off: rides.active == null };
});
console.log('\n=== H. seesaw (want peak ~1 quickly) ===');
console.log(JSON.stringify(seesaw));

// ── I. regression sweep ─────────────────────────────────────────────────────
const sweep = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  for (const v of rides.vehicles) {
    player.pos.set(v.group.position.x + 1, v.group.position.y + 0.5, v.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(v.zone, player);
    await sleep2(220);
    out.push({ family: v.family, ok: rides.active?.kind === 'vehicle' && [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite) });
    rides.active = null;
    player.rig.forceLegEmote = false;
    player.rig.stopEmote && player.rig.stopEmote();
    player.pos.set(v.group.position.x + 2, 2, v.group.position.z + 2);
    await sleep2(60);
  }
  return out.filter((o) => !o.ok);
});
console.log('\n=== I. regression failures (want []) ===');
console.log(JSON.stringify(sweep));

await browser.close();

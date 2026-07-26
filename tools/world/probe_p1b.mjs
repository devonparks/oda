/** P1 retest: seesaw alternation (player pushes back), board ollie/flip/grind. */
import { bootWorld, sleep } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });

// ── seesaw with NPC, player pushing ────────────────────────────────────────
const seesaw = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const m = rides.seesaw, sim = rides.seesawSim;
  const n = S.npcs.npcs.find((x) => !x.controlled);
  if (n) n.avatar.pos.set(m.position.x + 3, 0, m.position.z + 2);
  player.pos.set(m.position.x + 1.2, 0.5, m.position.z);
  player.vel.y = 0;
  rides.begin(rides.zones.find((z) => z.id === 'seesaw'), player);
  const end = rides.active.end;
  let minL = 1, maxL = -1, npcRode = false, swaps = 0, lastSide = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 18000) {
    if (sim.riders['1'] && sim.riders['-1']) npcRode = true;
    // the player pushes whenever their end rests on the ground
    if (sim.lift * end <= -0.985) { key('keydown', 'KeyW'); await sleep2(90); key('keyup', 'KeyW'); }
    if (npcRode) {
      minL = Math.min(minL, sim.lift); maxL = Math.max(maxL, sim.lift);
      const side = Math.abs(sim.lift) > 0.8 ? Math.sign(sim.lift) : 0;
      if (side && side !== lastSide) { if (lastSide) swaps++; lastSide = side; }
    }
    await sleep2(50);
  }
  key('keydown', 'Space'); await sleep2(120); key('keyup', 'Space');
  await sleep2(700);
  return {
    npcRode, liftRange: [+minL.toFixed(2), +maxL.toFixed(2)], swaps,
    released: !sim.npc, empty: !sim.riders['1'] && !sim.riders['-1'],
  };
});
console.log('=== seesaw two-rider ===');
console.log(JSON.stringify(seesaw));

// ── board: ollie, kickflip, grind ──────────────────────────────────────────
const board = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const toasts = [];
  const orig = S.toast;
  S.toast = (msg, kind) => { toasts.push(msg); orig(msg, kind); };
  const v = rides.vehicles.find((x) => x.family === 'board');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(250);
  key('keydown', 'KeyW');
  await sleep2(900);
  // ollie
  key('keydown', 'Space'); await sleep2(100); key('keyup', 'Space');
  await sleep2(150);
  const midAir = { air: !!rides.active?.air, vy: +player.vel.y.toFixed(1), rot: +v.group.rotation.z.toFixed(2) };
  await sleep2(1500);
  const afterLand = { air: !!rides.active?.air, riding: rides.active?.kind === 'vehicle', rot: +v.group.rotation.z.toFixed(2) };
  key('keyup', 'KeyW');
  await sleep2(200);

  // grind: drop the riding player onto rail_box_01 (8.75, 28.05, top 0.56, long X)
  const a = rides.active;
  a.air = true; a.trickT = 0; a.trickFlip = true; a.lastGroundMs = 0;
  player.pos.set(8.0, 1.5, 28.05);
  player.vel.y = 0;
  player.yaw = player.targetYaw = Math.PI / 2;
  await sleep2(600);
  const grinding = !!a.grind;
  const gx0 = player.pos.x, gy = +player.pos.y.toFixed(2);
  await sleep2(400);
  const slid = +(player.pos.x - gx0).toFixed(2);
  let exited = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 3000) {
    if (!a.grind) { exited = true; break; }
    await sleep2(80);
  }
  await sleep2(1000);
  S.toast = orig;
  return {
    midAir, afterLand, toasts,
    grind: { engaged: grinding, slid, yOnRail: gy, exited, stillRiding: rides.active?.kind === 'vehicle' },
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
  };
});
console.log('=== board tricks ===');
console.log(JSON.stringify(board, null, 1));
await browser.close();

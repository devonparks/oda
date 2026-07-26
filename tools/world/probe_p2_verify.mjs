/**
 * P2 verification: zip line, pond floaties, walk-up slides + full vehicle
 * regression sweep.
 */
import { bootWorld, sleep, keyDown, keyUp } from './probe_lib.mjs';

const SCRATCH = 'C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page } = await bootWorld({ headless: true });

// ── A. zip line ─────────────────────────────────────────────────────────────
const zip = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const z = rides.zip;
  if (!z) return { built: false };
  const col = window.__world.world.collision;
  // which end has the handle?
  const h = z.handle.position;
  const from = Math.hypot(h.x - z.a.x, h.z - z.a.z) <= Math.hypot(h.x - z.b.x, h.z - z.b.z) ? z.a : z.b;
  const to = from === z.a ? z.b : z.a;
  const g = col.groundAt(from.x - Math.sign(to.x - from.x) * 0.5, from.z, from.y - 0.5);
  const info = {
    built: true,
    from: from.toArray().map((n) => +n.toFixed(2)),
    to: to.toArray().map((n) => +n.toFixed(2)),
    ledge: +g.toFixed(2),
  };
  // stand on the ledge just outside the boarding end, face the handle, walk in
  const dx = Math.sign(to.x - from.x);         // inward = toward the far end
  player.pos.set(from.x - dx * 0.55, g + 0.05, from.z);
  player.vel.y = 0;
  player.yaw = player.targetYaw = Math.atan2(dx, 0);
  window.__world.state.world.camYaw = Math.atan2(-dx, 0);   // boom opposite: W walks toward the handle
  await sleep2(100);
  key('keydown', 'KeyW');
  let grabbed = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 3000) {
    if (rides.active?.kind === 'zip') { grabbed = true; break; }
    await sleep2(50);
  }
  key('keyup', 'KeyW');
  if (!grabbed) return { ...info, grabbed };
  // ride it out
  let maxU = 0;
  const t1 = performance.now();
  while (performance.now() - t1 < 6000) {
    if (rides.active?.kind !== 'zip') break;
    maxU = Math.max(maxU, rides.active.u);
    await sleep2(60);
  }
  await sleep2(1500);
  return {
    ...info, grabbed, maxU: +maxU.toFixed(2),
    landed: [player.pos.x, player.pos.y, player.pos.z].map((n) => +n.toFixed(2)),
    grounded: player.grounded,
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
    handleAt: [+z.handle.position.x.toFixed(2), +z.handle.position.z.toFixed(2)],
  };
});
console.log('\n=== A. zip line ===');
console.log(JSON.stringify(zip));

// ── B. floatie ──────────────────────────────────────────────────────────────
const float1 = await page.evaluate(async () => {
  const S = window.__world.state, W = window.__world.world, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const floats = rides.vehicles.filter((x) => x.family === 'floatie');
  if (!floats.length) return { count: 0 };
  const v = floats[0];
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(300);
  const mounted = {
    riding: rides.active?.kind === 'vehicle',
    riderY: +player.pos.y.toFixed(2),
    bodyY: +v.group.position.y.toFixed(2),
  };
  key('keydown', 'KeyW');
  await sleep2(2500);
  key('keyup', 'KeyW');
  const afterPaddle = {
    pos: [player.pos.x, player.pos.z].map((n) => +n.toFixed(2)),
    stillWet: W.waterAt(player.pos.x, player.pos.z) != null,
    moved: +Math.hypot(player.pos.x - v.zone.pos[0], player.pos.z - v.zone.pos[1]).toFixed(2),
  };
  // paddle hard toward the south shore — the mask fence should stop us wet
  window.__world.state.world.camYaw = Math.PI;    // face south
  key('keydown', 'KeyS');
  await sleep2(3500);
  key('keyup', 'KeyS');
  const fence = {
    pos: [player.pos.x, player.pos.z].map((n) => +n.toFixed(2)),
    stillWet: W.waterAt(player.pos.x, player.pos.z) != null,
  };
  // hop off
  key('keydown', 'Space'); await sleep2(120); key('keyup', 'Space');
  await sleep2(800);
  return {
    count: floats.length, mounted, afterPaddle, fence,
    off: rides.active == null,
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
  };
});
console.log('\n=== B. floatie ===');
console.log(JSON.stringify(float1, null, 1));

// ── C. walk UP a slide ──────────────────────────────────────────────────────
const slide = await page.evaluate(async () => {
  const S = window.__world.state, W = window.__world.world, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (type, code) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const d = W.slideData[0];
  // stand at the exit, face up the chute, walk
  const ux = d.top.x - d.exit.x, uz = d.top.z - d.exit.z;
  const ul = Math.hypot(ux, uz);
  player.pos.set(d.exit.x - (ux / ul) * 0.6, d.exit.y + 0.3, d.exit.z - (uz / ul) * 0.6);
  player.vel.y = 0;
  const yaw = Math.atan2(ux / ul, uz / ul);
  player.yaw = player.targetYaw = yaw;
  window.__world.state.world.camYaw = yaw + Math.PI;   // boom behind: W walks up the chute
  await sleep2(200);
  key('keydown', 'KeyW');
  let peakY = -99, slid = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 5000) {
    peakY = Math.max(peakY, player.pos.y);
    if (rides.active?.kind === 'slide') slid = true;   // must NOT fire going up
    await sleep2(60);
  }
  key('keyup', 'KeyW');
  return {
    exitY: +d.exit.y.toFixed(2), topY: +d.top.y.toFixed(2),
    peakY: +peakY.toFixed(2),
    climbed: peakY > d.top.y - 0.55,
    autoSlideFiredGoingUp: slid,
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
  };
});
console.log('\n=== C. walk-up slide ===');
console.log(JSON.stringify(slide));

// ── D. regression: mount every vehicle ──────────────────────────────────────
const sweep = await page.evaluate(async () => {
  const S = window.__world.state, T = window.__world.THREE, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  for (const v of rides.vehicles) {
    player.pos.set(v.group.position.x + 1, v.group.position.y + 0.5, v.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(v.zone, player);
    await sleep2(250);
    out.push({
      family: v.family,
      ok: rides.active?.kind === 'vehicle'
        && [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
    });
    rides.active = null;
    player.rig.forceLegEmote = false;
    player.rig.stopEmote && player.rig.stopEmote();
    player.pos.set(v.group.position.x + 2, 2, v.group.position.z + 2);
    await sleep2(80);
  }
  return out;
});
console.log('\n=== D. vehicle sweep ===');
console.log(JSON.stringify(sweep));

// screenshot: floatie + pond
await page.evaluate(() => {
  const w = window.__world;
  w.tp(21.2, 7);
  w.state.world.camYaw = Math.PI;
  w.state.world.camPitch = 0.7;
  w.state.world.camDist = 12;
});
await sleep(900);
await page.screenshot({ path: SCRATCH + '/pond_p2.png' });

await browser.close();

/**
 * Baseline measurements for the P0 pass:
 *   A. every vehicle: rider-to-seat distance after mounting (the previous
 *      session's metric: player.pos vs the widest part's world centre, plus
 *      the top-band centroid which is where a saddle actually is)
 *   B. pond: where the real water plane ends, read from the shell vertices
 *   C. pogo stick: does it mount and ride without NaN
 *   D. jeep: how much geometry sits inside its collision boxes (shell-baked)
 */
import { bootWorld, sleep } from './probe_lib.mjs';

const { browser, page } = await bootWorld({ headless: true });

// ── A. vehicles ─────────────────────────────────────────────────────────────
const vehicles = await page.evaluate(async () => {
  const S = window.__world.state, W = window.__world.world;
  const T = window.__world.THREE;
  const player = S.player, rides = S.rides;
  const out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const v of rides.vehicles) {
    // park the kid next to it, mount, let ~20 frames run
    player.pos.set(v.group.position.x + 1, v.group.position.y + 0.5, v.group.position.z + 1);
    player.vel.y = 0;
    rides.begin(v.zone, player);
    await sleep(400);
    // deck part = widest-footprint child, measured in world space right now
    const pb = new T.Box3();
    let best = null, bestArea = -1;
    for (const c of v.group.children) {
      pb.setFromObject(c);
      const area = (pb.max.x - pb.min.x) * (pb.max.z - pb.min.z);
      if (area > bestArea) { bestArea = area; best = c; }
    }
    pb.setFromObject(best);
    const cx = (pb.min.x + pb.max.x) / 2, cz = (pb.min.z + pb.max.z) / 2;
    // top band of that part (saddle/board surface), from its real vertices
    const mesh = best.isMesh ? best : best.children.find((m) => m.isMesh) || best;
    let tb = null;
    if (mesh.isMesh) {
      mesh.updateWorldMatrix(true, false);
      const pos = mesh.geometry.attributes.position;
      const vv = new T.Vector3();
      let maxY = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        vv.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (vv.y > maxY) maxY = vv.y;
      }
      let sx = 0, sz = 0, n = 0;
      for (let i = 0; i < pos.count; i++) {
        vv.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (vv.y > maxY - 0.09) { sx += vv.x; sz += vv.z; n++; }
      }
      if (n) tb = { x: sx / n, z: sz / n, y: maxY, n };
    }
    const d = (x, z) => Math.hypot(player.pos.x - x, player.pos.z - z);
    out.push({
      family: v.family,
      zone: v.zone.id,
      pos: [+v.group.position.x.toFixed(2), +v.group.position.z.toFixed(2)],
      yaw: +v.yaw.toFixed(3),
      fwdOffset: +v.fwdOffset.toFixed(3),
      seat: v.seat.toArray().map((k) => +k.toFixed(3)),
      deck: +v.deck.toFixed(3),
      riderToWidestCentre: +d(cx, cz).toFixed(3),
      riderToTopBand: tb ? +d(tb.x, tb.z).toFixed(3) : null,
      riderY: +player.pos.y.toFixed(3),
      topBandY: tb ? +tb.y.toFixed(3) : null,
      finite: Number.isFinite(player.pos.x) && Number.isFinite(player.pos.y),
    });
    // force dismount + settle
    rides.active = null;
    player.rig.forceLegEmote = false;
    player.rig.stopEmote && player.rig.stopEmote();
    player.pos.set(v.group.position.x + 2, 2, v.group.position.z + 2);
    await sleep(120);
  }
  return out;
});
console.log('\n=== A. vehicles ===');
for (const v of vehicles) console.log(JSON.stringify(v));

// ── B. pond water plane ─────────────────────────────────────────────────────
const pond = await page.evaluate(() => {
  const W = window.__world.world, T = window.__world.THREE;
  let mesh = null;
  W.shell.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.attributes.position;
  const v = new T.Vector3();
  const CX = 21.187, CZ = 0.046;
  // y histogram of everything near the pond, cm resolution
  const hist = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    if (Math.hypot(v.x - CX, v.z - CZ) > 14.5) continue;
    if (v.y < -1.5 || v.y > 1.2) continue;
    const k = Math.round(v.y * 100);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => ({ y: k / 100, n }));
  // the flattest, biggest plateau near the collision top (0.119) is the water
  const wy = top.find((t) => Math.abs(t.y - 0.119) < 0.06)?.y ?? 0.119;
  let sx = 0, sz = 0, n = 0;
  const pts = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    if (Math.abs(v.y - wy) > 0.015) continue;
    if (Math.hypot(v.x - CX, v.z - CZ) > 14.5) continue;
    sx += v.x; sz += v.z; n++;
    pts.push([v.x, v.z]);
  }
  const cx = sx / n, cz = sz / n;
  const rs = pts.map(([x, z]) => Math.hypot(x - cx, z - cz)).sort((a, b) => a - b);
  const q = (p) => +rs[Math.min(rs.length - 1, Math.floor(p * rs.length))].toFixed(2);
  // directional max radius, 16 sectors — catches an elliptical pond
  const sect = new Array(16).fill(0);
  for (const [x, z] of pts) {
    const a = Math.atan2(z - cz, x - cx);
    const s = ((Math.floor((a + Math.PI) / (Math.PI * 2) * 16)) + 16) % 16;
    sect[s] = Math.max(sect[s], Math.hypot(x - cx, z - cz));
  }
  return {
    current: W.water, yLevels: top, waterY: wy, verts: n,
    centre: [+cx.toFixed(2), +cz.toFixed(2)],
    radius: { p50: q(0.5), p90: q(0.9), p99: q(0.99), max: +rs[rs.length - 1].toFixed(2) },
    sectorMax: sect.map((r) => +r.toFixed(2)),
  };
});
console.log('\n=== B. pond ===');
console.log(JSON.stringify(pond, null, 1));

// ── C. pogo ─────────────────────────────────────────────────────────────────
const pogo = await page.evaluate(async () => {
  const S = window.__world.state, player = S.player, rides = S.rides;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const v = rides.vehicles.find((x) => x.family === 'pogo');
  if (!v) return { found: false };
  player.pos.set(v.group.position.x + 0.8, 1, v.group.position.z + 0.8);
  await sleep(300);
  const promptNear = S.activeZone ? S.activeZone.id : null;
  rides.begin(v.zone, player);
  await sleep(600);
  const riding = rides.active && rides.active.kind === 'vehicle';
  const res = {
    found: true, pos: v.group.position.toArray().map((k) => +k.toFixed(2)),
    zoneRadius: v.zone.radius, promptNear, riding,
    playerY: +player.pos.y.toFixed(3),
    bodyY: +v.group.position.y.toFixed(3),
    finite: [player.pos.x, player.pos.y, player.pos.z].every(Number.isFinite),
    emote: player.rig.emote ? (player.rig.emote.id || 'playing') : null,
  };
  rides.active = null;
  player.rig.forceLegEmote = false;
  player.rig.stopEmote && player.rig.stopEmote();
  return res;
});
console.log('\n=== C. pogo ===');
console.log(JSON.stringify(pogo));

// ── D. jeep geometry in shell ───────────────────────────────────────────────
const jeep = await page.evaluate(() => {
  const W = window.__world.world, T = window.__world.THREE;
  let mesh = null;
  W.shell.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const pos = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  // the six boxes from park_collision.json
  const boxes = [
    { n: 'body', c: [-7.378, 0.391, 17.901], e: [0.783, 0.305, 0.72] },
    { n: 'steer', c: [-7.418, 0.616, 17.931], e: [0.149, 0.099, 0.153] },
    { n: 'w_fl', c: [-7.195, 0.155, 17.378], e: [0.165, 0.161, 0.145] },
    { n: 'w_fr', c: [-6.824, 0.155, 17.871], e: [0.165, 0.161, 0.145] },
    { n: 'w_rl', c: [-7.85, 0.155, 17.87], e: [0.165, 0.161, 0.145] },
    { n: 'w_rr', c: [-7.48, 0.155, 18.363], e: [0.165, 0.161, 0.145] },
  ];
  const counts = {};
  const inBox = (p, bx, pad = 0.05) =>
    Math.abs(p.x - bx.c[0]) < bx.e[0] + pad
    && Math.abs(p.y - bx.c[1]) < bx.e[1] + pad
    && Math.abs(p.z - bx.c[2]) < bx.e[2] + pad;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const q = new T.Vector3();
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    q.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    for (const bx of boxes) {
      if (inBox(q, bx)) { counts[bx.n] = (counts[bx.n] || 0) + 1; break; }
    }
  }
  return { counts, hasColor: !!mesh.geometry.attributes.color, indexed: !!idx };
});
console.log('\n=== D. jeep shell geometry ===');
console.log(JSON.stringify(jeep));

await browser.close();

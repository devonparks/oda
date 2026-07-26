/**
 * Investigation for Devon's second playtest:
 *   A. swings — where do the static chains live (y-extents of live vs carved
 *      triangles in the swing region)
 *   B. spinners — the outer TYRE band (seat radius + top height)
 *   C. bike/trike — saddle top-band centroid vs the frame's AABB centre
 *   D. playground top deck — fall-through map
 *   E. current skate stance — foot bones vs the deck, for the before numbers
 */
import { bootWorld, sleep } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });

// ── A. swings ───────────────────────────────────────────────────────────────
const swings = await page.evaluate(() => {
  const W = window.__world.world, T = window.__world.THREE;
  let mesh = null;
  W.shell.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  mesh.updateWorldMatrix(true, false);
  const m = mesh.matrixWorld;
  const pos = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  // region: the whole swing set, generous
  const R = { x0: 26.0, x1: 29.0, y0: -0.1, y1: 2.5, z0: 24.0, z1: 26.0 };
  const CARVE = { x0: 26.45, x1: 28.55, y0: 0.18, y1: 2.06, z0: 24.2, z1: 25.8 };
  const inR = (v, r) => v.x > r.x0 && v.x < r.x1 && v.y > r.y0 && v.y < r.y1 && v.z > r.z0 && v.z < r.z1;
  let live = 0, dead = 0, liveInCarve = 0;
  const liveTris = [];
  const triCount = idx.count / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx.getX(t * 3), i1 = idx.getX(t * 3 + 1), i2 = idx.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, i0).applyMatrix4(m);
    b.fromBufferAttribute(pos, i1).applyMatrix4(m);
    c.fromBufferAttribute(pos, i2).applyMatrix4(m);
    if (!(inR(a, R) || inR(b, R) || inR(c, R))) continue;
    const degenerate = (i0 === i1 || i1 === i2 || i0 === i2);
    if (degenerate) { dead++; continue; }
    live++;
    if (inR(a, CARVE) && inR(b, CARVE) && inR(c, CARVE)) liveInCarve++;
    liveTris.push({
      xs: [+Math.min(a.x, b.x, c.x).toFixed(2), +Math.max(a.x, b.x, c.x).toFixed(2)],
      ys: [+Math.min(a.y, b.y, c.y).toFixed(2), +Math.max(a.y, b.y, c.y).toFixed(2)],
      zs: [+Math.min(a.z, b.z, c.z).toFixed(2), +Math.max(a.z, b.z, c.z).toFixed(2)],
    });
  }
  // histogram of live tris by whether they'd be caught if maxY were raised
  const caughtAt = (maxY) => liveTris.filter((tr) =>
    tr.xs[0] > 26.45 && tr.xs[1] < 28.55 && tr.zs[0] > 24.2 && tr.zs[1] < 25.8
    && tr.ys[0] > 0.18 && tr.ys[1] < maxY).length;
  // chain-like: thin vertical, near the seat lines x = 27.5±0.62±0.19
  const chainish = liveTris.filter((tr) =>
    tr.ys[1] - tr.ys[0] > 0.8 && (tr.xs[1] - tr.xs[0]) < 0.3);
  return {
    live, dead, liveInCarve,
    caught: { at206: caughtAt(2.06), at216: caughtAt(2.16), at222: caughtAt(2.22), at230: caughtAt(2.30), at240: caughtAt(2.40) },
    chainish: chainish.slice(0, 12),
  };
});
console.log('\n=== A. swings ===');
console.log(JSON.stringify(swings, null, 1));

// ── B. spinners: the tyre band ──────────────────────────────────────────────
const spin = await page.evaluate(() => {
  const T = window.__world.THREE, rides = window.__world.state.rides;
  const out = [];
  for (const it of rides.spinners) {
    const centre = it.group.position;
    const v = new T.Vector3();
    // radial histogram of the assembly's verts: [r, y]
    const bands = [];   // 10cm radial bands: {maxY, n}
    it.group.traverse((o) => {
      if (!o.isMesh) return;
      o.updateWorldMatrix(true, false);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const r = Math.hypot(v.x - centre.x, v.z - centre.z);
        const bi = Math.floor(r / 0.1);
        if (!bands[bi]) bands[bi] = { maxY: -9, n: 0 };
        bands[bi].maxY = Math.max(bands[bi].maxY, v.y - centre.y);
        bands[bi].n++;
      }
    });
    out.push({
      pos: [+centre.x.toFixed(1), +centre.z.toFixed(1)],
      radius: +it.radius.toFixed(2), deck: +it.deck.toFixed(2),
      currentSeatR: +Math.max(0.35, it.radius * 0.52).toFixed(2),
      bands: bands.map((b2, i) => b2 ? { r: +(i * 0.1).toFixed(1), top: +b2.maxY.toFixed(2), n: b2.n } : null).filter(Boolean),
    });
  }
  return out;
});
console.log('\n=== B. spinners ===');
console.log(JSON.stringify(spin, null, 1));

// ── C. bike/trike saddle ────────────────────────────────────────────────────
const saddle = await page.evaluate(() => {
  const T = window.__world.THREE, rides = window.__world.state.rides;
  const out = [];
  const pb = new T.Box3();
  for (const v of rides.vehicles) {
    if (v.family !== 'bike' && v.family !== 'trike') continue;
    // widest child = the frame
    let best = null, bestArea = -1;
    for (const c of v.group.children) {
      pb.setFromObject(c);
      const area = (pb.max.x - pb.min.x) * (pb.max.z - pb.min.z);
      if (area > bestArea) { bestArea = area; best = c; }
    }
    const mesh = best.isMesh ? best : best.children.find((m) => m.isMesh) || best;
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.attributes.position;
    const vv = new T.Vector3();
    let maxY = -9;
    for (let i = 0; i < pos.count; i++) {
      vv.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (vv.y > maxY) maxY = vv.y;
    }
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < pos.count; i++) {
      vv.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (vv.y > maxY - 0.1) { sx += vv.x; sz += vv.z; n++; }
    }
    pb.setFromObject(best);
    const cx = (pb.min.x + pb.max.x) / 2, cz = (pb.min.z + pb.max.z) / 2;
    out.push({
      family: v.family, zone: v.zone.id,
      saddleTopBand: { x: +(sx / n).toFixed(2), z: +(sz / n).toFixed(2), y: +maxY.toFixed(2), n },
      frameCentre: { x: +cx.toFixed(2), z: +cz.toFixed(2) },
      offset: +Math.hypot(sx / n - cx, sz / n - cz).toFixed(3),
    });
  }
  return out;
});
console.log('\n=== C. bike/trike saddle vs frame centre ===');
console.log(JSON.stringify(saddle, null, 1));

// ── D. playground top deck fall-through map ─────────────────────────────────
const holes = await page.evaluate(() => {
  const col = window.__world.world.collision;
  // the upper structure region (zip ledge + roofs + slide tops)
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
console.log('\n=== D. playground top (from y2.75: # deck>1.7, = ledge, - low, . ground) ===');
for (const r of holes) console.log(r);

// ── E. current skate stance: foot bones vs deck ─────────────────────────────
const stance = await page.evaluate(async () => {
  const S = window.__world.state, T = window.__world.THREE, player = S.player, rides = S.rides;
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const v = rides.vehicles.find((x) => x.family === 'board');
  player.pos.set(v.group.position.x + 1, 1, v.group.position.z + 1);
  player.vel.y = 0;
  rides.begin(v.zone, player);
  await sleep2(500);
  const bones = {};
  for (const n of ['Ball_L', 'Ball_R', 'Ankle_L', 'Ankle_R', 'Hips']) {
    player.model.traverse((o) => { if (o.name === n && !bones[n]) bones[n] = o.getWorldPosition(new T.Vector3()); });
  }
  const pb = new T.Box3().setFromObject(v.group);
  const yaw = player.yaw;
  const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const along = (p) => (p.x - player.pos.x) * fwd.x + (p.z - player.pos.z) * fwd.z;
  const across = (p) => (p.x - player.pos.x) * fwd.z - (p.z - player.pos.z) * fwd.x;
  const res = {};
  for (const [n, p] of Object.entries(bones)) {
    res[n] = { along: +along(p).toFixed(3), across: +across(p).toFixed(3), y: +p.y.toFixed(3) };
  }
  res.deckTop = +pb.max.y.toFixed(3);
  rides.active = null;
  player.rig.forceLegEmote = false;
  player.rig.stopEmote && player.rig.stopEmote();
  return res;
});
console.log('\n=== E. skate stance now (along = travel axis, across = perpendicular) ===');
console.log(JSON.stringify(stance, null, 1));

await browser.close();

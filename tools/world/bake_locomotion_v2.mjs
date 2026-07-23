/**
 * Bake locomotion onto the v2 kid rigs — offline (Node, zero deps).
 *
 * WHY THIS EXISTS (see docs/EMOTE_SYNC_BRIEF.md): the Drop4-Hub session shipped
 * `assets/characters/v2/*.glb` (Unity-T-pose bind) + `assets/characters/emotes/*`
 * (ABSOLUTE v2-local emote clips). AMG World is adopting those rigs so the real
 * 58 emotes play. But an avatar can only wear ONE rig, so the world's locomotion
 * (idle/walk/run/sprint/jump/fall/land) must move onto the SAME v2 rig in the
 * same change. This tool does exactly that.
 *
 * It reuses the PROVEN math from `tools/world/emote_lab.mjs` step 6 (the idle
 * bake) VERBATIM — copied rather than imported so this script does not modify
 * that committed file (the sync brief forbids touching emote_lab.mjs / the v2
 * GLBs / the emote bins). Same math + same v2 rigs = one pipeline, not two.
 *
 * Source clips: `_unity_export/rig/locomotion_bindref.json` — the 7 clips as
 * BIND-referenced deltas (Unity local = bind ⊗ Δ, no idle→bind hop).
 * Output (world's lane): `world/assets/locomotion_v2.bin` + `.json`, in the
 * exact same byte layout as the emote bins so ONE sampler reads both:
 *   per clip:  frames × 22 × 4 int16 ABSOLUTE v2-local quats (×32767),
 *              then frames × int16 hip-Y offset in mm.
 *
 * Run:   node tools/world/bake_locomotion_v2.mjs          (bake)
 *        node tools/world/bake_locomotion_v2.mjs verify   (bake + self-checks)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..', '..');
const P = (...s) => path.join(ROOT, ...s);

// ── quaternion lib (Hamilton, [x,y,z,w]) — copied from emote_lab.mjs ─────────
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((v) => v / l); };
const qrot = (q, v) => {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};

// ── minimal GLB parser + FK — copied from emote_lab.mjs ─────────────────────
function parseGLB(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not GLB: ' + file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const nodes = json.nodes.map((n, i) => ({
    i, name: n.name || 'node' + i,
    q: n.rotation ? [...n.rotation] : [0, 0, 0, 1],
    t: n.translation ? [...n.translation] : [0, 0, 0],
    s: n.scale ? [...n.scale] : [1, 1, 1],
    children: n.children || [], parent: -1,
  }));
  nodes.forEach((n) => n.children.forEach((c) => { nodes[c].parent = n.i; }));
  const byName = {}; nodes.forEach((n) => { byName[n.name] = n; });
  return { json, nodes, byName };
}
function fkGLB(glb, poseLocalQ) {
  const W = {};
  const walk = (n, pq, pp, ps) => {
    const localQ = (poseLocalQ && poseLocalQ[n.name]) || n.q;
    const scaled = [n.t[0] * ps[0], n.t[1] * ps[1], n.t[2] * ps[2]];
    const p = qrot(pq, scaled).map((v, i) => v + pp[i]);
    const q = qnorm(qmul(pq, localQ));
    const s = [ps[0] * n.s[0], ps[1] * n.s[1], ps[2] * n.s[2]];
    W[n.name] = { q, p, s };
    n.children.forEach((c) => walk(glb.nodes[c], q, p, s));
  };
  glb.nodes.filter((n) => n.parent === -1).forEach((n) => walk(n, [0, 0, 0, 1], [0, 0, 0], [1, 1, 1]));
  return W;
}

// ── data loads ──────────────────────────────────────────────────────────────
const loco = JSON.parse(fs.readFileSync(P('world', 'assets', 'locomotion.json')));
const bindref = JSON.parse(fs.readFileSync(P('_unity_export', 'rig', 'locomotion_bindref.json')));
const BONES = loco.bones;          // 22, the shared ordering everywhere
const IDLE = loco.refPose;         // Unity idle locals {q,parent} — parent fallback for FK
const BIND = bindref.bindPose;     // Unity bind (T-pose) locals {q,parent}

/** FK Unity-space world rotations from local quats (rotations only). */
function fkUnity(locals, refForParents = BIND) {
  const W = {};
  const get = (name) => {
    if (W[name]) return W[name];
    const info = refForParents[name] || IDLE[name];
    const parentName = info ? info.parent : null;
    const pq = parentName && (refForParents[parentName] || IDLE[parentName]) ? get(parentName) : [0, 0, 0, 1];
    return (W[name] = qnorm(qmul(pq, locals[name] || [0, 0, 0, 1])));
  };
  BONES.forEach((b) => get(b));
  return W;
}
const refQ = (ref) => Object.fromEntries(BONES.map((b) => [b, ref[b].q]));
const mirrorX = (q) => [q[0], -q[1], -q[2], q[3]];

// ── the retarget: one clip frame's BIND-referenced deltas → v2-local quats ──
// This is emote_lab.mjs step6's body, factored to run per frame for any clip.
const v2 = parseGLB(P('assets', 'characters', 'v2', 'kid_hoodie.glb'));
const restW = fkGLB(v2, null);
const uBindW = fkUnity(refQ(BIND));
const Aconst = {};   // per-bone constant M(BindW_U)⁻¹ · BindW_v2
BONES.forEach((b) => { if (v2.byName[b]) Aconst[b] = qnorm(qmul(qinv(mirrorX(uBindW[b])), restW[b].q)); });

/** @param clip bindref clip {rot:float[], frames}  @param f frame index */
function retargetClipFrame(clip, f) {
  const nb = BONES.length;
  // Unity absolute locals at frame f: bind ⊗ Δ_bind
  const uLocals = {};
  for (let b = 0; b < nb; b++) {
    const i = (f * nb + b) * 4;
    const d = qnorm([clip.rot[i], clip.rot[i + 1], clip.rot[i + 2], clip.rot[i + 3]]);
    uLocals[BONES[b]] = qmul(BIND[BONES[b]].q, d);
  }
  const uW = fkUnity(uLocals);
  const desiredW = {}, locals = {};
  BONES.forEach((b) => { if (v2.byName[b]) desiredW[b] = qnorm(qmul(mirrorX(uW[b]), Aconst[b])); });
  BONES.forEach((b) => {
    const node = v2.byName[b]; if (!node) return;
    const parent = node.parent >= 0 ? v2.nodes[node.parent] : null;
    const pW = parent && desiredW[parent.name] ? desiredW[parent.name]
      : (parent ? fkGLB(v2, locals)[parent.name].q : [0, 0, 0, 1]);
    locals[b] = qnorm(qmul(qinv(pW), desiredW[b]));
  });
  return locals;
}

/** Encode one clip to the shared bin layout: quats block then hipY block. */
function encodeClip(clip) {
  const nb = BONES.length;
  const arr = new Int16Array(clip.frames * nb * 4 + clip.frames);
  for (let f = 0; f < clip.frames; f++) {
    const locals = retargetClipFrame(clip, f);
    for (let b = 0; b < nb; b++) {
      const q = locals[BONES[b]] || (v2.byName[BONES[b]] ? v2.byName[BONES[b]].q : [0, 0, 0, 1]);
      const p = (f * nb + b) * 4;
      arr[p] = Math.round(q[0] * 32767); arr[p + 1] = Math.round(q[1] * 32767);
      arr[p + 2] = Math.round(q[2] * 32767); arr[p + 3] = Math.round(q[3] * 32767);
    }
    arr[clip.frames * nb * 4 + f] = Math.round((clip.hipY ? clip.hipY[f] : 0) * 1000);
  }
  return Buffer.from(arr.buffer);
}

// ── bake ────────────────────────────────────────────────────────────────────
function bake() {
  const fps = bindref.fps || 30;
  const order = ['idle', 'walk', 'run', 'sprint', 'jump', 'fall', 'land'];
  const chunks = [];
  const clipsOut = [];
  let off = 0;
  for (const id of order) {
    const clip = bindref.clips[id];
    if (!clip) { console.log('  (skip, missing in bindref):', id); continue; }
    const bytes = encodeClip(clip);
    chunks.push(bytes);
    clipsOut.push({ id, frames: clip.frames, off, loop: !!clip.loop, dur: clip.frames / fps });
    off += bytes.length;
    console.log(`  ${id.padEnd(8)} ${clip.frames}f  ${(bytes.length / 1024).toFixed(1)}KB`);
  }
  const outDir = P('world', 'assets');
  fs.writeFileSync(path.join(outDir, 'locomotion_v2.bin'), Buffer.concat(chunks));
  const manifest = { format: 'v2local', fps, bones: BONES, clips: clipsOut };
  fs.writeFileSync(path.join(outDir, 'locomotion_v2.json'), JSON.stringify(manifest));
  console.log(`  TOTAL ${(off / 1024).toFixed(1)}KB → world/assets/locomotion_v2.bin (+ .json manifest)`);
  return { manifest, off };
}

console.log('\n═══ bake v2 locomotion ═══');
bake();

// ── verify ──────────────────────────────────────────────────────────────────
if (process.argv[2] === 'verify') {
  console.log('\n═══ verify ═══');
  const Q16 = 1 / 32767;
  const nb = BONES.length;

  // (1) CROSS-CHECK: my idle bake must equal the committed emote idle.bin
  //     (both are bindref.clips.idle through the identical step6 retarget).
  const mine = new Int16Array(fs.readFileSync(P('world', 'assets', 'locomotion_v2.bin')).buffer.slice(0, 0));
  const locoManifest = JSON.parse(fs.readFileSync(P('world', 'assets', 'locomotion_v2.json')));
  const bin = fs.readFileSync(P('world', 'assets', 'locomotion_v2.bin'));
  const idleClip = locoManifest.clips.find((c) => c.id === 'idle');
  const myIdle = new Int16Array(bin.buffer.slice(idleClip.off, idleClip.off + idleClip.frames * nb * 4 * 2 + idleClip.frames * 2));
  const theirs = new Int16Array(fs.readFileSync(P('assets', 'characters', 'emotes', 'idle.bin')).buffer.slice(0));
  let worst = 0, n = Math.min(myIdle.length, theirs.length);
  for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(myIdle[i] - theirs[i]));
  console.log(`  idle vs committed idle.bin: len ${myIdle.length}/${theirs.length}, worst int16 diff ${worst} ${worst <= 2 ? '✓ (rounding only — same pipeline)' : '✗ DIVERGENT'}`);

  // (2) PHYSICAL: FK a walk mid-frame on v2, feet near ground + head upright + stride
  const walk = locoManifest.clips.find((c) => c.id === 'walk');
  function readFrame(clip, f) {
    const base = clip.off >> 1; // int16 index
    const locals = {};
    for (let b = 0; b < nb; b++) {
      const p = base + (f * nb + b) * 4;
      const arrI = new Int16Array(bin.buffer, 0);
      locals[BONES[b]] = qnorm([arrI[p] * Q16, arrI[p + 1] * Q16, arrI[p + 2] * Q16, arrI[p + 3] * Q16]);
    }
    return locals;
  }
  const mid = Math.floor(walk.frames / 2);
  const posed = fkGLB(v2, readFrame(walk, mid));
  const y = (nn) => (posed[nn] ? posed[nn].p[1].toFixed(3) : '—');
  const z = (nn) => (posed[nn] ? posed[nn].p[2].toFixed(3) : '—');
  console.log(`  walk f${mid}: Head ${y('Head')} (rest 1.001)  Ankle_L ${y('Ankle_L')} Ankle_R ${y('Ankle_R')} (rest ~0.08)  Hand_L ${y('Hand_L')} Hand_R ${y('Hand_R')}`);
  console.log(`  walk f${mid} stride Z: Ankle_L ${z('Ankle_L')} Ankle_R ${z('Ankle_R')} (should differ — one foot fwd)`);

  // (3) sample a few walk frames to confirm the feet actually cycle
  let minZ = 9, maxZ = -9;
  for (let f = 0; f < walk.frames; f++) {
    const pp = fkGLB(v2, readFrame(walk, f));
    if (pp.Ankle_L) { minZ = Math.min(minZ, pp.Ankle_L.p[2]); maxZ = Math.max(maxZ, pp.Ankle_L.p[2]); }
  }
  console.log(`  walk Ankle_L Z travel over cycle: ${(maxZ - minZ).toFixed(3)} m (nonzero = real stride)`);
}

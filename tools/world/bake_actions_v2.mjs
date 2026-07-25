/**
 * Bake AMG World's ACTIVITY clips onto the v2 kid rigs — offline (Node, zero deps).
 *
 * WHY THIS EXISTS
 * ---------------
 * The park's activities were borrowing emotes as poses: 'squat' frozen at 1.8 s
 * was the "sit" on benches / swings / seesaw / spring riders / kart / slides, the
 * 'twist' dance was the "hula hoop", and the 'baseball' bat swing was the
 * "fishing cast". This produces the real thing: sit idles, a swing pump that
 * kicks its feet out, a slide ride, a fishing cast + reel, and hula hips.
 *
 * Source: tools/world/actions_bindref.json, authored on the actual Polygon Kid
 * rig by tools/world/unity/AMGActionBaker.cs (world-space aim + two-bone IK to
 * measured contact points, with the real Synty idle's breath residual layered
 * over the torso). Same wire format as _unity_export/rig/locomotion_bindref.json:
 * BIND-referenced deltas + hip-Y, 22 bones.
 *
 * The retarget below is emote_lab.mjs step 6's body, COPIED verbatim (exactly as
 * bake_locomotion_v2.mjs did) rather than imported — emote_lab.mjs is a committed
 * reference with a side-effecting CLI and must not be touched or run blind.
 *
 * Output (the emote lane, so RigV2's existing emote channel plays it):
 *   assets/characters/emotes/actions.bin   — per clip: frames × 22 × 4 int16
 *                                            ABSOLUTE v2-local quats (×32767),
 *                                            then frames × int16 hip-Y in mm.
 *   assets/characters/emotes/manifest.json — gains ONE new category, `actions`.
 * Nothing already in that folder is rewritten: the existing six category bins and
 * their manifest entries are byte-identical after a run (arcade/drop4/express.js
 * and the world's emote wheel share them). A guard below fails the bake if that
 * ever stops being true.
 *
 * NOTE ON FPS: RigV2 plays every clip in the emote lane at the manifest's single
 * global fps (20). The source is authored at 20 fps for exactly that reason.
 *
 * Run:   node tools/world/bake_actions_v2.mjs          (bake)
 *        node tools/world/bake_actions_v2.mjs verify   (bake + FK self-checks)
 *        node tools/world/bake_actions_v2.mjs poses    (bake + emit render poses)
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
const SRC = P('tools', 'world', 'actions_bindref.json');
if (!fs.existsSync(SRC)) {
  console.error('missing ' + SRC + '\n  → run Unity menu  AMG > Bake World Action Clips');
  process.exit(1);
}
const src = JSON.parse(fs.readFileSync(SRC));
const BONES = src.bones;          // 22, the shared ordering everywhere
const BIND = src.bindPose;        // Unity bind (T-pose) locals {q,parent}

/**
 * FK Unity-space world rotations from local quats (rotations only).
 * `Root` (the Hips' parent) appears in no bindPose in this pipeline and is
 * therefore identity — same as bake_locomotion_v2.mjs and emote_lab.mjs.
 */
function fkUnity(locals, refForParents = BIND) {
  const W = {};
  const get = (name) => {
    if (W[name]) return W[name];
    const info = refForParents[name];
    const parentName = info ? info.parent : null;
    const pq = parentName && refForParents[parentName] ? get(parentName) : [0, 0, 0, 1];
    return (W[name] = qnorm(qmul(pq, locals[name] || [0, 0, 0, 1])));
  };
  BONES.forEach((b) => get(b));
  return W;
}
const refQ = (ref) => Object.fromEntries(BONES.map((b) => [b, ref[b].q]));
const mirrorX = (q) => [q[0], -q[1], -q[2], q[3]];

// ── the retarget: one clip frame's BIND-referenced deltas → v2-local quats ──
// emote_lab.mjs step6's body, factored to run per frame for any clip.
const v2 = parseGLB(P('assets', 'characters', 'v2', 'kid_hoodie.glb'));
const restW = fkGLB(v2, null);
const uBindW = fkUnity(refQ(BIND));
const Aconst = {};   // per-bone constant M(BindW_U)⁻¹ · BindW_v2
BONES.forEach((b) => { if (v2.byName[b]) Aconst[b] = qnorm(qmul(qinv(mirrorX(uBindW[b])), restW[b].q)); });

function retargetClipFrame(clip, f) {
  const nb = BONES.length;
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

// Order is the bin's layout order; `hold` marks a looping clip (RigV2 wraps the
// playhead and holds the channel open until stopEmote()).
const ORDER = ['sit', 'sit_swing', 'swing_pump', 'slide_ride', 'sit_kart',
  'sit_seesaw', 'sit_rocker', 'hula', 'fish_cast', 'fish_wait', 'fish_reel'];
const ICONS = {
  sit: '\u{1FA91}', sit_swing: '\u{1F4BA}', swing_pump: '\u{1F4BA}', slide_ride: '\u{1F6DD}',
  sit_kart: '\u{1F3CE}️', sit_seesaw: '⚖️', sit_rocker: '\u{1F40E}',
  hula: '⭕', fish_cast: '\u{1F3A3}', fish_wait: '\u{1F41F}', fish_reel: '\u{1F41F}',
};

const OUT_DIR = P('assets', 'characters', 'emotes');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// ── bake ────────────────────────────────────────────────────────────────────
function bake() {
  const chunks = [];
  const emotesOut = [];
  let off = 0;
  for (const id of ORDER) {
    const clip = src.clips[id];
    if (!clip) { console.log('  (missing in source, skipped):', id); continue; }
    const bytes = encodeClip(clip);
    chunks.push(bytes);
    emotesOut.push({
      id, label: clip.label || id, icon: ICONS[id] || '✨',
      frames: clip.frames, off, hold: !!clip.loop, dur: clip.frames / src.fps,
    });
    off += bytes.length;
    console.log(`  ${id.padEnd(12)} ${String(clip.frames).padStart(3)}f  ${(bytes.length / 1024).toFixed(1).padStart(5)}KB  ${clip.loop ? 'loop' : 'one-shot'}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'actions.bin'), Buffer.concat(chunks));

  // Extend the manifest with ONE new category, leaving every existing byte of
  // the other categories (and the idle block) exactly as it was.
  const m = JSON.parse(fs.readFileSync(MANIFEST));
  if (m.fps !== src.fps) {
    throw new Error(`fps mismatch: manifest ${m.fps} vs source ${src.fps}. RigV2 plays the whole emote lane at the manifest fps — rebake the source at ${m.fps}.`);
  }
  const before = JSON.stringify(m.categories.filter((c) => c.id !== 'actions'));
  m.categories = m.categories.filter((c) => c.id !== 'actions');
  m.categories.push({ id: 'actions', label: 'Activities', hidden: true, emotes: emotesOut });
  const after = JSON.stringify(m.categories.filter((c) => c.id !== 'actions'));
  if (before !== after) throw new Error('refusing to write: an existing manifest category changed');
  fs.writeFileSync(MANIFEST, JSON.stringify(m));
  console.log(`  TOTAL ${(off / 1024).toFixed(1)}KB → assets/characters/emotes/actions.bin (+ manifest category "actions", hidden)`);
  return emotesOut;
}

console.log('\n═══ bake v2 action clips ═══');
const baked = bake();

// ── verify ──────────────────────────────────────────────────────────────────
const Q16 = 1 / 32767, nb = BONES.length;
const bin = fs.readFileSync(path.join(OUT_DIR, 'actions.bin'));
const info = Object.fromEntries(baked.map((e) => [e.id, e]));

function readFrame(e, f) {
  const arrI = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength >> 1);
  const base = e.off >> 1;
  const locals = {};
  for (let b = 0; b < nb; b++) {
    const p = base + (f * nb + b) * 4;
    locals[BONES[b]] = qnorm([arrI[p] * Q16, arrI[p + 1] * Q16, arrI[p + 2] * Q16, arrI[p + 3] * Q16]);
  }
  return locals;
}
const posedAt = (id, f) => fkGLB(v2, readFrame(info[id], f));
const deg = (a, b) => Math.acos(Math.max(-1, Math.min(1,
  (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) || 1)))) * 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

if (process.argv[2] === 'verify') {
  console.log('\n═══ verify (FK on the shipped bin, kid_hoodie) ═══');

  // (0) existing bins untouched — the one thing that could break other pages
  const sizes = { greet: 85262, happy: 150054, dance: 136526, sporty: 117836, feelings: 140976, poses: 110894, idle: 9434 };
  let intact = true;
  for (const [k, want] of Object.entries(sizes)) {
    const got = fs.statSync(path.join(OUT_DIR, k + '.bin')).size;
    if (got !== want) { intact = false; console.log(`  ! ${k}.bin size changed: ${got} (was ${want})`); }
  }
  console.log(`  existing emote bins untouched: ${intact ? '✓' : '✗'}`);
  const m = JSON.parse(fs.readFileSync(MANIFEST));
  console.log(`  manifest categories: ${m.categories.map((c) => c.id).join(', ')}  (idle block ${m.idle ? '✓' : '✗ MISSING'})`);

  // (1) rest reference on the v2 rig
  const R = restW;
  console.log(`  v2 rest: Head ${R.Head.p[1].toFixed(3)}  Hips ${R.Hips.p[1].toFixed(3)}  Ankle_L ${R.Ankle_L.p[1].toFixed(3)}  Hand_R ${R.Hand_R.p[1].toFixed(3)}`);

  // (2) per clip: the numbers that decide whether a pose is real.
  //     kneeOpen is the INTERIOR joint angle — 180 = straight leg, 90 = folded.
  console.log('\n  clip        kneeOpen° hipFlex°  head    ankleL(y,z)     handL(x,y,z)          handR(x,y,z)');
  for (const e of baked) {
    const W = posedAt(e.id, 0);
    const thigh = sub(W.LowerLeg_L.p, W.UpperLeg_L.p);
    const shin = sub(W.Ankle_L.p, W.LowerLeg_L.p);
    const knee = 180 - deg(thigh, shin);
    const hipFlex = deg([0, -1, 0], thigh);
    const f3 = (v) => v.toFixed(3).padStart(6);
    console.log(`  ${e.id.padEnd(12)} ${knee.toFixed(0).padStart(4)}  ${hipFlex.toFixed(0).padStart(6)}   ${f3(W.Head.p[1])}  ${f3(W.Ankle_L.p[1])},${f3(W.Ankle_L.p[2])}  ${f3(W.Hand_L.p[0])},${f3(W.Hand_L.p[1])},${f3(W.Hand_L.p[2])}  ${f3(W.Hand_R.p[0])},${f3(W.Hand_R.p[1])},${f3(W.Hand_R.p[2])}`);
  }

  // (3) CONTACT assertions — the poses exist to touch specific things
  console.log('\n  contact checks');
  const chk = (label, ok, detail) => console.log(`   ${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`);

  // sit: thigh near horizontal, knee well bent, hands beside the hips
  {
    const W = posedAt('sit', 0);
    const thigh = sub(W.LowerLeg_L.p, W.UpperLeg_L.p);
    const hipFlex = deg([0, -1, 0], thigh);
    const knee = 180 - deg(thigh, sub(W.Ankle_L.p, W.LowerLeg_L.p));
    chk('sit: hip flexed 60-105° (thigh forward)', hipFlex > 60 && hipFlex < 105, `${hipFlex.toFixed(0)}°`);
    chk('sit: knee bent 55-105°', knee > 55 && knee < 105, `${knee.toFixed(0)}°`);
    chk('sit: hands beside the hips, not floating', Math.abs(W.Hand_L.p[1] - W.Hips.p[1]) < 0.12,
      `handL y ${W.Hand_L.p[1].toFixed(3)} vs hips ${W.Hips.p[1].toFixed(3)}`);
    chk('sit: knees ahead of the hips', W.LowerLeg_L.p[2] - W.Hips.p[2] > 0.15,
      `Δz ${(W.LowerLeg_L.p[2] - W.Hips.p[2]).toFixed(3)}`);
  }
  // sit_swing: both hands up at the chain line x = ±0.19.
  // NOTE the sign: the v2 GLB is the Unity rig with X NEGATED (measured — Y and
  // Z are identical, so "forward" still means +Z). The bone named Hand_L, which
  // is at -X in Unity, therefore sits at +X here.
  {
    const W = posedAt('sit_swing', 0);
    const dL = Math.hypot(W.Hand_L.p[0] - 0.19, W.Hand_L.p[2] - 0.005);
    const dR = Math.hypot(W.Hand_R.p[0] + 0.19, W.Hand_R.p[2] - 0.005);
    chk('swing sit: hands ON the chains (±0.19, within 4 cm)', dL < 0.04 && dR < 0.04,
      `L ${dL.toFixed(3)} R ${dR.toFixed(3)}`);
    chk('swing sit: grip above the shoulders', W.Hand_L.p[1] > W.Shoulder_L.p[1] + 0.15,
      `hand ${W.Hand_L.p[1].toFixed(3)} vs shoulder ${W.Shoulder_L.p[1].toFixed(3)}`);
  }
  // swing_pump: the legs must actually travel, and the hands must NOT
  {
    let lo = 9, hi = -9, handSpread = 0;
    const c = info.swing_pump;
    for (let f = 0; f < c.frames; f++) {
      const W = posedAt('swing_pump', f);
      lo = Math.min(lo, W.Ankle_L.p[1]); hi = Math.max(hi, W.Ankle_L.p[1]);
      handSpread = Math.max(handSpread, Math.hypot(W.Hand_R.p[0] + 0.19, W.Hand_R.p[2] - 0.005));
    }
    chk('swing pump: feet travel > 25 cm over the cycle', hi - lo > 0.25, `${(hi - lo).toFixed(3)} m`);
    chk('swing pump: hands stay welded to the chain (< 6 cm)', handSpread < 0.06, `${handSpread.toFixed(3)} m`);
  }
  // THE CONTRACT WITH rides.js / main.js: a seated clip drops the pelvis to
  // where the old frozen-'squat' stand-in put it (hipY -0.261), so every seat
  // offset those files tuned against the squat still lands. Break this and the
  // kids float above the benches — silently, at runtime, on the live site.
  {
    const SEATED = ['sit', 'sit_swing', 'swing_pump', 'slide_ride', 'sit_kart', 'sit_seesaw', 'sit_rocker'];
    const hipOf = (id, f) => {
      const e = info[id];
      const arrI = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength >> 1);
      return arrI[(e.off >> 1) + e.frames * nb * 4 + f] / 1000;
    };
    let worst = 0;
    for (const id of SEATED) for (let f = 0; f < info[id].frames; f++) worst = Math.max(worst, Math.abs(hipOf(id, f) + 0.261));
    chk('seated clips carry the -0.261 pelvis drop (rides.js offsets depend on it)', worst < 0.03, `max deviation ${worst.toFixed(3)} m`);
    const standing = ['hula', 'fish_cast', 'fish_wait', 'fish_reel'];
    let stand = 0;
    for (const id of standing) for (let f = 0; f < info[id].frames; f++) stand = Math.max(stand, Math.abs(hipOf(id, f)));
    chk('standing clips keep the pelvis at standing height', stand < 0.05, `max |hipY| ${stand.toFixed(3)} m`);
  }
  // straddle sits: the knees must actually FOLD. Legs merely spread with straight
  // knees renders as a kid standing and leaning, which is what the first bake did.
  for (const id of ['sit_seesaw', 'sit_rocker']) {
    const W = posedAt(id, 0);
    const thigh = sub(W.LowerLeg_L.p, W.UpperLeg_L.p);
    const open = 180 - deg(thigh, sub(W.Ankle_L.p, W.LowerLeg_L.p));
    const spread = Math.abs(W.Ankle_L.p[0] - W.Ankle_R.p[0]);
    chk(`${id}: knee folded past 110°`, open < 110, `${open.toFixed(0)}° interior`);
    chk(`${id}: feet straddle wider than the hips`, spread > 0.20, `${spread.toFixed(3)} m apart`);
  }
  // hula: hips orbit, head stays put
  {
    const c = info.hula;
    let hx = [9, -9], hz = [9, -9], headX = [9, -9];
    for (let f = 0; f < c.frames; f++) {
      const W = posedAt('hula', f);
      hx = [Math.min(hx[0], W.Spine_01.p[0]), Math.max(hx[1], W.Spine_01.p[0])];
      hz = [Math.min(hz[0], W.Spine_01.p[2]), Math.max(hz[1], W.Spine_01.p[2])];
      headX = [Math.min(headX[0], W.Head.p[0]), Math.max(headX[1], W.Head.p[0])];
    }
    chk('hula: pelvis orbits in X and Z', hx[1] - hx[0] > 0.03 && hz[1] - hz[0] > 0.03,
      `X ${(hx[1] - hx[0]).toFixed(3)} Z ${(hz[1] - hz[0]).toFixed(3)}`);
    chk('hula: head sways less than the hips (counter-tilt works)',
      headX[1] - headX[0] < (hx[1] - hx[0]) * 2.2, `head X ${(headX[1] - headX[0]).toFixed(3)}`);
  }
  // fish_cast: the right hand must go BACK then FORWARD past the body
  {
    const c = info.fish_cast;
    let minZ = 9, maxZ = -9, atMin = 0, atMax = 0;
    for (let f = 0; f < c.frames; f++) {
      const z = posedAt('fish_cast', f).Hand_R.p[2];
      if (z < minZ) { minZ = z; atMin = f; }
      if (z > maxZ) { maxZ = z; atMax = f; }
    }
    chk('cast: hand travels > 45 cm front-to-back', maxZ - minZ > 0.45, `${(maxZ - minZ).toFixed(3)} m`);
    chk('cast: wind-up comes BEFORE the whip', atMin < atMax, `back @f${atMin}, forward @f${atMax}`);
    chk('cast: rod hand ends near the hold pose',
      Math.abs(posedAt('fish_cast', c.frames - 1).Hand_R.p[2] - posedAt('fish_wait', 0).Hand_R.p[2]) < 0.08);
  }
  // fish_reel: left hand cranks a circle
  {
    const c = info.fish_reel;
    let cy = [9, -9], cz = [9, -9];
    for (let f = 0; f < c.frames; f++) {
      const W = posedAt('fish_reel', f);
      cy = [Math.min(cy[0], W.Hand_L.p[1]), Math.max(cy[1], W.Hand_L.p[1])];
      cz = [Math.min(cz[0], W.Hand_L.p[2]), Math.max(cz[1], W.Hand_L.p[2])];
    }
    chk('reel: left hand cranks a visible circle', cy[1] - cy[0] > 0.07,
      `Y ${(cy[1] - cy[0]).toFixed(3)} Z ${(cz[1] - cz[0]).toFixed(3)}`);
  }
  // loops must actually loop: last frame close to first
  {
    console.log('\n  loop continuity (max bone Δ° first↔last frame)');
    for (const e of baked) {
      if (!e.hold) continue;
      const a = readFrame(e, 0), b = readFrame(e, e.frames - 1);
      let worst = 0, worstB = '';
      for (const bn of BONES) {
        const d = Math.min(1, Math.abs(a[bn][0] * b[bn][0] + a[bn][1] * b[bn][1] + a[bn][2] * b[bn][2] + a[bn][3] * b[bn][3]));
        const ang = 2 * Math.acos(d) * 180 / Math.PI;
        if (ang > worst) { worst = ang; worstB = bn; }
      }
      console.log(`   ${e.id.padEnd(12)} ${worst.toFixed(1).padStart(5)}°  (${worstB}) ${worst < 25 ? '✓' : '— seam'}`);
    }
  }
  // secondary motion actually present (the residual layer did something)
  {
    console.log('\n  torso life (Spine_02 travel over the clip, degrees)');
    for (const e of baked) {
      let worst = 0;
      const a = readFrame(e, 0);
      for (let f = 1; f < e.frames; f++) {
        const b = readFrame(e, f);
        const d = Math.min(1, Math.abs(a.Spine_02[0] * b.Spine_02[0] + a.Spine_02[1] * b.Spine_02[1] + a.Spine_02[2] * b.Spine_02[2] + a.Spine_02[3] * b.Spine_02[3]));
        worst = Math.max(worst, 2 * Math.acos(d) * 180 / Math.PI);
      }
      console.log(`   ${e.id.padEnd(12)} ${worst.toFixed(1).padStart(5)}° ${worst > 0.8 ? '✓ breathing' : '✗ STATIC'}`);
    }
  }
}

// ── render poses (feeds tools/world/render_pose.mjs) ────────────────────────
if (process.argv[2] === 'poses') {
  const poses = [];
  const wants = [
    ['sit', 0], ['sit_swing', 0], ['swing_pump', 6], ['swing_pump', 18],
    ['slide_ride', 0], ['sit_kart', 0], ['sit_seesaw', 0], ['sit_rocker', 0],
    ['hula', 0], ['hula', 8], ['fish_cast', 7], ['fish_cast', 12],
    ['fish_wait', 0], ['fish_reel', 6],
  ];
  for (const [id, f] of wants) {
    if (!info[id]) continue;
    poses.push({ label: `${id}-f${f}`, locals: readFrame(info[id], Math.min(f, info[id].frames - 1)) });
  }
  const out = P('tools', 'world', '_action_poses.json');
  fs.writeFileSync(out, JSON.stringify({ glb: '/assets/characters/v2/kid_hoodie.glb', poses }));
  console.log(`\n  wrote ${out} (${poses.length} poses) — render with tools/world/render_pose.mjs`);
}

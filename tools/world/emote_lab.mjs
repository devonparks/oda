/**
 * Emote transfer lab — offline (Node, zero deps).
 *
 * Goal: make the 58 baked Synty emote clips play correctly on a kid rig.
 * Strategy: prove every math step against data with a known answer before
 * touching the unknowns.
 *
 *   Step 1  Parse GLBs (shipping kid_hoodie + the v2 Unity-bind re-export).
 *   Step 2  PROVE the idle→bind delta conversion:  locomotion.json (idle-ref)
 *           and _unity_export/rig/locomotion_bindref.json (bind-ref) hold the
 *           SAME clips in both frames — so Δ_bind ?= bind⁻¹·idle·Δ_idle can be
 *           checked exactly, pinning composition order + conventions.
 *   Step 3  Retarget emotes onto the v2 rig two independent ways:
 *             A: the runtime's own formula (pose = g·(c⁻¹Δc), c solved
 *                bind-to-bind) — the doc's "untried combination".
 *             B: world-space per-bone transfer
 *                W_v2(b,t) = M(W_U(b,t)·BindW_U(b)⁻¹)·BindW_v2(b)
 *           and check A vs B agreement + hand/head world heights.
 *   Step 4  Emit per-frame LOCAL quats for the render harness to screenshot.
 *
 * Run:  node tools/world/emote_lab.mjs [step]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '..', '..', '..');
const P = (...s) => path.join(ROOT, ...s);

// ── tiny quaternion lib (Hamilton, [x,y,z,w], FK: Ww = Wp ⊗ local) ──────────
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((v) => v / l); };
const qrot = (q, v) => { // rotate vec3 by quat
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};
/** angular difference in degrees between two quats (sign-insensitive) */
const qangle = (a, b) => {
  const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return (2 * Math.acos(d)) * 180 / Math.PI;
};

// ── minimal GLB parser (nodes + hierarchy + TRS) ────────────────────────────
export function parseGLB(file) {
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

/** FK world rotations+positions for a set of named bones on a parsed GLB. */
export function fkGLB(glb, poseLocalQ /* name->quat override or null */) {
  const W = {}; // name -> {q, p, scale}
  const walk = (n, pq, pp, ps) => {
    const localQ = (poseLocalQ && poseLocalQ[n.name]) || n.q;
    const scaled = [n.t[0] * ps[0], n.t[1] * ps[1], n.t[2] * ps[2]];
    const p = [...qrot(pq, scaled).map((v, i) => v + pp[i])];
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
const manifest = JSON.parse(fs.readFileSync(P('world', 'assets', 'emotes', 'manifest.json')));
const BONES = loco.bones;                 // 22, shared ordering everywhere
const IDLE = loco.refPose;                // Unity idle locals {q,parent}
const BIND = bindref.bindPose;            // Unity bind (T-pose) locals {q,parent}

/** FK Unity-space world rotations from local quats (rotations only). */
function fkUnity(locals /* name -> quat */, refForParents = BIND) {
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

// ═══ STEP 2 — prove the idle→bind conversion against locomotion data ════════
export function step2() {
  console.log('\n═══ STEP 2: prove Δ_bind = f(Δ_idle) on locomotion (known both ways) ═══');
  const idleQ = refQ(IDLE), bindQ = refQ(BIND);
  // candidate conversions (order matters in quat algebra)
  const CANDS = {
    'bind⁻¹·idle·Δ': (b, d) => qmul(qmul(qinv(bindQ[b]), idleQ[b]), d),
    'Δ·idle⁻¹·bind': (b, d) => qmul(d, qmul(qinv(idleQ[b]), bindQ[b])),
    'idle·Δ·bind⁻¹? no—(idle·Δ) then bind⁻¹ left': (b, d) => qmul(qinv(bindQ[b]), qmul(idleQ[b], d)),
  };
  for (const clipName of ['idle', 'walk', 'run']) {
    const ci = loco.clips[clipName], cb = bindref.clips[clipName];
    if (!ci || !cb) { console.log('missing clip', clipName); continue; }
    const frames = Math.min(ci.frames, cb.frames);
    for (const [label, fn] of Object.entries(CANDS)) {
      let worst = 0;
      for (let f = 0; f < frames; f += 3) {
        for (let b = 0; b < BONES.length; b++) {
          const i = (f * BONES.length + b) * 4;
          const dIdle = qnorm([ci.rot[i], ci.rot[i + 1], ci.rot[i + 2], ci.rot[i + 3]]);
          const dBind = qnorm([cb.rot[i], cb.rot[i + 1], cb.rot[i + 2], cb.rot[i + 3]]);
          const conv = qnorm(fn(BONES[b], dIdle));
          worst = Math.max(worst, qangle(conv, dBind));
        }
      }
      console.log(`  ${clipName.padEnd(6)} ${label.padEnd(46)} worst err: ${worst.toFixed(3)}°`);
    }
  }
}

// ═══ STEP 3 — retarget onto v2, two ways, numeric check ═════════════════════
const HIP_MM = 0.001, Q16 = 1 / 32767;

/** read one emote's idle-referenced deltas: [frame][bone] -> quat, + hipY[] */
export function readEmote(id) {
  const info = (() => {
    for (const c of manifest.categories) for (const e of c.emotes) if (e.id === id) return { ...e, cat: c.id };
    throw new Error('no emote ' + id);
  })();
  const bin = new Int16Array(fs.readFileSync(P('world', 'assets', 'emotes', info.cat + '.bin')).buffer.slice(0));
  const base = info.off >> 1, nb = manifest.bones.length;
  const frames = [];
  for (let f = 0; f < info.frames; f++) {
    const row = [];
    for (let b = 0; b < nb; b++) {
      const p = base + (f * nb + b) * 4;
      row.push(qnorm([bin[p] * Q16, bin[p + 1] * Q16, bin[p + 2] * Q16, bin[p + 3] * Q16]));
    }
    frames.push(row);
  }
  const hipBase = base + info.frames * nb * 4;
  const hipY = Array.from({ length: info.frames }, (_, f) => bin[hipBase + f] * HIP_MM);
  return { info, frames, hipY };
}

/** Unity ABSOLUTE locals for an emote frame: idle ⊗ Δ  (order proven in step 2). */
const unityLocalsAt = (em, f) => Object.fromEntries(BONES.map((b, bi) => [b, qmul(IDLE[b].q, em.frames[f][bi])]));

/** candidate Unity→glTF rotation maps (conjugation by an axis mirror) */
const MAPS = {
  'mirrorX (x,-y,-z,w)': (q) => [q[0], -q[1], -q[2], q[3]],
  'mirrorY (-x,y,-z,w)': (q) => [-q[0], q[1], -q[2], q[3]],
  'mirrorZ (-x,-y,z,w)': (q) => [-q[0], -q[1], q[2], q[3]],
  'identity': (q) => [...q],
};

export function step3(emoteId = 'armsfolded', frame = 20) {
  console.log(`\n═══ STEP 3: retarget "${emoteId}" f${frame} onto v2 — method A vs B vs M ═══`);
  const v2 = parseGLB(P('assets', 'characters', 'v2', 'kid_hoodie.glb'));
  const restW = fkGLB(v2, null);
  // v2 scale sanity: report a few bind world positions
  const H = (n) => restW[n] ? restW[n].p[1].toFixed(3) : '—';
  console.log(`  v2 rest heights  Head ${H('Head')}  Hand_R ${H('Hand_R')}  Hand_L ${H('Hand_L')}  (doc: 1.001 / 0.868 / 0.868)`);

  let em;
  try { em = readEmote(emoteId); } catch (e) { console.log('  !', e.message); return; }
  const f = Math.min(frame, em.info.frames - 1);
  const uLocals = unityLocalsAt(em, f);
  const uW = fkUnity(uLocals);                        // Unity world rots at frame
  const uBindW = fkUnity(refQ(BIND));                 // Unity world rots at bind

  for (const [mname, M] of Object.entries(MAPS)) {
    // Approach B: per-bone world transfer
    const A = {};   // per-bone constant: M(BindW_U)⁻¹ · BindW_v2
    BONES.forEach((b) => { if (v2.byName[b]) A[b] = qnorm(qmul(qinv(M(uBindW[b])), restW[b].q)); });
    const targetLocal = {};
    // walk hierarchy in glb order to build locals from desired worlds
    const desiredW = {};
    BONES.forEach((b) => { if (v2.byName[b]) desiredW[b] = qnorm(qmul(M(uW[b]), A[b])); });
    BONES.forEach((b) => {
      const node = v2.byName[b]; if (!node) return;
      const parent = node.parent >= 0 ? v2.nodes[node.parent] : null;
      const pW = parent && desiredW[parent.name] ? desiredW[parent.name] : (parent ? fkGLB(v2, targetLocal)[parent.name].q : [0, 0, 0, 1]);
      targetLocal[b] = qnorm(qmul(qinv(pW), desiredW[b]));
    });
    const posed = fkGLB(v2, targetLocal);
    const hh = (n) => posed[n] ? posed[n].p[1].toFixed(3) : '—';
    console.log(`  B[${mname.padEnd(20)}] Head ${hh('Head')}  Hand_R ${hh('Hand_R')}  Hand_L ${hh('Hand_L')}  Elbow_R ${hh('Elbow_R')}`);
  }
  const truth = JSON.parse(fs.readFileSync(P('world', 'assets', 'emotes', '_truth.json')));
  if (truth[emoteId]) console.log('  Unity truth [peakR, meanR?, peakL?, ...]:', JSON.stringify(truth[emoteId]));
}

// ═══ STEP 4 — emit posed frames (target-local quats) for the render harness ═
/** Retarget one emote frame onto a target glb via world transfer with map M. */
function retargetFrame(glb, restW, uBindW, em, f, M) {
  const uW = fkUnity(unityLocalsAt(em, Math.min(f, em.info.frames - 1)));
  const desiredW = {}, targetLocal = {};
  BONES.forEach((b) => {
    if (!glb.byName[b]) return;
    const A = qmul(qinv(M(uBindW[b])), restW[b].q);
    desiredW[b] = qnorm(qmul(M(uW[b]), A));
  });
  BONES.forEach((b) => {
    const node = glb.byName[b]; if (!node) return;
    const parent = node.parent >= 0 ? glb.nodes[node.parent] : null;
    const pW = parent && desiredW[parent.name] ? desiredW[parent.name]
      : (parent ? fkGLB(glb, targetLocal)[parent.name].q : [0, 0, 0, 1]);
    targetLocal[b] = qnorm(qmul(qinv(pW), desiredW[b]));
  });
  return targetLocal;
}

export function step4(outFile) {
  console.log('\n═══ STEP 4: emit test poses for the render harness ═══');
  const v2 = parseGLB(P('assets', 'characters', 'v2', 'kid_hoodie.glb'));
  const restW = fkGLB(v2, null);
  const uBindW = fkUnity(refQ(BIND));
  const MX = MAPS['mirrorX (x,-y,-z,w)'], MY = MAPS['mirrorY (-x,y,-z,w)'];

  const wants = [
    // [emoteId, frameFraction, map, label]
    ['armsfolded', 0.5, MX, 'armsfolded-mid-MX'],
    ['wave', 0.45, MX, 'wave-peak-MX'],
    ['wave', 0.45, MY, 'wave-peak-MY'],       // handedness discriminator
    ['dab', 0.5, MX, 'dab-MX'],
    ['bow', 0.5, MX, 'bow-MX'],
    ['cheer', 0.5, MX, 'cheer-MX'],
    ['facepalm', 0.5, MX, 'facepalm-MX'],
    ['flex', 0.5, MX, 'flex-MX'],
    ['REST', 0, null, 'rest-pose'],
  ];
  const poses = [];
  for (const [id, ff, M, label] of wants) {
    if (id === 'REST') { poses.push({ label, locals: null }); continue; }
    let em; try { em = readEmote(id); } catch (e) { console.log('  skip', id, e.message); continue; }
    const f = Math.round(ff * (em.info.frames - 1));
    poses.push({ label, locals: retargetFrame(v2, restW, uBindW, em, f, M) });
    console.log(`  ${label}: frame ${f}/${em.info.frames}`);
  }
  const out = outFile || P('tools', 'world', '_lab_poses.json');
  fs.writeFileSync(out, JSON.stringify({ glb: '/assets/characters/v2/kid_hoodie.glb', poses }));
  console.log('  wrote', out, `(${poses.length} poses)`);
}

// ═══ STEP 5 — production bake: ALL emotes → v2-local Int16 bins ═════════════
/**
 * Output format (assets/characters/emotes/):
 *   manifest.json — { fps, format:'v2local', bones, categories:[{id,label,emotes:[...]}] }
 *   {cat}.bin     — per emote: frames×22×4 int16 ABSOLUTE v2-local quats
 *                   (×32767), then frames× int16 hip-Y offset in mm.
 * Unlike the world bins these are NOT deltas — a player assigns them directly
 * to the v2 rig's bones (slerp between frames), no runtime correction needed.
 */
export function step5() {
  console.log('\n═══ STEP 5: bake all emotes → v2-local bins ═══');
  const v2 = parseGLB(P('assets', 'characters', 'v2', 'kid_hoodie.glb'));
  const restW = fkGLB(v2, null);
  const uBindW = fkUnity(refQ(BIND));
  const M = MAPS['mirrorX (x,-y,-z,w)'];
  // precompute per-bone A
  const A = {};
  BONES.forEach((b) => { if (v2.byName[b]) A[b] = qnorm(qmul(qinv(M(uBindW[b])), restW[b].q)); });

  const outDir = P('assets', 'characters', 'emotes');
  fs.mkdirSync(outDir, { recursive: true });

  const outManifest = { fps: manifest.fps, format: 'v2local', bones: BONES, categories: [] };
  let totalBytes = 0, totalEmotes = 0;

  for (const cat of manifest.categories) {
    const chunks = [];
    const emotesOut = [];
    let off = 0;
    for (const e of cat.emotes) {
      const em = readEmote(e.id);
      const nb = BONES.length;
      const arr = new Int16Array(em.info.frames * nb * 4 + em.info.frames);
      for (let f = 0; f < em.info.frames; f++) {
        const locals = retargetFrame(v2, restW, uBindW, em, f, M);
        for (let b = 0; b < nb; b++) {
          const q = locals[BONES[b]] || (v2.byName[BONES[b]] ? v2.byName[BONES[b]].q : [0, 0, 0, 1]);
          const p = (f * nb + b) * 4;
          arr[p] = Math.round(q[0] * 32767); arr[p + 1] = Math.round(q[1] * 32767);
          arr[p + 2] = Math.round(q[2] * 32767); arr[p + 3] = Math.round(q[3] * 32767);
        }
        arr[em.info.frames * nb * 4 + f] = Math.round(em.hipY[f] * 1000);
      }
      const bytes = Buffer.from(arr.buffer);
      chunks.push(bytes);
      emotesOut.push({ id: e.id, label: e.label, icon: e.icon, frames: em.info.frames, off, hold: !!e.hold, dur: e.dur });
      off += bytes.length;
      totalEmotes++;
    }
    const binPath = path.join(outDir, cat.id + '.bin');
    fs.writeFileSync(binPath, Buffer.concat(chunks));
    totalBytes += off;
    outManifest.categories.push({ id: cat.id, label: cat.label || cat.id, emotes: emotesOut });
    console.log(`  ${cat.id}: ${cat.emotes.length} emotes, ${(off / 1024).toFixed(0)} KB`);
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(outManifest));
  console.log(`  TOTAL: ${totalEmotes} emotes, ${(totalBytes / 1024).toFixed(0)} KB + manifest`);
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const step = process.argv[2] || 'all';
if (step === '2' || step === 'all') step2();
if (step === '3' || step === 'all') step3(process.argv[3] || 'armsfolded', +(process.argv[4] || 20));
if (step === '4' || step === 'all') step4();
if (step === '5') step5();

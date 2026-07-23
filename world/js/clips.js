/**
 * AMG World — baked locomotion clips.
 *
 * The Synty Base Locomotion pack is Mecanim humanoid, and the PolygonKids rig
 * is a valid humanoid avatar, so Unity's own retargeter can sample those clips
 * directly onto a kid. `tools/world/bake_locomotion.md` documents that bake; it
 * writes `assets/locomotion.json`, which this module turns into three.js
 * AnimationClips.
 *
 * What ships: 22 bones (fingers dropped — 24 of the 42 joints, invisible at
 * hub-world camera distance and over half the bytes), rotations only, plus a
 * single vertical hip offset per frame. ~125 KB of JSON that gzips to roughly
 * a third of that.
 *
 * IMPORTANT — the bake stores DELTAS FROM THE BIND POSE, not absolute local
 * rotations. The kid GLBs went through an export pipeline that re-expressed the
 * skeleton: their bone units are centimetres with "up" running along local Z,
 * while Unity's prefab is metres with up along +Y. An absolute local quaternion
 * sampled in Unity therefore means something different here, and applying them
 * directly lays the character on its side. A delta (rest^-1 * pose) is
 * frame-relative, so any fixed difference in rest orientation cancels out — the
 * runtime composes it onto whatever the GLB's own bind pose is.
 *
 * The hip translation is a scalar for the same reason: its axis differs too, so
 * it's applied along the parent-space "world up" vector RigAnimator already
 * computes, scaled from metres to the rig's centimetres.
 *
 * Why not glTF animations: the clips live in separate FBX files with their own
 * skeleton, so shipping them as glTF would mean merging rigs in Blender. Baking
 * to plain arrays in Unity — where the humanoid retarget already works — is both
 * simpler and far smaller.
 */
import * as THREE from 'three';

/** Blend thresholds, in m/s. Must line up with WALK/RUN in world.js. */
export const GAIT = { walk: 1.6, run: 3.4 };

/**
 * How fast each clip "looks" like it is travelling, measured by sampling one
 * cycle of ankle travel on an actual kid: walk ~0.74 m/s, sprint ~1.9 m/s.
 * These clips were authored for an adult, so retargeted onto a 1.2 m child the
 * stride is short — which is why the world's movement speeds had to come down
 * (2.4/4.6 was an adult jogging pace and made the legs whirl).
 *
 * Playback rate = actual speed / this, clamped. TUNING KNOB: if the feet slide
 * forwards the number is too high; if they scuff backwards it is too low.
 * Worth adjusting by eye on a real device rather than by arithmetic.
 */
const CLIP_SPEED = { walk: 0.95, run: 1.7, sprint: 1.9 };
const RATE_MIN = 0.75, RATE_MAX = 1.7;

/** module-scope scratch for interpolation, reused every frame */
const _tmp = new THREE.Quaternion();

/**
 * Load the bake. Deltas are kept as raw arrays rather than built into
 * THREE.AnimationClips, because an AnimationMixer would OVERWRITE each bone's
 * quaternion — and a delta has to be COMPOSED onto the GLB's bind pose instead.
 * Blending is therefore done here, which also makes the additive procedural
 * layer straightforward.
 */
export async function loadLocomotion(url = 'assets/locomotion.json') {
  const data = await fetch(url).then((r) => {
    if (!r.ok) throw new Error('locomotion.json ' + r.status);
    return r.json();
  });
  if (data.format !== 'delta') {
    throw new Error('locomotion.json is not in delta format — re-run the bake');
  }
  return data;
}

/**
 * Drives one avatar's body from the baked deltas.
 *
 * Sampling and blending are done by hand rather than with THREE.AnimationMixer,
 * because a mixer OVERWRITES bone.quaternion and these are deltas that must be
 * COMPOSED onto the GLB's own bind pose. Doing it here also means the procedural
 * layer (blinks, head turn, emote arm override) can run straight afterwards on
 * the same bones with no fighting.
 *
 * Gait is a weighted mix of idle/walk/run chosen by speed; the airborne states
 * cut across it. Weights ease rather than snap so a kid accelerating out of a
 * standstill doesn't pop between gaits.
 */
export class Locomotion {
  /**
   * @param {THREE.Object3D} model  the cloned GLB scene
   * @param {object} data           parsed locomotion.json (delta format)
   * @param {RigAnimator} rig       supplies bones, bind pose and the up axis
   */
  constructor(model, data, rig) {
    this.data = data;
    this.rig = rig;
    this.bones = data.bones;
    this.fps = data.fps;
    this.clips = data.clips;
    this.corr = solveFrameCorrections(data, rig);

    /** per-clip playhead, in seconds */
    this.time = {};
    this.weights = {};
    for (const name in this.clips) { this.time[name] = 0; this.weights[name] = 0; }
    this.weights.idle = 1;

    this._jumpT = 0;
    this._landT = 0;
    this._wasGrounded = true;

    // scratch, reused every frame to keep this allocation-free
    this._q = new THREE.Quaternion();
    this._acc = new THREE.Quaternion();
    this.hipY = 0;
  }

  /** Sample one clip's delta for `bone` at its current playhead into `out`. */
  _sample(name, boneIndex, out) {
    const c = this.clips[name];
    const f = this.time[name] * this.fps;
    let f0 = Math.floor(f);
    let t = f - f0;
    const n = c.frames;
    if (c.loop) { f0 = ((f0 % n) + n) % n; }
    else { f0 = Math.min(f0, n - 1); if (f0 === n - 1) t = 0; }
    const f1 = c.loop ? (f0 + 1) % n : Math.min(f0 + 1, n - 1);

    const i0 = (f0 * this.bones.length + boneIndex) * 4;
    const i1 = (f1 * this.bones.length + boneIndex) * 4;
    const r = c.rot;
    out.set(r[i0], r[i0 + 1], r[i0 + 2], r[i0 + 3]);
    if (t > 0) {
      _tmp.set(r[i1], r[i1 + 1], r[i1 + 2], r[i1 + 3]);
      out.slerp(_tmp, t);
    }
    return out;
  }

  _sampleHip(name) {
    const c = this.clips[name];
    const f = this.time[name] * this.fps;
    let f0 = Math.floor(f);
    const t = f - f0;
    const n = c.frames;
    if (c.loop) f0 = ((f0 % n) + n) % n; else f0 = Math.min(f0, n - 1);
    const f1 = c.loop ? (f0 + 1) % n : Math.min(f0 + 1, n - 1);
    return c.hipY[f0] * (1 - t) + c.hipY[f1] * t;
  }

  /** @param {{speed:number, grounded:boolean}} s */
  update(dt, s) {
    const speed = s.speed || 0;
    const target = { idle: 0, walk: 0, run: 0, sprint: 0, jump: 0, fall: 0, land: 0 };

    if (!s.grounded) {
      this._jumpT += dt;
      const j = clamp(1 - this._jumpT / 0.35, 0, 1);
      target.jump = j;
      target.fall = 1 - j;
      this._wasGrounded = false;
    } else {
      if (!this._wasGrounded) { this._landT = 0.30; this._wasGrounded = true; this.time.land = 0; }
      this._jumpT = 0; this.time.jump = 0;
      if (this._landT > 0) { this._landT -= dt; target.land = clamp(this._landT / 0.30, 0, 1); }
      const rest = 1 - target.land;
      if (speed <= 0.05) {
        target.idle = rest;
      } else if (speed < GAIT.walk) {
        const k = speed / GAIT.walk;
        target.idle = rest * (1 - k); target.walk = rest * k;
      } else if (speed < GAIT.run) {
        const k = (speed - GAIT.walk) / (GAIT.run - GAIT.walk);
        target.walk = rest * (1 - k); target.run = rest * k;
      } else {
        target.run = rest;
      }
    }

    const k = 1 - Math.exp(-14 * dt);
    let total = 0;
    for (const name in this.weights) {
      this.weights[name] += ((target[name] || 0) - this.weights[name]) * k;
      if (this.weights[name] < 0.0015) this.weights[name] = 0;
      total += this.weights[name];
    }
    if (total <= 0) { this.weights.idle = 1; total = 1; }

    // Advance playheads. Gaits are rate-scaled by ground speed so feet don't skate.
    for (const name in this.time) {
      const rate = CLIP_SPEED[name] ? clamp(speed / CLIP_SPEED[name], RATE_MIN, RATE_MAX) : 1;
      this.time[name] += dt * rate;
      const c = this.clips[name];
      if (c.loop && this.time[name] > c.dur) this.time[name] %= c.dur;
    }

    // Compose the blended delta onto each bone's bind pose.
    const active = [];
    for (const name in this.weights) if (this.weights[name] > 0) active.push(name);

    for (let b = 0; b < this.bones.length; b++) {
      const boneName = this.bones[b];
      const bone = this.rig.bones[boneName];
      if (!bone) continue;

      // Weighted quaternion blend: start from the heaviest clip and slerp the
      // rest in by their share of the remaining weight. Cheap and stable for
      // the 2-3 clips that are ever active at once.
      let acc = null, accW = 0;
      for (const name of active) {
        const w = this.weights[name] / total;
        this._sample(name, b, this._q);
        if (acc === null) { acc = this._acc.copy(this._q); accW = w; }
        else { accW += w; acc.slerp(this._q, w / accW); }
      }
      if (acc === null) continue;

      // Re-express the delta in THIS rig's bone frame before applying it:
      //   pose = g_b * (c_b^-1 * D * c_b)
      // Without the conjugation the arms come out splayed, because Unity and
      // the exported GLB assign different local axes to the same bone.
      const c = this.corr[boneName];
      if (c) _tmp.copy(c).invert().multiply(acc).multiply(c);
      else _tmp.copy(acc);
      bone.quaternion.copy(this.rig.rest[boneName]).multiply(_tmp);
    }

    let hip = 0;
    for (const name of active) hip += this._sampleHip(name) * (this.weights[name] / total);
    this.hipY = hip;
  }

  dispose() {}
}


/**
 * Solve the per-bone frame correction between Unity's rig and this GLB's.
 *
 * Reference is Unity's IDLE pose, not its bind pose. Unity's bind is a T-pose
 * (hands at shoulder height) while the exported kid GLB rests with the arms
 * hanging down, so solving from the binds conflated a real POSE difference
 * with the AXIS difference — the spine transferred cleanly and the arms flew
 * up by the head. Unity's idle is arms-down and lands within ~8 cm of the
 * GLB's rest, which leaves this as very nearly a pure axis correction.
 *
 * Both describe the same physical skeleton, but the GLB went through an export
 * that reassigned local bone axes. Writing F for a bone's frame and c_b for the
 * constant rotation between them (F_glb = F_unity * c_b), the two bind poses
 * relate as  g_b = c_p^-1 * u_b * c_b,  so walking the hierarchy top-down:
 *
 *     c_b = u_b^-1 * c_p * g_b
 *
 * c at the root's parent is taken as identity: any leftover constant there is a
 * whole-character rotation, which would be immediately visible (and isn't).
 */
function solveFrameCorrections(data, rig) {
  const bind = data.refPose || data.bindPose;
  if (!bind) return null;
  const corr = {};
  const I = new THREE.Quaternion();

  // parents first — data.bones is authored root-down, but sort defensively
  const order = [...data.bones].sort((a, b) => depth(a) - depth(b));
  function depth(name) {
    let d = 0, cur = name;
    while (bind[cur] && bind[cur].parent && bind[bind[cur].parent]) { cur = bind[cur].parent; d++; }
    return d;
  }

  for (const name of order) {
    const info = bind[name];
    const g = rig.rest[name];
    if (!info || !g) continue;
    const u = new THREE.Quaternion(info.q[0], info.q[1], info.q[2], info.q[3]);
    const cp = corr[info.parent] || I;
    // c_b = u^-1 * c_p * g
    corr[name] = u.clone().invert().multiply(cp).multiply(g);
  }
  return corr;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/**
 * One shared library for every avatar in the scene. Returns null (and logs
 * once) if the bake is missing, so the world falls back to the procedural
 * animator rather than breaking.
 */
let _libPromise = null;
export function getLocomotionLibrary() {
  if (!_libPromise) {
    _libPromise = loadLocomotion().catch((e) => {
      console.warn('[world] locomotion clips unavailable, using procedural animation:', e.message);
      return null;
    });
  }
  return _libPromise;
}

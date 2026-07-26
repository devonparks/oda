/**
 * AMG World Engine — the kid rig player.
 *
 * A port of world/js/rig_v2.js onto Babylon. Two layers, blended per bone:
 *
 *   1. LOCOMOTION — idle/walk/run/sprint + jump/fall/land, weighted by speed
 *      and rate-scaled so the feet do not skate.
 *   2. ACTION     — one clip layered on top. Full-body when standing still,
 *      upper-body only while walking (the legs keep the gait). This is the
 *      channel the prop database drives: every prop names its OWN clip.
 *
 * WHY HAND-ROLLED, AGAIN. Babylon has AnimationGroup with weighted blending,
 * which is the obvious tool and the wrong one here. Our clips are not Babylon
 * animations — they are Int16 blobs of absolute local quaternions, deliberately,
 * because that format is what made layering work after several attempts that
 * did not. Converting 81 clips × 22 bones into AnimationGroups at load would
 * cost memory and startup for the privilege of doing the same slerp less
 * directly. The hot loop below allocates nothing, which is the Chromebook
 * requirement.
 *
 * BABYLON SPECIFIC: the glTF loader links every Bone to a TransformNode
 * (`babylonBone.linkTransformNode(...)` in the loader), so the skeleton is
 * driven BY the nodes. Writing to `bone.rotationQuaternion` would be
 * overwritten every frame. We write the TransformNodes, exactly as the three.js
 * version wrote Object3D.quaternion — same targets, same numbers.
 */
import { Quaternion, Vector3 } from 'babylon';
import { sampleBone, sampleHip, LEG_START } from './clips.js';

/** Gait blend thresholds, m/s — matched to the shipped feel. */
const GAIT = { walk: 1.6, run: 3.4 };
/** Playback rate = speed / this, clamped. Too high and the feet slide. */
const CLIP_SPEED = { walk: 0.95, run: 1.7, sprint: 1.9 };
const RATE_MIN = 0.75, RATE_MAX = 1.7;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Module scratch — reused every frame so update() allocates nothing.
const _q = new Quaternion();
const _acc = new Quaternion();
const _e = new Quaternion();
const _tmp = new Quaternion();

export class Rig {
  /**
   * @param {TransformNode} root  the loaded kid's root node
   * @param {{bin:Int16Array, clips:object, bones:string[], fps:number}} loco
   * @param {ActionLibrary} actions
   */
  constructor(root, loco, actions) {
    this.root = root;
    this.loco = loco;
    this.actions = actions;
    this.nb = loco.bones.length;

    // Bind bone name -> TransformNode, in the bake's bone order.
    const want = new Map(loco.bones.map((n, i) => [n, i]));
    this.bones = new Array(this.nb).fill(null);
    this.hips = null;
    this.hipsRest = null;
    for (const n of root.getChildTransformNodes(false)) {
      const i = want.get(n.name);
      if (i !== undefined) {
        if (!n.rotationQuaternion) n.rotationQuaternion = Quaternion.Identity();
        this.bones[i] = n;
      }
      if (n.name === 'Hips') { this.hips = n; this.hipsRest = n.position.clone(); }
    }
    const bound = this.bones.filter(Boolean).length;
    this.ok = bound >= 20;
    if (!this.ok) {
      console.warn(`[rig] only ${bound}/${this.nb} bones bound — names:`,
        loco.bones.filter((n, i) => !this.bones[i]));
    }

    // locomotion state
    this.w = {};                        // eased per-clip weights
    this.t = {};                        // per-clip playheads (s)
    for (const id of Object.keys(loco.clips)) { this.w[id] = 0; this.t[id] = Math.random() * 2; }
    this.w.idle = 1;
    this._wasGrounded = true;
    this._landT = 0;

    /**
     * Stride progress in radians, 2π per gait cycle — crosses a multiple of π
     * once per foot, which is what a footstep-SFX hook counts. Kept because the
     * three.js version exposed it and every consumer did `Math.floor(phase/π)`.
     */
    this.phase = 0;

    // action channel
    this.action = null;                 // {info, bin, t, driven, freezeAt}
    this.actionW = 0;                   // eased 0..1
    this.legW = 1;                      // 1 = full body, 0 = upper body only
    this._want = null;
    this._target = {};
    this._active = [];
  }

  get playing() { return this.action ? this.action.info.id : null; }

  /**
   * Play a clip on the action channel. Fire and forget; loads the category bin
   * on first use. `freezeAt` (seconds) clamps the playhead and holds that
   * frame — which is how a moment of any clip becomes a static pose.
   */
  async play(id, { freezeAt = null, loop = null } = {}) {
    const info = this.actions.info(id);
    if (!info) { console.warn('[rig] no such clip:', id); return false; }
    this._want = id;
    const bin = this.actions.binFor(id) || await this.actions.loadCategory(info.cat);
    if (this._want !== id) return false;                 // superseded while loading
    this.action = { info, bin, t: 0, freezeAt, loop: loop ?? !info.hold, driven: false };
    return true;
  }

  stop() { this.action = null; this._want = null; }

  /**
   * Drive the action playhead from outside instead of from dt.
   * A swing pump only reads as pumping if the kid kicks in time with the
   * swing, so the ride hands its own phase straight in here.
   */
  setActionTime(id, t) {
    const a = this.action;
    if (!a || a.info.id !== id) return false;
    const dur = a.info.dur || 1;
    a.t = ((t % dur) + dur) % dur;
    a.driven = true;
    return true;
  }

  /**
   * @param {number} dt seconds
   * @param {{speed:number, grounded:boolean, vy:number, actionWeight?:number,
   *          legWeight?:number}} s
   */
  update(dt, s) {
    if (!this.ok) return;
    const loco = this.loco, nb = this.nb, fps = loco.fps;

    // ── 1. gait weights ────────────────────────────────────────────────
    const sp = s.speed || 0;
    const tgt = this._target;
    for (const k in this.w) tgt[k] = 0;

    if (!s.grounded) {
      if (s.vy > 0.6) tgt.jump = 1; else tgt.fall = 1;
      this._wasGrounded = false;
    } else {
      if (!this._wasGrounded) { this._landT = 0; this.t.land = 0; }
      this._wasGrounded = true;
      if (this._landT < loco.clips.land.dur) {
        this._landT += dt;
        tgt.land = 1 - this._landT / loco.clips.land.dur;
      }
      const walk = clamp(sp / GAIT.walk, 0, 1);
      const run = clamp((sp - GAIT.walk) / (GAIT.run - GAIT.walk), 0, 1);
      const sprint = clamp((sp - GAIT.run) / 2.2, 0, 1);
      const move = 1 - (tgt.land || 0);
      tgt.idle = (1 - walk) * move;
      tgt.walk = walk * (1 - run) * move;
      tgt.run = run * (1 - sprint) * move;
      tgt.sprint = sprint * move;
    }

    // ease toward the targets so gait changes are not a pop
    const k = 1 - Math.exp(-dt * 12);
    for (const id in this.w) this.w[id] += (tgt[id] - this.w[id]) * k;

    // ── 2. advance playheads, rate-scaled so feet don't skate ──────────
    const active = this._active;
    active.length = 0;
    let total = 0;
    for (const id in this.w) {
      if (this.w[id] > 0.002) { active.push(id); total += this.w[id]; }
    }
    if (!total) { active.push('idle'); this.w.idle = total = 1; }

    for (const id of active) {
      const c = loco.clips[id];
      let rate = 1;
      if (CLIP_SPEED[id]) rate = clamp(sp / CLIP_SPEED[id] / (c.dur / (c.dur || 1)), RATE_MIN, RATE_MAX);
      this.t[id] += dt * rate;
      if (c.loop) this.t[id] %= c.dur; else this.t[id] = Math.min(this.t[id], c.dur);
    }
    // stride phase from whichever gait clip dominates
    const gait = ['sprint', 'run', 'walk'].find((g) => this.w[g] > 0.25);
    if (gait) this.phase = (this.t[gait] / loco.clips[gait].dur) * Math.PI * 2;

    // ── 3. the action channel ──────────────────────────────────────────
    const a = this.action;
    let aFps = 0, aBase = 0;
    if (a && a.bin) {
      if (!a.driven) {
        a.t += dt;
        if (a.freezeAt != null) a.t = Math.min(a.t, a.freezeAt);
        else if (a.loop) a.t %= (a.info.dur || 1);
        else a.t = Math.min(a.t, (a.info.dur || 1) - 1e-4);
      }
      a.driven = false;
      aFps = this.actions.fps;
      aBase = a.info.off >> 1;
    }
    const wantW = a && a.bin ? (s.actionWeight ?? 1) : 0;
    this.actionW += (wantW - this.actionW) * (1 - Math.exp(-dt * 14));
    this.legW = s.legWeight ?? (sp > 0.15 ? 0 : 1);

    // ── 4. compose, per bone ───────────────────────────────────────────
    for (let b = 0; b < nb; b++) {
      const node = this.bones[b];
      if (!node) continue;

      let accW = 0, has = false;
      for (const id of active) {
        const c = loco.clips[id];
        sampleBone(loco.bin, c.off >> 1, nb, c.frames, c.loop, this.t[id], fps, b, _q, _tmp);
        const wv = this.w[id] / total;
        if (!has) { _acc.copyFrom(_q); accW = wv; has = true; }
        else { accW += wv; Quaternion.SlerpToRef(_acc, _q, wv / accW, _acc); }
      }
      if (!has) continue;

      if (a && a.bin && this.actionW > 0.002) {
        // hips and legs fade out of the action while the kid is walking
        const w = (b === 0 || b >= LEG_START) ? this.actionW * this.legW : this.actionW;
        if (w > 0.002) {
          sampleBone(a.bin, aBase, nb, a.info.frames, a.loop, a.t, aFps, b, _e, _tmp);
          Quaternion.SlerpToRef(_acc, _e, w, _acc);
        }
      }
      node.rotationQuaternion.copyFrom(_acc);
    }

    // ── 5. hips vertical offset ────────────────────────────────────────
    // Applied along the model's own up. The three.js version un-rotated the
    // parent to keep it world-vertical; here the kid's root IS the thing that
    // tilts (on a swing), and the prop database owns that tilt, so the offset
    // stays in model space and the mount maths stays in one place.
    let hip = 0;
    for (const id of active) {
      const c = loco.clips[id];
      hip += sampleHip(loco.bin, c.off >> 1, nb, c.frames, c.loop, this.t[id], fps) * (this.w[id] / total);
    }
    if (a && a.bin) {
      const ah = sampleHip(a.bin, aBase, nb, a.info.frames, a.loop, a.t, aFps);
      const hw = this.actionW * this.legW;
      hip = hip * (1 - hw) + ah * hw;
    }
    if (this.hips) {
      this.hips.position.copyFrom(this.hipsRest);
      this.hips.position.y += hip;
    }
  }
}

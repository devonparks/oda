/**
 * AMG World — procedural rig animator for Synty POLYGON Kids characters.
 *
 * The kid GLBs ship rigged (42 joints) but carry no animation clips, so this
 * module generates poses in code — a walk cycle is a handful of sine waves on
 * named bones.
 *
 * Since the Synty Base Locomotion bake landed (see clips.js), the procedural
 * body is the FALLBACK rather than the main path: real clips drive the
 * skeleton, and this code becomes the additive layer on top — blinks, head
 * turn — plus an upper-body override while an emote plays. It still runs on
 * its own if `assets/locomotion.json` is missing, which is why every pose here
 * is kept intact rather than deleted.
 *
 * Bone names (Synty POLYGON rig):
 *   Root > Hips > Spine_01 > Spine_02 > Spine_03 > Neck > Head
 *   Spine_03 > Clavicle_L/R > Shoulder_L/R > Elbow_L/R > Hand_L/R
 *   Hips     > UpperLeg_L/R > LowerLeg_L/R > Ankle_L/R > Ball_L/R
 *   plus Eyes_Left/Right and Eyebrow_Left/Right for blinks + expressions.
 *
 * Axis handling: rest orientations differ per bone, so nothing may assume that
 * "rotate around local X" means "swing forward". At bind time each bone caches
 * its rest quaternion plus the WORLD x/y/z axes expressed in its parent frame;
 * poses are then written as world-intent rotations (swing / turn / tilt) and
 * converted per bone. That keeps the pose code readable and rig-agnostic.
 */
import * as THREE from 'three';

const BONES = [
  'Hips', 'Spine_01', 'Spine_02', 'Spine_03', 'Neck', 'Head',
  'Clavicle_L', 'Shoulder_L', 'Elbow_L', 'Hand_L',
  'Clavicle_R', 'Shoulder_R', 'Elbow_R', 'Hand_R',
  'UpperLeg_L', 'LowerLeg_L', 'Ankle_L', 'Ball_L',
  'UpperLeg_R', 'LowerLeg_R', 'Ankle_R', 'Ball_R',
  'Eyes_Left', 'Eyes_Right', 'Eyebrow_Left', 'Eyebrow_Right',
];

const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();

/**
 * The Synty bind pose is a wide A-pose, which reads as "the model is broken"
 * if you leave it. These are the shoulder rotations that bring the hands down
 * beside the hips, solved numerically against the actual rig rather than
 * guessed (see tools/world/README.md). Signs are mirrored per side.
 *
 * Sign conventions on this rig, for anyone adding poses:
 *   Shoulder 'z' negative  -> LEFT arm down, positive -> RIGHT arm down
 *   Shoulder/Elbow 'x' negative -> hand swings FORWARD (character faces -Z)
 */
const ARM_DOWN_Z = 0.78;
const ARM_DOWN_X = 0.10;
const ELBOW_REST = -0.25;

export class RigAnimator {
  /** @param {THREE.Object3D} root the loaded GLB scene */
  constructor(root) {
    this.root = root;
    this.bones = {};
    this.rest = {};
    /** world x/y/z axes re-expressed in each bone's parent frame */
    this.axes = {};

    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isBone && !BONES.includes(o.name)) return;
      if (!BONES.includes(o.name)) return;
      this.bones[o.name] = o;
      this.rest[o.name] = o.quaternion.clone();
      const parent = o.parent;
      parent.getWorldQuaternion(_qp).invert();
      this.axes[o.name] = {
        x: new THREE.Vector3(1, 0, 0).applyQuaternion(_qp).normalize(),
        y: new THREE.Vector3(0, 1, 0).applyQuaternion(_qp).normalize(),
        z: new THREE.Vector3(0, 0, 1).applyQuaternion(_qp).normalize(),
      };
    });

    /** Optional clip-driven body. When set, the baked Synty locomotion owns
     *  the skeleton and the procedural code becomes an additive layer on top
     *  (head look, blinks) plus an upper-body override while emoting. */
    this.loco = null;

    this.t = 0;
    this.phase = 0;            // walk-cycle phase, advanced by distance not time
    this.blinkTimer = 1 + Math.random() * 4;
    this.blink = 0;
    this.emote = null;         // { name, t, dur }
    this.hipOffset = new THREE.Vector3();
    this.bounce = 0;
  }

  /** Reset every tracked bone to its bind pose before a frame's pose is built. */
  _reset() {
    for (const name in this.bones) this.bones[name].quaternion.copy(this.rest[name]);
    this.hipOffset.set(0, 0, 0);
  }

  /**
   * Drop the arms out of the A-pose bind and into a relaxed hang. Every
   * locomotion pose starts here; `swing` adds the walk cycle's counter-swing
   * and `spread` widens the arms for running.
   */
  _armsDown(swing = 0, spread = 0, elbow = 0) {
    this._arm('L', 0, swing, spread, elbow);
    this._arm('R', 0, -swing, spread, elbow);
  }

  /**
   * Pose one arm from the BIND pose, in intent units rather than raw radians.
   *   up      0 = hanging by the hip, 1 = straight out sideways, 1.7 = overhead
   *   forward positive swings the hand in front of the body
   *   spread  widens the arm away from the ribs
   *   elbow   extra bend on top of the resting bend
   * Emote poses call this after _resetArms() so they compose predictably
   * instead of stacking on whatever the walk cycle already wrote.
   */
  _arm(side, up = 0, forward = 0, spread = 0, elbow = 0) {
    const sign = side === 'L' ? -1 : 1;
    this._rot(`Shoulder_${side}`, 'z', sign * (ARM_DOWN_Z - spread - up));
    this._rot(`Shoulder_${side}`, 'x', ARM_DOWN_X - forward);
    this._rot(`Elbow_${side}`, 'x', ELBOW_REST - elbow - Math.max(0, forward) * 0.5);
  }

  /** Drop the arm chain back to bind so an emote can own it outright. */
  _resetArms() {
    for (const n of ['Clavicle_L', 'Shoulder_L', 'Elbow_L', 'Hand_L',
                     'Clavicle_R', 'Shoulder_R', 'Elbow_R', 'Hand_R']) {
      if (this.bones[n]) this.bones[n].quaternion.copy(this.rest[n]);
    }
  }

  /**
   * Rotate a bone by `angle` radians about a world-intent axis.
   * axis: 'x' swing forward/back, 'y' turn left/right, 'z' tilt sideways.
   */
  _rot(name, axis, angle) {
    const bone = this.bones[name];
    if (!bone || !angle) return;
    _q.setFromAxisAngle(this.axes[name][axis], angle);
    bone.quaternion.multiply(_q);
  }

  /** Play a one-shot emote by id. Returns false for unknown ids. */
  playEmote(id) {
    const e = EMOTES[id];
    if (!e) return false;
    this.emote = { id, t: 0, dur: e.dur };
    return true;
  }

  get emoting() { return !!this.emote || !!(this.emotes && this.emotes.playing); }

  /**
   * @param {number} dt      seconds
   * @param {object} state   { speed, maxSpeed, grounded, airTime, sitting }
   */
  update(dt, state) {
    this.t += dt;

    const speed = state.speed || 0;
    const run = Math.min(speed / (state.maxSpeed || 4.2), 1);

    // Phase advances with distance so the feet don't skate at any speed.
    const strideLen = 1.35;
    this.phase += (speed * dt) / strideLen * Math.PI * 2;

    if (this.loco) {
      // Baked clips own the body: they write every tracked bone by composing
      // their delta onto the bind pose. The clip's own hip rise/fall replaces
      // the procedural bob — stacking both would read as a limp. It arrives in
      // METRES and the rig's bone units are centimetres, hence the x100.
      this.loco.update(dt, state);
      this.hipOffset.set(0, this.loco.hipY * 100, 0);
      this.hipOffset.y *= 1 - (this.emotes ? this.emotes.legWeight * this.emotes.weight : 0);
    } else {
      this._reset();
      if (state.sitting) this._poseSit();
      else if (!state.grounded) this._poseAir(state.airTime || 0);
      else if (run > 0.02) this._poseWalk(run);
      else this._poseIdle();
    }

    // Clip emotes layer over the locomotion the same way the procedural ones
    // do — upper body always, legs only while standing still.
    if (this.emotes) {
      this.emotes.update(dt, speed / (state.maxSpeed || 3.4));
      if (this.emotes.playing) this.hipOffset.y += (this.emotes.hipY || 0) * 100;
    }

    // Procedural fallback emotes, for ids the clip library doesn't have.
    if (this.emote) {
      this.emote.t += dt;
      const k = this.emote.t / this.emote.dur;
      if (k >= 1) this.emote = null;
      else EMOTES[this.emote.id].pose(this, k, this.t);
    }

    this._poseFace(dt);

    // Hip bob. The Hips bone's local axes are NOT world-aligned on this rig
    // (its rest translation runs down local Z), so the offset is applied along
    // the parent-space vector that actually points at world up — the same
    // mapping the rotations use.
    // In clip mode the animation drives Hips.position directly, so only
    // emote-driven offsets (the 'sit' crouch, the dance bounce) are layered on.
    const hips = this.bones.Hips;
    if (hips) {
      if (!this._hipRest) this._hipRest = hips.position.clone();
      hips.position.copy(this._hipRest)
        .addScaledVector(this.axes.Hips.y, this.hipOffset.y);
    }
  }

  // ---- poses --------------------------------------------------------------

  _poseIdle() {
    const t = this.t;
    const breathe = Math.sin(t * 1.5) * 0.5 + 0.5;
    this.hipOffset.y = Math.sin(t * 1.5) * 0.6;
    this._rot('Spine_01', 'x', -0.02 - breathe * 0.02);
    this._rot('Spine_03', 'x', 0.015 * breathe);
    this._rot('Head', 'y', Math.sin(t * 0.4) * 0.16);
    this._rot('Head', 'x', Math.sin(t * 0.63) * 0.05);
    // arms hang with a slight sway, elbows softly bent (never an A-pose)
    this._armsDown(Math.sin(t * 1.5) * 0.03, 0, 0);
  }

  _poseWalk(run) {
    const p = this.phase;
    const s = Math.sin(p), c = Math.cos(p);
    // amplitude grows from a walk into a run
    const legA = 0.55 + run * 0.35;
    const armA = 0.40 + run * 0.45;
    const lean = 0.06 + run * 0.20;

    this.hipOffset.y = Math.abs(Math.sin(p)) * (1.2 + run * 2.2) - 0.6;
    this._rot('Hips', 'y', -s * 0.10 * run);
    this._rot('Hips', 'z', c * 0.05);
    this._rot('Spine_01', 'x', -lean);
    this._rot('Spine_02', 'y', s * 0.09);
    this._rot('Spine_03', 'y', s * 0.06);
    this._rot('Head', 'y', -s * 0.07);

    // legs: thigh swings, knee bends only on the back half of the stride
    this._rot('UpperLeg_L', 'x', s * legA);
    this._rot('UpperLeg_R', 'x', -s * legA);
    this._rot('LowerLeg_L', 'x', -Math.max(0, -s) * (0.85 + run * 0.5) - 0.05);
    this._rot('LowerLeg_R', 'x', -Math.max(0, s) * (0.85 + run * 0.5) - 0.05);
    this._rot('Ankle_L', 'x', -s * 0.28 + 0.06);
    this._rot('Ankle_R', 'x', s * 0.28 + 0.06);

    // arms counter-swing the legs; running widens the carry and bends the elbows
    this._armsDown(s * armA, run * 0.16, run * 0.5);
  }

  _poseAir(airTime) {
    // tuck on the way up, reach on the way down
    const k = THREE.MathUtils.clamp(airTime * 2.2, 0, 1);
    this._rot('Spine_01', 'x', -0.18 + k * 0.1);
    // arms flung up and out on the way up, settling on the way down
    this._armsDown(-1.1 + k * 0.4, 0.45, 0.4);
    this._rot('UpperLeg_L', 'x', 0.45 - k * 0.35);
    this._rot('UpperLeg_R', 'x', 0.25 - k * 0.2);
    this._rot('LowerLeg_L', 'x', -0.9 + k * 0.6);
    this._rot('LowerLeg_R', 'x', -0.6 + k * 0.4);
  }

  _poseSit() {
    this._rot('Spine_01', 'x', 0.10);
    this._rot('UpperLeg_L', 'x', 1.45);
    this._rot('UpperLeg_R', 'x', 1.45);
    this._rot('LowerLeg_L', 'x', -1.5);
    this._rot('LowerLeg_R', 'x', -1.5);
    this._armsDown(0.2, 0.1, 0.3);
    this._rot('Head', 'y', Math.sin(this.t * 0.5) * 0.2);
  }

  /** Blinks + a resting brow. Cheap, but it's what stops the face reading dead. */
  _poseFace(dt) {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) { this.blink = 0.16; this.blinkTimer = 2 + Math.random() * 5; }
    if (this.blink > 0) {
      this.blink -= dt;
      const k = Math.sin(THREE.MathUtils.clamp(1 - this.blink / 0.16, 0, 1) * Math.PI);
      for (const n of ['Eyes_Left', 'Eyes_Right']) {
        const b = this.bones[n];
        if (b) b.scale.y = 1 - k * 0.9;
      }
    } else {
      for (const n of ['Eyes_Left', 'Eyes_Right']) {
        const b = this.bones[n];
        if (b) b.scale.y = 1;
      }
    }
  }
}

/**
 * Emote library. Each pose(rig, k, t) gets k in 0..1 across the emote and may
 * layer on top of whatever locomotion pose was already written this frame.
 * Kept deliberately small and wholesome — this is a 9–13 platform.
 */
export const EMOTES = {
  wave: {
    label: 'Wave', icon: '👋', dur: 1.6,
    pose(r, k) {
      const env = Math.sin(Math.min(k, 1) * Math.PI);
      r._resetArms();
      r._arm('L', 0, 0, 0, 0);
      r._arm('R', 1.35 * env, 0.15 * env, 0.1, 1.0 * env);
      r._rot('Hand_R', 'z', Math.sin(k * Math.PI * 8) * 0.5 * env);
      r._rot('Head', 'z', 0.08 * env);
    },
  },
  dance: {
    label: 'Dance', icon: '🕺', dur: 4.0,
    pose(r, k, t) {
      const b = Math.sin(t * 9);
      r.hipOffset.y += Math.abs(b) * 2.2;
      r._rot('Hips', 'y', b * 0.35);
      r._rot('Spine_02', 'y', -b * 0.28);
      r._resetArms();
      r._arm('L', 1.15 + b * 0.35, 0.2, 0.15, 1.3);
      r._arm('R', 1.15 - b * 0.35, 0.2, 0.15, 1.3);
      r._rot('Head', 'z', b * 0.18);
    },
  },
  cheer: {
    label: 'Cheer', icon: '🎉', dur: 1.8,
    pose(r, k, t) {
      const env = Math.sin(Math.min(k, 1) * Math.PI);
      r.hipOffset.y += Math.abs(Math.sin(t * 12)) * 1.6 * env;
      r._resetArms();
      r._arm('L', 1.7 * env, 0.1 * env, 0.1 * env, 0.2 * env);
      r._arm('R', 1.7 * env, 0.1 * env, 0.1 * env, 0.2 * env);
      r._rot('Spine_01', 'x', 0.12 * env);
      r._rot('Head', 'x', -0.2 * env);
    },
  },
  laugh: {
    label: 'Laugh', icon: '😂', dur: 2.0,
    pose(r, k, t) {
      const env = Math.sin(Math.min(k, 1) * Math.PI);
      const j = Math.sin(t * 14) * env;
      r._rot('Spine_01', 'x', 0.28 * env);
      r._rot('Spine_02', 'x', 0.12 * env + j * 0.05);
      r._rot('Head', 'x', 0.18 * env + j * 0.06);
      r._resetArms();
      // hands clutched to the belly
      r._arm('L', 0.15 * env, 0.9 * env, -0.1 * env, 1.5 * env);
      r._arm('R', 0.15 * env, 0.9 * env, -0.1 * env, 1.5 * env);
    },
  },
  think: {
    label: 'Think', icon: '🤔', dur: 2.4,
    pose(r, k) {
      const env = Math.sin(Math.min(k, 1) * Math.PI);
      r._resetArms();
      r._arm('L', 0, 0, 0, 0);
      // hand to the chin: lifted a little, well forward, elbow folded right up
      r._arm('R', 0.55 * env, 0.85 * env, -0.15 * env, 1.9 * env);
      r._rot('Head', 'x', 0.12 * env);
      r._rot('Head', 'y', -0.2 * env);
      r._rot('Spine_01', 'x', 0.06 * env);
    },
  },
  yes: {
    label: 'Yes', icon: '👍', dur: 1.4,
    pose(r, k, t) {
      const env = Math.sin(Math.min(k, 1) * Math.PI);
      r._resetArms();
      r._arm('L', 0, 0, 0, 0);
      r._arm('R', 0.35 * env, 0.55 * env, 0, 1.5 * env);
      r._rot('Head', 'x', Math.sin(t * 8) * 0.14 * env);
    },
  },
  sit: {
    label: 'Sit', icon: '🪑', dur: 3.0,
    pose(r, k) {
      const env = Math.min(k * 4, 1) * Math.min((1 - k) * 4, 1);
      r.hipOffset.y -= 14 * env;
      r._rot('UpperLeg_L', 'x', 1.5 * env);
      r._rot('UpperLeg_R', 'x', 1.5 * env);
      r._rot('LowerLeg_L', 'x', -1.6 * env);
      r._rot('LowerLeg_R', 'x', -1.6 * env);
      r._resetArms();
      r._arm('L', 0, 0.35 * env, -0.05, 0.5 * env);
      r._arm('R', 0, 0.35 * env, -0.05, 0.5 * env);
    },
  },
  spin: {
    label: 'Spin', icon: '🌀', dur: 1.5,
    pose(r, k) {
      const env = Math.sin(Math.min(k, 1) * Math.PI);
      r._rot('Hips', 'y', k * Math.PI * 4);
      r._resetArms();
      r._arm('L', 1.0 * env, 0, 0.25 * env, 0.2);
      r._arm('R', 1.0 * env, 0, 0.25 * env, 0.2);
      r.hipOffset.y += env * 1.5;
    },
  },
};

export const EMOTE_IDS = Object.keys(EMOTES);

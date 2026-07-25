/**
 * AMG World — avatars.
 *
 * One class covers both the local player and everyone else in the room; the
 * only difference is where the target position comes from (input vs network).
 * Remote avatars interpolate toward their last received transform so a 4 Hz
 * presence feed still looks like continuous movement.
 *
 * The kid GLBs are ~330–550 KB each, so models are cached by id and cloned with
 * SkeletonUtils (a plain .clone() would share the skeleton and make every kid
 * puppet the same pose).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { RigAnimator } from './animator.js';
import { Locomotion, getLocomotionLibrary } from './clips.js';
import { EmotePlayer, getEmoteLibrary } from './emotes.js';
import { RigV2 } from './rig_v2.js';

const loader = new GLTFLoader();
const cache = new Map();

/**
 * Which character rig the world runs on:
 *   'v2' (default) — the Unity-T-pose re-exports in assets/characters/v2/, which
 *                    play the real 58 Synty emotes + rebased locomotion via
 *                    RigV2 (absolute quats, no correction). See rig_v2.js.
 *   'v1'           — the original arms-down GLBs with the delta/corr locomotion
 *                    and procedural emotes. Kept as a one-flag rollback:
 *                    localStorage.amgWorldRig = 'v1'.
 */
export const RIG = (() => {
  try { return localStorage.getItem('amgWorldRig') === 'v1' ? 'v1' : 'v2'; }
  catch (e) { return 'v2'; }
})();

/** The GLB url for a manifest entry, honouring the active rig. */
export function characterUrl(m) {
  return RIG === 'v2' ? '../assets/characters/v2/' + m.id + '.glb' : '../' + m.glb;
}

/**
 * The exported kid GLBs already resolve to ~1.2 m tall: the bone data is in
 * centimetres, but the root node carries the 0.01 down-scale. So the avatar
 * needs NO extra scaling — applying 0.01 again makes a 1.2 cm kid, which reads
 * as "the model didn't load".
 *
 * Rig poses in animator.js are written in the bone-local centimetre space, so
 * an offset of 1.2 there is 1.2 cm of hip bob. Don't "fix" those numbers to
 * metres without changing this too.
 */
const MODEL_SCALE = 1;
/** Roughly the top of a 1.2 m kid's head, for nametag / bubble placement. */
const HEAD_TOP = 1.32;

/* Sprite sizing. Labels are authored for a ~7 m camera (the default follow
   distance) and scaled from there so they hold a constant on-screen size. */
const NAMETAG_REF_DIST = 7;
const LABEL_H = 0.30, LABEL_W = LABEL_H * (256 / 64);
const BUBBLE_H = 0.62, BUBBLE_W = BUBBLE_H * (512 / 160);

export async function preloadCharacter(id, url) {
  if (cache.has(id)) return cache.get(id);
  const p = loader.loadAsync(url).then((gltf) => {
    const scene = gltf.scene;
    scene.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;   // skinned bounds go stale as the rig moves
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        // Synty exports a COLOR_0 attribute that three.js renders black
        m.vertexColors = false;
        m.roughness = Math.max(m.roughness ?? 0.9, 0.7);
        m.metalness = 0;
        if ((m.name || '').includes('Face') || (m.name || '').includes('Eye')) {
          m.transparent = true; m.depthWrite = false; m.alphaTest = 0.02;
        }
        if (m.map) m.map.magFilter = THREE.NearestFilter;
        m.needsUpdate = true;
      }
    });
    return scene;
  });
  // Evict on failure so a transient load error (flaky wifi on a Chromebook)
  // doesn't cache a rejected promise and permanently break that character.
  p.catch(() => { if (cache.get(id) === p) cache.delete(id); });
  cache.set(id, p);
  return p;
}

export class Avatar {
  /**
   * @param {THREE.Object3D} proto a preloaded character scene to clone
   * @param {{name?:string, local?:boolean, tint?:number}} opts
   */
  constructor(proto, opts = {}) {
    this.group = new THREE.Group();
    this.model = skeletonClone(proto);
    this.model.scale.setScalar(MODEL_SCALE);
    this.group.add(this.model);

    if (RIG === 'v2') {
      // One absolute-quat player: rebased locomotion + the real 58 emotes on the
      // v2 rig. Loads its 34 KB locomotion bake + emote manifest once (shared);
      // main.js preloads locomotion at boot so no T-pose ever shows.
      this.rig = new RigV2(this.model);
    } else {
      this.rig = new RigAnimator(this.model);
      // v1 rollback: baked delta locomotion + procedural emotes, so nobody ever
      // sees a T-posed kid while the shared library loads.
      getLocomotionLibrary().then((lib) => {
        if (lib && !this._disposed) this.rig.loco = new Locomotion(this.model, lib, this.rig);
      });
      getEmoteLibrary().then((lib) => {
        if (lib && !this._disposed) this.rig.emotes = new EmotePlayer(this.rig, lib);
      });
    }
    this.local = !!opts.local;
    // Network-driven avatars (remote players) interpolate toward a received
    // transform. Locally-driven ones (the player, and NPCs) set pos/yaw/speed
    // directly and must NOT be interpolated toward a stale netPos/netSpeed —
    // doing so drags them to the origin at zero speed. Default: non-local ==
    // networked, unless told otherwise (NPCs pass networked:false).
    this.networked = !this.local && opts.networked !== false;
    this.name = opts.name || 'Player';

    // physics-ish state
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.targetYaw = 0;
    this.speed = 0;
    this.grounded = true;
    this.airTime = 0;
    this.groundY = 0;

    // remote interpolation
    this.netPos = new THREE.Vector3();
    this.netYaw = 0;
    this.netSpeed = 0;

    this.label = makeNameTag(this.name);
    this.label.position.y = HEAD_TOP + 0.22;
    this.group.add(this.label);

    this.bubble = null;
    this.bubbleUntil = 0;
  }

  setName(name) {
    if (name === this.name) return;
    this.name = name;
    this.group.remove(this.label);
    this.label.material.map?.dispose();
    this.label.material.dispose();
    this.label = makeNameTag(name);
    this.label.position.y = HEAD_TOP + 0.22;
    this.group.add(this.label);
  }

  /** Show a speech bubble above the head for a few seconds. */
  say(text, seconds = 4.5) {
    if (this.bubble) { this.group.remove(this.bubble); disposeSprite(this.bubble); }
    this.bubble = makeBubble(text);
    this.bubble.position.y = HEAD_TOP + 0.62;
    this.group.add(this.bubble);
    this.bubbleUntil = performance.now() + seconds * 1000;
  }

  /** Clip emote if we have it, else the procedural one of the same name.
   *  opts (v2 rigs only): { freezeAt } — hold the clip at that second. */
  playEmote(id, opts) {
    if (this.rig.emotes && this.rig.emotes.lib.has(id)) {
      this.rig.emote = null;              // clip wins; drop any procedural one
      this.rig.emotes.play(id);
      return true;
    }
    return this.rig.playEmote(id, opts);
  }

  /**
   * Play a baked ACTIVITY clip (assets/characters/emotes/actions.bin — the real
   * sits, swing pump, slide, hula, fishing), falling back to the emote-as-a-pose
   * stand-in this park shipped with if that bin ever fails to load.
   *
   * The fallback is not paranoia: actions.bin is one more fetch on a school
   * Chromebook, and a kid who taps "Sit down" on a flaky connection should get
   * the old frozen squat, not a T-pose. Fire and forget.
   *
   * @param {string} id       clip id in the `actions` category
   * @param {string} [fbId]   emote id to freeze if the clip is unavailable
   * @param {number} [fbAt]   second to freeze that fallback at
   */
  playAction(id, fbId = 'squat', fbAt = 1.8) {
    const r = this.rig.playEmote(id);
    if (r && typeof r.then === 'function') {
      r.then((ok) => { if (!ok && fbId) this.rig.playEmote(fbId, { freezeAt: fbAt }); });
    }
    return r;
  }

  /** Remote avatars only: latest authoritative transform from the network. */
  setNetworkTarget(x, y, z, yaw, speed) {
    this.netPos.set(x, y, z);
    this.netYaw = yaw;
    this.netSpeed = speed;
  }

  update(dt, camera) {
    if (this.networked) {
      // Ease toward the network target. A 12/s rate lands within a frame or two
      // of a 4 Hz feed without visible rubber-banding.
      const k = 1 - Math.exp(-12 * dt);
      this.pos.lerp(this.netPos, k);
      this.yaw += shortestAngle(this.yaw, this.netYaw) * k;
      this.speed += (this.netSpeed - this.speed) * k;
      this.grounded = true;
    }

    this.group.position.copy(this.pos);
    // YXZ so the tilt below is about the avatar's own (post-yaw) X axis —
    // default XYZ would lean everyone in a fixed WORLD direction instead.
    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = this.yaw;
    // Whole-body tilt (lean). Used by rides.js so a kid on a swing pivots with
    // it; anyone not riding stays exactly upright.
    this.group.rotation.x = this.tilt || 0;
    this.rig.update(dt, {
      speed: this.speed, maxSpeed: 3.4,
      grounded: this.grounded, airTime: this.airTime,
    });

    if (camera) {
      this.label.quaternion.copy(camera.quaternion);
      if (this.bubble) this.bubble.quaternion.copy(camera.quaternion);

      const d = camera.position.distanceTo(this.pos);
      // Sprites are sized in world units, so a nametag that reads nicely from
      // across the park covers half the screen when the camera swings in
      // close. Scale with distance to hold a roughly constant on-screen size.
      const k = THREE.MathUtils.clamp(d / NAMETAG_REF_DIST, 0.42, 1.9);
      this.label.scale.set(LABEL_W * k, LABEL_H * k, 1);
      if (this.bubble) this.bubble.scale.set(BUBBLE_W * k, BUBBLE_H * k, 1);

      // Fade distant nametags so a busy park isn't a wall of text. Your own
      // name is hidden entirely — you know who you are, and at a close camera
      // it sits right where you're trying to look.
      const far = THREE.MathUtils.clamp(1 - (d - 16) / 10, 0, 1);
      this.label.material.opacity = far;
      this.label.visible = !this.local && far > 0.02;
    }

    if (this.bubble && performance.now() > this.bubbleUntil) {
      this.group.remove(this.bubble);
      disposeSprite(this.bubble);
      this.bubble = null;
    }
  }

  dispose() {
    this._disposed = true;
    this.rig.dispose?.();       // RigV2
    this.rig.loco?.dispose?.(); // v1 Locomotion
    this.group.removeFromParent();
    disposeSprite(this.label);
    if (this.bubble) disposeSprite(this.bubble);
  }
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function disposeSprite(s) {
  s.material.map?.dispose();
  s.material.dispose();
}

function canvasSprite(draw, w, h, worldH) {
  const dpr = 2;
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(worldH * (w / h), worldH, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeNameTag(name) {
  const text = String(name).slice(0, 16);
  const w = 256, h = 64;
  return canvasSprite((ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '600 26px "Baloo 2", system-ui, sans-serif';
    const tw = Math.min(ctx.measureText(text).width + 28, w - 8);
    const x = (w - tw) / 2;
    ctx.fillStyle = 'rgba(8,12,28,0.72)';
    roundRect(ctx, x, 14, tw, 36, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,240,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#eafcff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 33);
  }, w, h, 0.30);
}

function makeBubble(text) {
  const t = String(text).slice(0, 60);
  const w = 512, h = 160;
  return canvasSprite((ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '600 30px "Baloo 2", system-ui, sans-serif';
    // wrap to at most two lines
    const words = t.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > w - 90 && line) { lines.push(line); line = word; }
      else line = test;
      if (lines.length === 2) break;
    }
    if (line && lines.length < 2) lines.push(line);
    const tw = Math.min(Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44, w - 12);
    const bh = 26 + lines.length * 36;
    const x = (w - tw) / 2, y = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    roundRect(ctx, x, y, tw, bh, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,70,0.25)'; ctx.lineWidth = 3; ctx.stroke();
    // tail
    ctx.beginPath();
    ctx.moveTo(w / 2 - 14, y + bh - 2);
    ctx.lineTo(w / 2, y + bh + 22);
    ctx.lineTo(w / 2 + 14, y + bh - 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.fillStyle = '#141c33';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y + 30 + i * 36));
  }, w, h, 0.62);
}

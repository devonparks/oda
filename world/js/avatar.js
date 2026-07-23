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

const loader = new GLTFLoader();
const cache = new Map();

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

    this.rig = new RigAnimator(this.model);
    this.local = !!opts.local;
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

  playEmote(id) { return this.rig.playEmote(id); }

  /** Remote avatars only: latest authoritative transform from the network. */
  setNetworkTarget(x, y, z, yaw, speed) {
    this.netPos.set(x, y, z);
    this.netYaw = yaw;
    this.netSpeed = speed;
  }

  update(dt, camera) {
    if (!this.local) {
      // Ease toward the network target. A 12/s rate lands within a frame or two
      // of a 4 Hz feed without visible rubber-banding.
      const k = 1 - Math.exp(-12 * dt);
      this.pos.lerp(this.netPos, k);
      this.yaw += shortestAngle(this.yaw, this.netYaw) * k;
      this.speed += (this.netSpeed - this.speed) * k;
      this.grounded = true;
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.rig.update(dt, {
      speed: this.speed, maxSpeed: 4.2,
      grounded: this.grounded, airTime: this.airTime,
    });

    if (camera) {
      this.label.quaternion.copy(camera.quaternion);
      if (this.bubble) this.bubble.quaternion.copy(camera.quaternion);
      // fade distant nametags out so a busy park doesn't turn into a wall of text
      const d = camera.position.distanceTo(this.pos);
      this.label.material.opacity = THREE.MathUtils.clamp(1 - (d - 14) / 10, 0, 1);
      this.label.visible = this.label.material.opacity > 0.02;
    }

    if (this.bubble && performance.now() > this.bubbleUntil) {
      this.group.remove(this.bubble);
      disposeSprite(this.bubble);
      this.bubble = null;
    }
  }

  dispose() {
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

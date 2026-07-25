/**
 * AMG World — fishing at the pond.
 *
 * The pond earned this: it has real water, wading, ducks, and now a reason to
 * stand still at the bank. One cast is one little story: the bobber arcs out,
 * plops, sits… dips (just a nibble)… then DIVES — and you have under a second
 * to hook it. What you pull out ranges from minnows to a golden koi to an old
 * boot, and everything lands in a fishing log kept across visits.
 *
 * Interaction grammar (kept deliberately tiny):
 *   E at the pond marker  → cast
 *   E (or click) on the bite → hook
 *   walk away             → reel in, no drama
 *
 * Everything is code-drawn: a rod line, a red bobber, the shared GroundFX
 * rings. No assets, no textures, nothing added to the download.
 */
import * as THREE from 'three';
import { getEmoteLibraryV2 } from './rig_v2.js';

/** The catch table. Weights are relative; coins flow through the shared
 *  economy. `msg` entries toast a bonus line — one of them is a breadcrumb. */
export const CATCH_TABLE = [
  { id: 'minnow',   name: 'Minnow',          icon: '🐟', w: 28, coins: 2 },
  { id: 'sunfish',  name: 'Sunfish',         icon: '🐠', w: 22, coins: 3 },
  { id: 'puffer',   name: 'Puffer',          icon: '🐡', w: 14, coins: 6 },
  { id: 'frog',     name: 'Pond Frog',       icon: '🐸', w: 10, coins: 5 },
  { id: 'crawdad',  name: 'Crawdad',         icon: '🦞', w: 8,  coins: 7 },
  { id: 'turtle',   name: 'Snapping Turtle', icon: '🐢', w: 6,  coins: 10 },
  { id: 'boot',     name: 'Old Boot',        icon: '🥾', w: 8,  coins: 1, junk: true },
  { id: 'bottle',   name: 'Message Bottle',  icon: '🍾', w: 6,  coins: 4,
    msgs: ['"Recess forever!"', '"The gazebo is the cozy spot."', '"Try waving at everyone you meet."', '"C.E. was here — 755 Broadway."'] },
  { id: 'ducky',    name: 'Rubber Ducky',    icon: '🦆', w: 3,  coins: 15, rare: true },
  { id: 'goldkoi',  name: 'Golden Koi',      icon: '🌟', w: 3,  coins: 25, rare: true },
];
const TOTAL_W = CATCH_TABLE.reduce((s, c) => s + c.w, 0);
const LOG_KEY = 'amgwFishLog';

const _v = new THREE.Vector3();

export class Fishing {
  /**
   * @param {World} world
   * @param {object} hooks { toast(msg,cls), sfx(f,d,type,v), coins(n), caught(entry,isNew,logSize), lap() }
   */
  constructor(world, hooks = {}) {
    this.world = world;
    this.hooks = hooks;
    this.state = 'idle';       // idle | cast | wait | bite | reel
    this.t = 0;
    this.player = null;
    this.handBone = null;

    this.log = this._loadLog();

    // bobber: one small red sphere
    this.bobber = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    this.bobber.visible = false;
    world.scene.add(this.bobber);

    // rod: a thin world-space cylinder re-posed every frame (no bone-frame math)
    this.rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.014, 0.85, 6),
      new THREE.MeshBasicMaterial({ color: 0x7a4a24 }));
    this.rod.visible = false;
    world.scene.add(this.rod);

    // line: two-point THREE.Line from rod tip to bobber
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.7 }));
    this.line.visible = false;
    this.line.frustumCulled = false;
    world.scene.add(this.line);

    this._castFrom = new THREE.Vector3();
    this._castTo = new THREE.Vector3();
    this._nibbleT = 0;
    this._dip = 0;             // current bobber dip depth (eased)
    this.hud = null;

    // click hooks too (E is primary; pointer-locked clicks are free)
    window.addEventListener('mousedown', () => { if (this.state === 'bite') this.hook(); });

    // warm the sporty emote bin so the FIRST cast's wind-up isn't swallowed by
    // a lazy category fetch (each bin only loads when first used)
    getEmoteLibraryV2().then((lib) => lib && lib.loadCategory('sporty').catch(() => {}));
  }

  _loadLog() {
    try { const l = JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); return l && typeof l === 'object' ? l : {}; }
    catch (e) { return {}; }
  }
  _saveLog() { try { localStorage.setItem(LOG_KEY, JSON.stringify(this.log)); } catch (e) {} }

  /** species caught so far / total table size (for the Help modal + badge) */
  logSummary() {
    const caught = CATCH_TABLE.filter((c) => this.log[c.id]);
    return { caught, total: CATCH_TABLE.length, icons: caught.map((c) => c.icon).join(' ') };
  }

  get busy() { return this.state !== 'idle'; }

  /** Find (or re-find after a character swap) the right hand bone. */
  _ensureHand(player) {
    if (this.player === player && this.handBone && this.handBone.parent) return;
    this.player = player;
    this.handBone = null;
    player.model.traverse((o) => { if (!this.handBone && o.name === 'Hand_R') this.handBone = o; });
  }

  /** @param {Avatar} player */
  cast(player) {
    if (this.busy || !this.world.water) return false;
    this._ensureHand(player);

    // The bobber lands at a fixed radius INSIDE the open water, along the
    // player→centre line — casting from the dirt path always clears the bank
    // and actually splashes down in the pond (Devon: "when you aim the rod it
    // should actually go in the water").
    const w = this.world.water;
    const dx = w.x - player.pos.x, dz = w.z - player.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const landR = Math.max(1.0, w.r - 1.4 - Math.random() * 1.2);
    const reach = d - landR;
    this._castFrom.set(player.pos.x, player.pos.y + 1.1, player.pos.z);
    this._castTo.set(player.pos.x + (dx / d) * reach, w.y, player.pos.z + (dz / d) * reach);

    player.playEmote('baseball');            // the wind-up reads as the cast
    this.hooks.sfx && this.hooks.sfx(520, 0.08, 'triangle', 0.05);
    this.state = 'cast';
    this.t = 0;
    this._dip = 0;
    this.bobber.visible = true;
    this.rod.visible = true;
    this.line.visible = true;
    this._ensureHud();
    this._hud('🎣 Casting…');
    return true;
  }

  /** The one decisive input. Returns true if it consumed the press. */
  hook() {
    if (this.state === 'bite') {
      const c = this._roll();
      const n = (this.log[c.id] || 0) + 1;
      const isNew = !this.log[c.id];
      this.log[c.id] = n;
      this._saveLog();
      this.hooks.coins && this.hooks.coins(c.coins);
      const size = Object.keys(this.log).length;
      this.hooks.caught && this.hooks.caught(c, isNew, size);
      if (c.rare) { this.player.playEmote('cheer'); this.hooks.sfx && this.hooks.sfx(880, 0.12, 'triangle', 0.07); }
      this.hooks.sfx && this.hooks.sfx(660, 0.09, 'triangle', 0.06);
      let line = `${c.icon} ${c.name}! +${c.coins} coins${isNew ? ' · NEW!' : ''}`;
      this.hooks.toast && this.hooks.toast(line, c.rare ? 'gold' : undefined);
      if (c.msgs) {
        const msg = c.msgs[(Math.random() * c.msgs.length) | 0];
        setTimeout(() => this.hooks.toast && this.hooks.toast('The note says: ' + msg), 1700);
      }
      this._hud(`${c.icon} ${c.name}!`);
      this._reel();
      return true;
    }
    if (this.state === 'wait') {             // impatient yank: scares the fish
      this.hooks.toast && this.hooks.toast('Too soon — wait for the dive!');
      this._reel();
      return true;
    }
    return false;
  }

  cancel() {
    if (!this.busy) return;
    this._reel(true);
  }

  _reel(silent) {
    this.state = 'reel';
    this.t = 0;
    if (!silent) this.hooks.sfx && this.hooks.sfx(300, 0.06, 'triangle', 0.04);
  }

  _roll() {
    let r = Math.random() * TOTAL_W;
    for (const c of CATCH_TABLE) { r -= c.w; if (r <= 0) return c; }
    return CATCH_TABLE[0];
  }

  _ensureHud() {
    if (this.hud) { this.hud.style.display = 'block'; return; }
    const d = document.createElement('div');
    d.id = 'fishHud';
    d.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);' +
      'background:rgba(10,14,32,0.82);border:1px solid rgba(255,255,255,0.2);border-radius:14px;' +
      'padding:6px 14px;color:#eafcff;font:700 14px "Baloo 2",system-ui;z-index:40;pointer-events:none;';
    document.body.appendChild(d);
    this.hud = d;
  }
  _hud(text) { if (this.hud) this.hud.textContent = text; }
  _hideHud() { if (this.hud) this.hud.style.display = 'none'; }

  /**
   * @param {number} dt
   * @param {Avatar} player
   * @param {boolean} moving  true when there is movement input this frame
   * @param {boolean} carry   true while standing in the fishing area — the rod
   *                          rides on the shoulder so the spot feels owned
   */
  update(dt, player, moving, carry = false) {
    if (this.state === 'idle') {
      if (carry && player) {
        this._ensureHand(player);
        this.rod.visible = true;
        this._poseCarry(player);
      } else if (this.rod.visible) {
        this.rod.visible = false;
      }
      return;
    }
    this.t += dt;

    // walking away reels in without fuss (not during the 1s result flash)
    if (moving && (this.state === 'wait' || this.state === 'bite' || this.state === 'cast')) {
      this.cancel();
    }

    const w = this.world.water;

    if (this.state === 'cast') {
      const k = Math.min(this.t / 0.8, 1);
      // parabolic arc from hand height down to the water
      this.bobber.position.lerpVectors(this._castFrom, this._castTo, k);
      this.bobber.position.y += Math.sin(k * Math.PI) * 1.6;
      if (k >= 1) {
        this.state = 'wait';
        this.t = 0;
        this._waitFor = 3 + Math.random() * 6;
        this._nibbleT = 1 + Math.random() * 2;
        this.world.fx.spawn(this._castTo.x, w.y + 0.02, this._castTo.z, { from: 0.15, to: 0.9, dur: 0.6, alpha: 0.6 });
        this.hooks.lap && this.hooks.lap();
        this.hooks.sfx && this.hooks.sfx(240, 0.07, 'sine', 0.05);
        this._hud('🎣 Waiting… (E when it dives!)');
      }
    } else if (this.state === 'wait') {
      // float with a light bob; occasional nibble dips that are NOT the bite
      const bob = Math.sin(this.t * 2.4) * 0.02;
      this._nibbleT -= dt;
      let dipTarget = 0;
      if (this._nibbleT < 0.35 && this._nibbleT > 0) {
        dipTarget = 0.06;                                    // teasing dip
        if (!this._nibbled) {
          this._nibbled = true;
          this.hooks.sfx && this.hooks.sfx(700, 0.04, 'sine', 0.035);
          this.world.fx.spawn(this.bobber.position.x, w.y + 0.02, this.bobber.position.z, { from: 0.1, to: 0.45, dur: 0.5, alpha: 0.4 });
        }
      } else if (this._nibbleT <= 0) {
        this._nibbleT = 1.2 + Math.random() * 2.2;
        this._nibbled = false;
      }
      this._dip += (dipTarget - this._dip) * Math.min(1, 10 * dt);
      this.bobber.position.y = w.y + 0.05 + bob - this._dip;
      if (this.t >= this._waitFor) {
        this.state = 'bite';
        this.t = 0;
        this.hooks.sfx && (this.hooks.sfx(760, 0.07, 'square', 0.06), this.hooks.sfx(520, 0.09, 'square', 0.05));
        this.world.fx.spawn(this.bobber.position.x, w.y + 0.02, this.bobber.position.z, { from: 0.2, to: 1.1, dur: 0.45, alpha: 0.7 });
        this._hud('❗ NOW — press E!');
      }
    } else if (this.state === 'bite') {
      // the dive: bobber yanked under, short window
      this._dip += (0.18 - this._dip) * Math.min(1, 14 * dt);
      this.bobber.position.y = w.y + 0.05 - this._dip + Math.sin(this.t * 22) * 0.012;
      if (this.t > 0.9) {
        this.hooks.toast && this.hooks.toast('It got away… cast again!');
        this._reel();
      }
    } else if (this.state === 'reel') {
      // bobber skims back to the player, then everything hides
      const k = Math.min(this.t / 0.5, 1);
      _v.set(player.pos.x, player.pos.y + 0.9, player.pos.z);
      this.bobber.position.lerp(_v, k * 0.35 + 0.1);
      if (k >= 1) {
        this.state = 'idle';
        this.bobber.visible = false;
        this.rod.visible = false;
        this.line.visible = false;
        this._hideHud();
        return;
      }
    }

    this._poseRod(player);
  }

  /** Rod resting on the shoulder, angled up past the head. No line. */
  _poseCarry(player) {
    let hx = player.pos.x, hy = player.pos.y + 0.95, hz = player.pos.z;
    if (this.handBone) {
      this.handBone.getWorldPosition(_v);
      hx = _v.x; hy = _v.y; hz = _v.z;
    }
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    _v.set(fx * -0.35, 1, fz * -0.35).normalize();   // tipped back over the shoulder
    this.rod.position.set(hx + _v.x * 0.26, hy + _v.y * 0.26, hz + _v.z * 0.26);
    this.rod.quaternion.setFromUnitVectors(this.rod.up, _v);
  }

  /** Rod from the right hand toward the bobber; line from rod tip to bobber. */
  _poseRod(player) {
    let hx = player.pos.x, hy = player.pos.y + 0.95, hz = player.pos.z;
    if (this.handBone) {
      this.handBone.getWorldPosition(_v);
      hx = _v.x; hy = _v.y; hz = _v.z;
    }
    const b = this.bobber.position;
    // rod points from hand toward the bobber, held at 40% along its length
    const dx = b.x - hx, dy = b.y + 0.6 - hy, dz = b.z - hz;
    const len = Math.hypot(dx, dy, dz) || 1;
    this.rod.position.set(hx + (dx / len) * 0.28, hy + (dy / len) * 0.28, hz + (dz / len) * 0.28);
    _v.set(dx / len, dy / len, dz / len);
    this.rod.quaternion.setFromUnitVectors(this.rod.up, _v);
    // rod tip = hand + dir * 0.75
    const tx = hx + (dx / len) * 0.75, ty = hy + (dy / len) * 0.75, tz = hz + (dz / len) * 0.75;
    const pos = this.line.geometry.attributes.position;
    pos.array[0] = tx; pos.array[1] = ty; pos.array[2] = tz;
    pos.array[3] = b.x; pos.array[4] = b.y; pos.array[5] = b.z;
    pos.needsUpdate = true;
  }
}

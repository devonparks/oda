/**
 * AMG World — unified v2-local rig player.
 *
 * ONE player for the v2 kid rigs (assets/characters/v2/*.glb, Unity-T-pose bind).
 * It drives everything from ABSOLUTE v2-local quaternions — no deltas, no bind
 * composition, no per-bone frame correction. Two layers, blended per bone:
 *
 *   1. LOCOMOTION  — idle/walk/run/sprint + jump/fall/land, gait-weighted by
 *                    speed and rate-scaled so feet don't skate. Baked by
 *                    `tools/world/bake_locomotion_v2.mjs` → world/assets/
 *                    locomotion_v2.{bin,json}.
 *   2. EMOTE       — one channel layered on top, upper-body override while
 *                    moving (legs keep the walk cycle). The 58 curated Synty
 *                    clips in assets/characters/emotes/ (format 'v2local').
 *
 * This is the same math as `arcade/drop4/express.js`'s createRigPlayer (idle
 * base + emote channel, slerp-and-assign, hip offset along world-up), extended
 * with the multi-clip locomotion base so a kid can WALK, not just idle. Sharing
 * one absolute-quat pipeline across the hub games and the world is the whole
 * point of the v2 re-export (see docs/EMOTE_SYNC_BRIEF.md).
 *
 * Why hand-rolled and not THREE.AnimationMixer: a mixer overwrites each bone's
 * quaternion per clip, which fights the layered gait+emote blend we do here;
 * doing it by hand also keeps the hot loop allocation-free for Chromebook GC.
 */
import * as THREE from 'three';
import { EmoteLibrary } from './emotes.js';

/**
 * The v2 emote library — the committed absolute-quat bake in
 * assets/characters/emotes/ (format 'v2local'), shared by the hub games'
 * express.js. Reuses EmoteLibrary purely as a manifest + lazy-bin container
 * (its old delta PLAYER is not used here; RigV2 does the absolute playback).
 * This deliberately does NOT go through emotes.js's gated getEmoteLibrary(),
 * which still serves the v1 rollback path its old world/assets/emotes bins.
 */
/**
 * Asset bases are PAGE-relative (this module fetches, and fetch resolves
 * against the document, not the module). The defaults serve world/index.html;
 * a hub game embedding a kid (e.g. arcade/basketball) calls setAssetBase()
 * with its own relative prefixes BEFORE the first getLocomotionV2/
 * getEmoteLibraryV2 call — the promises cache on first use.
 */
let LOCO_BASE = 'assets/';
let EMOTE_BASE = '../assets/characters/emotes/';
export function setAssetBase(locoBase, emoteBase) {
  if (_locoPromise || _emPromise) { console.warn('[rig_v2] setAssetBase after first load — ignored'); return; }
  if (locoBase != null) LOCO_BASE = locoBase;
  if (emoteBase != null) EMOTE_BASE = emoteBase;
}

let _emPromise = null;
export function getEmoteLibraryV2() {
  if (!_emPromise) {
    _emPromise = EmoteLibrary.load(EMOTE_BASE)
      .catch((e) => { console.warn('[world] v2 emotes unavailable:', e.message); return null; });
  }
  return _emPromise;
}

const Q16 = 1 / 32767;     // int16 -> unit quaternion component
const HIP_MM = 0.001;      // int16 millimetres -> metres
const LEG_START = 14;      // bones 0 (hips) + 14..21 are the lower body

/**
 * Where a SEATED baked clip puts the pelvis, in metres above the avatar origin.
 *
 * The rig's bind pelvis is 0.5437 up and the seated clips carry hipY -0.261
 * (see tools/world/unity/AMGActionBaker.cs), so 0.283. Anything placing a kid
 * on a seat needs this to land the pelvis on the plank instead of guessing —
 * benches, swings, the seesaw, the kart.
 */
export const BIND_PELVIS_Y = 0.5437;
/**
 * The seated clips' baked hip offset. CRITICAL: update() applies this along
 * WORLD up (see step 4 — it un-rotates the parent so the pelvis always drops
 * vertically), NOT along the model's own up. So for an UPRIGHT kid the pelvis
 * is simply BIND_PELVIS_Y + SEATED_HIP_OFFSET, but for a TILTED one — a kid on
 * a swing at the top of its arc — the two parts rotate differently:
 *
 *   pelvis = origin + R(tilt)·(0, BIND_PELVIS_Y, 0) + (0, SEATED_HIP_OFFSET, 0)
 *
 * Treating the whole 0.283 as one rotating offset drifts the pelvis up to 25 cm
 * off the seat at full swing — measured, and exactly the kind of "the character
 * isn't tied to the swing" mismatch this pass exists to kill.
 */
export const SEATED_HIP_OFFSET = -0.261;
/** Pelvis height above the avatar origin, UPRIGHT only. Tilted? See above. */
export const SEATED_PELVIS_Y = BIND_PELVIS_Y + SEATED_HIP_OFFSET;
/**
 * Pelvis JOINT to the bottom of the butt — how far above a seat the joint goes.
 * Raised 0.06 -> 0.105 after Devon's playtest: on the swing the kid "kinda
 * clips with the swing a little bit". The seat plank has real thickness and the
 * shorts have real volume; 6 cm put the joint close enough that the mesh
 * intersected the board at the bottom of the arc.
 */
export const BUTT_BELOW_PELVIS = 0.105;

/** Gait blend thresholds in m/s — matched to the old clips.js so the walk/run
 *  feel that shipped is preserved exactly. */
const GAIT = { walk: 1.6, run: 3.4 };
/** Playback rate = speed / this, clamped. Feet slide fwd if too high. */
const CLIP_SPEED = { walk: 0.95, run: 1.7, sprint: 1.9 };
const RATE_MIN = 0.75, RATE_MAX = 1.7;

// ── shared locomotion bake (loads once) ─────────────────────────────────────
let _locoPromise = null;
export function getLocomotionV2() {
  if (!_locoPromise) {
    _locoPromise = (async () => {
      const manifest = await fetch(LOCO_BASE + 'locomotion_v2.json').then((r) => {
        if (!r.ok) throw new Error('locomotion_v2.json ' + r.status);
        return r.json();
      });
      const buf = await fetch(LOCO_BASE + 'locomotion_v2.bin').then((r) => {
        if (!r.ok) throw new Error('locomotion_v2.bin ' + r.status);
        return r.arrayBuffer();
      });
      const bin = new Int16Array(buf);
      const clips = {};
      for (const c of manifest.clips) clips[c.id] = c;
      return { manifest, bin, clips, bones: manifest.bones, fps: manifest.fps };
    })().catch((e) => { console.warn('[world] v2 locomotion unavailable:', e.message); return null; });
  }
  return _locoPromise;
}

// module scratch, reused every frame (no per-frame allocation)
const _q = new THREE.Quaternion();
const _acc = new THREE.Quaternion();
const _e = new THREE.Quaternion();
const _e2 = new THREE.Quaternion();
const _wq = new THREE.Quaternion();
const _ws = new THREE.Vector3();
const _up = new THREE.Vector3();

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/**
 * Sample one bone's absolute quaternion from an Int16 clip block into `out`.
 * @param bin   Int16Array holding the clip's data
 * @param base  int16 index of the clip's first quaternion (byteOff >> 1)
 * @param nb    bone count
 * @param frames clip length
 * @param loop  wrap vs clamp at the end
 * @param time  playhead seconds
 * @param fps   clip fps
 * @param b     bone index
 */
function sampleAbs(bin, base, nb, frames, loop, time, fps, b, out) {
  const f = time * fps;
  let f0 = Math.floor(f), frac = f - f0;
  if (loop) f0 = ((f0 % frames) + frames) % frames;
  else if (f0 >= frames - 1) { f0 = frames - 1; frac = 0; }
  const f1 = loop ? (f0 + 1) % frames : Math.min(f0 + 1, frames - 1);
  const p0 = base + (f0 * nb + b) * 4, p1 = base + (f1 * nb + b) * 4;
  out.set(bin[p0] * Q16, bin[p0 + 1] * Q16, bin[p0 + 2] * Q16, bin[p0 + 3] * Q16).normalize();
  if (frac > 0) { _q.set(bin[p1] * Q16, bin[p1 + 1] * Q16, bin[p1 + 2] * Q16, bin[p1 + 3] * Q16).normalize(); out.slerp(_q, frac); }
  return out;
}

/** Hip vertical offset (metres) for a clip at `time`. */
function sampleHip(bin, base, nb, frames, loop, time, fps) {
  const f = time * fps;
  let f0 = Math.floor(f); const frac = f - f0;
  if (loop) f0 = ((f0 % frames) + frames) % frames; else f0 = Math.min(f0, frames - 1);
  const f1 = loop ? (f0 + 1) % frames : Math.min(f0 + 1, frames - 1);
  const hb = base + frames * nb * 4;
  return (bin[hb + f0] * HIP_MM) * (1 - frac) + (bin[hb + f1] * HIP_MM) * frac;
}

export class RigV2 {
  /** @param {THREE.Object3D} model cloned v2 GLB scene */
  constructor(model) {
    this.model = model;
    this.loco = null;      // { manifest, bin, clips, bones, fps }
    this.emlib = null;     // EmoteLibrary (shared)
    this.bones = null;     // bone objects aligned to loco.bones order
    this.hipsNode = null;
    this.hipsRestPos = null;
    this.ok = false;

    // locomotion state (per clip id)
    this.w = {};           // eased gait weights
    this.t = {};           // per-clip playheads (s)
    this._jumpT = 0; this._landT = 0; this._wasGrounded = true;

    /**
     * Stride progress in radians, 2π per full gait cycle (so it crosses a
     * multiple of π twice per cycle — once per foot). main.js's footsteps()
     * triggers the step SFX off this. The v1 RigAnimator exposed the same
     * field; without it every `Math.floor(phase/π)` comparison there is
     * NaN !== NaN — always true — and the tone fires every single frame.
     */
    this.phase = 0;

    // Per-frame scratch, reused so update() stays allocation-free (the whole
    // point of hand-rolling this instead of using THREE.AnimationMixer).
    this._target = { idle: 0, walk: 0, run: 0, sprint: 0, jump: 0, fall: 0, land: 0 };
    this._active = [];

    // emote channel
    this.emote = null;     // { info, data:Int16Array, t }
    /**
     * A SECOND clip blended over the emote channel. Exists for one reason: a
     * pose whose INTENSITY is driven by the world. The swing is the case —
     * a kid barely moving on a gentle sway and a kid pumping flat-out are the
     * same pose at two amplitudes, and the swing's own amplitude is what picks
     * between them. Without this, the pump plays at full throw while the swing
     * is still rocking gently, which is precisely the "two different systems"
     * mismatch Devon called out.
     */
    this.overlay = null;   // { info, data, t }
    this.overlayW = 0;     // 0 = pure emote, 1 = pure overlay
    this.emWeight = 0;
    this.legWeight = 1;    // 1 = full-body emote (standing), 0 = upper-body only
    this._tIdle = Math.random() * 2;   // desync many kids on screen (idle phase)

    getLocomotionV2().then((lib) => { if (lib && !this._disposed) this._bindLoco(lib); });
    getEmoteLibraryV2().then((lib) => { if (lib && !this._disposed) this.emlib = lib; });
  }

  _bindLoco(lib) {
    this.loco = lib;
    const set = new Set(lib.bones);
    const bones = new Array(lib.bones.length).fill(null);
    this.model.traverse((o) => {
      if (set.has(o.name)) bones[lib.bones.indexOf(o.name)] = o;
      if (o.name === 'Hips') { this.hipsNode = o; this.hipsRestPos = o.position.clone(); }
    });
    this.bones = bones;
    this.ok = bones.filter(Boolean).length >= 20;
    for (const c of lib.manifest.clips) { this.w[c.id] = 0; this.t[c.id] = this._tIdle; }
    this.w.idle = 1;
  }

  get emoting() { return !!this.emote; }

  /**
   * Start an emote by id. Loads its category bin if needed; fire-and-forget.
   * opts.freezeAt (seconds): clamp the playhead there and hold that frame
   * until stopEmote() — turns any moment of any clip into a held pose (the
   * bench "sit" is squat's deepest frame; no sit clip exists in the library).
   */
  async playEmote(id, opts = {}) {
    const lib = this.emlib || (this.emlib = await getEmoteLibraryV2());
    if (!lib) return false;
    const info = lib.info(id);
    if (!info) return false;
    let data = lib.data.get(info.cat);
    if (!data) { try { data = await lib.loadCategory(info.cat); } catch (e) { return false; } }
    this.emote = { info, data, t: 0, freezeAt: opts.freezeAt ?? null };
    return true;
  }
  play(id) { return this.playEmote(id); }
  stopEmote() { this.emote = null; this.overlay = null; this.overlayW = 0; }

  /**
   * Blend `id` over whatever the emote channel is playing, at `weight` (0..1).
   * Call every frame; pass weight 0 (or null id) to drop it. Fire-and-forget.
   */
  setOverlay(id, weight) {
    this.overlayW = clamp(weight || 0, 0, 1);
    if (!id || this.overlayW <= 0.001) { this.overlay = null; this._ovWant = null; return; }
    if (this.overlay && this.overlay.info.id === id) return;   // sync fast path
    if (this._ovWant === id) return;                           // load in flight
    this._ovWant = id;
    this._loadOverlay(id);
  }

  /** Called at most once per id; setOverlay's hot path allocates nothing. */
  async _loadOverlay(id) {
    const lib = this.emlib || (this.emlib = await getEmoteLibraryV2());
    if (!lib || this._ovWant !== id || this._disposed) return;
    const info = lib.info(id);
    if (!info) return;
    let data = lib.data.get(info.cat);
    if (!data) { try { data = await lib.loadCategory(info.cat); } catch (e) { return; } }
    if (this._ovWant !== id || this._disposed) return;
    this.overlay = { info, data, t: 0 };
  }

  /**
   * Drive the emote playhead from outside instead of from dt.
   *
   * The swing pump is one baked cycle, and it only reads as pumping if the kid
   * kicks out in time with the swing — so rides.js hands the swing's own phase
   * straight in here every frame. Anything with an external phase (a ride, a
   * scripted beat) can do the same. No-op if that clip isn't the one playing.
   */
  setEmoteTime(id, t) {
    const em = this.emote && this.emote.info.id === id ? this.emote
      : (this.overlay && this.overlay.info.id === id ? this.overlay : null);
    if (!em) return false;
    const dur = em.info.dur || 1;
    em.t = ((t % dur) + dur) % dur;
    em.driven = true;
    return true;
  }

  /** True once `id` is the clip actually playing (not still fetching its bin). */
  isEmote(id) { return !!this.emote && this.emote.info.id === id; }
  hasOverlay(id) { return !!this.overlay && this.overlay.info.id === id; }

  /**
   * @param {number} dt
   * @param {{speed:number, grounded:boolean, airTime:number}} s
   */
  update(dt, s) {
    if (!this.ok || !this.loco) return;   // holds bind (T-pose) only in the
    // sub-frame window before the 34 KB bake resolves — main.js preloads it.
    const loco = this.loco, nb = loco.bones.length, fps = loco.fps;
    const speed = s.speed || 0;

    // ── 1. gait target weights (ported from clips.js) ──
    const target = this._target;
    target.idle = 0; target.walk = 0; target.run = 0; target.sprint = 0;
    target.jump = 0; target.fall = 0; target.land = 0;
    if (!s.grounded) {
      this._jumpT += dt;
      const j = clamp(1 - this._jumpT / 0.35, 0, 1);
      target.jump = j; target.fall = 1 - j; this._wasGrounded = false;
    } else {
      if (!this._wasGrounded) { this._landT = 0.30; this._wasGrounded = true; this.t.land = 0; }
      this._jumpT = 0; this.t.jump = 0;
      if (this._landT > 0) { this._landT -= dt; target.land = clamp(this._landT / 0.30, 0, 1); }
      const rest = 1 - target.land;
      if (speed <= 0.05) target.idle = rest;
      else if (speed < GAIT.walk) { const k = speed / GAIT.walk; target.idle = rest * (1 - k); target.walk = rest * k; }
      else if (speed < GAIT.run) { const k = (speed - GAIT.walk) / (GAIT.run - GAIT.walk); target.walk = rest * (1 - k); target.run = rest * k; }
      else target.run = rest;
    }

    const gk = 1 - Math.exp(-14 * dt);
    let total = 0;
    for (const name in this.w) {
      this.w[name] += ((target[name] || 0) - this.w[name]) * gk;
      if (this.w[name] < 0.0015) this.w[name] = 0;
      total += this.w[name];
    }
    if (total <= 0) { this.w.idle = 1; total = 1; }

    // advance playheads, rate-scaled by ground speed so feet don't skate
    for (const name in this.t) {
      const rate = CLIP_SPEED[name] ? clamp(speed / CLIP_SPEED[name], RATE_MIN, RATE_MAX) : 1;
      this.t[name] += dt * rate;
      const c = loco.clips[name];
      if (c.loop && this.t[name] > c.dur) this.t[name] %= c.dur;
    }
    const active = this._active;
    active.length = 0;
    for (const name in this.w) if (this.w[name] > 0) active.push(name);

    // Stride phase from the dominant ground gait, for footstep SFX. 2π per gait
    // cycle => two π-crossings per cycle => one trigger per foot. Held (not
    // reset) while standing so the next step doesn't fire a spurious trigger.
    let domName = null, domW = 0;
    for (const n of ['walk', 'run', 'sprint']) {
      if (this.w[n] > domW) { domW = this.w[n]; domName = n; }
    }
    if (domName) {
      const dc = loco.clips[domName];
      if (dc && dc.dur) this.phase = (this.t[domName] / dc.dur) * Math.PI * 2;
    }

    // ── 2. emote channel envelope (ported from emotes.js / express.js) ──
    // forceLegEmote: a kid driving the kart is MOVING fast but must keep the
    // full-body sit pose — without this the legs would run inside the kart.
    const targetLeg = this.forceLegEmote ? 1 : 1 - clamp(speed / GAIT.walk, 0, 1);
    const ek = 1 - Math.exp(-12 * dt);
    this.legWeight += (targetLeg - this.legWeight) * ek;
    let em = this.emote, emInfo = null, emBase = 0;
    if (em) {
      emInfo = em.info;
      // setEmoteTime() owns the playhead for the frame it was called on; adding
      // dt on top would drift the swing pump a constant frame ahead of the swing.
      if (em.driven) em.driven = false; else em.t += dt;
      if (em.freezeAt != null) {
        if (em.t > em.freezeAt) em.t = em.freezeAt;   // held pose until stopEmote()
        this.emWeight += (1 - this.emWeight) * ek;
      }
      else if (emInfo.hold) { em.t %= emInfo.dur; this.emWeight += (1 - this.emWeight) * ek; }
      else if (em.t >= emInfo.dur) { this.emote = null; em = null; }
      else {
        const inK = Math.min(em.t / 0.14, 1), outK = Math.min((emInfo.dur - em.t) / 0.20, 1);
        this.emWeight = Math.min(inK, outK);
      }
    }
    if (!em) this.emWeight += (0 - this.emWeight) * ek;
    if (em) emBase = emInfo.off >> 1;
    const emFps = this.emlib ? this.emlib.fps : 20;
    const ov = this.overlay;
    if (ov) {
      if (ov.driven) ov.driven = false; else ov.t += dt;
      if (ov.t > ov.info.dur) ov.t %= ov.info.dur;
    }
    const ovW = ov ? this.overlayW : 0;
    const ovBase = ov ? ov.info.off >> 1 : 0;

    // ── 3. compose per bone: locomotion blend, emote slerped over ──
    for (let b = 0; b < nb; b++) {
      const bone = this.bones[b];
      if (!bone) continue;

      // weighted blend of active gait clips (absolute quats)
      let accW = 0, has = false;
      for (const name of active) {
        const c = loco.clips[name];
        sampleAbs(loco.bin, c.off >> 1, nb, c.frames, c.loop, this.t[name], fps, b, _q);
        const wv = this.w[name] / total;
        if (!has) { _acc.copy(_q); accW = wv; has = true; }
        else { accW += wv; _acc.slerp(_q, wv / accW); }
      }
      if (!has) continue;

      // emote layer on top (legs + hips fade out while moving)
      if (em && this.emWeight > 0.002) {
        const w = (b === 0 || b >= LEG_START) ? this.emWeight * this.legWeight : this.emWeight;
        if (w > 0.002) {
          sampleAbs(em.data, emBase, nb, emInfo.frames, !!emInfo.hold, em.t, emFps, b, _e);
          if (ovW > 0.002) {
            sampleAbs(ov.data, ovBase, nb, ov.info.frames, !!ov.info.hold, ov.t, emFps, b, _e2);
            _e.slerp(_e2, ovW);
          }
          _acc.slerp(_e, w);
        }
      }
      bone.quaternion.copy(_acc);
    }

    // ── 4. hips vertical offset along parent-space world up ──
    let hip = 0;
    for (const name of active) hip += sampleHip(loco.bin, loco.clips[name].off >> 1, nb, loco.clips[name].frames, loco.clips[name].loop, this.t[name], fps) * (this.w[name] / total);
    if (em) {
      let emHip = sampleHip(em.data, emBase, nb, emInfo.frames, !!emInfo.hold, em.t, emFps);
      if (ovW > 0.002) {
        const oHip = sampleHip(ov.data, ovBase, nb, ov.info.frames, !!ov.info.hold, ov.t, emFps);
        emHip = emHip * (1 - ovW) + oHip * ovW;
      }
      const hw = this.emWeight * this.legWeight;
      hip = hip * (1 - hw) + emHip * hw;
    }
    if (this.hipsNode && this.hipsNode.parent) {
      this.hipsNode.parent.getWorldQuaternion(_wq);
      this.hipsNode.parent.getWorldScale(_ws);
      _up.set(0, 1, 0).applyQuaternion(_wq.invert());
      this.hipsNode.position.copy(this.hipsRestPos).addScaledVector(_up, hip / (_ws.y || 1));
    }
  }

  dispose() { this._disposed = true; this.emote = null; this.overlay = null; }
}

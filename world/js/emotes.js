/**
 * AMG World — the emote library.
 *
 * 58 curated Synty clips baked the same way as the locomotion (see
 * `tools/world/bake_locomotion.md`): deltas from the bind pose, conjugated into
 * this rig's bone frames at runtime. The difference is packaging — emotes are
 * Int16-quantised BINARY, one file per category, fetched on first use.
 *
 * That matters because the full set is 724 KB. A kid who only ever waves
 * downloads the 83 KB "Hello" file and nothing else; the manifest itself is a
 * few KB and loads with the world.
 *
 * WHICH clips are in here is a safeguarding decision, not a taste one — see the
 * long comment at the top of `tools/world/emote_allowlist.json`. The Synty packs
 * ship gestures (throat-slit, the entire Taunt category, finger guns) that must
 * never appear in a space where 9-13 year olds interact.
 */
import * as THREE from 'three';

const Q = 1 / 32767;      // int16 -> unit quaternion component
const HIP_MM = 0.001;     // int16 millimetres -> metres

/** Bones 0..13 are the upper body; 14..21 are the legs. */
const LEG_START = 14;

const _a = new THREE.Quaternion();
const _b = new THREE.Quaternion();

export class EmoteLibrary {
  constructor(manifest, baseUrl = 'assets/emotes/') {
    this.manifest = manifest;
    this.baseUrl = baseUrl;
    this.bones = manifest.bones;
    this.fps = manifest.fps;
    /** category id -> Int16Array once fetched */
    this.data = new Map();
    this.pending = new Map();
    /** emote id -> { cat, ...entry } */
    this.index = new Map();
    for (const cat of manifest.categories) {
      for (const e of cat.emotes) this.index.set(e.id, { ...e, cat: cat.id });
    }
  }

  static async load(baseUrl = 'assets/emotes/') {
    const manifest = await fetch(baseUrl + 'manifest.json').then((r) => {
      if (!r.ok) throw new Error('emote manifest ' + r.status);
      return r.json();
    });
    return new EmoteLibrary(manifest, baseUrl);
  }

  get categories() { return this.manifest.categories; }
  has(id) { return this.index.has(id); }
  info(id) { return this.index.get(id); }

  /** Fetch a category's binary. Safe to call repeatedly; dedupes in flight. */
  loadCategory(catId) {
    if (this.data.has(catId)) return Promise.resolve(this.data.get(catId));
    if (this.pending.has(catId)) return this.pending.get(catId);
    const p = fetch(this.baseUrl + catId + '.bin')
      .then((r) => { if (!r.ok) throw new Error(catId + '.bin ' + r.status); return r.arrayBuffer(); })
      .then((buf) => {
        const arr = new Int16Array(buf);
        this.data.set(catId, arr);
        this.pending.delete(catId);
        return arr;
      })
      .catch((e) => { this.pending.delete(catId); throw e; });
    this.pending.set(catId, p);
    return p;
  }

  /** True once this emote can be played without a network round trip. */
  ready(id) {
    const info = this.index.get(id);
    return !!info && this.data.has(info.cat);
  }

  /** Preload whatever a player is most likely to reach for first. */
  preload(ids) {
    const cats = new Set();
    for (const id of ids) { const i = this.index.get(id); if (i) cats.add(i.cat); }
    return Promise.all([...cats].map((c) => this.loadCategory(c).catch(() => null)));
  }
}

/**
 * Plays one emote on one rig, layered over whatever the locomotion wrote.
 *
 * While the avatar is moving only the UPPER body is driven, so a kid can wave
 * mid-walk without their legs freezing — the classic upper-body override. When
 * standing still the whole body plays, which is what makes a backflip or a
 * curtsy read properly.
 */
export class EmotePlayer {
  constructor(rig, library) {
    this.rig = rig;
    this.lib = library;
    this.current = null;    // { id, info, data, t }
    this.weight = 0;
    this.legWeight = 0;
  }

  get playing() { return !!this.current; }

  /**
   * The per-bone frame correction, shared with the locomotion — both bakes use
   * the same reference pose. Read lazily because the two libraries load
   * independently and the emote one can win the race.
   */
  get corr() { return this.rig.loco ? this.rig.loco.corr : null; }

  /**
   * Start an emote. Loads its category first if needed, so the caller can fire
   * and forget. Returns a promise that resolves true once it actually started.
   */
  async play(id) {
    const info = this.lib.info(id);
    if (!info) return false;
    let data = this.lib.data.get(info.cat);
    if (!data) {
      try { data = await this.lib.loadCategory(info.cat); }
      catch (e) { console.warn('[world] emote category failed:', e.message); return false; }
    }
    this.current = { id, info, data, t: 0 };
    return true;
  }

  stop() { this.current = null; }

  /**
   * @param {number} dt
   * @param {number} moving 0 = standing still, 1 = at full run — used to fade
   *                        the legs out so locomotion keeps them
   */
  update(dt, moving) {
    const targetLeg = 1 - Math.min(moving, 1);
    const k = 1 - Math.exp(-12 * dt);
    this.legWeight += (targetLeg - this.legWeight) * k;

    if (!this.current) {
      this.weight += (0 - this.weight) * k;
      return this.weight > 0.002;
    }

    const { info, data } = this.current;
    this.current.t += dt;
    const dur = info.dur;

    if (info.hold) {
      // stances loop until something else interrupts them
      this.current.t %= dur;
      this.weight += (1 - this.weight) * k;
    } else {
      if (this.current.t >= dur) { this.current = null; return this.weight > 0.002; }
      // ease in and out so a one-shot doesn't snap on and off
      const inK = Math.min(this.current.t / 0.14, 1);
      const outK = Math.min((dur - this.current.t) / 0.20, 1);
      this.weight = Math.min(inK, outK);
    }

    this._apply(data, info, this.weight);
    return true;
  }

  _apply(data, info, weight) {
    if (weight <= 0.002) return;
    const nb = this.lib.bones.length;
    const f = this.current.t * this.lib.fps;
    let f0 = Math.floor(f);
    let frac = f - f0;
    if (info.hold) f0 %= info.frames;
    else if (f0 >= info.frames - 1) { f0 = info.frames - 1; frac = 0; }
    const f1 = info.hold ? (f0 + 1) % info.frames : Math.min(f0 + 1, info.frames - 1);

    // `off` is a BYTE offset into the category file; Int16Array indexes by 2s
    const base = info.off >> 1;
    const i0 = base + f0 * nb * 4;
    const i1 = base + f1 * nb * 4;

    for (let b = 0; b < nb; b++) {
      const name = this.lib.bones[b];
      const bone = this.rig.bones[name];
      if (!bone) continue;

      // Legs (and the hips that carry them) fade out while the player is moving
      // so the walk cycle keeps the lower body.
      const w = b === 0 || b >= LEG_START ? weight * this.legWeight : weight;
      if (w <= 0.002) continue;

      const p0 = i0 + b * 4, p1 = i1 + b * 4;
      _a.set(data[p0] * Q, data[p0 + 1] * Q, data[p0 + 2] * Q, data[p0 + 3] * Q).normalize();
      if (frac > 0) {
        _b.set(data[p1] * Q, data[p1 + 1] * Q, data[p1 + 2] * Q, data[p1 + 3] * Q).normalize();
        _a.slerp(_b, frac);
      }

      // Same frame conjugation as the locomotion: the delta was authored in
      // Unity's bone axes and has to be re-expressed in this rig's.
      const c = this.corr ? this.corr[name] : null;
      if (c) _a.copy(_b.copy(c).invert().multiply(_a).multiply(c));

      // Blend from whatever locomotion already wrote toward the emote pose.
      _b.copy(this.rig.rest[name]).multiply(_a);
      bone.quaternion.slerp(_b, w);
    }

    // hip height, stored as int16 millimetres after the rotation block
    const hipBase = base + info.frames * nb * 4;
    const h0 = data[hipBase + f0] * HIP_MM;
    const h1 = data[hipBase + f1] * HIP_MM;
    this.hipY = (h0 * (1 - frac) + h1 * frac) * weight * this.legWeight;
  }
}

/**
 * One shared library for every avatar. Resolves to null (logging once) if the
 * bake is absent, so the world falls back to the procedural emotes rather than
 * breaking the wheel.
 */
/**
 * OFF BY DEFAULT — see docs/EMOTE_RIG_ISSUE.md.
 *
 * The bake is correct (deltas verified identical to Unity's, byte for byte) and
 * so is the decoding, but the CLIPS DO NOT TRANSFER: the exported kid GLBs rest
 * with their arms hanging down while the Unity rig's rest is a T-pose, and that
 * difference lives in the arm chain's bone offsets, not just its rotations. The
 * result is that "arms folded" plays as "arms in the air". Locomotion is
 * unaffected because its arm motion is small relative to rest.
 *
 * Fixing this properly means re-exporting the kid characters from Unity so
 * their rest pose matches the rig the clips were authored against — a change to
 * the character export pipeline, not something to guess at here.
 *
 * Until then the world uses the procedural emotes in animator.js, which are
 * verified and look right. Flip this to true (or set
 * localStorage.amgWorldClipEmotes = '1') to test the clip path.
 */
export const CLIP_EMOTES_ENABLED = (() => {
  try { return localStorage.getItem('amgWorldClipEmotes') === '1'; } catch (e) { return false; }
})();

let _libPromise = null;
export function getEmoteLibrary() {
  if (!CLIP_EMOTES_ENABLED) return Promise.resolve(null);
  if (!_libPromise) {
    _libPromise = EmoteLibrary.load().catch((e) => {
      console.warn('[world] emote library unavailable, using procedural emotes:', e.message);
      return null;
    });
  }
  return _libPromise;
}

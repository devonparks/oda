/**
 * AMG World Engine — the baked clip library.
 *
 * PORTED, NOT REINVENTED. The bake format and the sampling maths come straight
 * from world/js/rig_v2.js, which is the version that finally worked after
 * several that did not. Nothing here is engine-specific: it decodes Int16
 * buffers into quaternions, and the only Babylon in the file is the Quaternion
 * type it writes into.
 *
 * FORMAT ('v2local', authored by tools/world/bake_locomotion_v2.mjs and
 * tools/world/unity/AMGActionBaker.cs):
 *
 *   Int16Array, per clip, starting at byte offset `off`:
 *     [frames × bones × 4]   absolute LOCAL bone quaternions, × 32767
 *     [frames]               hip vertical offset, in millimetres
 *
 * They are ABSOLUTE local rotations — no deltas, no bind composition, no
 * per-frame correction. That is the property that makes layering two clips a
 * slerp instead of an argument.
 *
 * There are two libraries and they run at DIFFERENT frame rates — locomotion
 * is baked at 30 fps, the emote/action bins at 20. Reading one with the other's
 * fps plays it at 1.5× and was worth the sentence.
 */
import { Quaternion } from 'babylon';

const Q16 = 1 / 32767;      // int16 → unit quaternion component
const HIP_MM = 0.001;       // int16 millimetres → metres

/** Bones 0 (hips) and 14..21 are the lower body — the upper/lower split. */
export const LEG_START = 14;

/**
 * Where a SEATED baked clip puts the pelvis, in metres above the model origin.
 * The rig's bind pelvis is 0.5437 and the seated clips carry hipY −0.261 by
 * contract with AMGActionBaker.cs. Anything placing a kid on a seat needs
 * these instead of guessing — see the prop database.
 */
export const BIND_PELVIS_Y = 0.5437;
export const SEATED_HIP_OFFSET = -0.261;
export const SEATED_PELVIS_Y = BIND_PELVIS_Y + SEATED_HIP_OFFSET;
/** Pelvis joint to the bottom of the butt: how far above a seat the joint sits. */
export const BUTT_BELOW_PELVIS = 0.105;

/** Asset URLs carry the build stamp: a cached prop database or clip bin
 *  paired with fresh code is the same staleness problem as a cached
 *  module, and just as invisible. `__AMG_BUILD` is set by index.html. */
const V = (typeof window !== 'undefined' && window.__AMG_BUILD) ? ('?v=' + window.__AMG_BUILD) : '';
const base = (p) => new URL(p, import.meta.url).href + V;

/** The locomotion bake: idle / walk / run / sprint / jump / fall / land. */
export async function loadLocomotion() {
  const [manifest, buf] = await Promise.all([
    fetch(base('../../world/assets/locomotion_v2.json')).then((r) => r.json()),
    fetch(base('../../world/assets/locomotion_v2.bin')).then((r) => r.arrayBuffer()),
  ]);
  const clips = {};
  for (const c of manifest.clips) clips[c.id] = c;
  return { bin: new Int16Array(buf), clips, bones: manifest.bones, fps: manifest.fps };
}

/**
 * The action/emote library: 7 categories, 81 clips, one bin per category and
 * loaded on demand. `actions` is the 23 that matter to props — sit, sit_swing,
 * swing_pump, slide_ride, sit_kart, sit_seesaw, sit_rocker, fish_cast, climb,
 * monkey, sit_table and the rest.
 */
export class ActionLibrary {
  constructor(manifest) {
    this.manifest = manifest;
    this.fps = manifest.fps;                 // 20
    this.bones = manifest.bones;
    this.bins = new Map();                   // category id -> Int16Array
    this.byId = new Map();                   // clip id -> {…info, cat}
    for (const cat of manifest.categories) {
      for (const e of cat.emotes) this.byId.set(e.id, { ...e, cat: cat.id });
    }
  }

  static async load() {
    const manifest = await fetch(base('../../assets/characters/emotes/manifest.json')).then((r) => r.json());
    return new ActionLibrary(manifest);
  }

  info(id) { return this.byId.get(id) || null; }
  ids() { return [...this.byId.keys()]; }

  /** Load one category's bin. Idempotent; safe to call every frame. */
  async loadCategory(cat) {
    if (this.bins.has(cat)) return this.bins.get(cat);
    if (!this._pending) this._pending = new Map();
    if (this._pending.has(cat)) return this._pending.get(cat);
    const p = fetch(base(`../../assets/characters/emotes/${cat}.bin`))
      .then((r) => r.arrayBuffer())
      .then((b) => { const a = new Int16Array(b); this.bins.set(cat, a); return a; });
    this._pending.set(cat, p);
    return p;
  }

  /** The bin for a clip id, or null if its category is not loaded yet. */
  binFor(id) {
    const i = this.byId.get(id);
    return i ? this.bins.get(i.cat) || null : null;
  }
}

/**
 * Sample one bone's absolute local quaternion out of a clip, into `out`.
 *
 * @param {Int16Array} bin
 * @param {number} intBase  int16 index of the clip's first quaternion (byte off >> 1)
 * @param {number} nb       bone count
 * @param {number} frames   clip length in frames
 * @param {boolean} loop    wrap vs clamp at the end
 * @param {number} time     playhead, seconds
 * @param {number} fps      the CLIP's fps — 30 for locomotion, 20 for actions
 * @param {number} b        bone index
 * @param {Quaternion} out
 * @param {Quaternion} tmp  scratch, so this allocates nothing
 */
export function sampleBone(bin, intBase, nb, frames, loop, time, fps, b, out, tmp) {
  const f = time * fps;
  let f0 = Math.floor(f);
  let frac = f - f0;
  if (loop) f0 = ((f0 % frames) + frames) % frames;
  else if (f0 >= frames - 1) { f0 = frames - 1; frac = 0; }
  const f1 = loop ? (f0 + 1) % frames : Math.min(f0 + 1, frames - 1);
  const p0 = intBase + (f0 * nb + b) * 4;
  out.set(bin[p0] * Q16, bin[p0 + 1] * Q16, bin[p0 + 2] * Q16, bin[p0 + 3] * Q16);
  out.normalize();
  if (frac > 0) {
    const p1 = intBase + (f1 * nb + b) * 4;
    tmp.set(bin[p1] * Q16, bin[p1 + 1] * Q16, bin[p1 + 2] * Q16, bin[p1 + 3] * Q16);
    tmp.normalize();
    Quaternion.SlerpToRef(out, tmp, frac, out);
  }
  return out;
}

/** Hip vertical offset (metres) for a clip at `time`. */
export function sampleHip(bin, intBase, nb, frames, loop, time, fps) {
  const f = time * fps;
  let f0 = Math.floor(f);
  const frac = f - f0;
  if (loop) f0 = ((f0 % frames) + frames) % frames; else f0 = Math.min(f0, frames - 1);
  const f1 = loop ? (f0 + 1) % frames : Math.min(f0 + 1, frames - 1);
  const hb = intBase + frames * nb * 4;
  return (bin[hb + f0] * HIP_MM) * (1 - frac) + (bin[hb + f1] * HIP_MM) * frac;
}

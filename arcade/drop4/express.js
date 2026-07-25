/**
 * Drop4 Hub — Express Mode (real Synty emote playback).
 *
 * Plays the 58 kid-safe Polygon emotes on the v2 character rigs, over a real
 * Synty standing-idle base layer (no T-pose ever shows). Clip data in
 * assets/characters/emotes/ is ABSOLUTE v2-local quaternions produced offline
 * by tools/world/emote_lab.mjs (world-space per-bone retarget from the Unity
 * bake — docs/EMOTE_RIG_ISSUE.md). No runtime correction: slerp and assign.
 *
 * Exports:
 *   mountExpress(container, opts)      — full stage + category wheel screen
 *   mountCelebration(container, opts)  — small result-screen character playing
 *                                        a win/loss/draw emote over idle
 *   mountIdleHero(canvas)              — home-screen equipped character, idling
 */
import * as THREE from 'three';
import { createCharacterViewer, webglAvailable } from '../../js/amg-character-viewer.js';
import { getEquippedCharacterId } from './characters.js';

const ROOT = '../../';
const EMOTE_BASE = ROOT + 'assets/characters/emotes/';
const Q16 = 1 / 32767, HIP_MM = 0.001;

let _manifest = null;
const _bins = new Map();

async function loadManifest() {
  if (!_manifest) _manifest = await fetch(EMOTE_BASE + 'manifest.json').then((r) => r.json());
  return _manifest;
}
async function loadBin(file) {
  if (_bins.has(file)) return _bins.get(file);
  const buf = await fetch(EMOTE_BASE + file).then((r) => { if (!r.ok) throw new Error(file + ' ' + r.status); return r.arrayBuffer(); });
  const arr = new Int16Array(buf);
  _bins.set(file, arr);
  return arr;
}
const loadCategory = (catId) => loadBin(catId + '.bin');

function findEmote(manifest, id) {
  for (const cat of manifest.categories) {
    const e = cat.emotes.find((x) => x.id === id);
    if (e) return { ...e, cat: cat.id };
  }
  return null;
}

/**
 * The shared rig player: idle base layer + one emote channel blended over it.
 * Drives a loaded v2 model; call tick(dt) from any rAF (the character viewer's
 * own render loop presents the frames).
 */
function createRigPlayer(model, manifest) {
  const boneList = manifest.bones;
  const bones = {}, restQ = {};
  let hipsNode = null, hipsRestPos = null;
  model.traverse((o) => {
    if (boneList.includes(o.name)) { bones[o.name] = o; restQ[o.name] = o.quaternion.clone(); }
    if (o.name === 'Hips') { hipsNode = o; hipsRestPos = o.position.clone(); }
  });
  const ok = Object.keys(bones).length >= 20;

  let idleData = null;   // Int16Array once loaded
  const idle = manifest.idle;
  loadBin(idle && idle.file ? idle.file : 'idle.bin').then((d) => { idleData = d; }).catch(() => {});

  let current = null;    // { info, data, t }
  let weight = 0;
  let tIdle = Math.random() * 2; // desync multiple characters on screen
  const _i = new THREE.Quaternion(), _e = new THREE.Quaternion(), _b = new THREE.Quaternion();
  const _up = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3();

  function sample(data, layout, f0, f1, frac, boneIdx, out) {
    const nb = boneList.length;
    const base = layout.base + 0;
    const p0 = base + (f0 * nb + boneIdx) * 4, p1 = base + (f1 * nb + boneIdx) * 4;
    out.set(data[p0] * Q16, data[p0 + 1] * Q16, data[p0 + 2] * Q16, data[p0 + 3] * Q16).normalize();
    if (frac > 0) { _b.set(data[p1] * Q16, data[p1 + 1] * Q16, data[p1 + 2] * Q16, data[p1 + 3] * Q16).normalize(); out.slerp(_b, frac); }
    return out;
  }
  const frameAt = (t, fps, frames, loop) => {
    const f = t * fps;
    let f0 = Math.floor(f), frac = f - f0;
    if (loop) f0 %= frames; else if (f0 >= frames - 1) { f0 = frames - 1; frac = 0; }
    const f1 = loop ? (f0 + 1) % frames : Math.min(f0 + 1, frames - 1);
    return { f0, f1, frac };
  };
  const hipAt = (data, headerFrames, nb, f0, f1, frac, base) => {
    const hb = base + headerFrames * nb * 4;
    return (data[hb + f0] * HIP_MM) * (1 - frac) + (data[hb + f1] * HIP_MM) * frac;
  };

  async function play(id) {
    if (!ok) return false;
    const info = findEmote(manifest, id);
    if (!info) return false;
    let data;
    try { data = await loadCategory(info.cat); } catch (e) { return false; }
    current = { info, data, t: 0 };
    return true;
  }

  function tick(dt) {
    if (!ok) return;
    const k = 1 - Math.exp(-12 * dt);
    tIdle += dt;
    const nb = boneList.length;

    // emote weight envelope
    if (current) {
      const { info } = current;
      current.t += dt;
      if (info.hold) { current.t %= info.dur; weight += (1 - weight) * k; }
      else if (current.t >= info.dur) { current = null; }
      else {
        const inK = Math.min(current.t / 0.14, 1);
        const outK = Math.min((info.dur - current.t) / 0.2, 1);
        weight = Math.min(inK, outK);
      }
    }
    if (!current) weight += (0 - weight) * k;

    // idle base frame
    let iF = null;
    if (idleData && idle) iF = frameAt(tIdle, idle.fps || 30, idle.frames, true);

    // emote frame
    let eF = null, eBase = 0;
    if (current) {
      const { info } = current;
      eF = frameAt(current.t, manifest.fps, info.frames, !!info.hold);
      eBase = info.off >> 1;
    }

    for (let b = 0; b < nb; b++) {
      const bone = bones[boneList[b]];
      if (!bone) continue;
      // base layer: idle (or rest if idle not loaded yet)
      if (iF) sample(idleData, { base: 0 }, iF.f0, iF.f1, iF.frac, b, _i);
      else _i.copy(restQ[boneList[b]]);
      if (eF && weight > 0.002) {
        sample(current.data, { base: eBase }, eF.f0, eF.f1, eF.frac, b, _e);
        _i.slerp(_e, weight);
      }
      bone.quaternion.copy(_i);
    }

    // hips vertical offset: idle + emote blended, along world-up in parent space
    if (hipsNode && hipsNode.parent) {
      let h = 0;
      if (iF && idleData) h += hipAt(idleData, idle.frames, nb, iF.f0, iF.f1, iF.frac, 0) * (1 - weight);
      if (eF && current) h += hipAt(current.data, current.info.frames, nb, eF.f0, eF.f1, eF.frac, eBase) * weight;
      hipsNode.parent.getWorldQuaternion(_wq);
      hipsNode.parent.getWorldScale(_ws);
      _up.set(0, 1, 0).applyQuaternion(_wq.invert());
      hipsNode.position.copy(hipsRestPos).addScaledVector(_up, h / (_ws.y || 1));
    }
  }

  return { ok, play, stop() { current = null; }, tick, get playing() { return !!current; } };
}

/** Internal: viewer + v2 model + rig player + its own tick loop. */
async function createStage(canvas, characterId, viewerOpts) {
  if (!webglAvailable()) return null;
  const viewer = createCharacterViewer(canvas, viewerOpts);
  const manifest = await loadManifest();
  let model = null, fellBack = false;
  try { model = await viewer.load(ROOT + 'assets/characters/v2/' + characterId + '.glb'); }
  catch (e) {
    fellBack = true;
    try { model = await viewer.load(ROOT + 'assets/characters/' + characterId + '.glb'); } catch (e2) {}
  }
  const player = model && !fellBack ? createRigPlayer(model, manifest) : null;
  let raf = 0, alive = true, last = performance.now();
  (function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(((now || performance.now()) - last) / 1000, 0.1);
    last = now || performance.now();
    if (player) player.tick(dt);
  })(last);
  return {
    viewer, player, manifest, fellBack,
    destroy() { alive = false; cancelAnimationFrame(raf); try { viewer.dispose(); } catch (e) {} },
  };
}

// ── the full Express screen ─────────────────────────────────────────────────
export async function mountExpress(container, opts = {}) {
  const manifest = await loadManifest();
  container.innerHTML = `
    <div class="d4-express">
      <div class="d4-express-stage"><canvas id="d4ExpressCanvas"></canvas>
        <div class="d4-express-hint" id="d4ExpressHint">Pick an emote 👇 · drag to spin</div>
      </div>
      <div class="d4-express-tabs" id="d4ExpressTabs"></div>
      <div class="d4-express-grid" id="d4ExpressGrid"></div>
    </div>`;
  injectStyles();

  const canvas = container.querySelector('#d4ExpressCanvas');
  const stage = await createStage(canvas, opts.characterId || getEquippedCharacterId(), { autoSpin: false, allowDrag: true, fitPad: 1.24, yBias: 0.02 });
  if (!stage) { container.querySelector('#d4ExpressHint').textContent = '3D not supported on this device'; return { destroy() {} }; }
  if (!stage.player) container.querySelector('#d4ExpressHint').textContent = 'Emotes coming soon for this character';

  const tabs = container.querySelector('#d4ExpressTabs');
  const grid = container.querySelector('#d4ExpressGrid');
  const CAT_ICONS = { greet: '👋', happy: '🎉', dance: '🕺', sporty: '🤸', feelings: '💭', poses: '🧍' };
  // `hidden` categories (the world's `actions` bin — sits, swing pump, fishing)
  // are library content played by code, never emotes a kid picks off a tab.
  const pickable = manifest.categories.filter((c) => !c.hidden);
  let activeCat = pickable[0].id;

  function renderTabs() {
    tabs.innerHTML = '';
    pickable.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'd4x-tab' + (c.id === activeCat ? ' on' : '');
      b.textContent = (CAT_ICONS[c.id] || '🎭') + ' ' + (c.label || c.id);
      b.onclick = () => { activeCat = c.id; if (window.odaSfx) window.odaSfx.play('click'); renderTabs(); renderGrid(); loadCategory(c.id).catch(() => {}); };
      tabs.appendChild(b);
    });
  }
  function renderGrid() {
    grid.innerHTML = '';
    const cat = manifest.categories.find((c) => c.id === activeCat);
    cat.emotes.forEach((e) => {
      const b = document.createElement('button');
      b.className = 'd4x-emote';
      b.innerHTML = `<span class="i">${e.icon || '🎭'}</span><span class="n">${e.label}</span>`;
      b.onclick = async () => {
        if (!stage.player) return;
        grid.querySelectorAll('.d4x-emote.playing').forEach((x) => x.classList.remove('playing'));
        b.classList.add('playing');
        if (window.odaSfx) window.odaSfx.play('select');
        await stage.player.play(e.id);
        setTimeout(() => b.classList.remove('playing'), Math.min((e.dur || 2) * 1000, 4000));
      };
      grid.appendChild(b);
    });
  }
  renderTabs(); renderGrid();
  loadCategory(activeCat).catch(() => {});

  return {
    play: (id) => stage.player && stage.player.play(id),
    destroy() { stage.destroy(); },
  };
}

// ── result-screen celebration ───────────────────────────────────────────────
const WIN_EMOTES = ['cheer', 'fistpump', 'twothumbs', 'clap', 'amped', 'dab', 'twist'];
const LOSS_EMOTES = ['shrug', 'headshake', 'think'];
const DRAW_EMOTES = ['shrug', 'checkwatch', 'think'];

export async function mountCelebration(container, opts = {}) {
  injectStyles();
  container.innerHTML = '<canvas class="d4-celeb-canvas"></canvas>';
  const canvas = container.querySelector('canvas');
  const stage = await createStage(canvas, opts.characterId || getEquippedCharacterId(), { autoSpin: false, allowDrag: true, fitPad: 1.3, yBias: 0.02 });
  if (!stage) { container.innerHTML = ''; return { destroy() {} }; }
  if (stage.player) {
    const pool = opts.result === 'win' ? WIN_EMOTES : opts.result === 'draw' ? DRAW_EMOTES : LOSS_EMOTES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => stage.player.play(pick), 350); // let the screen land first
  }
  return { destroy() { stage.destroy(); } };
}

// ── home-screen idling hero ─────────────────────────────────────────────────
export async function mountIdleHero(canvas) {
  const stage = await createStage(canvas, getEquippedCharacterId(), { autoSpin: true, spinSpeed: 0.008, allowDrag: true, fitPad: 1.2 });
  return stage; // caller destroys
}

function injectStyles() {
  if (document.getElementById('d4ExpressStyles')) return;
  const s = document.createElement('style'); s.id = 'd4ExpressStyles';
  s.textContent = `
  .d4-express{display:flex;flex-direction:column;align-items:center;width:100%}
  .d4-express-stage{position:relative;width:min(92vw,380px)}
  #d4ExpressCanvas{width:100%;height:340px;cursor:grab}
  .d4-express-hint{text-align:center;font-size:12px;color:var(--text3);min-height:16px}
  .d4-express-tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:12px 0}
  .d4x-tab{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:7px 14px;color:var(--text2);font-family:'Outfit';font-weight:700;font-size:13px;cursor:pointer;min-height:36px}
  .d4x-tab.on{background:var(--accent);color:var(--bg);border-color:var(--accent)}
  .d4-express-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;width:min(92vw,560px)}
  .d4x-emote{background:var(--surface);border:2px solid var(--border);border-radius:14px;padding:10px 6px;color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:all .15s;min-height:64px}
  .d4x-emote:hover{border-color:var(--accent);transform:translateY(-2px)}
  .d4x-emote.playing{border-color:var(--gold);box-shadow:0 0 14px rgba(255,202,69,.4)}
  .d4x-emote .i{font-size:22px}
  .d4x-emote .n{font-size:11px;font-weight:600;color:var(--text2)}
  .d4-celeb-canvas{width:180px;height:210px;cursor:grab;display:block;margin:0 auto}
  `;
  document.head.appendChild(s);
}

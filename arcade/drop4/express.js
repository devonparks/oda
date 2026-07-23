/**
 * Drop4 Hub — Express Mode (real Synty emote playback).
 *
 * Plays the 58 kid-safe Polygon emotes on the v2 character rigs. The clips in
 * assets/characters/emotes/*.bin are ABSOLUTE v2-local quaternions, produced
 * offline by tools/world/emote_lab.mjs (world-space per-bone retarget from the
 * Unity bake — see docs/EMOTE_RIG_ISSUE.md for the history). No runtime frame
 * correction is needed: slerp between frames and assign.
 *
 * The stage reuses the Hub's amg-character-viewer (spin/drag, Chromebook-safe)
 * pointed at assets/characters/v2/{id}.glb — the Unity-native re-exports whose
 * bind pose matches the rig the clips were authored against.
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
async function loadCategory(catId) {
  if (_bins.has(catId)) return _bins.get(catId);
  const buf = await fetch(EMOTE_BASE + catId + '.bin').then((r) => { if (!r.ok) throw new Error(catId + ' ' + r.status); return r.arrayBuffer(); });
  const arr = new Int16Array(buf);
  _bins.set(catId, arr);
  return arr;
}

/** Mount the Express stage + wheel into `container`. */
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
  if (!webglAvailable()) { container.querySelector('#d4ExpressHint').textContent = '3D not supported on this device'; return { destroy() {} }; }

  const viewer = createCharacterViewer(canvas, { autoSpin: false, allowDrag: true, fitPad: 1.24, yBias: 0.02 });
  const charId = opts.characterId || getEquippedCharacterId();
  let model = null;
  try { model = await viewer.load(ROOT + 'assets/characters/v2/' + charId + '.glb'); }
  catch (e) {
    // v2 rig missing → fall back to the shipping model, emotes disabled
    try { model = await viewer.load(ROOT + 'assets/characters/' + charId + '.glb'); } catch (e2) {}
    container.querySelector('#d4ExpressHint').textContent = 'Emotes coming soon for this character';
  }

  // bone lookup + rest capture
  const bones = {}, restQ = {}, boneList = manifest.bones;
  let hipsNode = null, hipsRestPos = null;
  if (model) model.traverse((o) => {
    if (boneList.includes(o.name)) { bones[o.name] = o; restQ[o.name] = o.quaternion.clone(); }
    if (o.name === 'Hips') { hipsNode = o; hipsRestPos = o.position.clone(); }
  });
  const canPlay = Object.keys(bones).length >= 20;

  // ── player state ──
  let current = null; // { info, data, t }
  let weight = 0;
  const _a = new THREE.Quaternion(), _b = new THREE.Quaternion(), _t = new THREE.Quaternion();
  const _up = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3();

  async function play(id) {
    if (!canPlay) return;
    for (const cat of manifest.categories) {
      const e = cat.emotes.find((x) => x.id === id);
      if (!e) continue;
      let data;
      try { data = await loadCategory(cat.id); } catch (err) { return; }
      current = { info: e, data, t: 0 };
      viewer.setSpin(0);
      if (window.odaSfx) window.odaSfx.play('select');
      return;
    }
  }
  function stop() { current = null; }

  let last = performance.now(), raf = 0, alive = true;
  function tick(now) {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    const k = 1 - Math.exp(-12 * dt);

    if (!current) {
      weight += (0 - weight) * k;
      if (weight < 0.002 && hipsNode) hipsNode.position.copy(hipsRestPos);
      if (weight < 0.002) return;
    } else {
      const { info } = current;
      current.t += dt;
      if (info.hold) { current.t %= info.dur; weight += (1 - weight) * k; }
      else if (current.t >= info.dur) { current = null; return; }
      else {
        const inK = Math.min(current.t / 0.14, 1);
        const outK = Math.min((info.dur - current.t) / 0.2, 1);
        weight = Math.min(inK, outK);
      }
    }
    if (!current) {
      // blend back to rest
      for (const n of boneList) { const b = bones[n]; if (b) b.quaternion.slerp(restQ[n], k); }
      return;
    }

    const { info, data } = current;
    const nb = boneList.length;
    const f = current.t * manifest.fps;
    let f0 = Math.floor(f), frac = f - f0;
    if (info.hold) f0 %= info.frames; else if (f0 >= info.frames - 1) { f0 = info.frames - 1; frac = 0; }
    const f1 = info.hold ? (f0 + 1) % info.frames : Math.min(f0 + 1, info.frames - 1);
    const base = info.off >> 1;
    const i0 = base + f0 * nb * 4, i1 = base + f1 * nb * 4;

    for (let b = 0; b < nb; b++) {
      const bone = bones[boneList[b]];
      if (!bone) continue;
      const p0 = i0 + b * 4, p1 = i1 + b * 4;
      _a.set(data[p0] * Q16, data[p0 + 1] * Q16, data[p0 + 2] * Q16, data[p0 + 3] * Q16).normalize();
      if (frac > 0) { _b.set(data[p1] * Q16, data[p1 + 1] * Q16, data[p1 + 2] * Q16, data[p1 + 3] * Q16).normalize(); _a.slerp(_b, frac); }
      _t.copy(bone.quaternion);
      bone.quaternion.copy(_t.slerp(_a, weight));
    }

    // hip vertical offset (crouches/jumps), applied along world-up in parent space
    if (hipsNode && hipsNode.parent) {
      const hipBase = base + info.frames * nb * 4;
      const h = (data[hipBase + f0] * HIP_MM) * (1 - frac) + (data[hipBase + Math.min(f1, info.frames - 1)] * HIP_MM) * frac;
      hipsNode.parent.getWorldQuaternion(_wq);
      hipsNode.parent.getWorldScale(_ws);
      _up.set(0, 1, 0).applyQuaternion(_wq.invert());
      const s = _ws.y || 1;
      hipsNode.position.copy(hipsRestPos).addScaledVector(_up, (h / s) * weight);
    }
  }
  raf = requestAnimationFrame(tick);

  // ── wheel UI ──
  const tabs = container.querySelector('#d4ExpressTabs');
  const grid = container.querySelector('#d4ExpressGrid');
  const CAT_ICONS = { greet: '👋', happy: '🎉', dance: '🕺', sporty: '🤸', feelings: '💭', poses: '🧍' };
  let activeCat = manifest.categories[0].id;
  function renderTabs() {
    tabs.innerHTML = '';
    manifest.categories.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'd4x-tab' + (c.id === activeCat ? ' on' : '');
      b.textContent = (CAT_ICONS[c.id] || '🎭') + ' ' + (c.label || c.id);
      b.onclick = () => { activeCat = c.id; renderTabs(); renderGrid(); };
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
      b.onclick = () => play(e.id);
      grid.appendChild(b);
    });
  }
  renderTabs(); renderGrid();
  loadCategory(activeCat).catch(() => {});

  return {
    play, stop,
    destroy() { alive = false; cancelAnimationFrame(raf); try { viewer.dispose(); } catch (e) {} },
  };
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
  .d4x-emote .i{font-size:22px}
  .d4x-emote .n{font-size:11px;font-weight:600;color:var(--text2)}
  `;
  document.head.appendChild(s);
}

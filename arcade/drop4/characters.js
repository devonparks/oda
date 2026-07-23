/**
 * Drop4 Hub — character system (16 Polygon Kids).
 *
 * REPLACES Drop4's modular Synty "Kits" (assemble-a-character) with the Hub's
 * flat pre-made picker. Deliberately mirrors the hub's own character.html
 * contract EXACTLY so the character is ONE shared cross-game identity:
 *   - pricing: first 6 free, the rest coin goals (identical table).
 *   - ownership: global students/{id}.inventory contains 'char_'+id.
 *   - equip: students/{id}.equipped.character + localStorage amgCharacterId/Thumb.
 * A character bought/equipped in the hub shows up in Drop4 and vice-versa.
 *
 * Uses the Hub's already-built vanilla-three.js viewer (js/amg-character-viewer.js),
 * which renders a static Polygon Kid GLB with drag-spin — Chromebook-cheap. Real
 * emote/idle playback is deferred (the 58-clip bake is rig-blocked; see the
 * conversion doc), so Express Mode is a spin/drag showcase for now.
 */

import { createCharacterViewer, webglAvailable } from '../../js/amg-character-viewer.js';

const ROOT = '../../'; // arcade/drop4/ → repo root, where /assets and /js live

export const PRICING = {
  kid_hoodie: 0, kid_tracksuit: 0, kid_footballer: 0, kid_cheerleader: 0,
  kid_dino: 0, kid_alien: 0,
  kid_ninja: 400, kid_cardboard: 500, kid_ghost: 500,
  kid_explorer: 600, kid_ballerina: 600, kid_princess: 800,
  kid_superhero: 1000, kid_superhero2: 1000, kid_witch: 1200, kid_wizard: 1200,
};

let CATALOG = [];
let manifestPromise = null;

/** Load + cache the character manifest (id,name,glb,thumb), free-first order. */
export async function loadCatalog() {
  if (!manifestPromise) {
    manifestPromise = fetch(ROOT + 'assets/characters/manifest.json')
      .then((r) => r.json())
      .then((mf) => { CATALOG = mf.slice().sort((a, b) => (PRICING[a.id] || 0) - (PRICING[b.id] || 0)); return CATALOG; })
      .catch(() => { CATALOG = []; return CATALOG; });
  }
  return manifestPromise;
}

export function getEquippedCharacterId() {
  try { return localStorage.getItem('amgCharacterId') || 'kid_hoodie'; } catch (e) { return 'kid_hoodie'; }
}
export function getEquippedCharacterThumb() {
  try { return localStorage.getItem('amgCharacterThumb') || (ROOT + 'assets/characters/thumbs/' + getEquippedCharacterId() + '.png'); }
  catch (e) { return ROOT + 'assets/characters/thumbs/kid_hoodie.png'; }
}
/** Absolute (root-prefixed) thumb path for a character id. */
export function thumbFor(id) { return ROOT + 'assets/characters/thumbs/' + id + '.png'; }

function owned(entry, student) {
  if ((PRICING[entry.id] || 0) === 0) return true;
  const inv = (student && student.inventory) || [];
  return inv.indexOf('char_' + entry.id) >= 0;
}

/**
 * Mount a full character picker into `container`. Self-contained: 3D stage +
 * grid + buy/equip against the shared student wallet. opts.onEquip(entry) fires
 * after a successful equip so the caller can refresh the home hero.
 */
export async function mountCharacterPicker(container, opts = {}) {
  const studentId = localStorage.getItem('studentId');
  await loadCatalog();
  let student = null, selectedId = null, equippedId = getEquippedCharacterId();

  container.innerHTML = `
    <div class="d4-char-wrap">
      <div class="d4-char-stage">
        <canvas id="d4CharStage"></canvas>
        <div class="d4-stage-name" id="d4StageName"></div>
        <div class="d4-stage-status" id="d4StageStatus"></div>
        <div style="font-size:12px;color:var(--text3);margin-top:6px">🎭 Drag to spin · emotes &amp; idles coming soon</div>
      </div>
      <div class="d4-char-side">
        <div class="d4-char-coins">Coins: <span id="d4CharCoins">—</span> 🪙</div>
        <button class="btn btn-accent" id="d4EquipBtn" style="display:none"></button>
        <div class="d4-char-grid" id="d4CharGrid"></div>
      </div>
    </div>`;

  const canvas = container.querySelector('#d4CharStage');
  let viewer = null;
  if (webglAvailable()) {
    try { viewer = createCharacterViewer(canvas, { autoSpin: true, spinSpeed: 0.012, fitPad: 1.16 }); } catch (e) { viewer = null; }
  }
  if (!viewer) container.querySelector('#d4StageStatus').textContent = '3D preview not supported on this device';

  async function loadStudent() {
    if (!studentId || studentId.startsWith('anon_') || !window.getFirebaseDB) return;
    try {
      const fb = await window.getFirebaseDB();
      const snap = await fb.fsMod.getDoc(fb.fsMod.doc(fb.db, 'students', studentId));
      if (snap.exists()) { student = snap.data(); if (student.equipped && student.equipped.character) equippedId = student.equipped.character.id; }
    } catch (e) {}
    container.querySelector('#d4CharCoins').textContent = ((student && student.coins) || 0).toLocaleString();
  }

  async function showModel(entry) {
    container.querySelector('#d4StageName').textContent = entry.name;
    if (!viewer) return;
    try { await viewer.load(ROOT + entry.glb); container.querySelector('#d4StageStatus').textContent = ''; }
    catch (e) { container.querySelector('#d4StageStatus').textContent = 'Could not load model'; }
  }

  function renderGrid() {
    const grid = container.querySelector('#d4CharGrid');
    grid.innerHTML = '';
    CATALOG.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'd4-char-card' + (entry.id === selectedId ? ' selected' : '') + (entry.id === equippedId ? ' equipped' : '');
      const price = PRICING[entry.id] || 0;
      let tag;
      if (entry.id === equippedId) tag = '<div class="d4-cc-tag in-use">In use</div>';
      else if (owned(entry, student)) tag = '<div class="d4-cc-tag owned">Owned</div>';
      else if (price === 0) tag = '<div class="d4-cc-tag free">FREE</div>';
      else tag = '<div class="d4-cc-tag coins">🪙 ' + price.toLocaleString() + '</div>';
      card.innerHTML = '<img src="' + thumbFor(entry.id) + '" alt="' + entry.name + '" loading="lazy"><div class="d4-cc-name">' + entry.name + '</div>' + tag;
      card.onclick = () => select(entry.id);
      grid.appendChild(card);
    });
  }

  function updateEquipBtn() {
    const btn = container.querySelector('#d4EquipBtn');
    const entry = CATALOG.find((c) => c.id === selectedId);
    if (!entry) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    const price = PRICING[entry.id] || 0;
    const coins = (student && student.coins) || 0;
    if (entry.id === equippedId) { btn.className = 'btn btn-outline'; btn.textContent = '✅ This is you!'; btn.onclick = null; }
    else if (owned(entry, student)) { btn.className = 'btn btn-accent'; btn.textContent = 'Make this me!'; btn.onclick = equipSelected; }
    else if (coins >= price) { btn.className = 'btn btn-gold'; btn.innerHTML = 'Unlock — 🪙 ' + price.toLocaleString(); btn.onclick = buySelected; }
    else { btn.className = 'btn btn-outline'; btn.innerHTML = 'Need 🪙 ' + (price - coins).toLocaleString() + ' more — go learn &amp; earn!'; btn.onclick = null; }
  }

  async function select(id) { selectedId = id; renderGrid(); updateEquipBtn(); await showModel(CATALOG.find((c) => c.id === id)); }

  async function equipSelected() {
    const entry = CATALOG.find((c) => c.id === selectedId); if (!entry) return;
    try { localStorage.setItem('amgCharacterThumb', entry.thumb); localStorage.setItem('amgCharacterId', entry.id); } catch (e) {}
    equippedId = entry.id;
    if (studentId && !studentId.startsWith('anon_') && window.getFirebaseDB) {
      try {
        if (window.amgEnsureAnonAuth) await window.amgEnsureAnonAuth();
        const fb = await window.getFirebaseDB();
        await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'students', studentId), { 'equipped.character': { id: entry.id, name: entry.name, glb: entry.glb, thumb: entry.thumb } });
      } catch (e) {}
    }
    renderGrid(); updateEquipBtn();
    if (window.odaToast) window.odaToast('✨ ' + entry.name + ' is now your character!', 'success');
    if (window.odaCelebrate) window.odaCelebrate('confetti');
    if (opts.onEquip) opts.onEquip(entry);
  }

  async function buySelected() {
    const entry = CATALOG.find((c) => c.id === selectedId); const price = PRICING[entry.id] || 0;
    const coins = (student && student.coins) || 0;
    if (coins < price || !studentId || studentId.startsWith('anon_')) return;
    try {
      if (window.amgEnsureAnonAuth) await window.amgEnsureAnonAuth();
      const fb = await window.getFirebaseDB();
      await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'students', studentId), { coins: fb.fsMod.increment(-price), inventory: fb.fsMod.arrayUnion('char_' + entry.id) });
      student.coins = coins - price; student.inventory = (student.inventory || []).concat(['char_' + entry.id]);
      container.querySelector('#d4CharCoins').textContent = student.coins.toLocaleString();
      if (window.odaToast) window.odaToast('🎉 Unlocked ' + entry.name + '!', 'success');
      if (window.odaCelebrate) window.odaCelebrate('fireworks');
      await equipSelected();
    } catch (e) { if (window.odaToast) window.odaToast('Purchase failed. Try again!', 'error'); }
  }

  await loadStudent();
  renderGrid();
  await select(equippedId || (CATALOG[0] && CATALOG[0].id) || 'kid_hoodie');
  return { destroy() { try { viewer && viewer.dispose(); } catch (e) {} } };
}

/** Load the equipped character (spinning) into a small home-screen canvas. */
export async function mountHeroCharacter(canvas) {
  await loadCatalog();
  if (!webglAvailable()) return null;
  let viewer = null;
  try { viewer = createCharacterViewer(canvas, { autoSpin: true, spinSpeed: 0.01, fitPad: 1.2 }); } catch (e) { return null; }
  const id = getEquippedCharacterId();
  const entry = CATALOG.find((c) => c.id === id) || CATALOG[0];
  if (entry) { try { await viewer.load(ROOT + entry.glb); } catch (e) {} }
  return viewer;
}

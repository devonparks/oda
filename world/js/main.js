/**
 * AMG World — bootstrap and frame loop.
 *
 * Flow: loading -> character picker -> park. Everything after the picker lives
 * in one requestAnimationFrame loop; there is no framework and no build step,
 * which matters because this ships to Chromebooks straight off GitHub Pages
 * alongside the rest of AMG Hub.
 *
 * Coins earned here go into the same students/{id}.coins balance the arcade
 * games use, so a lap of the park is worth the same currency as a game — the
 * world is part of the economy, not a side attraction.
 */
import * as THREE from 'three';
import { World } from './world.js';
import { Avatar, preloadCharacter } from './avatar.js';
import { Input } from './input.js';
import { Presence } from './presence.js';
import { EMOTES, EMOTE_IDS } from './animator.js';
import { getEmoteLibrary } from './emotes.js';
import { PHRASE_GROUPS, PHRASES, renderPhrase, safeName } from './chat.js';
import { ZONES, ACTIVITIES, SPAWN, nearestZone, gamesForZone } from './zones.js';
import { NpcCrowd } from './npc.js';
import { Ambience } from './ambience.js';
import { WorldProgress } from './achievements.js';
import { StarHunt } from './stars.js';

const LS = {
  char: 'amgWorldChar',
  name: 'amgWorldName',
  quality: 'amgWorldQuality',
  pos: 'amgWorldPos',
};

const TIPS = [
  'Coins you find in the park go straight to your AMG Hub balance.',
  'Press Q for emotes — wave at someone who walks past.',
  'Walk into a glowing ring to open that zone\'s games.',
  'Hold Shift to run. Space to jump.',
  'On a tablet: hold the left side to walk, drag the right side to look.',
  'Finishing your assignments earns coins faster than any game.',
];

const state = {
  world: null,
  input: null,
  player: null,
  presence: null,
  remotes: new Map(),
  coins: 0,
  charId: localStorage.getItem(LS.char) || 'kid_hoodie',
  name: safeName(localStorage.getItem(LS.name) || localStorage.getItem('studentName') || 'Player'),
  quality: localStorage.getItem(LS.quality) || 'medium',
  activeZone: null,
  paused: false,
  manifest: [],
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
boot().catch((err) => {
  console.error('[world] boot failed', err);
  $('loadMsg').textContent = 'Could not load the park. Try refreshing.';
  $('loadTip').textContent = err.message || '';
});

async function boot() {
  cycleTips();
  setProgress(0.03, 'Waking up the park…');

  if (!webglOK()) {
    $('loadMsg').textContent = 'This device can\'t run 3D.';
    $('loadTip').innerHTML = 'AMG World needs WebGL. <a href="../student.html" style="color:var(--accent)">Back to the hub games</a>.';
    return;
  }

  state.manifest = await fetch('../assets/characters/manifest.json').then((r) => r.json());
  setProgress(0.10, 'Loading characters…');

  await buildPicker();
  setProgress(0.18, 'Ready when you are');
  $('loading').classList.add('hidden');
  $('picker').classList.remove('hidden');
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function setProgress(p, msg) {
  $('loadFill').style.width = Math.round(p * 100) + '%';
  if (msg) $('loadMsg').textContent = msg;
}

function cycleTips() {
  const el = $('loadTip');
  let i = Math.floor(Math.random() * TIPS.length);
  el.textContent = TIPS[i];
  setInterval(() => { i = (i + 1) % TIPS.length; el.textContent = TIPS[i]; }, 4200);
}

// ---------------------------------------------------------------------------
// character picker
// ---------------------------------------------------------------------------
async function buildPicker() {
  const strip = $('charStrip');
  const nameInput = $('displayName');
  nameInput.value = state.name;
  $('qualitySel').value = state.quality;

  const { createCharacterViewer } = await import('../../js/amg-character-viewer.js');
  const viewer = createCharacterViewer($('pickerCanvas'), { autoSpin: true, fitPad: 1.12 });

  const select = async (m) => {
    state.charId = m.id;
    [...strip.children].forEach((c) => c.classList.toggle('sel', c.dataset.id === m.id));
    await viewer.load('../' + m.glb);
  };

  for (const m of state.manifest) {
    const chip = document.createElement('button');
    chip.className = 'char-chip';
    chip.dataset.id = m.id;
    chip.innerHTML = `<img src="../${m.thumb}" alt="" loading="lazy"><div>${m.name}</div>`;
    chip.onclick = () => select(m);
    strip.appendChild(chip);
  }

  const start = state.manifest.find((m) => m.id === state.charId) || state.manifest[0];
  await select(start);

  $('enterBtn').onclick = async () => {
    state.name = safeName(nameInput.value);
    state.quality = $('qualitySel').value;
    localStorage.setItem(LS.char, state.charId);
    localStorage.setItem(LS.name, state.name);
    localStorage.setItem(LS.quality, state.quality);
    viewer.dispose();
    $('picker').classList.add('hidden');
    $('loading').classList.remove('hidden');
    await enterWorld();
  };
}

// ---------------------------------------------------------------------------
// world
// ---------------------------------------------------------------------------
async function enterWorld() {
  const world = new World($('stage'), { quality: state.quality });
  state.world = world;
  await world.load(setProgress);

  const model = state.manifest.find((m) => m.id === state.charId) || state.manifest[0];
  setProgress(0.9, 'Getting you dressed…');
  const proto = await preloadCharacter(model.id, '../' + model.glb);

  const player = new Avatar(proto, { local: true, name: state.name });
  const saved = readSavedPos();
  player.pos.set(saved.x, 0, saved.z);
  player.yaw = saved.yaw;
  world.camYaw = saved.yaw;
  world.scene.add(player.group);
  state.player = player;

  state.input = new Input($('stage'));
  state.input.onTap = (sx, sy) => tapToMove(sx, sy);

  await loadCoins();
  buildEmoteWheel();
  buildChatPanel();
  bindHud();

  state.presence = new Presence({
    room: 'park',
    playerId: playerId(),
    name: state.name,
    charId: state.charId,
    onJoin: addRemote,
    onUpdate: updateRemote,
    onLeave: removeRemote,
    onStatus: (s) => {
      $('liveDot').classList.toggle('solo', s !== 'online');
      $('onlineChip').title = s === 'online'
        ? 'Players here right now'
        : 'Playing solo — multiplayer is offline';
    },
  });
  state.presence.connect();

  // Ambient NPC kids so a solo park isn't empty. Count scales with quality
  // (Chromebooks get fewer) and thins out as real players arrive. They are
  // spawned after the first frames so boot stays fast.
  const npcBase = state.quality === 'low' ? 3 : state.quality === 'high' ? 7 : 5;
  state.npcs = new NpcCrowd(world, state.manifest, { base: npcBase, min: 0, max: npcBase });
  state.npcs.preload().then(() => {
    for (let i = 0; i < npcBase; i++) state.npcs._spawnOne();
  });

  // Debug hook, same idea as Drop4's window.__gameStore: lets a browser-driving
  // agent (or Devon in devtools) inspect and teleport without a build step.
  window.__world = {
    state, world, THREE,
    tp: (x, z) => { player.pos.set(x, 6, z); player.vel.y = 0; },
    combo: (n) => coinCombo(n),
    resetCombo: () => { comboCount = 0; comboExpire = 0; },
    stats: () => ({
      drawCalls: world.renderer.info.render.calls,
      tris: world.renderer.info.render.triangles,
      pos: player.pos.toArray().map((n) => +n.toFixed(2)),
      cam: world.camera.position.toArray().map((n) => +n.toFixed(2)),
      objects: world.scene.children.length,
      remotes: state.remotes.size,
      npcs: state.npcs?.count ?? 0,
    }),
  };

  state.ambience = new Ambience();
  state.ambience.arm();   // begins on the next gesture, per autoplay policy

  setProgress(1, 'Have fun!');
  $('loading').classList.add('hidden');
  $('hud').classList.remove('hidden');
  state.progress = new WorldProgress(EMOTE_IDS.length);
  state.progress.init();
  state.stars = new StarHunt(world, state.progress);
  toast(`Welcome to Recess Park, ${state.name}!`);
  maybeOnboard();
  setTimeout(dailyBonus, 2600);   // after the welcome toast + any coach

  window.addEventListener('beforeunload', () => {
    saveP0s();
    state.presence?.disconnect();
    state.npcs?.dispose();
    state.ambience?.dispose();
    state.stars?.dispose();
  });
  requestAnimationFrame(loop);
}

function playerId() {
  let id = localStorage.getItem('studentId');
  if (!id) {
    id = sessionStorage.getItem('amgWorldGuest');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('amgWorldGuest', id);
    }
  }
  return id;
}

function readSavedPos() {
  try {
    const p = JSON.parse(localStorage.getItem(LS.pos) || 'null');
    if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) return p;
  } catch (e) {}
  return { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw };
}

function saveP0s() {
  const p = state.player;
  if (!p) return;
  localStorage.setItem(LS.pos, JSON.stringify({
    x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(3),
  }));
}

// ---------------------------------------------------------------------------
// frame loop
// ---------------------------------------------------------------------------
let lastSave = 0;
function loop() {
  requestAnimationFrame(loop);
  const world = state.world;
  // Clamp dt: a backgrounded tab returns with a huge delta that would fling the
  // player through the fence.
  const dt = Math.min(world.clock.getDelta(), 0.05);
  const t = world.clock.elapsedTime;
  const player = state.player;

  const intent = state.input.sample();
  if (!state.paused) {
    intent.target = state.input.moveTarget;
    intent.clearTarget = () => { state.input.moveTarget = null; };
    if (intent.jump && player.grounded) sfx('whoosh');
    world.stepPlayer(player, intent, dt);
  } else {
    player.speed = 0;
  }
  if (!state.paused && player.speed > 0.05) state.progress?.addDistance(player.speed * dt);
  world.updateCamera(player, state.paused ? { x: 0, y: 0 } : intent.look, intent.zoom, dt);
  player.update(dt, world.camera);
  footsteps(player, dt);
  world.update(dt, t, player.pos);

  for (const r of state.remotes.values()) r.avatar.update(dt, world.camera);

  // NPC crowd — realPlayers is the true remote count, never counting NPCs, so
  // the "players here" number stays honest while the park still feels alive.
  if (state.npcs && !state.paused) {
    state.npcs.update(dt, world.camera, player.pos, state.remotes.size);
  }

  // coins
  const got = world.collectCoins(player.pos.x, player.pos.z, player.pos.y);
  if (got.length) coinCombo(got.length);

  // hidden star hunt
  if (state.stars && !state.paused) {
    const star = state.stars.update(dt, t, player.pos);
    if (star) onStarFound(star);
  }

  // proximity prompt
  updateZonePrompt();

  // network + persistence
  state.presence?.send(player.pos.x, player.pos.y, player.pos.z, player.yaw, player.speed);
  if (t - lastSave > 5) { lastSave = t; saveP0s(); }

  drawMinimap();
  world.render();
}

/**
 * Audio. The world uses the shared odaSfx from oda-core, so it honours the same
 * mute toggle as every arcade game and adds no files to the download.
 */
/**
 * Daily park bonus. First visit of a new day drops bonus coins that grow with a
 * consecutive-day streak (reset if a day is missed) — a gentle reason to open
 * the world every day, on top of the coins you find. Bounded and coin-only, so
 * it's a nudge, not a grind. Persisted in localStorage, keyed per day.
 */
function dailyBonus() {
  const today = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD, local enough for a daily gate
  const last = localStorage.getItem('amgw_last_visit');
  if (last === today) return;                            // already claimed today

  // streak: +1 if yesterday, else reset to 1
  let streak = parseInt(localStorage.getItem('amgw_visit_streak') || '0', 10) || 0;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak = last === yesterday ? streak + 1 : 1;

  const bonus = Math.min(10 + (streak - 1) * 5, 40);
  localStorage.setItem('amgw_last_visit', today);
  localStorage.setItem('amgw_visit_streak', String(streak));

  awardCoins(bonus, true);
  window.odaSfx && window.odaSfx.play('levelup');
  const streakLine = streak > 1 ? ` · ${streak}-day streak!` : '';
  bannerReward(`\u{1F381} Daily Bonus +${bonus}${streakLine}`);
  if (window.odaCelebrate) window.odaCelebrate('confetti');
}

/** Feedback when a hidden star is collected. */
function onStarFound(res) {
  window.odaSfx && window.odaSfx.play('powerup');
  if (res.done) {
    awardCoins(50, true);
    bannerReward('⭐ All 5 stars found! +50');
    if (window.odaCelebrate) window.odaCelebrate('fireworks');
  } else {
    awardCoins(5, true);
    bannerReward(`⭐ Star ${res.count}/5 found! +5`);
  }
}

/** A centered one-shot reward banner (bigger than a toast) for daily/milestone moments. */
function bannerReward(html) {
  const el = document.createElement('div');
  el.className = 'reward-banner';
  el.innerHTML = html;
  $('hud').appendChild(el);
  if (window.amgEmojiParse) window.amgEmojiParse(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3600);
}

function sfx(name) { window.odaSfx && window.odaSfx.play(name); }

// ---------------------------------------------------------------------------
// first-run onboarding
// ---------------------------------------------------------------------------
/**
 * A new kid drops into a 3D park with no idea what to do. This is a light,
 * once-only coach that teaches the loop: move → coins → zones → express. It
 * never blocks play (you can walk while it's up), it's touch/keyboard aware,
 * and it's skippable. Shown once, remembered in localStorage.
 */
function maybeOnboard() {
  if (localStorage.getItem('amgWorldOnboarded') === '1') return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const steps = [
    { icon: '🕹️', text: touch
        ? 'Hold the <b>left side</b> of the screen to walk — or just tap where you want to go.'
        : 'Move with <b>W A S D</b> or the arrow keys. Hold <b>Shift</b> to run.' },
    { icon: '🪙', text: 'Grab the <b>gold coins</b> around the park — they go straight to your AMG Hub balance.' },
    { icon: '🎮', text: touch
        ? 'Walk into a <b>glowing ring</b> and tap it to jump into games.'
        : 'Walk into a <b>glowing ring</b> and press <b>E</b> to jump into games.' },
    { icon: '😀', text: 'Tap the <b>😀 button</b> (or press <b>Q</b>) to wave, dance and more. Have fun!' },
  ];

  const card = document.createElement('div');
  card.className = 'coach';
  card.innerHTML = `
    <button class="coach-skip" aria-label="Skip">Skip</button>
    <div class="coach-icon"></div>
    <div class="coach-text"></div>
    <div class="coach-row">
      <div class="coach-dots"></div>
      <button class="coach-next"></button>
    </div>`;
  $('hud').appendChild(card);

  let i = 0;
  const render = () => {
    card.querySelector('.coach-icon').textContent = steps[i].icon;
    card.querySelector('.coach-text').innerHTML = steps[i].text;
    card.querySelector('.coach-next').textContent = i === steps.length - 1 ? "Let's go!" : 'Next ›';
    card.querySelector('.coach-dots').innerHTML =
      steps.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('');
    if (window.amgEmojiParse) window.amgEmojiParse(card);
  };
  const finish = () => {
    localStorage.setItem('amgWorldOnboarded', '1');
    card.classList.add('coach-out');
    setTimeout(() => card.remove(), 300);
  };
  card.querySelector('.coach-next').onclick = () => { sfx('click'); if (i < steps.length - 1) { i++; render(); } else finish(); };
  card.querySelector('.coach-skip').onclick = () => { sfx('click'); finish(); };
  render();
  // let the welcome toast breathe first
  card.style.opacity = '0';
  setTimeout(() => { card.style.opacity = ''; card.classList.add('coach-in'); }, 1400);
}

/**
 * A footstep on each half of the walk cycle. Driven off the rig's phase rather
 * than a timer, so steps land with the feet whether walking or sprinting.
 */
let lastStepPhase = 0, wasGrounded = true;
function footsteps(p, dt) {
  if (!p.grounded) { wasGrounded = false; return; }
  if (!wasGrounded) {          // just landed
    wasGrounded = true;
    lastStepPhase = p.rig.phase;
    window.odaSfx && window.odaSfx.tone(150, 0.09, 'triangle', 0.09);
    return;
  }
  if (p.speed < 0.3) { lastStepPhase = p.rig.phase; return; }
  // one step per half-cycle
  if (Math.floor(p.rig.phase / Math.PI) !== Math.floor(lastStepPhase / Math.PI)) {
    const vol = 0.035 + Math.min(p.speed / 4.6, 1) * 0.03;
    window.odaSfx && window.odaSfx.tone(120 + Math.random() * 40, 0.06, 'triangle', vol);
  }
  lastStepPhase = p.rig.phase;
}

// ---------------------------------------------------------------------------
// zones
// ---------------------------------------------------------------------------
function updateZonePrompt() {
  const p = state.player.pos;
  const zone = nearestZone(p.x, p.z, ZONES) || nearestZone(p.x, p.z, ACTIVITIES);
  const el = $('zonePrompt');
  if (zone === state.activeZone) return;
  state.activeZone = zone;
  if (!zone) { el.classList.add('hidden'); return; }
  el.querySelector('.zp-icon').textContent = zone.icon;
  el.querySelector('.zp-text strong').textContent = zone.name;
  el.querySelector('.zp-text span').textContent = zone.blurb || zone.prompt || '';
  el.classList.remove('hidden');
}

function enterZone() {
  const zone = state.activeZone;
  if (!zone) return;
  if (zone.categories) return openZoneModal(zone);
  runActivity(zone);
}

function openZoneModal(zone) {
  sfx('powerup');
  state.progress?.visitZone(zone.id);
  const games = gamesForZone(zone, window.ODA_GAMES || []);
  $('zoneEmoji').textContent = zone.icon;
  $('zoneName').textContent = zone.name;
  $('zoneBlurb').textContent = zone.blurb;
  const grid = $('zoneGames');
  grid.innerHTML = '';
  if (!games.length) {
    grid.innerHTML = '<p style="color:var(--text2)">No games here yet — check back soon!</p>';
  }
  for (const g of games) {
    const a = document.createElement('a');
    a.className = 'game-card';
    a.href = '../' + g.file;
    a.innerHTML = `<div class="ge">${g.emoji}</div><div class="gt">${g.title}</div><div class="gd">${g.desc}</div>`;
    grid.appendChild(a);
  }
  showModal('zoneModal');
}

/** Non-game things to do. Small, cheap and worth walking to. */
function runActivity(zone) {
  const p = state.player;
  if (zone.id === 'coinride') {
    if (state.coins < 5) return toast('Coin rides cost 5 coins — go find some!');
    state.progress?.activity('coinride');
    awardCoins(-5, true);
    p.playEmote('cheer');
    state.presence?.broadcast({ emote: 'cheer' });
    setTimeout(() => {
      const won = Math.random() < 0.35 ? 15 : 0;
      if (won) { sfx('win'); awardCoins(won); toast(`The ride paid out ${won} coins!`, 'gold'); }
      else toast('What a ride!');
    }, 1400);
  } else if (zone.id === 'pond') {
    p.playEmote('laugh');
    state.presence?.broadcast({ emote: 'laugh' });
    toast('The ducks seem happy 🦆');
  } else if (zone.id === 'bikerack') {
    p.playEmote('yes');
    state.presence?.broadcast({ emote: 'yes' });
    toast('Ring ring! 🔔');
  }
}

function tapToMove(sx, sy) {
  const world = state.world;
  const ndc = new THREE.Vector2(
    (sx / window.innerWidth) * 2 - 1,
    -(sy / window.innerHeight) * 2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, world.camera);
  // Intersect the ground plane at the player's current height — good enough for
  // a flat park and far cheaper than raycasting 300k triangles.
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -state.player.pos.y);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, hit)) {
    const c = world.collision.clampToBounds(hit.x, hit.z, 1.2);
    state.input.moveTarget = { x: c.x, z: c.z };
  }
}

// ---------------------------------------------------------------------------
// remote players
// ---------------------------------------------------------------------------
async function addRemote(id, packet) {
  if (state.remotes.has(id)) return updateRemote(id, packet);
  const model = state.manifest.find((m) => m.id === packet.c) || state.manifest[0];
  const proto = await preloadCharacter(model.id, '../' + model.glb);
  if (state.remotes.has(id)) return;   // raced with another packet
  const avatar = new Avatar(proto, { name: safeName(packet.n) });
  avatar.pos.set(packet.x, packet.y, packet.z);
  avatar.netPos.copy(avatar.pos);
  avatar.yaw = avatar.netYaw = packet.r || 0;
  state.world.scene.add(avatar.group);
  state.remotes.set(id, { avatar, charId: packet.c, lastEmote: null, lastMsg: null });
  toast(`${safeName(packet.n)} joined the park`);
  updateOnlineCount();
  updateRemote(id, packet);
}

function updateRemote(id, packet) {
  const r = state.remotes.get(id);
  if (!r) return addRemote(id, packet);
  r.avatar.setNetworkTarget(packet.x, packet.y, packet.z, packet.r || 0, packet.s || 0);
  r.avatar.setName(safeName(packet.n));
  // emotes and phrases arrive as fire-once fields; de-dupe on the packet stamp
  if (packet.e && packet.e !== r.lastEmote + '@' + packet.t) {
    r.lastEmote = packet.e + '@' + packet.t;
    r.avatar.playEmote(packet.e);
  }
  const key = packet.m + '@' + packet.t;
  if (packet.m != null && key !== r.lastMsg) {
    r.lastMsg = key;
    const text = renderPhrase(packet.m);
    if (text) r.avatar.say(text);
  }
}

function removeRemote(id) {
  const r = state.remotes.get(id);
  if (!r) return;
  r.avatar.dispose();
  state.remotes.delete(id);
  updateOnlineCount();
}

function updateOnlineCount() {
  $('onlineCount').textContent = String(state.remotes.size + 1);
}

// ---------------------------------------------------------------------------
// coins
// ---------------------------------------------------------------------------
async function loadCoins() {
  try {
    if (window.odaShop) {
      const data = await window.odaShop.loadShopData();
      state.coins = data.coins || 0;
    }
  } catch (e) { /* offline / guest — the world still works */ }
  $('coinCount').textContent = String(state.coins);
}

let pendingCoins = 0, flushTimer = 0;
function awardCoins(n, silent) {
  state.coins = Math.max(0, state.coins + n);
  $('coinCount').textContent = String(state.coins);
  if (n > 0 && !silent) toast(`+${n} coin${n > 1 ? 's' : ''}`, 'gold');
  pendingCoins += n;
  // Batch the write: a kid running a coin lap would otherwise fire a Firestore
  // update per coin.
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushCoins, 2500);
}

/**
 * Coin combo. Coins are still worth 1 each — the economy stays honest — but
 * grabbing them in quick succession builds a streak with rising pitch and a
 * growing on-screen counter, and hitting a milestone (every 5) drops a small
 * bonus. Pure juice on the world's most common action, with a bounded payout so
 * it can't be farmed (30 coins per lap, 90s respawn).
 */
let comboCount = 0, comboExpire = 0;
const COMBO_WINDOW = 2800;
function coinCombo(n) {
  const now = performance.now();
  comboCount = now < comboExpire ? comboCount + n : n;
  comboExpire = now + COMBO_WINDOW;

  awardCoins(n, true);                 // base coins, silent (the combo IS the feedback)
  state.progress?.addCoins(n);

  // rising pitch with the streak, capped so it never gets shrill
  const step = Math.min(comboCount, 12);
  window.odaSfx && window.odaSfx.tone(880 + step * 70, 0.09, 'square', 0.11);
  if (comboCount >= 2) window.odaSfx && window.odaSfx.tone(1180 + step * 90, 0.08, 'square', 0.08, 0.05);

  showCombo(comboCount);

  // milestone bonus + celebration
  if (comboCount % 5 === 0) {
    const bonus = Math.min(2 + (comboCount / 5 - 1) * 3, 12);
    awardCoins(bonus, false);          // this one toasts "+N coins"
    window.odaSfx && window.odaSfx.play('combo');
    if (comboCount >= 10 && window.odaCelebrate) window.odaCelebrate('confetti');
  }
}

let comboEl = null, comboHideT = 0;
function showCombo(count) {
  if (!comboEl) {
    comboEl = document.createElement('div');
    comboEl.className = 'coin-combo';
    $('hud').appendChild(comboEl);
  }
  comboEl.textContent = count > 1 ? `\u{1FA99} x${count}` : '\u{1FA99}';
  if (window.amgEmojiParse) window.amgEmojiParse(comboEl);
  // retrigger the pop animation
  comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
  comboEl.style.setProperty('--combo-scale', String(1 + Math.min(count, 12) * 0.06));
  clearTimeout(comboHideT);
  comboHideT = setTimeout(() => { comboEl && comboEl.classList.remove('pop', 'show'); }, COMBO_WINDOW);
  comboEl.classList.add('show');
}


async function flushCoins() {
  const delta = pendingCoins;
  pendingCoins = 0;
  if (!delta) return;
  const sid = localStorage.getItem('studentId');
  if (!sid || sid.startsWith('anon_') || !window.getFirebaseDB) return;
  try {
    const fb = await window.getFirebaseDB();
    await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'students', sid), {
      coins: fb.fsMod.increment(delta),
    });
    window.odaShop?.invalidate?.();
  } catch (e) {
    console.warn('[world] coin sync failed, will retry next batch', e);
    pendingCoins += delta;
  }
}

// ---------------------------------------------------------------------------
// HUD wiring
// ---------------------------------------------------------------------------
/**
 * The emote wheel. With 58 clips across 6 categories a flat grid stops working,
 * so this is tabbed — and each tab's binary is only fetched when it's first
 * opened, which is the whole reason the bake is split per category.
 *
 * The first row is FAVOURITES: whatever this player uses most, kept in
 * localStorage. Digit keys 1-8 always map to that row, so muscle memory works
 * without opening the wheel at all.
 */
const FAV_KEY = 'amgWorldEmoteFavs';
let emoteLib = null;
let emoteFavs = [];

function loadFavs() {
  try { emoteFavs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
  catch (e) { emoteFavs = []; }
  if (!Array.isArray(emoteFavs) || !emoteFavs.length) {
    emoteFavs = ['wave', 'cheer', 'dab', 'thumbsup', 'clap', 'shrug', 'twist', 'heart'];
  }
}

function noteFav(id) {
  emoteFavs = [id, ...emoteFavs.filter((x) => x !== id)].slice(0, 8);
  try { localStorage.setItem(FAV_KEY, JSON.stringify(emoteFavs)); } catch (e) {}
}

async function buildEmoteWheel() {
  loadFavs();
  emoteLib = await getEmoteLibrary();
  const wheel = $('emoteWheel');
  wheel.innerHTML = '';

  if (!emoteLib) {
    // procedural fallback — the small hand-written set
    wheel.classList.add('wheel-grid');
    EMOTE_IDS.forEach((id, i) => wheel.appendChild(emoteButton(id, EMOTES[id], i)));
    return;
  }

  // Favourites are the most-used clips, so fetch that binary up front.
  emoteLib.preload(emoteFavs);

  const tabs = document.createElement('div');
  tabs.className = 'emote-tabs';
  const grid = document.createElement('div');
  grid.className = 'emote-grid';
  wheel.append(tabs, grid);

  const cats = [{ id: '_favs', label: 'Faves', icon: '⭐' }, ...emoteLib.categories];
  const showCat = (cat) => {
    [...tabs.children].forEach((t) => t.classList.toggle('sel', t.dataset.cat === cat.id));
    grid.innerHTML = '';
    if (cat.id === '_favs') {
      emoteFavs.forEach((id, i) => {
        const info = emoteLib.info(id);
        if (info) grid.appendChild(emoteButton(id, info, i));
      });
    } else {
      // Opening a tab is what triggers its download.
      emoteLib.loadCategory(cat.id).catch(() => {});
      cat.emotes.forEach((e) => grid.appendChild(emoteButton(e.id, e)));
    }
  };

  for (const cat of cats) {
    const t = document.createElement('button');
    t.className = 'emote-tab';
    t.dataset.cat = cat.id;
    t.innerHTML = `<span>${cat.icon}</span>${cat.label}`;
    t.onclick = () => showCat(cat);
    tabs.appendChild(t);
  }
  showCat(cats[0]);
}

function emoteButton(id, info, favIndex) {
  const b = document.createElement('button');
  b.innerHTML = `<span>${info.icon}</span>${info.label}`;
  b.title = favIndex != null ? `${info.label} (${favIndex + 1})` : info.label;
  b.onclick = () => { doEmote(id); $('emoteWheel').classList.add('hidden'); };
  return b;
}

function doEmote(id) {
  sfx('select');
  state.progress?.usedEmote(id);
  state.player.playEmote(id);
  noteFav(id);
  state.presence?.broadcast({ emote: id });
}

function buildChatPanel() {
  const panel = $('chatWheel');
  panel.innerHTML = '';
  for (const g of PHRASE_GROUPS) {
    const h = document.createElement('div');
    h.className = 'chat-group-name';
    h.textContent = g.name;
    panel.appendChild(h);
    const row = document.createElement('div');
    row.className = 'chat-phrases';
    for (let i = g.start; i < g.end; i++) {
      const b = document.createElement('button');
      b.textContent = PHRASES[i];
      b.onclick = () => { say(i); panel.classList.add('hidden'); };
      row.appendChild(b);
    }
    panel.appendChild(row);
  }
}

function say(index) {
  const text = renderPhrase(index);
  if (!text) return;
  sfx('click');
  state.player.say(text);
  state.presence?.broadcast({ message: index });
}

function bindHud() {
  const toggle = (el, others = []) => {
    others.forEach((o) => $(o).classList.add('hidden'));
    $(el).classList.toggle('hidden');
  };
  $('emoteBtn').onclick = () => toggle('emoteWheel', ['chatWheel']);
  $('chatBtn').onclick = () => toggle('chatWheel', ['emoteWheel']);
  $('jumpBtn').onclick = () => { state.input.jumpQueued = true; };
  $('mapBtn').onclick = () => $('minimap').classList.toggle('hidden');
  const soundBtn = $('soundBtn');
  const syncSoundIcon = () => {
    const on = window.odaSfx ? window.odaSfx.isEnabled() : localStorage.getItem('odaSoundEnabled') !== 'false';
    soundBtn.textContent = on ? '\u{1F50A}' : '\u{1F507}';
    if (window.amgEmojiParse) window.amgEmojiParse(soundBtn);
  };
  soundBtn.onclick = () => {
    let on;
    if (window.odaSfx) { on = window.odaSfx.toggle(); }
    else {
      on = localStorage.getItem('odaSoundEnabled') === 'false';
      localStorage.setItem('odaSoundEnabled', on ? 'true' : 'false');
    }
    state.ambience?.setEnabled(on);
    syncSoundIcon();
    if (on) sfx('click');
  };
  syncSoundIcon();
  $('helpBtn').onclick = () => { showModal('helpModal'); renderBadges(); };
  $('helpClose').onclick = () => hideModal('helpModal');
  $('zoneClose').onclick = () => hideModal('zoneModal');
  $('zoneModal').onclick = (e) => { if (e.target.id === 'zoneModal') hideModal('zoneModal'); };
  $('helpModal').onclick = (e) => { if (e.target.id === 'helpModal') hideModal('helpModal'); };

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const k = e.code;
    if (k === 'KeyE') enterZone();
    else if (k === 'KeyQ') toggle('emoteWheel', ['chatWheel']);
    else if (k === 'KeyC') toggle('chatWheel', ['emoteWheel']);
    else if (k === 'KeyM') $('minimap').classList.toggle('hidden');
    else if (k === 'KeyH') showModal('helpModal');
    else if (k === 'Escape') { hideModal('zoneModal'); hideModal('helpModal'); $('emoteWheel').classList.add('hidden'); $('chatWheel').classList.add('hidden'); }
    else if (/^Digit[1-8]$/.test(k)) {
      // 1-8 always hit the favourites row, so muscle memory works without
      // opening the wheel.
      const id = (emoteLib ? emoteFavs : EMOTE_IDS)[+k.slice(5) - 1];
      if (id) doEmote(id);
    }
  });

  // Walking into a zone on touch should be enough — no keyboard needed.
  $('zonePrompt').onclick = () => enterZone();
}

function showModal(id) { $(id).classList.remove('hidden'); state.paused = true; }

function renderBadges() {
  if (!state.progress) return;
  state.progress.renderGrid('achGrid');
  const pr = state.progress.progress();
  const el = $('achProgress');
  if (el) el.textContent = pr.unlocked + '/' + pr.total;
}
function hideModal(id) {
  $(id).classList.add('hidden');
  state.paused = !$('zoneModal').classList.contains('hidden')
    || !$('helpModal').classList.contains('hidden');
}

function toast(msg, kind = '') {
  const rail = $('toastRail');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  rail.appendChild(el);
  setTimeout(() => el.classList.add('fade'), 2200);
  setTimeout(() => el.remove(), 2700);
  while (rail.children.length > 4) rail.firstChild.remove();
}

// ---------------------------------------------------------------------------
// minimap
// ---------------------------------------------------------------------------
let miniCtx = null;
function drawMinimap() {
  const wrap = $('minimap');
  if (wrap.classList.contains('hidden')) return;
  const cv = $('minimapCanvas');
  miniCtx = miniCtx || cv.getContext('2d');
  const ctx = miniCtx;
  const S = cv.width;
  const b = state.world.collision.bounds;
  const spanX = b.maxX - b.minX, spanZ = b.maxZ - b.minZ;
  const span = Math.max(spanX, spanZ);
  const map = (x, z) => [((x - b.minX) / span) * S, ((z - b.minZ) / span) * S];

  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(60,120,70,0.35)';
  ctx.fillRect(0, 0, S, S);

  for (const z of ZONES) {
    const [x, y] = map(z.pos[0], z.pos[1]);
    ctx.fillStyle = '#' + z.color.toString(16).padStart(6, '0');
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#7dd3fc';
  for (const r of state.remotes.values()) {
    const [x, y] = map(r.avatar.pos.x, r.avatar.pos.z);
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  const [px, py] = map(state.player.pos.x, state.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-state.player.yaw);
  ctx.fillStyle = '#1fe6a8';
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

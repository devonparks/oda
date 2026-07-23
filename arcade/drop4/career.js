/**
 * Drop4 Hub — Career mode (the retention engine).
 *
 * 180 levels across 15 cities (ported data in career-data.js). Renders a
 * scrolling Candy-Crush-style level path, persists stars/completion, unlocks
 * power pieces on boss clears and CHARACTERS on city clears (Drop4's "beat the
 * species boss → become it" reworked: species → Polygon Kid). Builds each
 * level's match config from its (already sim-tuned) settings and hands it to
 * the shell's startMatch. All coin rewards are single-coin (gems already
 * stripped in career-data.js).
 */

import { ALL_CAREER_LEVELS, CAREER_CITIES, getChallengeTypeLabel } from './career-data.js';
import { PRICING } from './characters.js';

const LEVEL_BY_ID = {};
ALL_CAREER_LEVELS.forEach((l) => { LEVEL_BY_ID[l.id] = l; });

// Boss level → power piece it unlocks (Brooklyn/Venice/Harlem bosses).
const POWER_UNLOCKS = { 12: 'bomb', 24: 'rainbow', 36: 'heavy' };

// Completing a city (its 12th/boss level) unlocks a character — the Hub-legal
// re-skin of Drop4's "become the species you beat." Spreads the coin-priced
// Polygon Kids across career progress so the campaign hands out characters.
const CITY_CHARACTER_UNLOCK = {
  1: 'kid_ninja', 2: 'kid_cardboard', 3: 'kid_ghost', 4: 'kid_explorer',
  5: 'kid_ballerina', 6: 'kid_princess', 7: 'kid_superhero', 8: 'kid_superhero2',
  9: 'kid_witch', 10: 'kid_wizard',
  // cities 11-15 have no new character (all 10 paid kids handed out by city 10) → coin bonus instead
};

// Per-city board theme (visual identity for the match backdrop).
const CITY_THEME = ['default', 'sunset', 'royal', 'forest', 'inferno', 'aurora', 'steel', 'candy', 'void', 'midnight', 'gold', 'darkmatter', 'ocean', 'ice', 'crown_court'];

// ── progress persistence (localStorage + best-effort Firestore mirror) ──
let ctx = null; // { startMatch, GAME_ID, db, studentId, isGuest }
const PKEY = 'd4_career_progress';
let progress = {};
function loadProgress() { try { progress = JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch (e) { progress = {}; } }
function saveProgress() {
  try { localStorage.setItem(PKEY, JSON.stringify(progress)); } catch (e) {}
  if (ctx && !ctx.isGuest && window.getFirebaseDB) {
    window.getFirebaseDB().then((fb) => fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'students', ctx.studentId), { careerProgress: progress })).catch(() => {});
  }
}
const completed = (id) => !!(progress[id] && progress[id].completed);
const isUnlocked = (id) => id === 1 || completed(id - 1);
function powerState() { return { bomb: completed(12), rainbow: completed(24), heavy: completed(36) }; }

// ── intro card (deriveIntroFromParams) ──
function deriveIntro(level) {
  const s = level.settings || {};
  if (s.bossScript === 'tommy') return { label: "TOMMY'S RULE", rule: 'Even cols on even turns. Odd on odd.' };
  if (s.bossScript === 'sal') return { label: "SAL'S GRAVITY", rule: 'Gravity flips every 4 moves. Read twice.' };
  if (s.bossScript === 'warden') return { label: 'THE WARDEN', rule: '4-piece threat. Block fast. Survive.' };
  if ((s.rewardMultiplier || 1) >= 2) return { label: 'JEOPARDY · ' + s.rewardMultiplier + '× COINS', rule: 'High risk, high reward.' };
  if (s.movesLimit) return { label: 'WIN IN ' + s.movesLimit + ' MOVES', rule: 'Beat the clock of moves.' };
  if (s.obstacleCells && s.obstacleCells.length) return { label: s.obstacleCells.length + ' OBSTACLES', rule: 'Concrete blocks in your way.' };
  if (level.type === 'speed' && s.timerSeconds) return { label: 'SPEED · ' + s.timerSeconds + 's/move', rule: 'Think fast!' };
  if (level.type === 'connect5') return { label: 'CONNECT 5', rule: 'Five in a row to win.' };
  if (level.type === 'connect6') return { label: 'CONNECT 6', rule: 'Six in a row. Big board.' };
  if (level.type === 'connect3') return { label: 'CONNECT 3', rule: 'Three in a row — fast!' };
  if (level.type === 'go_second') return { label: 'GO SECOND', rule: 'The computer moves first.' };
  if (level.isBoss) return { label: 'BOSS BATTLE', rule: level.opponent + ' — beat them to advance!' };
  return null;
}

// ── build match config from a level ──
function levelToMatchOpts(level) {
  const s = level.settings || {};
  const cityIndex = level.chapter - 1;
  return {
    rows: s.rows || 6, cols: s.cols || 7, connectCount: s.connectCount || 4,
    difficulty: level.difficulty, mercyBoost: !!s.mercyBoost,
    timerSeconds: s.timerSeconds || 0, playerGoesFirst: s.playerGoesFirst !== false,
    bossScript: s.bossScript || null, obstacleCells: s.obstacleCells || null,
    presetBoard: s.presetBoard || null, movesLimit: s.movesLimit || null,
    rewardMultiplier: s.rewardMultiplier || 1, starThresholds: level.starThresholds || null,
    theme: CITY_THEME[cityIndex] || 'default', opponentName: level.opponent,
    powerPieces: powerState(), intro: deriveIntro(level),
  };
}

function playLevel(level) {
  if (!level || !isUnlocked(level.id)) return;
  ctx.startMatch(levelToMatchOpts(level), level);
}

// ── completion + rewards (called by the shell on a terminal result) ──
async function completeLevel(level, result) {
  if (result.result !== 'win') return 0;
  const id = level.id;
  const prev = progress[id] || { stars: 0, bestMoves: Infinity, completed: false };
  const stars = Math.max(prev.stars, result.stars || 1);
  progress[id] = { completed: true, stars, bestMoves: Math.min(prev.bestMoves, result.moveCount) };
  saveProgress();

  if (window.odaAchievements) {
    const cleared = Object.values(progress).filter((p) => p.completed).length;
    window.odaAchievements.check('career_10', cleared >= 10);
    window.odaAchievements.check('career_50', cleared >= 50);
    if (level.settings && level.settings.bossScript === 'tommy') window.odaAchievements.unlock('boss_tommy');
    if (POWER_UNLOCKS[id]) window.odaAchievements.unlock('power_' + POWER_UNLOCKS[id]);
  }

  let bonusCoins = 0;
  // primary coin reward from the level (coins only; gems already stripped)
  if (level.reward && level.reward.type === 'coins' && level.reward.amount) bonusCoins += level.reward.amount;
  if (level.bonusReward && level.bonusReward.type === 'coins' && level.bonusReward.amount) bonusCoins += level.bonusReward.amount;

  // power piece unlock (boss clear)
  if (POWER_UNLOCKS[id]) {
    const pp = POWER_UNLOCKS[id];
    try { window.odaToast && window.odaToast('⚡ Power piece unlocked: ' + pp.toUpperCase() + '!', 'success'); } catch (e) {}
  }
  // city-complete character unlock (boss level = last in city)
  if (level.isBoss) {
    const charId = CITY_CHARACTER_UNLOCK[level.chapter];
    if (charId && ctx && !ctx.isGuest && window.getFirebaseDB) {
      try {
        const fb = await window.getFirebaseDB();
        await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'students', ctx.studentId), { inventory: fb.fsMod.arrayUnion('char_' + charId) });
        window.odaToast && window.odaToast('🎉 New character unlocked!', 'success');
        window.odaCelebrate && window.odaCelebrate('fireworks');
      } catch (e) {}
    } else if (!charId) {
      bonusCoins += 500; // late-city bosses (no new character) → coin bonus instead
    }
  }
  return bonusCoins;
}

function nextLevel(level) { const n = LEVEL_BY_ID[level.id + 1]; return n && isUnlocked(n.id) ? n : (LEVEL_BY_ID[level.id + 1] || null); }

// ── the map UI ──
function render(container) {
  const totalStars = Object.values(progress).reduce((a, p) => a + (p.stars || 0), 0);
  const cleared = Object.values(progress).filter((p) => p.completed).length;
  let html = `<div style="text-align:center;margin-bottom:14px;color:var(--text2)">⭐ ${totalStars} stars · ${cleared}/180 levels</div><div class="career-scroll">`;
  CAREER_CITIES.forEach((city, ci) => {
    const theme = CITY_THEME[ci] || 'default';
    const cityUnlocked = city.levelIds.some((id) => isUnlocked(id));
    html += `<div class="career-city ${cityUnlocked ? '' : 'locked'}" style="--city:${city.themeColor || '#3fa0ff'}">
      <div class="cc-head"><div><span class="cc-name">${esc(city.name)}</span> <span class="cc-nick">${esc(city.nickname)}</span></div><div class="cc-world">${esc(city.state)}</div></div>
      <div class="cc-nodes">`;
    city.levelIds.forEach((id) => {
      const lv = LEVEL_BY_ID[id]; if (!lv) return;
      const p = progress[id]; const done = p && p.completed; const unlocked = isUnlocked(id);
      const boss = lv.isBoss;
      const stars = done ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : '';
      const cls = 'cc-node' + (boss ? ' boss' : '') + (done ? ' done' : '') + (!unlocked ? ' locked' : '') + (unlocked && !done ? ' next' : '');
      html += `<button class="${cls}" data-id="${id}" title="${esc(lv.name)} — ${getChallengeTypeLabel(lv.type)}">
        <span class="cc-num">${boss ? '👑' : (id)}</span><span class="cc-stars">${stars || (unlocked ? '' : '🔒')}</span></button>`;
    });
    html += `</div></div>`;
  });
  html += '</div>';
  container.innerHTML = html;
  container.querySelectorAll('.cc-node').forEach((b) => {
    const id = +b.dataset.id;
    if (isUnlocked(id)) b.onclick = () => playLevel(LEVEL_BY_ID[id]);
  });
  injectStyles();
  // scroll to the first unplayed level
  const next = container.querySelector('.cc-node.next');
  if (next) next.scrollIntoView({ block: 'center' });
}

function injectStyles() {
  if (document.getElementById('d4CareerStyles')) return;
  const s = document.createElement('style'); s.id = 'd4CareerStyles';
  s.textContent = `
  .career-scroll{max-height:66vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:4px}
  .career-city{background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--city);border-radius:16px;padding:14px}
  .career-city.locked{opacity:.55}
  .cc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .cc-name{font-family:'Fredoka';font-size:17px;font-weight:700}
  .cc-nick{font-size:12px;color:var(--text3)}
  .cc-world{font-size:11px;color:var(--city);font-weight:700;text-transform:uppercase;letter-spacing:1px}
  .cc-nodes{display:flex;flex-wrap:wrap;gap:8px}
  .cc-node{width:52px;height:52px;border-radius:14px;background:var(--surface2);border:2px solid var(--border);color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;transition:all .15s;font-family:'Fredoka'}
  .cc-node:hover{transform:translateY(-2px)}
  .cc-node .cc-num{font-size:16px;font-weight:700}
  .cc-node .cc-stars{font-size:8px;color:var(--gold);line-height:1}
  .cc-node.done{border-color:var(--accent);background:rgba(31,230,168,.12)}
  .cc-node.next{border-color:var(--accent2);box-shadow:0 0 14px rgba(63,160,255,.35)}
  .cc-node.boss{width:60px;height:60px;background:rgba(255,202,69,.12);border-color:var(--gold)}
  .cc-node.locked{opacity:.4;cursor:default}
  `;
  document.head.appendChild(s);
}

// ── public ──
export function mountCareer(container, context) {
  ctx = context;
  loadProgress();
  render(container);
  // expose callbacks the shell uses on result
  window.__careerComplete = completeLevel;
  window.__careerNext = nextLevel;
  window.__careerPlay = playLevel;
}

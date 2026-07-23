/**
 * career-data.js — AMG Hub Drop4 career mode data (ports Drop4's recipe DSL →
 * generator → tuning → public API into one framework-free ES module).
 *
 * Ported verbatim (value-for-value, logic-for-logic) from four Drop4 source
 * files, READ-ONLY reference at C:/Users/devon/OneDrive/Desktop/Drop4/src/data/:
 *   - careerLevels.ts     (type defs + public API + ratings/lookups)
 *   - careerRecipes.ts    (recipe DSL + all 15 city recipes)
 *   - careerGenerator.ts  (pure recipe → CareerLevel/CareerCity emitter)
 *   - careerTuning.ts     (sim-derived difficulty override table)
 *
 * TypeScript → JS transforms:
 *   - All `interface` / `type` declarations are dropped; shapes are documented
 *     in comments below instead. No runtime behavior depends on them.
 *   - The only external dependency in the TS originals was the `Difficulty`
 *     string union (`'easy' | 'medium' | 'hard' | 'legendary'`), imported from
 *     Drop4's gameStore. That's a plain string here — no import needed.
 *
 * AMG Hub economy remap (single COIN economy, NO gems):
 *   - `defaultBonusRewardFor` always returns undefined (no more `type:'gems'`
 *     bonusReward is ever emitted from REWARD_BY_TYPE's old `bonus` key).
 *   - `bonus` keys removed entirely from REWARD_BY_TYPE.
 *   - The ~14 recipe reward `name` strings that displayed " + N Gem(s)" as
 *     flavor text (ids 8, 9, 13, 14, 15, 20, 22, 23, 26, 27, 28, 31, 32, 33)
 *     have that substring stripped. Those rewards were always `type:'coins'`
 *     or `type:'pieces'` — the gem text was cosmetic label only, never a real
 *     grant — so `amount`/`id`/`icon` are unchanged.
 *   - Everything else (coins, board/pieces/title rewards, boss scripts,
 *     presetBoards, obstacleCells, movesLimit, connectCount, timerSeconds,
 *     playerGoesFirst, starThresholds, CAREER_TUNE, mercyBoost) is preserved
 *     exactly.
 *
 * Board orientation: presetBoard is authored ROW-major in the recipes below
 * (top row first, human-readable) and transposed to COLUMN-major [col][row]
 * by `normalizeSettings`, exactly once, exactly like Drop4 — this new engine
 * (see engine.js) is COLUMN-major too, so the transpose is kept.
 *
 * Species/world unlocks: `city.state` ("Human World" / "Elf World" / ... )
 * is carried verbatim, unchanged, for a later ceremony to map onto character
 * unlocks. Do not alter these strings here.
 *
 * Pure module: no React, no Zustand, no AsyncStorage, no imports from Drop4.
 */

// ─── Shapes (documentation only — JS has no static types) ───────────────
//
// Difficulty = 'easy' | 'medium' | 'hard' | 'legendary'
//
// CareerReward = {
//   type: 'coins' | 'gems' | 'board' | 'pieces' | 'emote' | 'title' | 'box',
//   id?: string, boxId?: string, name: string, amount?: number, icon: string,
// }
//
// CareerLevel = {
//   id: number, name: string, opponent: string, opponentPersonality: string,
//   chapter: number, type: CareerChallengeType, difficulty: Difficulty,
//   isBoss: boolean, reward?: CareerReward, bonusReward?: CareerReward,
//   settings: {
//     rows?, cols?, connectCount?, timerSeconds?, playerGoesFirst?,
//     presetBoard?: (0|1|2)[][] (COLUMN-major [col][row] post-generator),
//     movesLimit?, rewardMultiplier?, obstacleCells?: {row,col}[],
//     bossScript?: 'tommy'|'sal'|'warden', mercyBoost?: boolean,
//   },
//   starThresholds?: { three: number, two: number },
// }
//
// CareerCity = {
//   id: string, name: string, nickname: string, state: string, tagline: string,
//   unlockedAfterCityId?: string, comingSoon?: boolean,
//   themeColor: string, accentColor: string, skyGradient: [string,string,string],
//   mapPosition: { xPct: number, yPct: number }, levelIds: number[],
// }

// ═══════════════════════════════════════════════════════════════════════
// §1 — challenge type label helper (from careerLevels.ts)
// ═══════════════════════════════════════════════════════════════════════

export function getChallengeTypeLabel(type) {
  switch (type) {
    case 'standard': return 'Standard 6x7';
    case 'connect3': return 'Connect 3';
    case 'connect5': return 'Connect 5';
    case 'connect6': return 'Connect 6';
    case 'timed': return 'Timed';
    case 'go_second': return 'Go Second';
    case 'puzzle': return 'Puzzle';
    case 'boss': return 'Boss Battle';
    case 'speed': return 'Speed';
    case 'jeopardy': return 'Jeopardy';
    case 'obstacle': return 'Obstacle';
    case 'moves_limit': return 'Moves Limit';
    default: return 'Standard';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// §2 — reward defaults (from careerRecipes.ts, GEM-SCRUBBED)
// ═══════════════════════════════════════════════════════════════════════
// Original Drop4 table carried a `bonus: { type: 'gems', amount }` key on
// several type/difficulty pairs (speed, moves_limit, puzzle, jeopardy,
// connect5, connect6). AMG Hub has one coin economy — those `bonus` keys
// are removed entirely. `defaultBonusRewardFor` below always returns
// undefined as a result.

const REWARD_BY_TYPE = {
  standard: {
    easy:   { coins: 100, icon: '🪙' },
    medium: { coins: 250, icon: '🪙' },
    hard:   { coins: 600, icon: '🪙' },
  },
  timed: {
    easy:   { coins: 100, icon: '⏱️' },
    medium: { coins: 300, icon: '⏱️' },
    hard:   { coins: 700, icon: '⏱️' },
  },
  speed: {
    easy:   { coins: 150, icon: '⚡' },
    medium: { coins: 400, icon: '⚡' },
    hard:   { coins: 800, icon: '⚡' },
  },
  obstacle: {
    easy:   { coins: 150, icon: '🧱' },
    medium: { coins: 350, icon: '🧱' },
    hard:   { coins: 800, icon: '🧱' },
  },
  moves_limit: {
    easy:   { coins: 200, icon: '🎯' },
    medium: { coins: 450, icon: '🎯' },
    hard:   { coins: 1000, icon: '🎯' },
  },
  puzzle: {
    easy:   { coins: 200, icon: '🧩' },
    medium: { coins: 450, icon: '🧩' },
    hard:   { coins: 950, icon: '🧩' },
  },
  jeopardy: {
    easy:      { coins: 300, icon: '💰' },
    medium:    { coins: 750, icon: '💰' },
    hard:      { coins: 1500, icon: '💰' },
    legendary: { coins: 2500, icon: '💰' },
  },
  go_second: {
    easy:   { coins: 120, icon: '↩' },
    medium: { coins: 300, icon: '↩' },
    hard:   { coins: 700, icon: '↩' },
  },
  connect3: {
    easy:   { coins: 100, icon: '3️⃣' },
    medium: { coins: 250, icon: '3️⃣' },
    hard:   { coins: 600, icon: '3️⃣' },
  },
  connect5: {
    easy:   { coins: 200, icon: '5️⃣' },
    medium: { coins: 500, icon: '5️⃣' },
    hard:   { coins: 1000, icon: '5️⃣' },
  },
  connect6: {
    easy:   { coins: 250, icon: '6️⃣' },
    medium: { coins: 600, icon: '6️⃣' },
    hard:   { coins: 1200, icon: '6️⃣' },
  },
  // boss has bespoke rewards (legendary skins) so it's not in this
  // defaults table — boss recipes always explicitly set their own reward.
};

/** Build a CareerReward from the (difficulty, type) defaults. Used by the
 *  generator when a recipe omits its `reward` field. */
export function defaultRewardFor(type, difficulty) {
  const def = REWARD_BY_TYPE[type]?.[difficulty];
  if (!def) {
    // Bosses + anything not in the table — fall back to a flat coin
    // payout. Boss recipes always set their own reward explicitly.
    const coins = difficulty === 'easy' ? 200 : difficulty === 'medium' ? 500 : 1000;
    return { type: 'coins', name: `${coins} Coins`, amount: coins, icon: '🪙' };
  }
  return {
    type: 'coins',
    name: `${def.coins} Coins`,
    amount: def.coins,
    icon: def.icon,
  };
}

/** AMG Hub remap: no gem economy, so there is never a bonus reward to
 *  auto-generate. Recipes that need a bespoke bonusReward (boss skin/title
 *  drops) set `bonusReward` explicitly, which always wins over this
 *  default anyway (see buildLevel). */
export function defaultBonusRewardFor(_type, _difficulty) {
  return undefined;
}

// ─── Default star thresholds per type ─────────────────────────────────

const STAR_DEFAULTS = {
  standard:    { three: 8, two: 14 },
  timed:       { three: 9, two: 15 },
  speed:       { three: 7, two: 12 },
  obstacle:    { three: 9, two: 14 },
  moves_limit: { three: 5, two: 8 },
  puzzle:      { three: 5, two: 8 },
  jeopardy:    { three: 10, two: 16 },
  go_second:   { three: 9, two: 15 },
  connect3:    { three: 5, two: 8 },
  connect5:    { three: 10, two: 16 },
  connect6:    { three: 12, two: 20 },
  boss:        { three: 10, two: 16 },
};

/** Star thresholds for a level type. Falls back to standard if the type
 *  isn't in the defaults map. If the level has its own movesLimit, both
 *  thresholds are clamped to it. */
export function defaultStarsFor(type, movesLimit) {
  const base = STAR_DEFAULTS[type] ?? STAR_DEFAULTS.standard;
  if (movesLimit == null) return base;
  return {
    three: Math.min(base.three, movesLimit),
    two: Math.min(base.two, movesLimit),
  };
}

// ─── Default name + personality templates ─────────────────────────────

const NAME_TEMPLATES = {
  standard:    ['Standard Match', 'Open Court', 'Center Control', 'Mid-Game', 'Free Form'],
  timed:       ['Quick Thinking', 'Beat the Clock', 'Tick Tock', 'Pressure Drop', 'Time Crunch'],
  speed:       ['Speed Demon', 'Blink and Lose', 'Quickdraw', 'Sudden Death', 'Lightning Round'],
  obstacle:    ['Roadblock', 'The Wall', 'Maze Walls', 'Asteroid Field', 'Hard Lines'],
  moves_limit: ['Six-Move Win', 'Move Smart', 'Five and Done', 'Limited Drops', 'Twenty Moves'],
  puzzle:      ['Puzzle Start', 'Pre-Set Chaos', 'The Maze', 'Brain Teaser', 'Solve It'],
  jeopardy:    ['Double Jeopardy', 'High Stakes', 'Triple Bag', 'All In', 'Final Jeopardy'],
  go_second:   ['The Comeback', 'Going Second', 'Catch-Up', 'Underdog', 'Late Bloomer'],
  connect3:    ['Mini Match', 'Tiny Terror', 'Drop3', 'Three Wins', 'Small Stakes'],
  connect5:    ['Drop5', 'Stretch It', 'Five in a Row', "Veteran's Test", 'Long Game'],
  connect6:    ['Drop6', 'Wide Open', 'Marathon', 'Big Numbers', 'Six-Pack'],
};

const PERSONALITY_TEMPLATES = {
  standard:    ['Classic match. Show what you got.', 'Plays straight. No tricks.', 'A clean game. Earn it.'],
  timed:       ['Plays fast. Think faster.', 'Thinks on the move.', 'Tick tock — clock is on you.'],
  speed:       ['Blink and you lose.', "Doesn't wait around.", 'Lightning fingers.'],
  obstacle:    ['Set up roadblocks. Work around them.', 'Loves a maze. Find the line.', 'The board is half closed.'],
  moves_limit: ["Counts every drop. So should you.", "No wasted moves here.", 'Win clean or go home.'],
  puzzle:      ['Already mid-fight. Read the board.', 'Position is everything.', 'Solve the start, win the end.'],
  jeopardy:    ['Triple coin payout. All on the line.', 'High roller. Bring it.', "Big stakes — don't blink."],
  go_second:   ['Has a head start. Catch up if you can.', "Goes first. You play catch-up.", 'Started early. End it late.'],
  connect3:    ['Small board, big brain.', 'Tight spaces. Sharp minds.', 'Three in a row. Move fast.'],
  connect5:    ['Long lines only. Five wins.', 'Patience pays. Five in a row.', "Stretches it out."],
  connect6:    ['Six in a row. Marathon match.', 'Big board, bigger lines.', 'Plays the long game.'],
};

/** Pick a name from the type's pool, indexed by slot for stability. */
export function defaultNameFor(type, slotIndex) {
  const pool = NAME_TEMPLATES[type] ?? NAME_TEMPLATES.standard;
  return pool[slotIndex % pool.length];
}

/** Pick a personality from the type's pool, indexed by slot. */
export function defaultPersonalityFor(type, slotIndex) {
  const pool = PERSONALITY_TEMPLATES[type] ?? PERSONALITY_TEMPLATES.standard;
  return pool[slotIndex % pool.length];
}

// ═══════════════════════════════════════════════════════════════════════
// §3 — CITY_RECIPES (from careerRecipes.ts, GEM-SCRUBBED display text)
// ═══════════════════════════════════════════════════════════════════════
// Order matters — ID assignment walks the cities in array order via the
// generator below. Every value (settings, presetBoard, obstacleCells,
// rewards, bossScript, mapPosition, etc.) is preserved exactly from Drop4.
// The ONLY edits vs. the Drop4 source are the " + N Gem(s)" substrings
// stripped from 14 reward `name` strings (ids 8, 9, 13, 14, 15, 20, 22,
// 23, 26, 27, 28, 31, 32, 33) — those rewards keep their original
// type/amount/icon; only the cosmetic gem text in the label is gone.

export const CITY_RECIPES = [
  // ─── 1 · BROOKLYN (Terra Nova / Human World) ─────────────────────────
  {
    id: 'brooklyn',
    name: 'Terra Nova',
    state: 'Human World',
    nickname: 'The Cradle',
    tagline: 'Where every legend begins — the homeworld under a young sun.',
    themeColor: '#f4a623',
    accentColor: '#ff6b35',
    skyGradient: ['#1a2766', '#3a2a5c', '#f4a623'],
    mapPosition: { xPct: 90, yPct: 47 },
    opponents: [
      'Rookie Ron', 'Speedy Sam', 'Casual Carl', 'Beginner Ben',
      'Tiny Tim', 'Lucky Luke', 'Defensive Dee', 'Flash Fiona',
      'Big Board Bob', 'Tricky Tara', 'Iron Ivan', 'Tommy Blacktop',
    ],
    levels: [
      { type: 'standard', difficulty: 'easy', name: 'First Drop', opponent: 'Rookie Ron', personality: 'Your first opponent. Go easy on him.', reward: { type: 'coins', name: '50 Coins', amount: 50, icon: '🪙' } },
      { type: 'timed', difficulty: 'easy', name: 'Quick Thinking', opponent: 'Speedy Sam', personality: 'Plays fast, thinks faster.', settings: { timerSeconds: 15 }, reward: { type: 'coins', name: '50 Coins', amount: 50, icon: '⏱️' } },
      { type: 'standard', difficulty: 'easy', name: 'Center Control', opponent: 'Casual Carl', personality: 'Always plays the edges. Punish him for it.', settings: { movesLimit: 12 }, reward: { type: 'coins', name: '100 Coins', amount: 100, icon: '🪙' }, starThresholds: { three: 7, two: 9 } },
      { type: 'obstacle', difficulty: 'easy', name: 'First Wall', opponent: 'Beginner Ben', personality: "He's set up a tiny wall. Play around it.", settings: { obstacleCells: [{ row: 4, col: 3 }, { row: 5, col: 3 }] }, reward: { type: 'coins', name: '100 Coins', amount: 100, icon: '🧱' } },
      { type: 'connect3', difficulty: 'easy', name: 'Mini Match', opponent: 'Tiny Tim', personality: 'Small board, big brain.', settings: { rows: 5, cols: 5, connectCount: 3 }, reward: { type: 'board', id: 'wood', name: 'Wood Board', icon: '🪵' }, starThresholds: { three: 5, two: 8 } },
      { type: 'go_second', difficulty: 'easy', name: 'The Comeback', opponent: 'Lucky Luke', personality: 'Can you win going second?', settings: { playerGoesFirst: false } },
      { type: 'standard', difficulty: 'easy', name: 'Block Party', opponent: 'Defensive Dee', personality: 'She starts with an advantage!', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,2,0,2,0,2]] }, reward: { type: 'coins', name: '150 Coins', amount: 150, icon: '🪙' }, starThresholds: { three: 8, two: 13 } },
      { type: 'speed', difficulty: 'medium', name: 'Speed Demon', opponent: 'Flash Fiona', personality: 'Blink and you lose.', settings: { timerSeconds: 5 }, reward: { type: 'coins', name: '150 Coins', amount: 150, icon: '⚡' } },
      { type: 'moves_limit', difficulty: 'easy', name: 'Six-Move Win', opponent: 'Big Board Bob', personality: 'Big board. Six moves to win or you lose. Move smart.', settings: { rows: 8, cols: 9, movesLimit: 6 }, reward: { type: 'coins', name: '200 Coins', amount: 200, icon: '🎯' }, starThresholds: { three: 4, two: 6 } },
      { type: 'obstacle', difficulty: 'medium', name: 'Roadblock', opponent: 'Tricky Tara', personality: 'She set up roadblocks. Play around them.', settings: { obstacleCells: [{ row: 2, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 2, col: 5 }] }, reward: { type: 'coins', name: '250 Coins', amount: 250, icon: '🧱' }, starThresholds: { three: 9, two: 15 } },
      { type: 'jeopardy', difficulty: 'medium', name: 'Double Jeopardy', opponent: 'Iron Ivan', personality: 'Five in a row, triple the bag. Everything on the line.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 }, reward: { type: 'pieces', id: 'chrome', name: 'Chrome Pieces', icon: '🔘' }, starThresholds: { three: 10, two: 16 } },
      { type: 'boss', difficulty: 'medium', name: 'BOSS: Tommy Blacktop', opponent: 'Tommy Blacktop', personality: "The Cradle's king. Even cols on even turns, odd on odd turns. Break his rhythm or lose.", settings: { bossScript: 'tommy' }, reward: { type: 'board', id: 'neon', name: 'Neon Glow Board', icon: '✨' }, bonusReward: { type: 'title', name: 'Blacktop King', icon: '👑' }, starThresholds: { three: 8, two: 13 } },
    ],
  },

  // ─── 2 · VENICE BEACH (Solstice / Human World) ───────────────────────
  {
    id: 'venice_beach',
    name: 'Solstice',
    state: 'Human World',
    nickname: 'The Rim',
    tagline: 'The bright edge of the system. Move fast or get left in the dark.',
    unlockedAfterCityId: 'brooklyn',
    themeColor: '#ff8c42',
    accentColor: '#ffd166',
    skyGradient: ['#ff6b9d', '#ff8c42', '#ffd166'],
    mapPosition: { xPct: 10, yPct: 58 },
    opponents: [
      'Stretch Stevens', 'Puzzle Pete', 'Blitz Betty', 'Micro Max',
      'Stone Cold Steve', 'Copy Cat Clara', 'Mega Mike', 'Six-Pack Sid',
      'Clock Crusher', 'Chaos Karen', 'Marathon Mel', 'Sunset Sal',
    ],
    levels: [
      { type: 'connect5', difficulty: 'medium', name: 'Drop5', opponent: 'Stretch Stevens', personality: 'Five connects. New rules.', settings: { rows: 8, cols: 9, connectCount: 5 }, reward: { type: 'coins', name: '300 Coins', amount: 300, icon: '5️⃣' } },
      { type: 'puzzle', difficulty: 'medium', name: 'Puzzle Start', opponent: 'Puzzle Pete', personality: 'Solve the puzzle!', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,1,1,0,0,0],[0,2,2,1,0,1,0],[2,1,1,2,2,1,2]] }, reward: { type: 'coins', name: '300 Coins', amount: 300, icon: '🧩' }, starThresholds: { three: 4, two: 7 } },
      { type: 'speed', difficulty: 'medium', name: 'No Time', opponent: 'Blitz Betty', personality: 'Think FAST.', settings: { timerSeconds: 3 }, reward: { type: 'coins', name: '350 Coins', amount: 350, icon: '⚡' } },
      { type: 'connect3', difficulty: 'hard', name: 'Tiny Terror', opponent: 'Micro Max', personality: 'Small board, hard bot.', settings: { rows: 5, cols: 5, connectCount: 3 }, reward: { type: 'coins', name: '300 Coins', amount: 300, icon: '3️⃣' }, starThresholds: { three: 5, two: 8 } },
      { type: 'obstacle', difficulty: 'medium', name: 'The Wall', opponent: 'Stone Cold Steve', personality: 'The center column is blocked. Deal with it.', settings: { obstacleCells: [{ row: 3, col: 3 }, { row: 4, col: 3 }, { row: 5, col: 3 }] }, reward: { type: 'coins', name: '400 Coins', amount: 400, icon: '🧱' }, starThresholds: { three: 9, two: 14 } },
      { type: 'obstacle', difficulty: 'medium', name: 'Maze Walls', opponent: 'Copy Cat Clara', personality: 'Three walls form a maze. Find the win line through it.', settings: { obstacleCells: [{ row: 2, col: 2 }, { row: 3, col: 2 }, { row: 2, col: 4 }, { row: 4, col: 1 }, { row: 4, col: 5 }] }, reward: { type: 'coins', name: '400 Coins', amount: 400, icon: '🧱' }, starThresholds: { three: 8, two: 13 } },
      { type: 'standard', difficulty: 'medium', name: 'Giant Board', opponent: 'Mega Mike', personality: 'Biggest board yet.', settings: { rows: 9, cols: 9 }, reward: { type: 'board', id: 'ice', name: 'Ice Arena Board', icon: '❄️' }, starThresholds: { three: 11, two: 18 } },
      { type: 'connect6', difficulty: 'medium', name: 'Drop6', opponent: 'Six-Pack Sid', personality: 'Six in a row to win!', settings: { rows: 9, cols: 9, connectCount: 6 }, reward: { type: 'coins', name: '500 Coins', amount: 500, icon: '6️⃣' }, starThresholds: { three: 12, two: 20 } },
      { type: 'timed', difficulty: 'hard', name: 'Pressure', opponent: 'Clock Crusher', personality: 'Tick tock...', settings: { timerSeconds: 10 }, reward: { type: 'coins', name: '500 Coins', amount: 500, icon: '⏱️' } },
      { type: 'puzzle', difficulty: 'medium', name: 'Pre-Set Chaos', opponent: 'Chaos Karen', personality: 'Chaos is her middle name.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,2,0,1,0,0],[0,1,0,0,0,2,0],[2,0,1,2,0,1,0],[1,2,0,1,2,0,1]] }, reward: { type: 'coins', name: '450 Coins', amount: 450, icon: '🧩' }, starThresholds: { three: 5, two: 9 } },
      { type: 'moves_limit', difficulty: 'hard', name: 'Twenty Moves', opponent: 'Marathon Mel', personality: "Twenty moves to win. That's it. No more, no less.", settings: { rows: 7, cols: 8, movesLimit: 20 }, reward: { type: 'pieces', id: 'fire_ice', name: 'Fire & Ice Pieces', icon: '🔥' }, starThresholds: { three: 12, two: 16 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: Sunset Sal', opponent: 'Sunset Sal', personality: 'The Rim. Gravity flips every 4 moves. The board you see is not the board you play.', settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 15, bossScript: 'sal', presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,1,2,0,0,0],[0,0,0,2,1,0,0,0],[0,0,2,1,1,2,0,0]] }, reward: { type: 'board', id: 'galaxy', name: 'Galaxy Board', icon: '🌌' }, bonusReward: { type: 'title', name: 'Gravity Bender', icon: '🌀' }, starThresholds: { three: 10, two: 16 } },
    ],
  },

  // ─── 3 · HARLEM (Highspire / Human World) ────────────────────────────
  {
    id: 'harlem',
    name: 'Highspire',
    state: 'Human World',
    nickname: 'The Crown',
    tagline: "The homeworld's peak. Prove yourself before you reach for the stars.",
    unlockedAfterCityId: 'venice_beach',
    themeColor: '#9b59b6',
    accentColor: '#f1c40f',
    skyGradient: ['#0a0e27', '#2d1b69', '#9b59b6'],
    mapPosition: { xPct: 85, yPct: 18 },
    opponents: [
      'Nightmare Nick', 'Lightning Lisa', 'Maze Master Matt', 'Quick Draw Quinn',
      'Upside-Down Uma', 'Arena Alex', 'Storm Surge Sara', 'Old Guard Otto',
      'Grim Reaper Gina', 'Ghost Greg', 'Final Boss Frank', 'The Cathedral Warden',
    ],
    levels: [
      { type: 'go_second', difficulty: 'hard', name: 'Nightmare Mode', opponent: 'Nightmare Nick', personality: 'Opponent goes first AND has a head start.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0]] }, reward: { type: 'coins', name: '550 Coins', amount: 550, icon: '↩' } },
      { type: 'speed', difficulty: 'hard', name: 'Speed Chess', opponent: 'Lightning Lisa', personality: 'Five in a row with a five-second clock.', settings: { rows: 8, cols: 9, connectCount: 5, timerSeconds: 5 }, reward: { type: 'coins', name: '600 Coins', amount: 600, icon: '⚡' } },
      { type: 'puzzle', difficulty: 'hard', name: 'The Maze', opponent: 'Maze Master Matt', personality: 'Navigate the maze.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,2,0,2,0,2,0],[0,0,0,0,0,0,0],[2,0,2,0,2,0,2],[0,0,0,0,0,0,0]] }, reward: { type: 'coins', name: '650 Coins', amount: 650, icon: '🧩' }, starThresholds: { three: 7, two: 12 } },
      { type: 'speed', difficulty: 'hard', name: 'Drop3 Blitz', opponent: 'Quick Draw Quinn', personality: 'Fastest game mode.', settings: { rows: 5, cols: 5, connectCount: 3, timerSeconds: 3 }, reward: { type: 'coins', name: '500 Coins', amount: 500, icon: '⚡' } },
      { type: 'obstacle', difficulty: 'hard', name: 'Asteroid Field', opponent: 'Upside-Down Uma', personality: 'Six walls. Three real wins. Find one.', settings: { obstacleCells: [{ row: 1, col: 2 }, { row: 2, col: 1 }, { row: 3, col: 3 }, { row: 4, col: 5 }, { row: 2, col: 5 }, { row: 4, col: 2 }] }, reward: { type: 'coins', name: '800 Coins', amount: 800, icon: '🧱' }, starThresholds: { three: 9, two: 14 } },
      { type: 'standard', difficulty: 'hard', name: 'The Arena', opponent: 'Arena Alex', personality: 'Pre-placed chaos on a big board.', settings: { rows: 7, cols: 8, presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,2,0,0,1,0,0],[0,2,1,0,0,2,1,0],[2,1,2,1,2,1,2,1]] }, reward: { type: 'board', id: 'lava', name: 'Lava Pit Board', icon: '🌋' }, starThresholds: { three: 8, two: 13 } },
      { type: 'connect6', difficulty: 'hard', name: 'Perfect Storm', opponent: 'Storm Surge Sara', personality: 'The hardest combo.', settings: { rows: 9, cols: 9, connectCount: 6, timerSeconds: 10 }, reward: { type: 'coins', name: '900 Coins', amount: 900, icon: '⛈️' } },
      // movesLimit=5 on a connect-5 level: 5 moves IS the mathematical
      // minimum to win, so every clear is already a perfect 3-star —
      // there's no room for a distinct 2-star band below the cap.
      { type: 'moves_limit', difficulty: 'hard', name: 'Line of Five', opponent: 'Old Guard Otto', personality: 'Sixteen moves to land five in a row. Every drop counts.', settings: { rows: 8, cols: 9, connectCount: 5, movesLimit: 5 }, reward: { type: 'coins', name: '1000 Coins', amount: 1000, icon: '🎯' }, starThresholds: { three: 8, two: 12 } },
      { type: 'speed', difficulty: 'hard', name: 'Sudden Death', opponent: 'Grim Reaper Gina', personality: "One mistake and you're done.", settings: { timerSeconds: 5 }, reward: { type: 'coins', name: '850 Coins', amount: 850, icon: '⚰️' } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Final Jeopardy', opponent: 'Ghost Greg', personality: 'Connect 5 on a standard board. Triple the bag. All or nothing.', settings: { rows: 6, cols: 7, connectCount: 5, rewardMultiplier: 3 }, reward: { type: 'coins', name: '1500 Coins', amount: 1500, icon: '🪙' } },
      { type: 'standard', difficulty: 'hard', name: 'Last Stand', opponent: 'Final Boss Frank', personality: 'The last regular challenge.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,2,2,0,0,0]] }, reward: { type: 'coins', name: '1200 Coins', amount: 1200, icon: '🛡️' } },
      // Warden seed REDESIGNED 2026-07-12 (identity restore): the original
      // authored pyramid put an open-ended FOUR on the bottom row of a
      // connect-5 level where the boss moves first — mathematically lost
      // before the player's first drop (why the 07-06 tune clearSeed'd it).
      // New seed = a 2x2 "cathedral gate" (4 pieces, so the intro card's
      // "4-piece threat" stays literal): heavy central tempo, no forced
      // line. Sim-verified survivable; see docs/career-audit/.
      { type: 'boss', difficulty: 'hard', name: 'BOSS: The Cathedral Warden', opponent: 'The Cathedral Warden', personality: "The Crown's final boss. The Warden seeded a 4-piece threat. You go second. 10-second clock. Survive the night.", settings: { rows: 9, cols: 9, connectCount: 5, timerSeconds: 10, playerGoesFirst: false, bossScript: 'warden', presetBoard: [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,2,2,0,0,0],[0,0,0,0,2,2,0,0,0]] }, reward: { type: 'board', id: 'darkmatter', name: 'Dark Matter Board', icon: '🌑' }, bonusReward: { type: 'title', name: 'Night Warden', icon: '🗝️' } },
    ],
  },

  // ─── 4 · CHICAGO (Sylvara / Elf World) ───────────────────────────────
  {
    id: 'chicago', name: 'Sylvara', state: 'Elf World', nickname: 'The Spires',
    tagline: 'Elf World opens. Out-think or get out.',
    unlockedAfterCityId: 'harlem',
    themeColor: '#37c978', accentColor: '#7ee6a8',
    skyGradient: ['#0a3c26', '#1a7a4e', '#37c978'],
    mapPosition: { xPct: 60, yPct: 32 },
    opponents: [
      'Hustler Hank', 'Pawn Master Pax', 'Puzzle Phyllis', 'Locked-In Lou',
      'Knight Knox', 'Trapped Tia', 'Position Perry', 'Closed Cara',
      'Cage Master Cade', 'Riddler Reese', 'The Cipher', 'Big Bear',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Welcome to Sylvara', opponent: 'Hustler Hank', personality: 'You think The Cradle was hard? Think again.' },
      { type: 'puzzle', difficulty: 'medium', name: 'Open Position', opponent: 'Pawn Master Pax', personality: 'Read the board. Then play it.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,1,0,0,0],[0,0,2,1,0,0,0],[0,1,2,2,1,0,0]] } },
      { type: 'obstacle', difficulty: 'medium', name: 'Locked Lanes', opponent: 'Puzzle Phyllis', personality: 'Three lanes. One is yours.', settings: { obstacleCells: [{row:2,col:2},{row:3,col:2},{row:2,col:4},{row:3,col:4}] } },
      { type: 'standard', difficulty: 'medium', name: 'The Slow Game', opponent: 'Locked-In Lou', personality: "Every move is a question. Don't guess.", settings: { movesLimit: 16 }, starThresholds: { three: 8, two: 12 } },
      { type: 'connect5', difficulty: 'medium', name: 'Five Files', opponent: 'Knight Knox', personality: 'Five in a row. Long lines.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'puzzle', difficulty: 'medium', name: 'Endgame Trap', opponent: 'Trapped Tia', personality: "She set this up before you sat down.", settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,2,0,0],[0,1,2,2,1,2,0],[2,1,1,2,2,1,0],[1,2,2,1,1,2,1]] }, starThresholds: { three: 3, two: 6 } },
      { type: 'obstacle', difficulty: 'medium', name: 'Six Walls', opponent: 'Position Perry', personality: 'Find the line. Or build a new one.', settings: { obstacleCells: [{row:1,col:1},{row:2,col:2},{row:3,col:3},{row:3,col:5},{row:2,col:4},{row:1,col:5}] } },
      { type: 'timed', difficulty: 'medium', name: 'Cage Clock', opponent: 'Closed Cara', personality: '12 seconds. Solve fast.', settings: { timerSeconds: 12 } },
      { type: 'puzzle', difficulty: 'hard', name: 'The Cipher', opponent: 'Cage Master Cade', personality: 'Crack the position. There is one move.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,1,2,0,0],[0,0,1,2,1,2,0],[0,1,2,1,2,1,2]] }, starThresholds: { three: 2, two: 4 } },
      { type: 'moves_limit', difficulty: 'hard', name: 'Eight Moves', opponent: 'Riddler Reese', personality: 'Eight moves. No more.', settings: { rows: 7, cols: 8, movesLimit: 8 } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Cipher Jeopardy', opponent: 'The Cipher', personality: 'Five in a row. Triple coins. Cracking only.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: Big Bear', opponent: 'Big Bear', personality: "Sylvara's puzzle king. Eight pieces deep. Solve or fold.", settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 20, presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,2,1,2,1,0,0],[0,2,1,2,1,2,1,0],[1,2,2,1,1,2,2,1],[2,1,1,2,2,1,1,2]] }, reward: { type: 'board', id: 'matrix', name: 'Matrix Board', icon: '🧠' }, bonusReward: { type: 'pieces', id: 'monochrome', name: 'Monochrome Pieces', icon: '⬛' } },
    ],
  },

  // ─── 5 · DETROIT (Emberglade / Elf World) ────────────────────────────
  {
    id: 'detroit', name: 'Emberglade', state: 'Elf World', nickname: 'The Forge',
    tagline: 'Mixed modes in the forge-glade. Prove it.',
    unlockedAfterCityId: 'chicago',
    themeColor: '#d98e3a', accentColor: '#f0b56e',
    skyGradient: ['#1a1a1a', '#4a4a4a', '#95a5a6'],
    mapPosition: { xPct: 70, yPct: 22 },
    opponents: [
      'Switch Silas', 'Gear Greta', 'Carburetor Chuck', 'Piston Pat',
      'Wrench Wendy', 'Diesel Dom', 'Spark Plug Spike', 'Throttle Tate',
      'Tinker Tina', 'Radiator Rae', 'Solder Saul', 'The Mechanic',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Cold Start', opponent: 'Switch Silas', personality: 'Emberglade warms you up.' },
      { type: 'connect3', difficulty: 'medium', name: 'Three Gears', opponent: 'Gear Greta', personality: 'Smaller board. Sharper teeth.', settings: { rows: 5, cols: 5, connectCount: 3 } },
      { type: 'speed', difficulty: 'medium', name: 'Throttle Up', opponent: 'Carburetor Chuck', personality: 'Five seconds. Move.', settings: { timerSeconds: 5 } },
      { type: 'go_second', difficulty: 'medium', name: 'Push Start', opponent: 'Piston Pat', personality: 'You go second. Catch up.', settings: { playerGoesFirst: false } },
      { type: 'obstacle', difficulty: 'medium', name: 'Toolbox', opponent: 'Wrench Wendy', personality: 'Tools on the floor. Step around.', settings: { obstacleCells: [{row:3,col:1},{row:3,col:3},{row:3,col:5},{row:4,col:2},{row:4,col:4}] } },
      { type: 'connect5', difficulty: 'medium', name: 'Long Belt', opponent: 'Diesel Dom', personality: 'Five in a row. Big board.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'timed', difficulty: 'medium', name: 'Spark Time', opponent: 'Spark Plug Spike', personality: '10 seconds per turn.', settings: { timerSeconds: 10 } },
      { type: 'puzzle', difficulty: 'medium', name: 'Engine Block', opponent: 'Throttle Tate', personality: 'The puzzle was here when you arrived.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,1,2,1,2,1,0],[2,1,1,2,1,2,1],[1,2,2,1,2,1,2]] } },
      { type: 'moves_limit', difficulty: 'hard', name: 'Ten and Done', opponent: 'Tinker Tina', personality: 'Ten moves. Make every one count.', settings: { movesLimit: 10 } },
      { type: 'speed', difficulty: 'hard', name: 'Overheat', opponent: 'Radiator Rae', personality: '3 seconds. Cool under pressure.', settings: { timerSeconds: 3 } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Big Job', opponent: 'Solder Saul', personality: 'Triple bag. Connect 5. Pick a side.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: The Mechanic', opponent: 'The Mechanic', personality: "He's seen every game. He runs every play. Beat the master.", settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 12, obstacleCells: [{row:3,col:1},{row:3,col:6},{row:4,col:3},{row:4,col:4}], presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,2,1,0,0,0],[0,0,2,1,2,1,0,0],[0,1,2,1,2,1,2,0],[2,1,1,2,1,2,1,2]] }, reward: { type: 'board', id: 'gold', name: 'Gold Court', icon: '🏆' }, bonusReward: { type: 'title', name: 'The Mechanic', icon: '🔧' } },
    ],
  },

  // ─── 6 · OAKLAND (Moonhollow / Elf World) ────────────────────────────
  {
    id: 'oakland', name: 'Moonhollow', state: 'Elf World', nickname: 'The Grove',
    tagline: 'Connect 6 country under the moon grove. No weak links.',
    unlockedAfterCityId: 'detroit',
    themeColor: '#2fbf8f', accentColor: '#7fe6c4',
    skyGradient: ['#0a2a1e', '#1a5a3e', '#2ecc71'],
    mapPosition: { xPct: 4, yPct: 34 },
    opponents: [
      'Long Game Larry', 'Six-Strong Sunny', 'Big Board Bo', 'Patience Park',
      'Marathon Marc', 'Grid Geneva', 'The Stretch', 'Wide Open Wynn',
      'Endurance Eddie', 'Slow Burn Soraya', 'The Architect', "The Grove's Best",
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Welcome to the Grove', opponent: 'Long Game Larry', personality: 'Long sentences. Long games.' },
      { type: 'connect5', difficulty: 'medium', name: 'Five Town', opponent: 'Six-Strong Sunny', personality: 'Five in a row. Big board.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'standard', difficulty: 'medium', name: 'Wide Open', opponent: 'Big Board Bo', personality: 'Bigger board, bigger ideas.', settings: { rows: 8, cols: 9 } },
      { type: 'connect6', difficulty: 'medium', name: 'Six Pack', opponent: 'Patience Park', personality: 'Six in a row. Take your time.', settings: { rows: 9, cols: 9, connectCount: 6 } },
      { type: 'moves_limit', difficulty: 'medium', name: 'Long Marathon', opponent: 'Marathon Marc', personality: '20 moves to land it.', settings: { rows: 8, cols: 9, movesLimit: 20 } },
      { type: 'connect5', difficulty: 'medium', name: 'Wider Five', opponent: 'Grid Geneva', personality: 'Bigger grid. Same five.', settings: { rows: 9, cols: 10, connectCount: 5 } },
      { type: 'connect6', difficulty: 'hard', name: 'The Stretch', opponent: 'The Stretch', personality: 'Long. Slow. Brutal.', settings: { rows: 9, cols: 10, connectCount: 6 } },
      { type: 'standard', difficulty: 'hard', name: 'Open Floor', opponent: 'Wide Open Wynn', personality: 'No tricks. Just the biggest board you have seen.', settings: { rows: 9, cols: 10 } },
      { type: 'go_second', difficulty: 'hard', name: 'Catch the Long Line', opponent: 'Endurance Eddie', personality: 'You go second on a 9-wide board. Catch up.', settings: { rows: 9, cols: 9, playerGoesFirst: false } },
      { type: 'connect5', difficulty: 'hard', name: 'Slow Burn', opponent: 'Slow Burn Soraya', personality: 'No clock. Just five in a row.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'puzzle', difficulty: 'hard', name: 'The Architect', opponent: 'The Architect', personality: 'She built this puzzle for you. Solve it.', settings: { rows: 8, cols: 9, connectCount: 5, presetBoard: [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,1,0,0],[0,0,1,1,2,1,2,0,0],[0,2,1,2,1,2,1,2,0],[0,1,2,1,2,1,2,1,0],[2,1,2,1,2,1,1,2,1]] } },
      { type: 'boss', difficulty: 'hard', name: "BOSS: The Grove's Best", opponent: "The Grove's Best", personality: 'Connect 6 on the biggest board. 15 second clock. The Grove picks its kings.', settings: { rows: 9, cols: 9, connectCount: 6, timerSeconds: 15, presetBoard: [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,2,0,0,0,0,0],[0,0,2,1,2,0,0,0,0],[0,2,1,2,1,2,0,0,0],[2,1,2,1,2,1,2,0,0]] }, reward: { type: 'board', id: 'crystal', name: 'Crystal Board', icon: '🔮' }, bonusReward: { type: 'title', name: "Grove's Best", icon: '🏅' } },
    ],
  },

  // ─── 7 · COMPTON (Rustheap / Goblin World) ───────────────────────────
  {
    id: 'compton', name: 'Rustheap', state: 'Goblin World', nickname: 'The Heap',
    tagline: 'Goblin World. Speed demons only — blink and lose.',
    unlockedAfterCityId: 'oakland',
    themeColor: '#8fbf2f', accentColor: '#c4e654',
    skyGradient: ['#2d0a0a', '#8b1e1e', '#e74c3c'],
    mapPosition: { xPct: 22, yPct: 78 },
    opponents: [
      'Drag Race Drew', 'Burnout Bea', 'Nitrous Nate', 'Skidmark Sky',
      'Rev Rev Roxy', 'Throttle Theo', 'Pop-Off Pip', 'Track Star Talia',
      'Yard Hawk', 'Streetlight Sy', 'Crash Crew', 'Quick Draw Q',
    ],
    levels: [
      { type: 'speed', difficulty: 'medium', name: 'Welcome to the Heap', opponent: 'Drag Race Drew', personality: '5 seconds. No warmup.', settings: { timerSeconds: 5 } },
      { type: 'connect3', difficulty: 'medium', name: 'Burnout', opponent: 'Burnout Bea', personality: 'Small board. Fast burn.', settings: { rows: 5, cols: 5, connectCount: 3, timerSeconds: 4 } },
      { type: 'speed', difficulty: 'medium', name: 'Nitrous', opponent: 'Nitrous Nate', personality: 'Even faster.', settings: { timerSeconds: 4 } },
      { type: 'standard', difficulty: 'medium', name: 'Pause', opponent: 'Skidmark Sky', personality: 'Catch your breath. Or lose.' },
      { type: 'speed', difficulty: 'medium', name: 'Rev Up', opponent: 'Rev Rev Roxy', personality: '3 seconds. Pure reflex.', settings: { timerSeconds: 3 } },
      { type: 'connect3', difficulty: 'medium', name: 'Quick Three', opponent: 'Throttle Theo', personality: '3 in a row. 3 second clock.', settings: { rows: 5, cols: 5, connectCount: 3, timerSeconds: 3 } },
      { type: 'speed', difficulty: 'hard', name: 'Pop Off', opponent: 'Pop-Off Pip', personality: 'Same 3 seconds. Harder bot.', settings: { timerSeconds: 3 } },
      { type: 'timed', difficulty: 'hard', name: 'Track Star', opponent: 'Track Star Talia', personality: 'Big board. 8-second clock.', settings: { rows: 8, cols: 9, timerSeconds: 8 } },
      { type: 'speed', difficulty: 'hard', name: 'Heap Hawk', opponent: 'Yard Hawk', personality: 'Connect 5. 5 second clock. Eyes open.', settings: { rows: 8, cols: 9, connectCount: 5, timerSeconds: 5 } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Streetlight Stakes', opponent: 'Streetlight Sy', personality: 'Triple coins. Speed. All in.', settings: { connectCount: 5, rewardMultiplier: 3, timerSeconds: 6 } },
      { type: 'obstacle', difficulty: 'hard', name: 'Heap Crash', opponent: 'Crash Crew', personality: 'Wreckage on the track. 5 seconds.', settings: { obstacleCells: [{row:2,col:1},{row:2,col:5},{row:3,col:3},{row:4,col:2},{row:4,col:4}], timerSeconds: 5 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: Quick Draw Q', opponent: 'Quick Draw Q', personality: 'Rustheap kingpin. 3 second clock. Connect 5. Hesitate and you fold.', settings: { rows: 6, cols: 7, connectCount: 5, timerSeconds: 3, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,2,1,2,0,0],[0,2,1,2,1,2,0]] }, reward: { type: 'pieces', id: 'flame', name: 'Flame Pieces', icon: '🔥' }, bonusReward: { type: 'title', name: 'Quick Draw', icon: '🎯' } },
    ],
  },

  // ─── 8 · MIAMI (Croakwater / Goblin World) ───────────────────────────
  {
    id: 'miami', name: 'Croakwater', state: 'Goblin World', nickname: 'The Bazaar',
    tagline: 'Tournaments under swamp lanterns.',
    unlockedAfterCityId: 'compton',
    themeColor: '#6fe03a', accentColor: '#c4ff5e',
    skyGradient: ['#1a0a3e', '#6a0dad', '#ff006e'],
    mapPosition: { xPct: 80, yPct: 85 },
    opponents: [
      'Neon Nina', 'Tropic Troy', 'Ocean Drive Owen', 'Palm Park Pia',
      'Cabana Karim', 'Yacht Yara', 'Beach Boss Bria', 'Rooftop Romeo',
      'Sunset Cyrus', 'Bayside Brad', 'Skyline Skye', 'King of the Bazaar',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Welcome to Croakwater', opponent: 'Neon Nina', personality: 'Bright lights. Brighter games.' },
      { type: 'jeopardy', difficulty: 'medium', name: 'Triple Swamp', opponent: 'Tropic Troy', personality: 'Triple coins. Connect 5.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'standard', difficulty: 'medium', name: 'Lantern Row', opponent: 'Ocean Drive Owen', personality: 'Cruise the board.', settings: { rows: 7, cols: 8 } },
      { type: 'speed', difficulty: 'medium', name: 'Swamp Sprint', opponent: 'Palm Park Pia', personality: '5 seconds. Tropical pace.', settings: { timerSeconds: 5 } },
      { type: 'puzzle', difficulty: 'medium', name: 'Bazaar Riddle', opponent: 'Cabana Karim', personality: 'The position is set. Solve it.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,1,0,0,0],[0,0,2,2,1,0,0],[0,1,2,1,2,1,0],[2,1,1,2,2,1,2]] } },
      { type: 'jeopardy', difficulty: 'medium', name: 'Bog Money', opponent: 'Yacht Yara', personality: 'Triple bag. Show out. Clock is ticking on the dock.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3, timerSeconds: 10 } },
      { type: 'connect5', difficulty: 'hard', name: 'Marsh Boss', opponent: 'Beach Boss Bria', personality: 'Five in a row. Eyes on you.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Canopy Stakes', opponent: 'Rooftop Romeo', personality: 'Triple coins. Up here, only winners.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'timed', difficulty: 'hard', name: 'Lantern Clock', opponent: 'Sunset Cyrus', personality: 'Watch the sun. 8 seconds per turn.', settings: { rows: 7, cols: 8, timerSeconds: 8 } },
      { type: 'obstacle', difficulty: 'hard', name: 'Bogside Walls', opponent: 'Bayside Brad', personality: 'Six walls. Dance through.', settings: { obstacleCells: [{row:1,col:1},{row:1,col:5},{row:3,col:3},{row:4,col:2},{row:4,col:4},{row:2,col:6}] } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Deepwater Stakes', opponent: 'Skyline Skye', personality: 'Triple bag. 6-second clock. Show me.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3, timerSeconds: 6 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: King of the Bazaar', opponent: 'King of the Bazaar', personality: "Croakwater's crown. 5 in a row. Triple bag. 8 second clock. Take it from me.", settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 8, rewardMultiplier: 3, presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,2,1,0,0],[0,0,0,2,1,2,1,0],[0,0,2,1,2,1,2,0],[0,2,1,2,1,2,1,2]] }, reward: { type: 'board', id: 'sunset', name: 'Sunset Board', icon: '🌅' }, bonusReward: { type: 'title', name: 'King of the Bazaar', icon: '🕶️' } },
    ],
  },

  // ─── 9 · THE VOID (Goblin World) ─────────────────────────────────────
  {
    id: 'the_void', name: 'The Void', state: 'Goblin World', nickname: 'The Deep Forge',
    tagline: 'Rumors only. Nobody comes back the same.',
    unlockedAfterCityId: 'miami',
    themeColor: '#9be34f', accentColor: '#3dff88',
    skyGradient: ['#000000', '#1a0033', '#e94560'],
    mapPosition: { xPct: 50, yPct: 95 },
    opponents: [
      'Shade One', 'Echo', 'Mirror', 'The Drift',
      'Phantom', 'Whisper', 'Static', 'Noise',
      'The Hollow', 'Threshold', 'The Edge', 'The Void',
    ],
    levels: [
      { type: 'go_second', difficulty: 'hard', name: 'Wrong Foot', opponent: 'Shade One', personality: 'You go second. Always. From here on out.', settings: { playerGoesFirst: false } },
      { type: 'obstacle', difficulty: 'hard', name: 'Eight Walls', opponent: 'Echo', personality: 'Eight blocks. Three columns left.', settings: { obstacleCells: [{row:1,col:0},{row:1,col:6},{row:2,col:1},{row:2,col:5},{row:3,col:2},{row:3,col:4},{row:4,col:1},{row:4,col:5}] } },
      { type: 'connect6', difficulty: 'hard', name: 'Six in Tight', opponent: 'Mirror', personality: 'Six in a row. Tight board.', settings: { rows: 7, cols: 7, connectCount: 6 } },
      { type: 'puzzle', difficulty: 'hard', name: 'Drift', opponent: 'The Drift', personality: 'You did not place these. Fix it.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,1,1,2,1,2,0],[2,1,2,1,2,1,2],[1,2,1,2,2,1,1]] }, starThresholds: { three: 3, two: 5 } },
      { type: 'speed', difficulty: 'hard', name: 'Phantom Limb', opponent: 'Phantom', personality: '3 seconds. The clock is in your head.', settings: { timerSeconds: 3 } },
      { type: 'moves_limit', difficulty: 'hard', name: 'Six Moves Out', opponent: 'Whisper', personality: 'Six moves. The Void counts.', settings: { rows: 7, cols: 8, movesLimit: 6 } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Static Stakes', opponent: 'Static', personality: 'Triple bag. Triple risk.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'obstacle', difficulty: 'hard', name: 'Noise', opponent: 'Noise', personality: 'Walls everywhere. Find a clean line.', settings: { obstacleCells: [{row:1,col:2},{row:2,col:3},{row:1,col:4},{row:3,col:1},{row:3,col:5},{row:4,col:3}] } },
      { type: 'puzzle', difficulty: 'hard', name: 'The Hollow', opponent: 'The Hollow', personality: 'Empty position. Fill it right.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,2,1,2,0,0],[0,2,1,2,1,2,0]] } },
      { type: 'connect5', difficulty: 'hard', name: 'Threshold', opponent: 'Threshold', personality: 'Five in a row. The line crosses you.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'go_second', difficulty: 'hard', name: 'The Edge', opponent: 'The Edge', personality: 'You go second. The Edge gives nothing away.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,2,2,2,0,0],[0,2,1,2,2,0,0]] } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: The Void', opponent: 'The Void', personality: 'You came back. Most do not. Survive the dark.', settings: { rows: 8, cols: 8, connectCount: 5, timerSeconds: 8, playerGoesFirst: false, obstacleCells: [{row:2,col:1},{row:2,col:6},{row:5,col:1},{row:5,col:6}], presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,2,2,0,0,0],[0,0,2,1,1,2,0,0],[0,2,1,2,1,2,1,0],[2,1,2,1,2,1,2,1]] }, reward: { type: 'board', id: 'void', name: 'Void Obsidian Board', icon: '🌑' }, bonusReward: { type: 'title', name: 'Voidwalker', icon: '👁️' } },
    ],
  },

  // ─── 10 · ATLANTA (Gravemarch / Skeleton World) ──────────────────────
  {
    id: 'atlanta', name: 'Gravemarch', state: 'Skeleton World', nickname: 'The Boneyard',
    tagline: 'Skeleton World. A bone-cold anthem — ancient, silent, undefeated.',
    unlockedAfterCityId: 'the_void',
    themeColor: '#9fc6e8', accentColor: '#d4e8f7',
    skyGradient: ['#1a0033', '#3a0066', '#9b00b9'],
    mapPosition: { xPct: 75, yPct: 72 },
    opponents: [
      'Drip Daniel', 'Hustle Henry', 'Bass Boost Bex', 'Stack Cassidy',
      'Boom Bap Brent', 'Glow Up Gia', 'Real Recognize Rey', 'Drip Drum',
      'Slick Sosa', "Top Floor Tony", 'Heir Apparent', 'Bone King',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Welcome to the Boneyard', opponent: 'Drip Daniel', personality: 'Just the warm-up. Gravemarch plays for keeps.' },
      { type: 'jeopardy', difficulty: 'medium', name: 'Grave Money', opponent: 'Hustle Henry', personality: 'Triple bag right out the gate.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'speed', difficulty: 'medium', name: 'Bone Drop', opponent: 'Bass Boost Bex', personality: '5 second clock. Read the beat.', settings: { timerSeconds: 5 } },
      { type: 'standard', difficulty: 'medium', name: 'Stack', opponent: 'Stack Cassidy', personality: 'Stack the wins.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,1,0,0,0],[0,0,2,2,1,0,0],[0,1,2,1,2,1,0]] } },
      { type: 'jeopardy', difficulty: 'medium', name: 'Boneyard Bap', opponent: 'Boom Bap Brent', personality: 'Triple bag. Hard beat. Stay on tempo.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3, timerSeconds: 8 } },
      { type: 'connect5', difficulty: 'medium', name: 'Glow Up', opponent: 'Glow Up Gia', personality: 'Five in a row. Big board.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'obstacle', difficulty: 'medium', name: 'Real Recognize', opponent: 'Real Recognize Rey', personality: 'Five walls. Real ones step around.', settings: { obstacleCells: [{row:1,col:2},{row:2,col:1},{row:3,col:3},{row:4,col:5},{row:2,col:5}] } },
      { type: 'speed', difficulty: 'hard', name: 'Bone Drum', opponent: 'Drip Drum', personality: '4 second clock. Drum roll.', settings: { timerSeconds: 4 } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Slick Stakes', opponent: 'Slick Sosa', personality: 'Triple bag. 6 second clock. Show out.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3, timerSeconds: 6 } },
      { type: 'puzzle', difficulty: 'hard', name: 'Top Crypt', opponent: 'Top Floor Tony', personality: 'Solve the position. Then the world is yours.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,2,0,0],[0,1,2,2,1,2,0],[2,1,1,2,2,1,0],[1,2,2,1,1,2,1]] } },
      { type: 'moves_limit', difficulty: 'hard', name: 'Heir Apparent', opponent: 'Heir Apparent', personality: '7 moves to take the throne.', settings: { rows: 7, cols: 8, movesLimit: 7 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: Bone King', opponent: 'Bone King', personality: "Gravemarch's crown. 5 in a row. Triple bag. 5 second clock. Earn it.", settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 5, rewardMultiplier: 3, presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,1,2,0,0],[0,0,0,2,1,2,1,0],[0,0,2,1,2,1,2,0],[0,2,1,2,1,2,1,2]] }, reward: { type: 'pieces', id: 'gold_chain', name: 'Gold Chain Pieces', icon: '⛓️' }, bonusReward: { type: 'title', name: 'Boneyard King', icon: '👑' } },
    ],
  },

  // ─── 11 · HOUSTON (Candlecroft / Skeleton World) ─────────────────────
  {
    id: 'houston', name: 'Candlecroft', state: 'Skeleton World', nickname: 'The Reliquary',
    tagline: 'Texas heat, slow burn. Outlast or be cooked.',
    unlockedAfterCityId: 'atlanta',
    themeColor: '#e8b23a', accentColor: '#ffd97a',
    skyGradient: ['#3d1a00', '#8a3a00', '#ff5f1f'],
    mapPosition: { xPct: 50, yPct: 82 },
    opponents: [
      'Slow Roll Sage', 'Endurance Earl', 'Patient Pez', 'Long Haul Huck',
      'Stalker Stella', 'Cool Hand Cody', 'Marathon Mara', 'Steady Slade',
      'Late Bloomer Lena', 'Iron Lung Iris', 'Final Answer Felix', 'The Patient King',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Welcome to Candlecroft', opponent: 'Slow Roll Sage', personality: "We do this slow down here." },
      { type: 'go_second', difficulty: 'medium', name: 'Patient Start', opponent: 'Endurance Earl', personality: 'You go second. Wait for it.', settings: { playerGoesFirst: false } },
      { type: 'moves_limit', difficulty: 'medium', name: 'Patient Twelve', opponent: 'Patient Pez', personality: '12 moves. Plenty of time. Use them.', settings: { rows: 7, cols: 8, movesLimit: 12 } },
      { type: 'standard', difficulty: 'medium', name: 'Long Haul', opponent: 'Long Haul Huck', personality: 'Big board. Big game.', settings: { rows: 8, cols: 9 } },
      { type: 'go_second', difficulty: 'medium', name: 'Stalker', opponent: 'Stalker Stella', personality: 'You go second. She watches from a bigger court.', settings: { playerGoesFirst: false, rows: 8, cols: 9 } },
      { type: 'moves_limit', difficulty: 'medium', name: 'Cool Hand', opponent: 'Cool Hand Cody', personality: '15 moves. No clock. Cool head wins.', settings: { rows: 8, cols: 9, movesLimit: 15 } },
      { type: 'connect5', difficulty: 'medium', name: 'Five-Step Marathon', opponent: 'Marathon Mara', personality: 'Five in a row. Take all day.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'standard', difficulty: 'hard', name: 'Steady', opponent: 'Steady Slade', personality: 'No tricks. Just stamina.', settings: { rows: 8, cols: 9 } },
      { type: 'go_second', difficulty: 'hard', name: 'Late Bloomer', opponent: 'Late Bloomer Lena', personality: 'You go second. Late bloomers finish strong.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,2,2,2,0,0]] } },
      { type: 'moves_limit', difficulty: 'hard', name: 'Iron Lung', opponent: 'Iron Lung Iris', personality: '10 moves. Hold your breath.', settings: { rows: 8, cols: 9, movesLimit: 10 } },
      { type: 'puzzle', difficulty: 'hard', name: 'Final Answer', opponent: 'Final Answer Felix', personality: 'There is one move that wins. Find it.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,1,1,2,0,0],[0,2,1,2,1,1,0],[1,1,2,1,2,2,1],[2,1,2,2,1,1,2]] }, starThresholds: { three: 1, two: 2 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: The Patient King', opponent: 'The Patient King', personality: "The Reliquary's patient king. Connect 6 on a 9-wide board. 30 moves.", settings: { rows: 9, cols: 9, connectCount: 6, movesLimit: 30 }, reward: { type: 'board', id: 'desert_dawn', name: 'Desert Dawn Board', icon: '🌵' }, bonusReward: { type: 'title', name: 'The Patient King', icon: '⏳' } },
    ],
  },

  // ─── 12 · CLEVELAND (Duskmoor / Skeleton World) ──────────────────────
  // Easter egg for the Kingpin universe — Cleveland is Devon's hometown +
  // the Kingpin Bible's setting. Keep verbatim, per AMG Studios CLAUDE.md.
  {
    id: 'cleveland', name: 'Duskmoor', state: 'Skeleton World', nickname: 'The Mausoleum',
    tagline: 'Cold streets, real ones only. 755 Broadway never forgot.',
    unlockedAfterCityId: 'houston',
    themeColor: '#8a7fc4', accentColor: '#b8aef0',
    skyGradient: ['#1a0e1a', '#3a2e1a', '#a36b3a'],
    mapPosition: { xPct: 65, yPct: 27 },
    opponents: [
      'Lake Effect Lars', 'East Cle Eli', 'Tremont Tasha', 'Coventry Curt',
      'West Side Wes', 'Slavic Village Stas', 'Old Brooklyn Ollie',
      "Charlie Everbrush", 'Bedford Bree', 'Glenville Grant', "Murray Hill Mac", '755',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Cold Open', opponent: 'Lake Effect Lars', personality: 'No flash. Just real ones.' },
      { type: 'obstacle', difficulty: 'medium', name: 'East Side Walls', opponent: 'East Cle Eli', personality: 'Three walls. East side rules.', settings: { obstacleCells: [{row:3,col:1},{row:3,col:5},{row:4,col:3}] } },
      { type: 'standard', difficulty: 'medium', name: 'Tremont Stand', opponent: 'Tremont Tasha', personality: 'Stand your ground. 15 seconds a turn.', settings: { timerSeconds: 15 } },
      { type: 'go_second', difficulty: 'medium', name: 'Coventry Catch-Up', opponent: 'Coventry Curt', personality: 'You go second. Catch up.', settings: { playerGoesFirst: false } },
      { type: 'obstacle', difficulty: 'medium', name: 'West Side Five', opponent: 'West Side Wes', personality: 'Five walls. Five wins.', settings: { obstacleCells: [{row:1,col:1},{row:2,col:2},{row:3,col:3},{row:4,col:4},{row:5,col:5}] } },
      { type: 'connect5', difficulty: 'medium', name: 'Long Winter', opponent: 'Slavic Village Stas', personality: 'Five in a row. Lake winter long.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'standard', difficulty: 'medium', name: 'Old Brooklyn', opponent: 'Old Brooklyn Ollie', personality: 'Same name. Different world. Bigger board.', settings: { rows: 7, cols: 8 } },
      { type: 'obstacle', difficulty: 'hard', name: 'Charlie Everbrush', opponent: 'Charlie Everbrush', personality: 'You will hear this name again. Six walls.', settings: { obstacleCells: [{row:1,col:1},{row:1,col:5},{row:3,col:2},{row:3,col:4},{row:4,col:1},{row:4,col:5}] } },
      { type: 'puzzle', difficulty: 'hard', name: 'Bedford', opponent: 'Bedford Bree', personality: 'The position is set. Read the lake.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,2,0,0],[0,1,2,2,1,1,0],[2,1,1,2,2,1,2],[1,2,2,1,1,2,1]] } },
      { type: 'standard', difficulty: 'hard', name: 'Glenville', opponent: 'Glenville Grant', personality: 'No tricks. East 105th rules.', settings: { rows: 7, cols: 8 } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Murray Hill Stakes', opponent: 'Murray Hill Mac', personality: 'Triple bag. East 12th. Bring it.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: 755', opponent: '755', personality: '755 Broadway never forgot. The address you didnt know was an address. Connect 5. Eight walls. Survive the cold.', settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 12, obstacleCells: [{row:1,col:0},{row:1,col:7},{row:2,col:2},{row:2,col:5},{row:4,col:1},{row:4,col:6},{row:5,col:3},{row:5,col:4}] }, reward: { type: 'board', id: 'lake_effect', name: 'Lake Effect Board', icon: '🏞️' }, bonusReward: { type: 'title', name: '755', icon: '🔢' } },
    ],
  },

  // ─── 13 · PHILADELPHIA (Ivyfall / Zombie World) ──────────────────────
  {
    id: 'philadelphia', name: 'Ivyfall', state: 'Zombie World', nickname: 'The Steps',
    tagline: 'Climb the steps. Or get pushed down them.',
    unlockedAfterCityId: 'cleveland',
    themeColor: '#5ec46a', accentColor: '#9ce8a5',
    skyGradient: ['#1a1a2a', '#3a3a4a', '#bdc3c7'],
    mapPosition: { xPct: 86, yPct: 35 },
    opponents: [
      'Heavyweight Hal', 'Step Climber Stax', 'Scrappy Reggie', 'Iron Jaw Igor',
      'Right Hook Remy', 'Bell Ringer Belle', 'Flashfoot Asher', 'Haymaker Cleo',
      'Wrecker Dutch', 'Turnbuckle Tess', 'Southpaw Stefan', 'The Underdog',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'First Round', opponent: 'Heavyweight Hal', personality: 'Bell rings. Step up.' },
      { type: 'go_second', difficulty: 'medium', name: 'First Hit', opponent: 'Step Climber Stax', personality: 'You go second. Take the hit.', settings: { playerGoesFirst: false } },
      { type: 'standard', difficulty: 'medium', name: 'Steep Steps', opponent: 'Scrappy Reggie', personality: 'You ever climbed steps? 14 moves to the top.', settings: { movesLimit: 14 }, starThresholds: { three: 8, two: 11 } },
      { type: 'go_second', difficulty: 'medium', name: 'Iron Jaw', opponent: 'Iron Jaw Igor', personality: 'You go second. He starts strong.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0]] } },
      { type: 'jeopardy', difficulty: 'medium', name: 'Right Hook', opponent: 'Right Hook Remy', personality: 'Triple bag. Land the hook.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'go_second', difficulty: 'medium', name: 'Bell Ringer', opponent: 'Bell Ringer Belle', personality: 'You go second. The bell stings.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,2,2,2,0,0]] } },
      { type: 'speed', difficulty: 'medium', name: 'Flashfoot', opponent: 'Flashfoot Asher', personality: '5 second clock. Asher never stops moving.', settings: { timerSeconds: 5 } },
      { type: 'go_second', difficulty: 'hard', name: 'Haymaker', opponent: 'Haymaker Cleo', personality: 'You go second. He has a head start.', settings: { playerGoesFirst: false } },
      { type: 'connect5', difficulty: 'hard', name: 'Wrecker', opponent: 'Wrecker Dutch', personality: 'Five in a row. He hits like a wrecking ball.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'go_second', difficulty: 'hard', name: 'Turnbuckle', opponent: 'Turnbuckle Tess', personality: 'You go second. She came up from nothing too — a 2-piece head start to prove it.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,2,0,0]] } },
      { type: 'jeopardy', difficulty: 'hard', name: 'Southpaw', opponent: 'Southpaw Stefan', personality: 'Triple bag. The big fight.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: The Underdog', opponent: 'The Underdog', personality: 'You go second. Twelve-second clock. Climb the steps.', settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 12, playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,2,0,0,0],[0,0,0,2,2,0,0,0],[0,0,2,2,2,2,0,0]] }, reward: { type: 'board', id: 'liberty_bell', name: 'Liberty Bell Board', icon: '🔔' }, bonusReward: { type: 'title', name: 'The Underdog', icon: '🥊' } },
    ],
  },

  // ─── 14 · SEATTLE (Fogmourne / Zombie World) ─────────────────────────
  {
    id: 'seattle', name: 'Fogmourne', state: 'Zombie World', nickname: 'The Drowned',
    tagline: 'Gloomy puzzles. The board is wet. So are your odds.',
    unlockedAfterCityId: 'philadelphia',
    themeColor: '#16a085', accentColor: '#48c9b0',
    skyGradient: ['#0a1a2a', '#1a3a5a', '#16a085'],
    mapPosition: { xPct: 12, yPct: 12 },
    opponents: [
      'Drizzle Dane', 'Mist Mira', 'Overcast Oscar', 'Pour Patel',
      'Downpour Dakota', 'Cloud Cover Chase', 'Fog Freya', 'Squall Stan',
      'Pacific Paz', 'Cascade Cain', 'Soundwave Sven', 'The Storm',
    ],
    levels: [
      { type: 'standard', difficulty: 'medium', name: 'Light Drizzle', opponent: 'Drizzle Dane', personality: 'It always starts soft.' },
      { type: 'puzzle', difficulty: 'medium', name: 'Mist', opponent: 'Mist Mira', personality: 'Read the position through the haze.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,1,1,2,0,0],[0,2,2,1,1,2,0],[1,2,1,2,2,1,1]] } },
      { type: 'puzzle', difficulty: 'medium', name: 'Overcast', opponent: 'Overcast Oscar', personality: 'Sky is heavy. So is the board.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,2,0,0],[0,1,2,2,1,1,0],[2,1,1,2,2,1,2],[1,2,2,1,1,2,1]] } },
      { type: 'obstacle', difficulty: 'medium', name: 'Pour', opponent: 'Pour Patel', personality: 'Five walls. Find the dry path.', settings: { obstacleCells: [{row:1,col:1},{row:2,col:3},{row:1,col:5},{row:4,col:2},{row:4,col:4}] } },
      { type: 'puzzle', difficulty: 'medium', name: 'Downpour', opponent: 'Downpour Dakota', personality: 'Solve before you drown.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,2,0,1,0,0],[0,1,1,2,2,1,0],[2,2,1,1,2,2,1],[1,1,2,2,1,1,2]] } },
      { type: 'standard', difficulty: 'medium', name: 'Cloud Cover', opponent: 'Cloud Cover Chase', personality: 'No puzzle. Just gloom.', settings: { rows: 7, cols: 8 } },
      { type: 'obstacle', difficulty: 'hard', name: 'Fog', opponent: 'Fog Freya', personality: 'Six walls. Visibility nil.', settings: { obstacleCells: [{row:1,col:2},{row:2,col:1},{row:2,col:5},{row:3,col:3},{row:4,col:2},{row:4,col:4}] } },
      { type: 'puzzle', difficulty: 'hard', name: 'Squall', opponent: 'Squall Stan', personality: 'Sudden position. Sudden answer.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,2,0,1,0,0],[0,1,1,0,2,1,0],[0,2,2,1,1,2,0],[1,2,1,2,2,1,2],[2,1,2,1,1,2,1]] }, starThresholds: { three: 3, two: 5 } },
      { type: 'connect5', difficulty: 'hard', name: 'Pacific Long', opponent: 'Pacific Paz', personality: 'Five in a row. Wide ocean.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'puzzle', difficulty: 'hard', name: 'Cascade', opponent: 'Cascade Cain', personality: 'Falling pieces. Falling rain.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,0,1,1,0,0],[0,2,1,2,2,1,0],[1,1,2,1,2,2,1],[2,1,1,2,1,2,1]] } },
      { type: 'moves_limit', difficulty: 'hard', name: 'Soundwave', opponent: 'Soundwave Sven', personality: '8 moves. Sound the bell.', settings: { rows: 7, cols: 8, movesLimit: 8 } },
      { type: 'boss', difficulty: 'hard', name: 'BOSS: The Storm', opponent: 'The Storm', personality: 'Connect 5. 10 second clock. Read the storm. Solve the puzzle. Survive.', settings: { rows: 7, cols: 8, connectCount: 5, timerSeconds: 10, presetBoard: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,2,1,2,0,0],[0,0,2,1,2,1,2,0],[0,1,2,1,2,1,1,2],[2,1,1,2,1,2,2,1]] }, reward: { type: 'board', id: 'pacific_storm', name: 'Pacific Storm Board', icon: '🌧️' }, bonusReward: { type: 'title', name: 'Stormwalker', icon: '⛈️' } },
    ],
  },

  // ─── 15 · TORONTO (Last Spire / Zombie World) ────────────────────────
  {
    id: 'toronto', name: 'Last Spire', state: 'Zombie World', nickname: 'The Citadel',
    tagline: 'Border crossing. New rules apply. Bring everything.',
    unlockedAfterCityId: 'seattle',
    themeColor: '#e74c3c', accentColor: '#ffffff',
    skyGradient: ['#0a0a1a', '#2a1a3a', '#e74c3c'],
    mapPosition: { xPct: 70, yPct: 14 },
    opponents: [
      'Border Blair', "North Star Nox", 'Six Side Sonny', 'Mosaic Maya',
      'Polyglot Pria', 'Highrise Hugo', 'Maple Moe', 'Crown Carrera',
      'Northern Light Nyx', 'Steel Stadium Sarge', 'Empire Enzo', 'Six King',
    ],
    levels: [
      { type: 'standard', difficulty: 'hard', name: 'Last Gate', opponent: 'Border Blair', personality: 'New country. Same game. Harder bot.', settings: { rows: 7, cols: 8 } },
      { type: 'speed', difficulty: 'hard', name: 'Spire Star', opponent: 'North Star Nox', personality: '4 second clock. The North is fast.', settings: { timerSeconds: 4 } },
      { type: 'obstacle', difficulty: 'hard', name: 'Six Spires', opponent: 'Six Side Sonny', personality: 'Six walls. The last six.', settings: { obstacleCells: [{row:1,col:1},{row:2,col:2},{row:3,col:3},{row:3,col:4},{row:2,col:5},{row:1,col:6}] } },
      { type: 'puzzle', difficulty: 'hard', name: 'Mosaic', opponent: 'Mosaic Maya', personality: 'Read the position. Build a line.', settings: { presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,1,0,0],[0,0,0,0,1,1,0],[0,1,2,1,2,2,0],[2,1,1,2,1,2,1],[1,2,2,1,2,1,2]] }, starThresholds: { three: 3, two: 5 } },
      { type: 'connect5', difficulty: 'hard', name: 'Polyglot', opponent: 'Polyglot Pria', personality: 'Five in a row. She speaks every game.', settings: { rows: 8, cols: 9, connectCount: 5 } },
      { type: 'jeopardy', difficulty: 'legendary', name: 'Spire Money', opponent: 'Highrise Hugo', personality: 'Triple bag. Built his whole stack from nothing.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3 } },
      { type: 'go_second', difficulty: 'hard', name: 'Ashfall', opponent: 'Maple Moe', personality: 'You go second. The ash never lets up.', settings: { playerGoesFirst: false, presetBoard: [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,2,2,2,0,0]] } },
      { type: 'speed', difficulty: 'hard', name: 'Crown Speed', opponent: 'Crown Carrera', personality: '3 second clock. Crowns wait for no one.', settings: { rows: 7, cols: 8, timerSeconds: 3 } },
      { type: 'connect6', difficulty: 'hard', name: 'Last Light', opponent: 'Northern Light Nyx', personality: 'Six in a row. Sky is strange up here.', settings: { rows: 9, cols: 9, connectCount: 6 } },
      { type: 'jeopardy', difficulty: 'legendary', name: 'Steel Spire', opponent: 'Steel Stadium Sarge', personality: 'Triple bag. Connect 5. 6 second clock.', settings: { rows: 7, cols: 8, connectCount: 5, rewardMultiplier: 3, timerSeconds: 6 } },
      { type: 'obstacle', difficulty: 'hard', name: 'Empire Enzo', opponent: 'Empire Enzo', personality: 'Eight walls. Find the empire path.', settings: { obstacleCells: [{row:1,col:1},{row:1,col:6},{row:2,col:3},{row:2,col:4},{row:3,col:2},{row:3,col:5},{row:4,col:3},{row:4,col:4}] } },
      // Six King identity RESTORED 2026-07-12: connectCount 6 + the authored
      // checker-pyramid seed (apex = player piece, row under it = King).
      // Sim: 50% medium / 73% hard AI at the boss's tuned medium band
      // (timer pressure pushes real play lower) — menacing but honest.
      { type: 'boss', difficulty: 'legendary', name: 'BOSS: Six King', opponent: 'Six King', personality: "v1's final boss. SIX in a row. Triple bag. 8 second clock. You go second. Four walls. Bring everything.", settings: { rows: 9, cols: 9, connectCount: 6, timerSeconds: 8, rewardMultiplier: 3, playerGoesFirst: false, obstacleCells: [{row:2,col:2},{row:2,col:6},{row:6,col:2},{row:6,col:6}], presetBoard: [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,1,0,0,0,0],[0,0,0,2,2,2,0,0,0],[0,0,2,1,2,1,2,0,0],[0,2,1,2,1,2,1,2,0]] }, reward: { type: 'board', id: 'crown_court', name: 'Crown Court Board', icon: '👑' }, bonusReward: { type: 'title', name: 'Six King', icon: '6️⃣' } },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// §4 — CAREER_TUNE + applyTune (from careerTuning.ts, verbatim)
// ═══════════════════════════════════════════════════════════════════════
// Sim-derived difficulty override table. Keyed by level id, OVERRIDES the
// authored recipe difficulty/settings so the campaign hits a Candy-Crush
// "hard but fair" win-rate curve. Untuned ids fall through unchanged.

export const CAREER_TUNE = {
  8: { difficulty: 'easy' },
  9: { difficulty: 'easy', movesLimit: 12 },
  11: { difficulty: 'easy' },
  13: { difficulty: 'easy' },
  15: { difficulty: 'easy' },
  16: { difficulty: 'medium' },
  17: { difficulty: 'easy' },
  18: { difficulty: 'easy' },
  19: { difficulty: 'easy' },
  20: { difficulty: 'easy' },
  21: { difficulty: 'easy' },
  23: { difficulty: 'medium' },
  24: { difficulty: 'medium' },
  25: { difficulty: 'easy' },
  26: { difficulty: 'easy' },
  27: { difficulty: 'easy' },
  29: { difficulty: 'easy' },
  30: { difficulty: 'easy' },
  31: { difficulty: 'easy' },
  32: { difficulty: 'easy', movesLimit: 16 },
  33: { difficulty: 'easy' },
  34: { difficulty: 'easy' },
  35: { difficulty: 'easy', clearSeed: true },
  // 36 (Cathedral Warden): clearSeed REMOVED 2026-07-12 — his identity IS
  // the seeded threat (the 'warden' bossScript has no other mechanic).
  36: { difficulty: 'easy' },
  37: { difficulty: 'easy' },
  40: { difficulty: 'easy' },
  42: { difficulty: 'hard' },
  43: { difficulty: 'easy' },
  45: { difficulty: 'easy' },
  46: { difficulty: 'easy' },
  47: { difficulty: 'easy' },
  48: { difficulty: 'medium' },
  49: { difficulty: 'easy' },
  51: { difficulty: 'easy' },
  52: { difficulty: 'easy' },
  55: { difficulty: 'easy' },
  57: { difficulty: 'easy' },
  58: { difficulty: 'easy' },
  59: { difficulty: 'medium' },
  60: { difficulty: 'medium' },
  62: { difficulty: 'hard' },
  63: { difficulty: 'easy' },
  64: { difficulty: 'easy' },
  65: { difficulty: 'easy' },
  66: { difficulty: 'easy' },
  67: { difficulty: 'easy' },
  68: { difficulty: 'easy' },
  69: { difficulty: 'easy' },
  70: { difficulty: 'medium' },
  72: { difficulty: 'medium', clearSeed: true },
  73: { difficulty: 'easy' },
  75: { difficulty: 'easy' },
  77: { difficulty: 'easy' },
  79: { difficulty: 'medium' },
  80: { difficulty: 'easy' },
  82: { difficulty: 'easy' },
  83: { difficulty: 'medium' },
  84: { difficulty: 'easy' },
  86: { difficulty: 'easy' },
  87: { difficulty: 'hard' },
  88: { difficulty: 'easy' },
  90: { difficulty: 'easy' },
  91: { difficulty: 'medium' },
  92: { difficulty: 'medium' },
  94: { difficulty: 'medium' },
  95: { difficulty: 'medium' },
  97: { difficulty: 'easy' },
  99: { difficulty: 'easy' },
  101: { difficulty: 'easy' },
  102: { difficulty: 'easy', movesLimit: 12 },
  103: { difficulty: 'easy' },
  104: { difficulty: 'easy' },
  105: { difficulty: 'easy' },
  107: { difficulty: 'easy', clearSeed: true },
  108: { difficulty: 'medium', clearSeed: true },
  110: { difficulty: 'easy' },
  113: { difficulty: 'easy' },
  116: { difficulty: 'easy' },
  117: { difficulty: 'medium' },
  119: { difficulty: 'easy', movesLimit: 13 },
  121: { difficulty: 'hard' },
  122: { difficulty: 'easy' },
  123: { difficulty: 'easy' },
  124: { difficulty: 'hard' },
  125: { difficulty: 'hard' },
  126: { difficulty: 'easy' },
  127: { difficulty: 'hard' },
  128: { difficulty: 'medium' },
  129: { difficulty: 'medium', clearSeed: true },
  130: { difficulty: 'easy' },
  132: { difficulty: 'easy' },
  134: { difficulty: 'hard' },
  136: { difficulty: 'easy' },
  140: { difficulty: 'medium' },
  142: { difficulty: 'hard' },
  143: { difficulty: 'medium' },
  144: { difficulty: 'medium' },
  146: { difficulty: 'easy' },
  148: { difficulty: 'easy' },
  150: { difficulty: 'medium', clearSeed: true },
  152: { difficulty: 'medium' },
  153: { difficulty: 'medium' },
  154: { difficulty: 'easy' },
  155: { difficulty: 'easy' },
  156: { difficulty: 'medium', clearSeed: true },
  161: { difficulty: 'hard' },
  163: { difficulty: 'medium' },
  167: { difficulty: 'easy' },
  168: { difficulty: 'medium', clearSeed: true },
  169: { difficulty: 'medium' },
  170: { difficulty: 'medium' },
  171: { difficulty: 'medium' },
  172: { difficulty: 'medium' },
  173: { difficulty: 'medium' },
  174: { difficulty: 'medium' },
  175: { difficulty: 'medium', clearSeed: true },
  177: { difficulty: 'easy' },
  178: { difficulty: 'medium' },
  179: { difficulty: 'medium' },
  // 180 (Six King finale): connectCount 5 + clearSeed REMOVED 2026-07-12 —
  // a boss named Six King must require six; authored seed restored. Only
  // the AI band stays tuned (re-simmed).
  180: { difficulty: 'medium' },
};

/** Apply a level's tune override to its resolved difficulty + normalized
 *  settings. Pure — returns a new pair; no mutation of the inputs. Called
 *  by buildLevel after normalizeSettings + mercy flags. */
export function applyTune(id, difficulty, settings) {
  const t = CAREER_TUNE[id];
  if (!t) return { difficulty, settings };
  const s = { ...settings };
  if (t.clearSeed && s.presetBoard) {
    const cols = s.cols ?? 7;
    const rows = s.rows ?? 6;
    s.presetBoard = Array.from({ length: cols }, () => Array(rows).fill(0));
  }
  if (t.movesLimit != null) s.movesLimit = t.movesLimit;
  if (t.connectCount != null) s.connectCount = t.connectCount;
  if (t.playerGoesFirst != null) s.playerGoesFirst = t.playerGoesFirst;
  return { difficulty: t.difficulty ?? difficulty, settings: s };
}

// ═══════════════════════════════════════════════════════════════════════
// §5 — Generator (from careerGenerator.ts, pure recipe → CareerLevel/City)
// ═══════════════════════════════════════════════════════════════════════

/** Fixed slots per city. Required for stable ID assignment. */
const LEVELS_PER_CITY = 12;

/** Compute the global level ID for a given (cityIndex, slotIndex). */
export function levelIdFor(cityIndex, slotIndex) {
  return cityIndex * LEVELS_PER_CITY + slotIndex + 1;
}

/** Resolve the opponent name for a recipe slot. Recipe override wins;
 *  otherwise round-robin through the city's roster keyed by slot. */
function resolveOpponent(recipe, city, slotIndex) {
  if (recipe.opponent) return recipe.opponent;
  if (city.opponents.length === 0) return `Opponent ${slotIndex + 1}`;
  return city.opponents[slotIndex % city.opponents.length];
}

/** Resolve the level name. Recipe override wins; otherwise pick a
 *  templated name from the type's pool. */
function resolveName(recipe, slotIndex) {
  if (recipe.name) return recipe.name;
  return defaultNameFor(recipe.type, slotIndex);
}

/** Resolve the personality string. Recipe override > city pool >
 *  type-templated default. */
function resolvePersonality(recipe, city, slotIndex) {
  if (recipe.personality) return recipe.personality;
  if (city.personalityPool && city.personalityPool.length > 0) {
    return city.personalityPool[slotIndex % city.personalityPool.length];
  }
  return defaultPersonalityFor(recipe.type, slotIndex);
}

/** Recipes author presetBoard the way a human reads a grid — ROW-major
 *  ([row][col], top row first). The engine consumes COLUMN-major boards
 *  (board[col][row]). Transpose exactly once, here. */
function normalizeSettings(settings) {
  if (!settings?.presetBoard) return settings ?? {};
  const rows = settings.rows ?? 6;
  const cols = settings.cols ?? 7;
  const p = settings.presetBoard;
  // Defensive: a non-square preset that already matches [col][row] dims
  // is left alone (can't happen under the row-major authoring contract,
  // but transposing it twice would be worse than trusting it).
  if (rows !== cols && p.length === cols && (p[0]?.length ?? 0) === rows) return settings;
  const transposed = Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => p[r]?.[c] ?? 0),
  );
  return { ...settings, presetBoard: transposed };
}

/** Levels 1-3 (the very first city's opening slots) get the mercy-ramp
 *  flag — see CareerLevel.settings.mercyBoost. */
function isMercyRampLevel(id) {
  return id >= 1 && id <= 3;
}

/** Build a single CareerLevel from a recipe + its position. */
function buildLevel(recipe, city, cityIndex, slotIndex) {
  const id = levelIdFor(cityIndex, slotIndex);
  const isBoss = recipe.type === 'boss';
  const settings = normalizeSettings(recipe.settings);
  if (isMercyRampLevel(id)) settings.mercyBoost = true;
  const { difficulty, settings: tunedSettings } = applyTune(id, recipe.difficulty, settings);
  return {
    id,
    name: resolveName(recipe, slotIndex),
    opponent: resolveOpponent(recipe, city, slotIndex),
    opponentPersonality: resolvePersonality(recipe, city, slotIndex),
    chapter: cityIndex + 1,
    type: recipe.type,
    difficulty,
    isBoss,
    settings: tunedSettings,
    reward: recipe.reward ?? defaultRewardFor(recipe.type, difficulty),
    bonusReward: recipe.bonusReward ?? defaultBonusRewardFor(recipe.type, difficulty),
    starThresholds: recipe.starThresholds ?? defaultStarsFor(recipe.type, tunedSettings.movesLimit),
  };
}

/** Generate the full career dataset from CITY_RECIPES. Pure — called once
 *  at module-init below, result cached in module-level constants. */
export function generateCareerData() {
  const levels = [];
  const cities = [];
  const chapters = [];

  CITY_RECIPES.forEach((city, cityIndex) => {
    const cityLevels = [];
    const levelIds = [];

    if (!city.comingSoon) {
      city.levels.forEach((recipe, slotIndex) => {
        if (slotIndex >= LEVELS_PER_CITY) return; // safety net, shouldn't happen
        const lvl = buildLevel(recipe, city, cityIndex, slotIndex);
        levels.push(lvl);
        cityLevels.push(lvl);
        levelIds.push(lvl.id);
      });
    }

    cities.push({
      id: city.id,
      name: city.name,
      nickname: city.nickname,
      state: city.state,
      tagline: city.tagline,
      themeColor: city.themeColor,
      accentColor: city.accentColor,
      skyGradient: city.skyGradient,
      mapPosition: city.mapPosition,
      unlockedAfterCityId: city.unlockedAfterCityId,
      comingSoon: city.comingSoon,
      levelIds,
    });

    if (cityLevels.length > 0) {
      chapters.push({
        id: cityIndex + 1,
        name: city.nickname,
        levels: cityLevels,
      });
    }
  });

  return { levels, cities, chapters };
}

// ═══════════════════════════════════════════════════════════════════════
// §6 — Generated dataset (single source of truth, cached at module-init)
// ═══════════════════════════════════════════════════════════════════════

const _DATA = generateCareerData();

/** All 180 levels in career order, IDs 1-180. */
export const ALL_CAREER_LEVELS = _DATA.levels;

/** One chapter entry per city (id = cityIndex+1, name = city.nickname). */
export const CHAPTERS = _DATA.chapters;

/** All 15 cities with levelIds populated. */
export const CAREER_CITIES = _DATA.cities;

// ─── Ratings (cosmetic OVR badge, from careerLevels.ts) ────────────────

const ALL_LEVEL_COUNT = ALL_CAREER_LEVELS.reduce((m, l) => Math.max(m, l.id), 1);

function computeRating(level) {
  // Driven mainly by CAREER POSITION, not by the tuned AI band — a
  // Basketball-Stars-style flourish so the card numbers climb across the
  // campaign even though careerTuning.ts drops most late bosses to
  // 'medium' for fairness.
  const idx = Math.max(0, level.id - 1);
  const span = Math.max(1, ALL_LEVEL_COUNT - 1);
  const ramp = Math.round((idx / span) * 22); // 0 → 22 across the campaign
  const diffBump =
    level.difficulty === 'easy' ? 0 :
    level.difficulty === 'medium' ? 2 :
    level.difficulty === 'hard' ? 4 : 6; // legendary
  const spread = (level.id * 3) % 3; // ±2 so neighbours aren't identical
  const boss = level.isBoss ? 4 : 0;
  return Math.min(99, 70 + ramp + diffBump + spread + boss);
}

/** Per-level rating lookup (70-99). */
export const CAREER_RATINGS = ALL_CAREER_LEVELS.reduce((acc, lvl) => {
  acc[lvl.id] = computeRating(lvl);
  return acc;
}, {});

// ─── Lookups + helpers (from careerLevels.ts) ──────────────────────────

/** Fast city-by-id index. */
export const CITY_BY_ID = CAREER_CITIES.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

/** All levels that belong to a given city, in career order. */
export function getLevelsForCity(cityId) {
  const city = CITY_BY_ID[cityId];
  if (!city) return [];
  return city.levelIds
    .map((id) => ALL_CAREER_LEVELS.find((l) => l.id === id))
    .filter((l) => !!l);
}

/** Is a city unlocked given the set of completed level ids? */
export function isCityUnlocked(cityId, completedLevelIds) {
  const city = CITY_BY_ID[cityId];
  if (!city) return false;
  if (city.comingSoon) return false;
  if (!city.unlockedAfterCityId) return true; // starter city
  const prereq = CITY_BY_ID[city.unlockedAfterCityId];
  if (!prereq) return true;
  return prereq.levelIds.every((id) => completedLevelIds.has(id));
}

/** Completion count + star count for a given city. */
export function getCityCompletion(city, progress = {}) {
  const total = city.levelIds.length;
  let completed = 0;
  let stars = 0;
  for (const id of city.levelIds) {
    const p = progress[id];
    if (p?.completed) completed++;
    stars += p?.stars ?? 0;
  }
  const maxStars = total * 3;
  return {
    completed,
    total,
    stars,
    maxStars,
    fraction: total > 0 ? completed / total : 0,
  };
}

/** Aggregate reputation: 0-5 stars based on total career stars. Scales
 *  with the live level count (ALL_CAREER_LEVELS.length x 3 stars each,
 *  split into 5 even bands) so the top band stays reachable. */
export function getReputationStars(totalStars) {
  const maxStars = ALL_CAREER_LEVELS.length * 3;
  const starsPerRep = Math.max(1, maxStars / 5);
  return Math.min(5, Math.floor(totalStars / starsPerRep));
}

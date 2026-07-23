/**
 * Drop4 Hub — career data unit tests. Zero dependencies; run with `node`.
 * Verifies career-data.js (ported from Drop4's careerLevels/careerRecipes/
 * careerGenerator/careerTuning) preserves the 180-level contract and that
 * the AMG Hub gem remap is fully scrubbed (single coin economy, no gems).
 * Explicit pass/fail counting and a non-zero exit on any failure.
 */
import {
  ALL_CAREER_LEVELS,
  CAREER_CITIES,
  CHAPTERS,
  CITY_BY_ID,
} from '../career-data.js';

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name) {
  if (cond) { pass++; } else { fail++; fails.push(name); console.log('  ✗ FAIL:', name); }
}
function eq(a, b, name) {
  ok(JSON.stringify(a) === JSON.stringify(b), name + ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

// ── level count + id contract ──────────────────────────────────────────
ok(ALL_CAREER_LEVELS.length === 180, `exactly 180 levels (got ${ALL_CAREER_LEVELS.length})`);

{
  const ids = ALL_CAREER_LEVELS.map((l) => l.id);
  const idSet = new Set(ids);
  ok(idSet.size === ids.length, 'no duplicate level ids');
  const sorted = [...idSet].sort((a, b) => a - b);
  let noGaps = sorted.length === 180;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) { noGaps = false; break; }
  }
  ok(noGaps, 'ids are exactly 1..180 with no gaps');
}

// ── cities + chapters ───────────────────────────────────────────────────
ok(CAREER_CITIES.length === 15, `exactly 15 cities (got ${CAREER_CITIES.length})`);
ok(CHAPTERS.length === 15, `exactly 15 chapters (got ${CHAPTERS.length})`);
{
  let allTwelve = true;
  for (const city of CAREER_CITIES) {
    if (!Array.isArray(city.levelIds) || city.levelIds.length !== 12) {
      allTwelve = false;
      console.log('  ✗ city with != 12 levelIds:', city.id, city.levelIds?.length);
    }
  }
  ok(allTwelve, 'every city has exactly 12 levelIds');
}

// ── boss scripts ────────────────────────────────────────────────────────
function levelById(id) { return ALL_CAREER_LEVELS.find((l) => l.id === id); }
eq(levelById(12)?.settings?.bossScript, 'tommy', 'level 12 bossScript === tommy');
eq(levelById(24)?.settings?.bossScript, 'sal', 'level 24 bossScript === sal');
eq(levelById(36)?.settings?.bossScript, 'warden', 'level 36 bossScript === warden');

// ── mercy boost ──────────────────────────────────────────────────────────
ok(levelById(1)?.settings?.mercyBoost === true, 'level 1 mercyBoost === true');
ok(levelById(2)?.settings?.mercyBoost === true, 'level 2 mercyBoost === true');
ok(levelById(3)?.settings?.mercyBoost === true, 'level 3 mercyBoost === true');
ok(!levelById(4)?.settings?.mercyBoost, 'level 4 mercyBoost is falsy');

// ── gem scrub ────────────────────────────────────────────────────────────
{
  let noGemType = true;
  for (const lvl of ALL_CAREER_LEVELS) {
    if (lvl.reward?.type === 'gems') { noGemType = false; console.log('  ✗ reward type gems on id', lvl.id); }
    if (lvl.bonusReward?.type === 'gems') { noGemType = false; console.log('  ✗ bonusReward type gems on id', lvl.id); }
  }
  ok(noGemType, "no level's reward/bonusReward has type === 'gems'");
}
{
  const json = JSON.stringify(ALL_CAREER_LEVELS);
  ok(!json.includes('💎'), 'ALL_CAREER_LEVELS JSON contains no 💎 glyph');
  ok(!/\bGems?\b/i.test(json), 'ALL_CAREER_LEVELS JSON contains no /\\bGems?\\b/i');
}

// ── star thresholds + difficulty band ───────────────────────────────────
{
  const validDiff = new Set(['easy', 'medium', 'hard', 'legendary']);
  let starsOk = true;
  let diffOk = true;
  for (const lvl of ALL_CAREER_LEVELS) {
    if (typeof lvl.starThresholds?.three !== 'number' || typeof lvl.starThresholds?.two !== 'number') {
      starsOk = false;
      console.log('  ✗ missing numeric starThresholds on id', lvl.id, lvl.starThresholds);
    }
    if (!validDiff.has(lvl.difficulty)) {
      diffOk = false;
      console.log('  ✗ invalid difficulty on id', lvl.id, lvl.difficulty);
    }
  }
  ok(starsOk, 'every level has numeric starThresholds.three and .two');
  ok(diffOk, 'every level has difficulty in easy|medium|hard|legendary');
}

// ── presetBoard orientation spot-check (column-major [col][row]) ───────
{
  let foundColumnMajor = false;
  for (const lvl of ALL_CAREER_LEVELS) {
    const pb = lvl.settings?.presetBoard;
    if (!pb) continue;
    const cols = lvl.settings.cols ?? 7;
    const rows = lvl.settings.rows ?? 6;
    if (cols === rows) continue; // ambiguous on square boards, skip
    if (pb.length === cols && (pb[0]?.length ?? 0) === rows) {
      foundColumnMajor = true;
      break;
    }
  }
  ok(foundColumnMajor, 'at least one non-square presetBoard is column-major (outer=cols, inner=rows)');
}

// ── summary ──────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('Failed:', fails.join(', '));
  process.exit(1);
}

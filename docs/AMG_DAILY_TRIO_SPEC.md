# Daily Trio — spec (2026-07-30)

The "one more go" engine for score-attack games. Three rotating daily missions per game.
This is the mechanic Cool Math-class sites lack and store apps live on: a reason to open
the SAME game again today, and again tomorrow.

## Rules (locked — build agents do not deviate)

1. **Deterministic, serverless.** Seed = `YYYY-MM-DD + gameId` → seeded PRNG picks 3
   missions from the game's template pool and fills their parameters. Every kid sees the
   same trio for a given game on a given day ("did you finish today's trio?" is a
   lunchroom conversation — that's the point).
2. **Template pool per game**: 6–10 templates with parameter ranges, checked against
   stats the game ALREADY tracks in-session (score, pipes, slices, streaks, wins, time).
   A template that would need new stat plumbing is the wrong template — pick another.
3. **Rewards, earned-only**: each mission pays ≈ 1x that game's typical single-game coin
   earn (read the game's real payout code to calibrate — e.g. if a decent run pays 8,
   missions pay 8). All 3 done → +50% bonus and a "Daily Trio ⭐" celebration toast.
   Coins flow through the game's EXISTING awardCoins mechanism. Anonymous players see
   missions and progress but coins follow the game's existing anon rules.
4. **No day-streak multipliers in v1.** No gems, no purchases, nothing timed under an
   hour. Missions never punish — incomplete trios just reset tomorrow.
5. **Persistence** (canonical shape, learned from the flappy build): `odaTrio_<gameId>`
   holds `{date, ids:[3], targets:[3], progress:[3], done:[3], paid:[3], trioBonusPaid,
   runsToday}`. `targets` are SNAPSHOTTED at generation (a target computed from the
   player's best must not drift as best improves mid-day). `runsToday` counts runs even
   when no run-count template was drawn. Date mismatch on load → regenerate. `paid`
   flags make coin awards idempotent — persist them BEFORE calling awardCoins. Optional
   additive `trioCompletions` increment on the game's records doc.
6. **UI, zero new screens**: a compact "Today's Trio" card on the game's home screen
   (3 rows: emoji, text, live progress like `3/5`, ✓ when done), styled with the game's
   existing card conventions + oda-theme vars. Mid-game: when a mission completes, a
   small toast (house pattern) — never blocks play, never fires during critical input.
7. **Progress updates**: hook the END of a run (game-over/win path) with the session's
   stats — do NOT poll or hook per-frame. Cumulative templates ("slice 40 fruits today")
   accumulate across runs via the localStorage record.
8. **Mission text is kid-voiced and specific**: "Pass 12 pipes in one run 🐦", not
   "Achieve a score of 12."

## Canonical build order

flappy (canonical, hero game) → snake, doodlejump, fruitninja, helicopter, stacktower,
suika, 2048, brickbreaker, whackamole, dodgeball, colormatch, reaction, aimtrainer,
numbermemory, simonsays, wordscramble, mathsprint (learning: pays MORE per the
Learn-&-Earn axiom — calibrate ~1.5x).

Head-to-head games (connect4, tictactoe, checkers...) already have Ladder Climb as their
progression engine — they do NOT get trios in v1 (two progression systems at once
muddies both).

## Template shape (canonical, from the flappy build)

```js
// {id, text(params), icon, params:{min,max}|fixed, check(sessionStats, cumulative), target}
const TRIO_TEMPLATES = [
  { id:'pipes_run',  icon:'🐦', make:r => ({target: 8+r(10)}),  text:t => `Pass ${t} pipes in one run` },
  { id:'pipes_day',  icon:'🌊', make:r => ({target: 30+r(30)}), text:t => `Pass ${t} pipes today (any runs)` },
  { id:'chill_run',  icon:'🐢', make:r => ({target: 10+r(8)}),  text:t => `Score ${t} in Chill Mode` },
  ...
];
```

Seeded PRNG: mulberry32 over a hash of `date+gameId` — COPY from the canonical flappy
implementation (arcade/flappy/index.html, /* ===== DAILY TRIO ===== */ section, shipped
2026-07-30). Do not re-derive.

## Port notes from the canonical build

- Player-relative targets (like flappy's half_best) break the "same trio for everyone"
  conversation — the mission is shared but the number differs per kid. Acceptable, but
  prefer absolute targets in ports.
- "Play N runs today" templates count instant-death runs too — keep those missions'
  rewards at the base rate (farming N insta-deaths for one base reward is not worth
  patching, but never attach the bonus to them alone).
- Toasts stagger onto the game-over overlay (800ms + 700ms/idx) — never mid-play.

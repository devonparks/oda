# AMG Hub — Overnight Upgrade Backlog (2026-07-30)

Source: 10-agent behavior-based audit of all 50 arcade games against `AMG_GAME_STANDARD.md`
(The Bar). Scores are shell / economy / juice / cosmetics, 0–5. This doc is the working
checklist for the overnight run; each finished game gets its box checked + a commit.

**Ground rules:** surgical per-game diffs only, strengths are do-not-break, verify in
browser before commit, one commit per game, push in small batches (deploys amghub.org).

---

## Hard bugs found by the audit (fix first — real, concrete, high confidence)

- [x] **tetris** (5/3/5/5) — SHIPPED ceb6d23 (leaderboard live once Devon deploys rules): records are localStorage-ONLY — no Firestore `tetrisRecords`, no
  class leaderboard, despite "P0 done" claim. Add additive Firestore write + leaderboard
  panel (model on suika). Do NOT restructure loadStats/saveStats.
- [x] **tictactoe** (5/5/4/5) — SHIPPED 62cea0b (+ js/student.js aggregate fix): TWO record collections in use — `tictactoeRecords` (stale
  early reads) vs `tttRecords` (feeds awardCoins/leaderboard). Confirm which feeds UI,
  consolidate reads, smallest safe diff. Careless merge could zero a live leaderboard.
- [x] **typing** (2/4/4/4) — SHIPPED 3e1333a: NO sound toggle anywhere — SFX plays unconditionally, ignores
  `odaSoundEnabled`. Add toggle button + persist. Also add home quick-stats pills.
- [x] **trivia** (3/4/4/4) — SHIPPED 5f9e2c1: sound toggle exists but not persisted/read from
  `odaSoundEnabled` — resets every load. Two-line fix.
- [ ] **solitaire** (2/3/4/4): no class leaderboard at all; achievements localStorage-only
  (never sync to Firestore); `odaHelp.init` unguarded. KEEP direct-to-table entry (kids'
  muscle memory) — add leaderboard + sync without forcing a home menu.
- [ ] **minesweeper** (5/5/3/1): `myCosmetics` is DEAD CODE — loaded, never rendered. Wire
  flag/board-theme cosmetic + add win particles + light shake.
- [x] **pixelplaza**: empty directory, NOT referenced by any registry — no player impact.
  Flag to Devon: delete folder or build the game someday.

## Wave A — hero games (engagement data: these earn the most plays)

- [x] **flappy** (5/5/4/4) — SHIPPED 0887abc: add crash shake + pipe-pass glow/combo pop. If a slow/easy mode
  exists, surface it as first-class "Chill Mode" card (376 plays, 22/kid — the retention
  monster was driven by easy mode). Physics untouched.
- [x] **rps** (5/5/4/5) — SHIPPED 89ca52d: streak popup on consecutive wins (streak already tracked, no
  payoff); verify sound fires on choose/reveal/win.
- [x] **pingpong** (5/5/3/5) — SHIPPED 42ecbec: paddle-hit flash/scale-pop + rally-streak popup. Sibling
  penaltykick is the juice reference. Don't touch coin tiers/perfectGames.
- [x] **basketball** (5/5/5/4) — VERIFIED CORRECT, no edit needed: VERIFY-only — confirm oda_cosmetics_basketball actually
  swaps the rendered character (not a hardcoded charId). Fix only if broken.
- [x] **hangman** (5/5/5/5) — SKIPPED by design (risk > value): already at bar. Optional hygiene only (dup win paths) — SKIP
  unless trivial; risk isn't worth it. Tournament payout paths fragile.
- [x] **uno** — VERIFIED already complete: 10 real badges + working animated toast fired
  from both win paths + Firestore-backed streak unlocks. Audit grep undercounted. No edit.

## Wave B — flat games get their moment (celebration/juice/cosmetic wiring, all S)

- [x] **sudoku** — SHIPPED 7e4d3c7: every solve celebrates; entry pulse already existed
  (verify-first caught it). Coin premium untouched (Devon's balance call).
- [x] **slidingpuzzle** — SHIPPED 2b8edd1: real find — local confetti never routed through
  odaCelebrate, so purchased win effects never rendered here. Fixed + snap pulse.
- [x] **floodfill** — SHIPPED c2f78fc: fill pulse + every-win celebration.
- [x] **war** — SHIPPED ac6d826: WAR table shake + winner card flash. Kept minimal.
- [x] **lightsout** — VERIFIED already working (cosmetics render via theme-*/color-*
  classes; toast exists). Audit premise wrong, zero edits.
- [x] **mathsprint** — VERIFIED already working (theme + number style render in-game;
  wrong-answer tone exists). Audit premise wrong, zero edits.
- [x] **2048** — SHIPPED e435ef4: merge flash 128+, combo popup. Tile themes verified
  wired (accent ring/glow by design, not full recolor — design question, left alone).
- [x] **blockblast** — SHIPPED daec8cb: real find — piece tray/drag previews ignored the
  equipped color theme (grid cells honored it). CSS fix + clear-streak popups.
- [x] **bowling** — SHIPPED c78f06e: strike shake. Ball/lane/pin cosmetics verified fully
  wired (audit premise wrong).
- [x] **retrobowl** — SHIPPED c170d28: hub identity nameColor = helmet stripe accent (no
  retrobowl catalogue exists; didn't invent shop items). Gradient tiers fall back white.
- [x] **simonsays** — SHIPPED b239ebe: round milestone popups + sequence-complete glow,
  timing chain byte-identical.

## Wave C — bigger/riskier M items (only with fresh verification each)

- [x] **checkers** — SHIPPED (Wave C): real find — its hand-rolled achievements existed
  but could NEVER unlock (hardcoded wins:1 overwrote real counts; most hooks never
  called). Fixed + 6 new badges = 14. ck_tourney stays unwired (tournament code
  off-limits). Multiplayer piece-loss tracking is a snapshot-diff heuristic.
- [x] **chess** — SHIPPED (Wave C): audit premise wrong (had 10 badges already); added 6
  additive ones (castle/promote/queen-capture/checkmate-win/streak/first-win) = 16.
- [x] **brickbreaker** — VERIFIED had a full 6-badge system (audit wrong). Wave D shipped
  the real bug instead: Records screen showed badges locked until a game-over that
  session (achState never loaded on open). Fixed.
- [x] **battleship** — SHIPPED (Wave C): sunk-ship red flash + shake, both directions,
  Set-deduped, render-layer only. Ocean/Ship/Hit cosmetics verified already fully wired
  (audit wrong). Noted: --bs-grid CSS var is set but consumed nowhere (inert, pre-existing).
- [x] **lemonade** — SHIPPED (Wave C): real find — coins only awarded on the Next Day
  click, so leaving via the back link forfeited them. Award moved to day-end. Profit pop
  + record celebration added. Stand/cup/music cosmetics verified already rendering.
- [x] **dominoes** — SHIPPED (Wave C): last-played glow ring + round-end score popup.
  Multiplayer glow not wired (snapshot replaces board wholesale — out of light-touch scope).
- [x] **Wave D batch** — wordle (streak popup; toasts verified working — audit's thin
  signal was the standard anon-gate), wordscramble (solved-pill flash; toasts verified),
  dodgeball (hit shake; 6 badges verified exist), doodlejump (VERIFIED squash-stretch
  already implemented), colormatch (streak popups + tiered glow), numbermemory (level-up
  popups), suika (chain popups + top-tier shake), stacktower (VERIFIED combo popups
  already exist), trivia/reaction/coinminer (no further work needed).

## Wave D — solo ladder (the big Drop4 port, pattern-first)

- [ ] Build ONE clean ladder module for **connect4** (the exemplar): escalating AI
  opponents with personality names, visible progression strip, coin rewards per rung,
  saved to connect4Records. Additive wrapper around existing match logic.
- [ ] If night allows: configure same pattern into tictactoe, checkers.
- Deferred to future sessions: battleship/uno/dominoes ladders, basketball career
  (needs a sim pass like Drop4 careerTuning per audit).

## Hands off — already at/near exemplar (do not touch tonight)

snake, memory, penaltykick, whackamole, aimtrainer, helicopter, fruitninja, racers,
connect4 (except ladder), hangman (except noted), drop4, chess/checkers (except badges).

## Deferred flags for Devon

- pixelplaza: empty dir, unreferenced. Delete or build?
- tetris "P0 done" claim in AMG_GAME_STANDARD.md was wrong re: records — doc corrected
  when tetris fix ships.
- tests/run-all.js needs serviceAccountKey.json (not run tonight; browser-verified
  instead).

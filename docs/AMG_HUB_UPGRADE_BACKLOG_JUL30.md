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
- [ ] **uno** (5/4/4/4): achievements are thin (~2) and toast may be a stub — verify toast
  fires, add a few milestone badges. Ladder deferred to Wave D pattern.

## Wave B — flat games get their moment (celebration/juice/cosmetic wiring, all S)

- [ ] **sudoku** (5/5/3/3): celebrate EVERY solve (not just PB), entry feedback, verify
  learn-game coin premium vs arcade.
- [ ] **slidingpuzzle** (5/5/3/4): confetti/odaCelebrate burst on solve (currently just a
  coins pill).
- [ ] **floodfill** (5/5/3/4): cell-fill pulse + solve celebration + low-moves popup.
- [ ] **war** (5/4/3/4): light impact feedback only — Karpathy rule, keep war simple.
- [ ] **lightsout** (5/5/4/3): wire equipped tile theme into actual grid render.
- [ ] **mathsprint** (5/5/4/3): render a visible equipped cosmetic during sprint; sound on
  wrong answer.
- [ ] **2048** (5/5/4/3): merge glow + chain-combo popups; verify tile skins actually
  reskin the grid.
- [ ] **blockblast** (5/5/5/3): verify block skins visibly apply; combo popups for streaks.
- [ ] **bowling** (5/5/4/3): verify ball/lane cosmetic renders visually; pin-strike shake.
- [ ] **retrobowl** (5/5/5/3): add one visible cosmetic slot (jersey/field theme) — only
  the win effect renders today.
- [ ] **simonsays** (5/4/3/4): round-streak popup + board glow on correct input. CAREFUL:
  timing loop desync risk — test full sequence.

## Wave C — bigger/riskier M items (only with fresh verification each)

- [ ] **checkers** (5/5/4/4): additive odaAchievements (has none). Don't touch
  tournament/spectate state machines.
- [ ] **chess** (5/5/4/5): additive odaAchievements (exemplar lacks badges). Same care.
- [ ] **brickbreaker** (5/5/5/4): audit says no achievements — VERIFY first, then add via
  odaAchievements additively.
- [ ] **battleship** (5/5/4/3): sunk-ship shake + splash + one visible cosmetic slot.
  Multiplayer/tournament state machine = minefield, additive only.
- [ ] **lemonade** (5/4/3/3): render equipped stand/cup cosmetics in-game; confirm day-end
  coin award reliability; "day complete" polish beat.
- [ ] **dominoes** (5/5/4/4): chain-play flourish. Canvas hit-testing fiddly — light touch.
- [ ] **wordle/wordscramble/trivia/dodgeball/doodlejump/colormatch/numbermemory/reaction/
  stacktower/suika/coinminer**: minor polish per audit (combo pops, streak celebration,
  small verifies). Batch as time allows.

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

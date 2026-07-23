# AMG Hub — Game Quality Standard (v1)

**Goal:** AMG Hub is an **ad-free learning ecosystem**. Every game should feel like a
premium AMG Studios app (Drop4 caliber), adapted for the browser + Chromebooks + a
learn-to-earn economy. This is the bar every game is measured against and pulled up to.

Reference exemplars already in the repo: **Connect 4** (AI + series + tournaments +
cosmetics + juice) and **Chess**. Reference app: **Drop4** (game feel, progression,
power pieces, celebration).

---

## The Bar — every game must have all of these

### 1. Shell & UX (table stakes)
- [ ] Card-based **home menu** (Play/Records/Shop, + VS Computer/Quick Match for 2-player)
- [ ] `.amg`/theme styling — reads `oda-theme.css` tokens, looks part of the Vivid Arcade world
- [ ] Back button → home screen during play, → hub arcade tab from home
- [ ] Mobile responsive (Chromebook + phone), 44px touch targets
- [ ] Help overlay via `odaHelp.init(...)`
- [ ] Sound via Web Audio (no files), toggle persisted in `odaSoundEnabled`

### 2. Progression & economy (the learn-to-earn hook)
- [ ] **Coins awarded** on play/win via `students/{id}.coins` increment
- [ ] **Records** saved (`{gameId}Records`) + **class leaderboard**
- [ ] **Achievements** with toast unlocks
- [ ] Quick-stats pills on the home screen (best / games / streak)

### 3. Game feel / juice (what makes it feel premium — the Drop4 layer)
- [ ] **Instant feedback** on every action (show result the moment the player acts)
- [ ] Snappy animations (~0.5–0.8s), spring easing, no sluggish waits
- [ ] Sound on every meaningful action (place, clear, win, lose, combo)
- [ ] **Win celebration** — particles/effect + reward reveal
- [ ] Screen juice where it fits (shake on impact, glow on success, combo popups)

### 4. Identity & cosmetics (ties the ecosystem together)
- [ ] Reads the player's equipped cosmetics from `oda_cosmetics_{gameId}` (localStorage, instant)
- [ ] Renders at least one cosmetic slot in-game (piece color / board theme / skin)
- [ ] **Renders the equipped WIN EFFECT on victory** ← currently the shop *sells* 8 win
      effects that never render in any game. Wiring these in is a top ecosystem win.

### 5. Learning-platform fit
- [ ] No ads, no real-money anything, kid-appropriate (ages 9–13)
- [ ] Learning games pay **more** coins than pure arcade (the core Learn-&-Earn axiom)
- [ ] Nothing that pressures spend; coins are earned by playing + learning

---

## The Drop4 "good parts" worth porting to hub games (as they fit)
- **Progression, not one-off matches** — a single-player *ladder/career*: escalating
  opponents/levels with a visible map + rewards. (Connect 4's vs-AI is currently
  one-and-done; a ladder is the biggest single upgrade for solo play.)
- **Boss encounters** with a signature scripted twist (a reason to keep climbing).
- **Power-ups / special pieces** unlocked by progress (Bomb / Rainbow / Heavy in Drop4).
- **Celebration kit** — star burst on clear, combo/streak popups, per-event FX.
- **Cosmetic payoff** — earned coins → shop → visibly changes the game you're in.

Games that ship as standalone AMG Studios apps (Drop4 = Connect 4, TicTacToe+) keep the
hub version in sync as the free, learning-framed edition — same engine feel, hub economy.

---

## Shared systems — use these, don't re-roll them

Three things every game needs are now in `js/oda-core.js`. Reach for these
first; a new game should be able to hit most of The Bar in a few lines.

| Module | What it gives you |
|---|---|
| `odaShop` | Priced cosmetics against the shared `students/{id}.coins` balance. `odaShop.renderShopPanel(gameId, catalogue, containerId, {onEquip, onBuy})` |
| `odaAchievements` | Badges + unlock toast + persistence + a rendered grid. `init(gameId, defs)` then `unlock(id)` / `check(id, cond)` / `renderGrid(el)` |
| `odaSfx` | Web Audio, no files. `odaSfx.play('win'\|'coin'\|'combo'\|'hit'\|'error'\|…)`, or `odaSfx.tone(freq, dur, type, vol)`. Honours the `odaSoundEnabled` toggle and handles the autoplay policy. |

`odaSfx` exists because 47 of the 49 games had each hand-rolled the same
`getAudio()`/`playTone()` pair. `odaAchievements` exists because every game
that had achievements had invented its own shape — which is part of why
several games had none at all.

**Economy rule, learned the hard way from Racers:** a game must pay into
`students/{id}.coins`. Racers had a complete garage running on a private
wallet, so a kid could play it all lunch and earn nothing toward the hub. A
local currency for in-game upgrades is fine; earning *nothing* shared is not.

---

## Prioritized upgrade queue (from the 2026-07-21 audit)

**P0 — DONE 2026-07-22:**
1. ~~`tetris` (Block Drop)~~ — shop + cosmetics + celebration shipped
2. ~~`retrobowl` (Gridiron Rush)~~ — sound on every action, 12 achievements,
   win effect. Also renamed in-game from "Retro Bowl" (a real commercial
   game) to match the registry's **Gridiron Rush**.
3. ~~`coinminer`~~ — Shop tab: coin skins + backdrops, priced in AMG coins
4. ~~`racers`~~ — now pays AMG coins per run + 10 achievements + win effect
5. ~~`bowling`~~ — 12 achievements + win effect on a personal best

**P0 remaining:** `tetris` still has no achievements — it was the exemplar for
shop/cosmetics but never got badges. Now a ~15-line job with `odaAchievements`.

**P1 — has systems, thin on feel (add juice + a solo progression taste):**
`simonsays, numbermemory, flappy, mathsprint, whackamole, lightsout, suika, stacktower`

**P2 — already strong, add the Drop4 progression layer when time allows:**
`connect4, chess, checkers, tictactoe, battleship, uno, dominoes` — add single-player
ladder/career + render win effects.

---

## Process for upgrading a game (repeatable)
1. Read the game; check it against **The Bar** above.
2. Add missing P0 systems first (shop/records/achievements) using the `oda-game-dev` skill patterns.
3. Add the juice layer (feel/sound/celebration + win-effect render).
4. Verify in-browser (menu → play → win → coins → shop) + mobile width.
5. Commit per game (green), push (auto-deploys to amghub.org).

_Standard authored 2026-07-21 alongside the Vivid Arcade visual overhaul._

# Drop4 → AMG Hub conversion — plan & execution prompt

**Written by the Drop4 session (the chat that knows Drop4's real architecture),
2026-07-22, for a fresh chat titled "Drop4 AMG hub conversion" to execute.**

Paste this whole file into that fresh chat. It is self-contained: it carries the
platform decision, a system-by-system map, a phased plan, and the traps that
aren't visible from either side alone.

---

## 0. The one rule that outranks everything

**The public, monetized Drop4 is going to App Review this week. This conversion
must not touch, rebuild, or risk one line of the code path that ships.**

The isolation is structural, not a promise to be careful:

- The Hub version is a **new/forked codebase in the ODA (AMG Hub) repo**
  (`Desktop\ODA`), NOT a branch of Drop4 (`Desktop\Drop4`). It lives alongside
  the other ~49 hub games.
- It talks to Firebase project **oda-hub-d4bef** (the Hub's), never
  **drop4-c45bf** (the store app's). Different project, different accounts,
  different data.
- What you take from Drop4, you take by **copying pure logic files out**
  (engine, AI, career data — see §2A), never by importing the Drop4 package or
  editing in the Drop4 tree. Treat `Desktop\Drop4` as **read-only reference**.
- Nothing you do here produces a commit in the Drop4 repo. If you ever feel the
  urge to "just fix this small thing in Drop4 while I'm here" — don't. That repo
  is frozen for submission.

Everything below assumes that boundary.

---

## 1. THE PLATFORM DECISION (the crux)

### Recommendation: **port to vanilla JS + Canvas + three.js (option b), reusing Drop4's PURE game logic and the Hub's already-built Polygon character pipeline. Do NOT embed the RN app (option a).**

This is a real recommendation with the reasoning, because I can see how coupled
Drop4 actually is.

**Why not (a) — RN+Expo web in an iframe.** It looks tempting ("reuse all the
code") but it's the wrong fit for THIS platform and defeats the point of the
conversion:

- **It can't use `oda-core.js`.** oda-core (`odaShop`, `odaAchievements`,
  `odaSfx`, `odaXP`, `odaCelebrate`) is vanilla globals on the page. An RN-web
  app is a self-contained React tree inside an iframe; it can only reach
  oda-core through a `postMessage` bridge you'd have to build and maintain for
  every coin award, every cosmetic read, every achievement. The whole value of
  AMG Hub is the *shared* economy — an iframe app is a walled garden bolted on.
- **Bundle weight on a school Chromebook.** The other 49 games are a few KB of
  vanilla each and load off GitHub Pages. Drop4's RN-web bundle is multiple MB
  of React + React Navigation + Reanimated + the r3f/three stack before any
  game code. On a low-end Chromebook over school wifi that's a bad first
  impression, and it makes Drop4 the one game that behaves differently from
  every other tile in the hub.
- **It doesn't produce the reusable template.** Devon wants this conversion to
  be the *standard* he applies to Tic Tac Toe and every other game. An
  iframe-embedded RN app is a one-off, not a pattern the other (vanilla) games
  can follow.

**Why (b) is less scary than it sounds — the split is very favorable.** I
measured it. Drop4 is ~137k lines, but the part you actually want to reuse is
**pure and tiny**, and the part that's a rewrite is **UI you were going to
replace anyway** (phone-frame RN screens → full-screen Hub web):

| Reuse verbatim (copy TS→JS, ~zero logic change) | Rewrite in vanilla/Canvas |
|---|---|
| `src/stores/gameStore.ts` engine core — `checkWin`, `getLowestEmptyRow`, gravity/drop, draw detection, power-piece resolution (`dropBomb`/`dropRainbow`/`dropHeavy`). Only imports `zustand` + a storage shim. | The board + pieces rendering (`GameBoard.tsx`, `LivingBoardScene.tsx` — RN-Animated + shaders) → Canvas 2D |
| `src/engine/aiEngine.ts` — **331 lines, ZERO RN/expo imports.** `getAIMove(board, difficulty, connectCount, mercyBoost)`. Drop in as-is. | The ~110 `.tsx` screens/components (~51k lines): CareerWorldMap, Customize, Shop, LootBox, Matchup, Emotes, etc. |
| `src/data/careerLevels.ts` + `careerRecipes.ts` + `careerGenerator.ts` — pure data + a pure generator. The whole 180-level campaign is data. | Navigation (React Navigation → the Hub's own screen/routing convention) |
| `src/data/dropRushEngine.ts` — the falling-block minigame logic | State persistence (Zustand+AsyncStorage → `oda_cosmetics_{gameId}` + `students/{id}`) |
| `src/data/rarity.ts` (canonical 6-tier system), star thresholds, reward tables, `tools/economy-sim.mjs` math | The 3D character host (r3f/expo-gl → the Hub's `js/amg-character-viewer.js`) |

The connect-4 **rules engine and the AI are pure functions of a board array.**
That is the hard, well-tested, balance-tuned heart of the game (the career
difficulty was sim-tuned over many passes), and it ports without touching the
logic. What you rewrite is the presentation — which for the Hub you *must*
rewrite regardless, because Drop4 renders inside a 390×844 phone frame and the
Hub fills the screen.

**Why the character system is already solved for you.** Do NOT try to port
Drop4's `@amg/character-runtime` `CompositeCharacter` (it assembles a character
from modular Synty **Sidekick** part-GLBs streamed from R2 — that's the whole
"Kits" concept the conversion is *removing*). The Hub side already built the
replacement this week: `js/amg-character-viewer.js` renders the 16 pre-made
**Polygon Kids** GLBs with baked locomotion + a 58-emote kid-safe bake, in
vanilla three.js, vertex-colour, Chromebook-cheap. So the character + Express
systems don't get *ported* — they get *pointed at the pipeline that already
exists.*

**Net:** you reuse Drop4's brain (engine + AI + career + balance), you inherit
the Hub's body (Polygon viewer + emotes + oda-core economy), and you write new
Hub-native UI in between. That's the template.

---

## 2. SYSTEM-BY-SYSTEM CONVERSION MAP

### 2A. Game engine (connect-4 rules + AI) — **REUSE, don't rewrite**
- Copy `gameStore.ts`'s pure core and `aiEngine.ts` into the Hub game as plain
  JS modules (strip the Zustand wrapper; keep the functions). They operate on a
  `board` = `number[][]` where `0` empty, `1`/`2` players, `3` obstacle/wall.
- Bring `careerLevels/careerRecipes/careerGenerator` across intact — the 180
  levels, boss scripts (`tommy`/`sal`/`warden` column-parity/gravity/seed),
  obstacle cells, moves-limits, connect-3/5/6 variants are all data.
- **Trap:** `careerTuning.ts` overrides recipe difficulty per-level and is the
  real source of truth for what actually plays (a sim-tuned "hard but fair"
  curve). Carry it across with the recipes or you'll ship an untuned campaign.

### 2B. Character / Customize — **Sidekick Kits → Polygon Characters (collapse)**
- Drop4's "Kits" = 5 tiers × 17 subcategories of modular parts (Body/Hair/
  Outfits/Addons/Gear), backed by `CharacterState` = species + per-slot part
  names + colors + blendshapes. **This entire tree collapses to a flat
  "Characters" picker**: 16 pre-made Polygon Kids, pick one, done. No species,
  no per-slot assembly, no colorways, no skin-tone wheel, no body sliders.
- Wire the picker to the Hub's `js/amg-character-viewer.js`. The player's
  chosen character id lives in `students/{id}` (Firestore) + `oda_cosmetics_*`
  (localStorage), read via oda-core, NOT in a Drop4 characterStore.
- **What survives as "cosmetics to earn":** the *characters themselves* become
  the unlockables (some free, some coin-priced via `odaShop`), plus **boards**
  and **pieces** (see 2D). That preserves Drop4's "the soul is cosmetics" loop
  with a Hub-legal, coin-only shop.

### 2C. Express Mode (emotes/idles) — **point at the Polygon emote bake**
- Drop4's Express = `EmotesScreen` + the animation registry driving
  emote/idle GLB clips on the character. The Hub already baked 58 kid-safe
  Polygon emotes + idles through the same rig. So Express *survives the
  conversion* — rebuild the picker UI Hub-native and have it drive the Polygon
  viewer's emote player instead of the Sidekick one.
- Keep Drop4's "★ Faves loadout" idea if cheap; it's a nice retention touch and
  it's just a list of ids.

### 2D. Boards & pieces — **KEEP (they're code-drawn) → port to Canvas**
- Drop4's boards and pieces are **100% code-drawn** (no image assets):
  `BoardSceneImage`/`getThemeScene`, a shared rarity ladder, RN-Animated
  `LivingBoardScene`, `PieceVisual` finish ramps. This is pure draw logic +
  palette data → re-express on a Canvas 2D context. This is the most
  *portable* visual system in the app; don't redraw from scratch, translate it.
- Boards/pieces stay the primary earnable cosmetic alongside characters.

### 2E. Economy — **coins + gems + ads + IAP → ONE learn-to-earn coin**
This is the identity of the conversion. Concretely, in Drop4 today:
- **`gems` appear in ~55 files, ads in ~14.** Don't hunt them one by one — the
  Hub game shouldn't inherit Drop4's economy stores at all. Build the economy on
  **oda-core** (`odaShop` reads/writes the single shared `students/{id}.coins`)
  and map Drop4 concepts onto it:
  - **Remove gems entirely.** Everywhere Drop4 gates something behind gems
    (epic+ cosmetics, chest tiers, the golden spin), re-price in coins or make
    it a learn-to-earn unlock.
  - **Remove ads entirely.** Every rewarded-ad touchpoint (chest-timer skip,
    "watch ad for coins", the 5/day free-coins tile) becomes **"complete an
    assigned lesson to earn coins / skip the wait"** — hand off to the Hub's
    existing educational tools (Quiz Show, flashcards, crossword, spelling).
    *This is the whole point: assignments earn faster than grinding.*
  - **Remove IAP** — there is none wired in Drop4 v1 anyway; just don't add the
    Hub equivalent.
  - **Lootboxes MAY stay, coin-only.** Drop4's chest/reveal is good juice. Keep
    it if you want, priced in coins, no gems, no timer-skip-via-ad (timers can
    stay as a learn-to-earn nudge or be dropped for kids — Devon's call).
- **Trap:** Drop4 grants "earned-only" cosmetics (profile frames, some drops)
  that are deliberately NOT purchasable. Preserve that distinction in `odaShop`
  or you flatten the progression.

### 2F. Career mode — **KEEP; audit for economy assumptions**
- The career map + 180 levels + boss ceremonies are the retention engine and
  they carry over. The *data* is pure (2A). Rebuild the map UI Hub-native
  (full-screen, Chromebook-cheap — a scrolling Canvas/DOM path, not r3f).
- **Does career assume ads/gems?** Mostly no — rewards are coins + cosmetic
  drops. Two things to convert: (1) the **city-complete ceremony** reveals a
  species + power piece — "species" is gone, so that becomes "new character
  unlocked" (or just power-piece + coins); (2) reward tables that pay bonus
  **gems** re-map to coins.
- Power pieces (Bomb/Rainbow/Heavy) unlock by clearing city bosses — pure
  progression, keep as-is.

### 2G. Auth & persistence — **drop4-c45bf → oda-hub-d4bef**
- No Drop4 auth. The player is an AMG Hub student (anonymous Firebase under the
  hood in project oda-hub-d4bef) + teacher/guardian accounts. Progress, coins,
  cosmetics all live in `students/{id}` + `oda_cosmetics_{gameId}` via oda-core.
- Drop4's Friend Match, ranked, wager, AMG-account linking — **drop all of it.**
  Hub is single-player + assignments. (No free-text chat ever — already the
  Hub rule.)

### 2H. UI / framing — **phone frame → full screen**
- Drop4 wraps everything in a 390×844 `PhoneFrame` (a desktop-web affordance).
  The Hub game fills the viewport (website + app), responsive down to a
  Chromebook screen. Rebuild layouts Hub-native; don't port the phone frame.
- Match the other hub games' chrome: oda-core's help (`odaHelp`), SFX
  (`odaSfx`, Web Audio, no files — **don't port Drop4's audio**), win effects
  (`odaCelebrate`/`odaWinEffect` renders the player's equipped effect), XP.

---

## 3. PHASED PLAN (ordered so identity comes first, isolation baked in)

**Phase 0 — Scaffold + isolation (do this first, prove the boundary).**
- New game folder in the ODA repo following the existing hub-game structure
  (see `docs/AMG_GAME_STANDARD.md`). Wire `oda-core.js`, an empty board that
  renders on Canvas, coins reading from `students/{id}`. Ship nothing from
  Drop4 yet except a copied, unit-testable engine module.
- Copy `gameStore` engine core + `aiEngine.ts` + career data in as plain JS.
  Port their existing tests too (the engine has a real test suite) so you know
  the brain works before any UI. **Confirm zero imports back into `Desktop\Drop4`.**

**Phase 1 — Character swap (identity #1).**
- Flat "Characters" picker over the 16 Polygon Kids via
  `js/amg-character-viewer.js`. Selection persists via oda-core. This is the
  most visible "this is the Hub version" signal — do it early.

**Phase 2 — Economy swap (identity #2).**
- Single coin via `odaShop`. Strip gems/ads/IAP by construction (you're not
  porting Drop4's economy stores, you're building on oda-core). Stand up the
  **learn-to-earn hooks**: every old "watch ad / pay gems to go faster" spot
  becomes "go do an assignment." Coin-only lootbox if kept.

**Phase 3 — Core game loop end-to-end.**
- Board + pieces on Canvas (port the code-drawn system, 2D), one full match
  vs AI, win/lose/draw, coins awarded through oda-core, win effect via
  `odaCelebrate`. This is a playable game.

**Phase 4 — Career mode.**
- Full-screen career map + the 180 levels (data already in hand), boss scripts,
  power pieces, city-complete ceremony reworded for characters-not-species.

**Phase 5 — Express + boards/pieces shop + polish.**
- Emote/idle picker on the Polygon bake; boards/pieces as coin cosmetics;
  achievements via `odaAchievements`; help via `odaHelp`; the Drop Rush
  minigame if you want it (engine ports cleanly).

**Phase 6 — Lock the template.**
- Write down what was reusable vs bespoke as the **"AMG Hub game conversion
  standard"** so Tic Tac Toe and the rest follow the same path. (This is the
  actual goal — Devon wants a repeatable pattern, not a one-off.)

---

## 4. WHAT MAKES THIS HARDER THAN IT SOUNDS (things you can't see from the Hub side)

1. **The engine is pure, but it's woven THROUGH Zustand + effects in
   `GameScreen.tsx`.** The rules functions are clean; the *orchestration*
   (turn timer, boss-script enforcement on player taps, AI-move filtering for
   Sal's gravity flip, intro-card gating, the moment win/loss is recorded) lives
   in a ~3000-line RN screen with dozens of `useEffect`s. Don't try to port that
   screen — re-implement the loop natively around the pure engine. Read
   `GameScreen.tsx` for the *rules of orchestration* (especially the three boss
   scripts and the obstacle-stamping), then rewrite the driver.

2. **"Career difficulty" is not in the recipes.** `careerTuning.ts` overrides
   per-level difficulty and is the sim-tuned source of truth. Miss it and the
   campaign plays wrong even with the right level data. (Same for star
   thresholds, which are clamped to move-limits in code, not data.)

3. **Boards/pieces "code-drawn" means RN-Animated + custom shaders, not plain
   shapes.** `LivingBoardScene` animates; `AnimatedSceneShader` exists. The
   *palette + ladder data* ports trivially; the *animation* needs a Canvas
   re-expression. Budget for it — it's the visual soul and a flat static board
   will feel cheap next to Drop4.

4. **Rarity is canonical and re-exported everywhere.** `src/data/rarity.ts` is
   the ONE source (6 tiers); shop/pricing/expression catalogs all re-export it.
   Bring the source, not the copies, or colors/labels drift.

5. **The character swap deletes a LOT of Drop4 UI, and that's correct.** Kits'
   5-tier nav, species picker, skin wheel, body sliders, colorway sheets,
   the ~1300-item cosmetic catalog, all the thumbnail-render tooling — **none
   of it comes across.** Polygon Kids are pre-made. If the fresh chat starts
   porting the Kits UI, it's going the wrong way; the whole point is that
   "assemble-a-character" becomes "pick-a-character."

6. **Don't inherit Drop4's audio or ads or notification services.** Use
   `odaSfx` (Web Audio, no files). Drop4's `audio.ts`/`ads`/`notifications`/
   AdMob/App-Check are all store-app infrastructure that has no place in a
   nonprofit Chromebook game.

7. **Firebase project confusion is the highest-risk mistake.** Any stray
   `drop4-c45bf` config, R2 CDN URL
   (`pub-8953453f2512408f9c58656d4ea4e681.r2.dev`), or Drop4 Firestore path that
   leaks into the Hub build points kids' data at the wrong project. Grep the new
   game for those literals before you ship — they should return nothing.

8. **This is a fork in spirit, but treat Drop4 as read-only reference, not a
   dependency.** There's no clean npm package to import (the engine is "stuck"
   inside `Drop4/src`, per the engine-extraction notes). Copy the pure files
   out; do not wire a path back into the Drop4 tree, or you couple the frozen
   store app to an actively-changing Hub game.

---

## 5. One-paragraph brief for the fresh chat

> Build the AMG Hub (nonprofit, educational, Chromebook) version of Drop4 as a
> new vanilla JS + Canvas + three.js game in the ODA repo (`Desktop\ODA`),
> alongside the other hub games, on Firebase project oda-hub-d4bef. Treat
> `Desktop\Drop4` as READ-ONLY reference — the store version is going to App
> Review this week and must not be touched. Reuse Drop4's PURE brain by copying
> it out — the connect-4 rules engine (`gameStore` core), the AI
> (`engine/aiEngine.ts`), and the 180-level career data
> (`careerLevels`/`careerRecipes`/`careerGenerator`/`careerTuning`) are pure and
> port with ~zero logic change. Replace the modular Synty **Sidekick** "Kits"
> character system with a flat picker over the 16 pre-made **Polygon Kids** via
> the Hub's already-built `js/amg-character-viewer.js`; point Express Mode at the
> Hub's 58-emote Polygon bake. Rebuild all UI Hub-native and full-screen (drop
> Drop4's phone frame). Replace coins+gems+ads+IAP with the single shared AMG
> Hub coin via oda-core's `odaShop`, and convert every "watch an ad / pay gems
> to go faster" touchpoint into "complete an assignment to earn coins faster"
> (learn-to-earn). Keep boards, pieces, power pieces, and career mode. Do the
> character swap and the economy swap FIRST — they're the identity of the
> conversion — then the core loop, then career, then polish. Finish by writing
> down the reusable pattern so Tic Tac Toe and every other game convert the same
> way.

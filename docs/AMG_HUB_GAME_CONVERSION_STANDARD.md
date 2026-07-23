# AMG Hub Game Conversion Standard (v1)

**How to convert a premium AMG Studios app (Drop4, Tic Tac Toe+, RPS+, …) into
its free, nonprofit, learn-to-earn AMG Hub edition.** Written from the Drop4 →
AMG Hub conversion (2026-07-23), which is the reference implementation living at
`arcade/drop4/`. Apply this same recipe to every other game.

The thesis in one line: **reuse the app's pure brain, inherit the Hub's body,
rewrite the UI Hub-native in between.** That split is what makes each conversion
faster than the last.

---

## 0. The isolation contract (non-negotiable)

The commercial app is a separate, possibly-shipping product. The conversion must
not touch or risk it.

- The Hub edition is a **new folder in the ODA repo** (`arcade/<game>/`), NOT a
  branch of the app. It sits beside the other ~49 hub games.
- It talks to Firebase project **oda-hub-d4bef** only (oda-core provides this as
  `ODA_CONFIG.firebase` — never hardcode the app's project).
- You take the app's logic by **copying pure files out** and translating TS→JS,
  never by importing the app package or editing its tree. Treat the app repo as
  **read-only reference**.
- Before every deploy, grep the new folder for the app's Firebase project id,
  any app-specific CDN host, and any import path back into the app tree — all
  must return **zero**. (Drop4: `drop4-c45bf`, `pub-8953453f…r2.dev`, `Drop4/`.)
- Work on a dedicated branch; only stage your `arcade/<game>/` paths (+ one
  registry line at cutover). Never `git add -A` — other chats have WIP in the
  same repo.

---

## 1. What ports vs what you rewrite

Measured on Drop4 (~137k lines). The reusable part is small, pure, and tested;
the rewrite is UI you were replacing anyway (phone-frame RN → full-screen web).

| Reuse (copy TS→JS, ~zero logic change) | Rewrite Hub-native |
|---|---|
| Rules engine (win/gravity/draw, power pieces) — pure functions on a board array | Board + piece **rendering** → Canvas 2D |
| AI (`getAIMove`, minimax) — pure | The RN screens/navigation → single `index.html` + ES-module screens |
| Level/career data + generator + **tuning table** — pure data | State persistence (zustand/AsyncStorage → oda-core + localStorage) |
| Rarity system + palettes (colors/formulas) | 3D character host (r3f/expo → the Hub's `amg-character-viewer.js`) |
| Minigame engines (pure grid logic) | Economy stores (coins/gems/ads/IAP → one oda-core coin) |

**Rule:** the app's rules engine and AI are pure functions of a board array —
that is the hard, balance-tuned heart, and it ports with no logic change. The
UI you must rewrite regardless because the Hub fills the screen and lives on
Chromebooks. Do not port the RN game screen; capture its *orchestration rules*
(turn loop, boss scripts, payout moments) and re-implement a small native driver
around the pure engine.

---

## 2. Module architecture (the template)

A hub game is normally one `index.html`. A converted premium app is too big for
that, so use a **folder of ES modules** (precedent: `world/`, `js/`). Keep pure
logic in importable files so it can be Node-tested before any UI exists.

```
arcade/<game>/
  index.html        # Hub shell: screens, routing, Firebase init, oda-core wiring, glue
  engine.js         # pure rules (ported from the app's store core, framework-free)
  ai.js             # pure AI (ported verbatim; imports only from engine.js)
  <data>.js         # pure level/career data + generator + tuning (ported)
  rarity.js         # canonical rarity tiers + color helpers (ported)
  visuals.js        # Canvas 2D: piece orbs, board frame, scene backdrops, palettes
  game.js           # the match driver (input, AI scheduling, boss scripts, FX, results)
  characters.js     # 16 Polygon Kids picker via amg-character-viewer.js (shared identity)
  shop.js           # single-coin economy config + odaShop cosmetic catalogs
  career.js         # (if the app has one) map UI + progress + unlocks + level→match runner
  package.json      # {"type":"module"} — for Node test runs ONLY; the static site ignores it
  tests/*.test.mjs  # zero-dependency Node assertions for the pure modules
```

**Engine port pattern:** strip the store wrapper; turn each mutating store action
into a **pure resolver that returns `{ board, status, winner, winCells, … }`**
instead of calling `set()`. The driver owns turn/score/streak/history state. See
`arcade/drop4/engine.js` (`applyDrop`/`applyBomb`/`applyRainbow`/`applyHeavy`).

---

## 3. oda-core integration cheat sheet

Everything is a `window.*` global from `../../js/oda-core.js` (load it before your
module script). Full API in the recon notes; the essentials:

- **Coins** (the shared economy): `updateDoc(doc(db,'students',studentId),{coins:increment(n)})`.
  Guard `if(!sid||sid.startsWith('anon_'))return;` — guests get local-only state.
  There is no `awardCoins` helper; every game hand-rolls the one-liner.
- **Records**: `<gameId>Records/{studentId}` doc `{wins,losses,draws,gamesPlayed,winStreak,bestStreak,…}`;
  class leaderboard = `query(collection(db,'<gameId>Records'), where('classCode','==',cc), orderBy('wins','desc'), limit(30))`.
- **Shop**: `odaShop.renderShopPanel(gameId, catalog, containerId, {onEquip,onBuy})`;
  read with `odaShop.getEquipped(gameId, slot)`. Catalog item = `{id,name,emoji,cost,slot,value}`.
- **Achievements**: `odaAchievements.init(gameId, defs)` then `.unlock(id)` / `.check(id,cond)` / `.renderGrid(el)`.
  Defs = `{id,name,icon,desc}`. Use the shared system — do NOT hand-roll (the legacy connect4 did; don't copy that).
- **SFX**: `odaSfx.play(name)` — names: `click place select coin win lose combo levelup error whoosh powerup hit tick achievement`. No files. Toggle persists in `odaSoundEnabled`.
- **Win effect**: `odaWinEffect()` on a win — auto-resolves the player's equipped effect + guest fallback.
- **Help**: `odaHelp.init({title,emoji,subtitle,sections,controls,tip})` — floating `?` button.
- **Identity**: the student is `localStorage.studentId` (Firestore `students/{id}` doc id); anon guests get `anon_*` and never write to Firestore.

---

## 4. The two identity swaps (do these first)

### 4a. Characters — app character system → 16 Polygon Kids
Drop4's modular Synty **Kits** (assemble-a-character) collapse to a **flat picker
over 16 pre-made Polygon Kids**. Do NOT port the app's character runtime.

- Wire `js/amg-character-viewer.js` (`createCharacterViewer(canvas,opts)` →
  `.load(glbUrl)`; static spin/drag, Chromebook-cheap). Load the three.js
  importmap (`three@0.160.0`, keys `three` + `three/addons/`).
- **Use the Hub's shared cross-game character identity** — mirror `character.html`
  exactly so a character bought/equipped anywhere shows everywhere:
  - pricing: first 6 free, the rest 400–1200 coins (same table).
  - ownership: global `students/{id}.inventory` contains `char_<id>`.
  - equip: `students/{id}.equipped.character` + `localStorage.amgCharacterId/Thumb`.
- `characters.js` in the reference impl is a drop-in for any game.

### 4b. Economy — coins + gems + ads + IAP → ONE learn-to-earn coin
- **Remove gems** everywhere. Re-price gem-gated cosmetics in coins; neuter any
  gem reward generator; strip "+ N Gems" from reward labels. Grep the data for
  `gems`/`💎`/`\bGems?\b` → zero.
- **Remove ads and IAP** by construction (don't port those stores).
- **Learn-to-earn**: coins are earned by playing AND by completing hub
  assignments. Every "not enough coins" moment nudges the kid to go learn & earn
  (link to `../../student.html`). There is nothing to buy with real money.
- **Preserve the earned-only distinction**: some cosmetics/frames are rewards,
  not purchasable — keep that so progression isn't flattened.
- Cosmetics = boards + piece skins (odaShop) + characters (shared identity).
  Lootboxes MAY stay, coin-only (optional).
- *Note:* the app's in-match flow often has NO ad/gem valves to convert (Drop4
  had none) — the learn-to-earn hooks are then greenfield, not rip-outs.

---

## 5. Driver + boss/career patterns (games with a campaign)

- **Match driver** (`game.js`): player tap → column → `applyDrop`; schedule AI on
  a delay; on terminal, report `{result,winner,moveCount,playerMoves,stars}` via
  `onResult` — the shell computes coins/records. Animate drop (ease-in fall +
  squash), land-flash, and a gold win-highlight cascade for game feel.
- **Boss scripts** are enforced in the driver, not the engine: parity gates
  (reject illegal taps + correct the AI's column), gravity-flip (toggle a flag +
  reverse the board for the AI + Y-mirror the render), seed-threat (just stamp a
  preset board + go-second + tight timer).
- **Career**: the level data (types, obstacles, moves-limit, preset boards, boss
  scripts, **the sim-tuned difficulty override table**) is pure — port it intact.
  Rebuild the map as a scrolling Candy-Crush path (DOM nodes, not r3f). Unlock
  power pieces on boss clears; convert "species unlock" → **character unlock** on
  city clears.

---

## 6. Verification playbook (works around the frozen preview pane)

The in-app Browser pane can't composite WebGL/rAF frames, so a screenshot won't
show a Canvas game. Verify headlessly instead — this proved the whole Drop4 build:

1. **Pure logic → Node tests.** Zero-dependency `node tests/*.test.mjs` with
   explicit pass/fail counts and `process.exit(1)` on failure (no jest → nothing
   masked). Drop4: 60 assertions across engine/AI/career.
2. **Modules load → `import()` in-page** via `javascript_tool`; assert key exports
   and data counts.
3. **Visuals → offscreen canvas + `getImageData`.** Draw the board/piece to a
   detached canvas, count non-transparent pixels to prove the draw code runs.
4. **Driver → dispatch real pointer events** at computed column x-positions on a
   DOM-attached canvas; assert `moveCount`/`status`/`onResult` advance. This
   tests input → engine → result without needing frames to composite.
5. **Assets → `fetch(..., {method:'HEAD'})`** to confirm GLB/thumb/asset paths
   resolve (200) from `arcade/<game>/` (all are `../../`).
6. **Console → `read_console_messages`** for a clean load (only benign logs).
7. Commit green after each phase; keep work resumable.

---

## 7. Cutover (reversible, one line)

Build **unlisted** (folder exists, not in `js/oda-games.js`) until playable, so
nothing half-built ships. To go live:

- **New tile:** add one entry to `js/oda-games.js`
  (`{id,emoji,title,desc,file:'arcade/<game>/index.html',cat,colors,categories}`).
- **Replace an existing tile** (Drop4 replaces `connect4`): repoint that entry's
  `file` to `arcade/<game>/index.html` and refresh title/desc/emoji. Keep the old
  folder as instant rollback. **Keep the internal `gameId` = the old id** so
  existing records/cosmetics/coins carry through (Drop4 uses `gameId:'connect4'`
  though the folder is `drop4/`).
- Push deploys to amghub.org — so push only when Devon says go.

---

## 8. Known deferrals (be honest about these)

- **Express Mode / character emotes**: the 58-clip Polygon bake mis-poses the
  arms (rig bind-pose mismatch vs the Unity clips). The fix needs a *supervised*
  Unity-native glTF re-export of all 16 characters (only 4/16 done; a package
  install already caused a safe-mode incident). Until then Express degrades to
  the spin/drag character showcase, with real emotes flagged coming-soon. Do not
  schedule Express UI that assumes clip playback works.
- **Drop Rush minigame**: engine ports cleanly; the tetromino/spawn layer wasn't
  ported. Optional add-on.

---

## 9. Reference implementation checklist (what Drop4 shipped)

- [x] Pure engine + AI ported, 60 Node tests green, isolation grep clean
- [x] 16 Polygon Kids picker (shared cross-game identity)
- [x] Single-coin economy, no gems/ads/IAP, learn-to-earn nudges
- [x] Canvas board + premium piece orbs + drop/land/win animation
- [x] 180-level career, 15 cities, boss scripts, power pieces, character unlocks
- [x] Records + class leaderboard + 12 achievements + win effects + help + SFX
- [x] Hub-native full-screen shell on oda-core; unlisted, ready for cutover
- [ ] Express emotes (deferred — rig re-export), Drop Rush (optional)

_Next games (Tic Tac Toe+, then the rest): follow §2–§7. Most of `rarity.js`,
`visuals.js` (piece orb + scene), `characters.js`, `shop.js`, and the oda-core
glue in `index.html` are game-agnostic — copy them and swap the engine + board
geometry._

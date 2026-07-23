# Sprint Log

## 2026-07-22 — AMG World + shared game systems (overnight session)

**Mission:** build AMG World (the 3D hub Devon described as Poptropica x Club Penguin x
PlayStation Home) and keep improving AMG Hub. Devon is doing the Drop4 -> AMG Hub
conversion in a separate chat; this session stayed out of that lane entirely.

**Branch:** `amg-world` off `main`. Not merged, not pushed — pushing deploys to
amghub.org, and that stays Devon's call.

### Commits this session
1. `da22552` AMG World: 3D hub park + the Synty -> web asset pipeline
2. `dd1f037` World entry point in the hub, RTDB presence rules, pipeline docs
3. `d675201` Shared achievements + SFX in oda-core; cleared the P0 audit queue
4. (this commit) world README + sprint log

### AMG World — what shipped
A working 3D park at `world/`, reachable from a new **World** tab on student.html.
Walk around as one of the 16 kid characters, collect coins, emote, use safe chat,
and walk into any of 6 zone portals to open a themed set of hub games.

Asset pipeline (`tools/world/`): the Synty POLYGON Kids demo scene is 1117 renderers
sharing one 2048^2 atlas. Unity bakes each vertex's atlas colour into a vertex colour
and writes OBJ; Blender converts to Draco GLB. The whole park is **1.34 MB with no
textures at all**, and the static shell is **one draw call**. Measured solo on medium
with shadows: 49 draw calls, 206k triangles.

The kid GLBs are rigged but ship no animation clips, and the POLYGON locomotion pack
isn't licensed here — so walk/run/idle/jump and 8 emotes are generated procedurally
from named bones. Costs no bytes, suits the genre, and the arm rest angles were solved
numerically against the real rig rather than guessed at.

### Key decisions (revisitable)
- **Presence rides Firebase Realtime Database, not Firestore.** A 2 Hz position feed is
  ~2.4k document writes per player per session; one class would burn the Firestore free
  quota before lunch. RTDB is bandwidth-priced and gives onDisconnect().
- **No free-text chat, ever.** Fixed phrase book; the wire carries only an INDEX into it.
  A hostile client can at worst make someone say "Nice one!". This is the single
  non-negotiable design constraint of the whole feature.
- **Presence nodes are keyed by anon-auth UID, not studentId** — that is what makes
  "you may only move your own avatar" enforceable in rules.
- Zone portals open a game *category*, not a fixed game, so the catalogue can grow
  without touching the world.
- Vertex-colour bake over texture atlas: near-identical look on Synty's flat swatches,
  zero texture download, zero texture memory.

### Shared systems added to `js/oda-core.js` (v1.8)
- `odaSfx` — Web Audio with a named sound library. **47 of the 49 games** had each
  hand-rolled the same getAudio()/playTone() pair.
- `odaAchievements` — defs, unlock toast, localStorage + Firestore persistence, rendered
  grid. Every game that had achievements had invented its own shape, which is part of
  why several had none at all.

Upgrading the remaining ~45 games to The Bar is now a short job per game.

### P0 audit queue — cleared
- **retrobowl** — sound on every action, 12 achievements, win effect. Also renamed the
  in-game title from "Retro Bowl" (a real commercial game) to **Gridiron Rush**, which
  is what the registry already called it.
- **bowling** — 12 achievements + win effect on a personal best.
- **coinminer** — Shop tab (coin skins + backdrops) priced in AMG coins.
- **racers** — the audit said "add shop", but the real problem was bigger: the garage ran
  an entirely private wallet and the game never wrote to `students/{id}.coins` at all, so
  a kid could play it all lunch and earn nothing toward the hub. Now pays AMG coins per
  run (capped) with the garage wallet left intact, plus 10 achievements and the win effect.

### Bugs found and fixed along the way
- **Site-wide CSP bug:** `worker-src` fell back to `default-src 'self'`, so blob: workers
  were blocked. three.js's Draco loader doesn't error on that — it **hangs forever**.
  Added `worker-src`/`child-src 'self' blob:`.
- `switchTab()` in student.js paired `tabs[i]` with `sections[i]` plus a hardcoded
  name->index map; adding a fourth tab silently mismatched the pairs. Now resolves by id.
- Bowling's strike-streak invariant lived in one caller, so a different path kept a stale
  streak alive. Moved into an `applyBall()` wrapper.

### Verified in Chrome (not the preview pane — it can't composite WebGL)
- Park loads, character walks, jumps, emotes; coins collect and credit; zone portal opens
  11 real multiplayer games; safe-chat bubble renders; world pauses/unpauses with modals
- With no RTDB instance provisioned: world runs solo and says so
- Bowling achievements driven through the real scorer via a new `window.__bowl` hook:
  streak 1, 2, resets to 0 on an open ball, then 1, 2, 3 -> turkey
- Coin Miner shop renders priced cosmetics and they visibly apply
- All edited inline scripts parse clean

### Open / next
- **Multiplayer is off until Devon creates the RTDB instance** and runs
  `firebase deploy --only database`. World is fully playable meanwhile.
- **Mobile untested on a real device** — touch stick and insets are implemented but
  browser resizing doesn't reproduce a phone.
- `tetris` still has no achievements (it was the shop/cosmetics exemplar) — now ~15 lines.
- World has no audio yet; `odaSfx` is right there.
- Playground structures are obstacles, not climbable.

## 2026-07-12 — The AMG Hub Overhaul (overnight session)

**Mission:** rebrand ODA Hub → AMG Hub (amghub.org), go direct-to-consumer, fix the two
long-broken things (login, cosmetics), reframe teacher tools as kid-solo Learn & Earn games.

**Branch:** `amg-hub` (main untouched; merging + pushing = deploy, Devon's call).

### Commits this session
1. `cd91abc` Checkpoint of ~3 months of uncommitted WIP (trademark renames, Gridiron Rush game, character-creator prototype)
2. `54bdcaf` Audit + plan docs (8-agent parallel audit of all 118K LOC)
3. `df082e0` Full user-facing rebrand + new public landing page + family-accounts UI
4. `e476314` Auth overhaul: session hygiene, anonymous-auth plumbing, hardened rules (staged), classCodes migration
5. `9627cb5` Cosmetics pipeline fix (root cause: equipped vs gameCosmetics tree mismatch) + every dead paid cosmetic implemented + Learn & Earn starter packs wired into 6 tools + coin hooks
6. (this commit) version bump + sprint log + launch checklist polish

### Key decisions (revisitable)
- Internal `oda-*` identifiers/collections stay; only user-facing rebrands (REBRAND_NOTES.md)
- `teachers` collection = guardians (accountType parent|teacher); Family Code == classCode
- Teacher portal = Parent Command Center via label swap for parent accounts
- Renames: Retro Bowl→Gridiron Rush, Jeopardy→Quiz Show (trademark defense)
- Retired from kid hub: Lemonade Day tool (employer program), Builder (author tool)
- Anonymous Firebase auth for kids (invisible), rules v2 staged NOT deployed — deploy order in AMG_HUB_LAUNCH.md

### Verified
- Landing page renders + all login panels flow (live Firestore round-trip tested)
- Stale/forged studentId → clean session-clear → re-login (tested in browser)
- Starter Quiz Show board plays end-to-end kid-solo (5x5 grid rendered, coin path intact)
- All edited pages parse clean (node --check on every inline script)
- 17 fleet agents (audit 8, rebrand 5, cosmetics/repairs 5, learn-earn 4 = 22 total), zero errors

### Open items for Devon
- Review gates + console/DNS steps: docs/AMG_HUB_LAUNCH.md
- Legal peek: pitch.html content still derived from an entrepreneurship curriculum frame (branding stripped)
- southeast-slime.html remains parked/unlinked (confirm what "Southeast" refers to)
- Post-launch: server-authoritative coin awards (Cloud Function) is the real anti-cheat fix

---

## 2026-07-21 — AMG Hub "Vivid Arcade" full visual overhaul (autonomous, Devon at work)

**Brief:** "Brand new thing, not ODA v2 — more color, overhaul all the UI, make it look
award-winning. And the 3D characters are cut off / look unfinished." Unity AMG Engine on :6400
available. Full autonomous authorization; deploy without pre-review.

**Shipped & deployed to https://amghub.org (3 pushes, all verified live in Chrome):**

- **Vivid Arcade theme** (`css/oda-theme.css`) — the keystone. Every page + all 48 games read
  this file's `var(--*)` tokens, so re-skinning via token VALUES (names unchanged) upgraded the
  whole platform at once. Deep violet-tinted dark base, brighter rainbow accents, `--brand-grad`,
  chunkier radii, stronger glows. New reusable kit: `.amg-bg` (animated aurora), `.grad-text`,
  `.amg-coin`, `.pill-tabs`, `.chip`, `.eyebrow`.
- **Character cutoff FIX** (`js/amg-character-viewer.js`) — `frame()` now fits both height AND
  width against the aspect ratio with padding (old `size.y*1.7` @32°FOV framed ~0.97× the model →
  clipped heads/feet) + re-frames on resize. Verified full-body across the whole hero cast + the
  character page (which was refactored off its own buggy inline three.js onto the shared viewer).
- **Landing** (`index.html` + `css/index.css`) rebuilt: nav bar, big Fredoka hero w/ rainbow
  "Level up.", stat row, live 3D character, registry-driven 12-tile featured grid, Learn&Earn
  multiplier badges, colorful parents cards. All login-panel IDs + JS hooks preserved.
- **Student hub** (surgical, no rewrite): per-game colors on arcade cards, rainbow Learn&Earn
  cards, gradient name, purple level badge, gold coin chip, brand-grad XP bar, colorful pill tabs.
- **Character page**: shared viewer + spotlight-glow stage.
- **Aurora bg** rolled out to shop, parent, guardian dashboard + all learning tools.

**Verified:** landing (desktop + mobile 375px, no horizontal overflow, responsive grids), character
page, hub (via harness), shop, Quiz Show, 4 arcade games (theme is CSS-only → cannot break game JS).

**Recommended next (needs Devon's input):** which specific games he considers "low quality" so I can
add Jetpack-Joyride-style juice like helicopter got — didn't guess blind. Optional: per-game color on
game *menus* (48 files, low incremental value since the shell already looks great).

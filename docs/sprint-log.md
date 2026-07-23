# Sprint Log

## 2026-07-23 (evening, later) — AMG World adopts the v2 rig: real 58 emotes + rebased locomotion (remote)

Follow-on to the Drop4-Hub "EMOTES SOLVED" entry below. That chat shipped the v2
kid rigs + absolute-quat emote bake; per `docs/EMOTE_SYNC_BRIEF.md` I converged
the WORLD onto the same one pipeline (answered its 3 questions first, stayed in
lane — no changes to `assets/characters/**`, `emote_lab.mjs`, `rig_to_glb.py`, or
`arcade/drop4/**`).

**What landed (all in the world's lane):**
- `tools/world/bake_locomotion_v2.mjs` — rebases the 7 locomotion clips
  (idle/walk/run/sprint/jump/fall/land) from `_unity_export/rig/locomotion_bindref.json`
  onto the v2 rigs, reusing emote_lab step-6's retarget math VERBATIM (copied,
  not imported, so emote_lab.mjs is untouched). Output: `world/assets/
  locomotion_v2.{bin,json}` (34 KB, absolute Int16 v2-local quats, same byte
  layout as the emote bins so one sampler reads both).
- `world/js/rig_v2.js` — ONE absolute-quat player: locomotion gait blend + an
  emote channel layered over it (upper-body override while moving, hip offset
  along world-up). Same math as `arcade/drop4/express.js`, extended with the
  multi-clip locomotion base. No deltas, no corr.
- `world/js/avatar.js` — `RIG` flag (default `'v2'`; `localStorage.amgWorldRig
  ='v1'` = full rollback) + `characterUrl()`; avatars load `assets/characters/
  v2/{id}.glb` and use `RigV2`. `npc.js`/`main.js` rewired (v2 emote ids, wheel
  points at the v2 library, boot preloads the 34 KB bake so no T-pose flash).

**Verification (real Chrome, in-page — the pane can't composite this):**
- Bake proof: my `idle` bake == the committed `assets/characters/emotes/idle.bin`
  BYTE-IDENTICAL (worst int16 diff 0) → same pipeline, not a divergent second one.
- Runtime rig (kid_hoodie): 22/22 bones driven; idle = arms-down (hands 0.52, NOT
  the T-pose 0.87), feet on ground; walk = real stride, head steady 0.96 (no
  collapse); **armsfolded folds** (hands 0.75/0.79 at chest — the exact pose that
  flew overhead on the old rigs); wave raises Hand_R 0.52→1.09.
- Real `Avatar` path: `RIG='v2'`, `rig` is `RigV2`, materials clean (emissive 0,
  maps bound); offscreen render = 17.3% coverage, colored, **0% black pixels**.
- No console errors. `check_v2_skeletons.mjs` ✓, `arcade/drop4` tests 60/60 ✓.

**Retirable after Devon A/Bs on device** (kept this session as the `v1` rollback,
not deleted): `world/assets/emotes/*` (old delta bins), `emotes.js` EmotePlayer +
`CLIP_EMOTES_ENABLED`, the `corr`/`solveFrameCorrections` emote use, and the
delta locomotion in `clips.js`. Once v2 is confirmed on a real Chromebook, delete
those and drop the flag branch in `avatar.js`.

## 2026-07-23 (evening) — EMOTES SOLVED: 58 Synty clips live on all 16 kids (remote, Devon at work)

Devon flipped this chat to Fable 5 and asked for "a real shot" at the emote
blocker. It's solved — offline, no supervised Unity session, no package installs.
Drop4 Hub now has a working **Express Mode** (🎭 card → stage + 6-category wheel →
real clip playback), verified end-to-end in real Chrome with screenshots.

**How the blocker fell:**
- `_unity_export/rig/locomotion_bindref.json` turned out to hold the SAME 7
  locomotion clips as the shipped idle-referenced bake, in BIND reference — a
  ground-truth pair. That let the idle→bind conversion be PROVEN (worst error
  0.016° = quantization) before touching emotes. The old "arithmetic conversion
  → 3/58" was a composition-order bug (wrong order = 151° error).
- New retarget (tools/world/emote_lab.mjs, zero-dep Node with its own GLB
  parser/FK): world-space per-bone transfer W_tgt = M(W_U·BindW_U⁻¹)·BindW_tgt,
  M = mirror-X, per-bone constant absorbs Blender's bone-frame roll. Judged by
  RENDERED FRAMES (puppeteer + system Chrome), per the doc's own warning that
  the hand-height metric misleads.
- All 16 characters re-exported from the RUNNING Unity via MCP (binary FBX via
  the ExportModelOptions overload — the default writes ASCII, which Blender
  rejects; the property is named ModelAnimIncludeOption, type Include).
  Superheros crashed Blender's FBX importer → fixed by trimming the prefab to
  its kept parts in Unity BEFORE export. rig_to_glb.py also gained a fix for a
  CYAN emissiveFactor the FBX import carried from Unity (washed characters blue).
- Result: `assets/characters/v2/*.glb` — 16 rigs, 190-540 KB, bind = Unity
  T-pose exactly, skeletons bit-identical → ONE bake serves all 16.
- `assets/characters/emotes/*.bin` — 58 emotes, 724 KB, ABSOLUTE v2-local quats
  (format 'v2local'), per-category lazy-load. Player: `arcade/drop4/express.js`.

**Verified:** pose grid renders (armsfolded folds, wave is right-handed, dab
dabs, textures correct) + live Express screen screenshot mid-wave + engine/career
suites still 60/60 green.

**World adoption path** (documented in EMOTE_RIG_ISSUE.md RESOLVED header):
point avatars at the v2 rigs, play the v2local bins directly, retire the
corr/delta path + CLIP_EMOTES_ENABLED gate. Locomotion rebase = same lab.
world/js deliberately untouched — that's the world chat's lane.

**Final polish round (same evening):**
- **Idle base layer** — baked the real Synty standing idle (53f @30fps, 9 KB,
  from the bind-referenced locomotion in `locomotion_bindref.json`) and made it
  Express's base layer: the character NEVER shows a T-pose; emotes blend over
  idle and blend back to it. `manifest.idle` + `idle.bin`.
- **Victory celebrations** — the result screen now shows the equipped character
  playing a random happy emote on a win (cheer/fistpump/dab/…), a kind shrug on
  a loss, checkwatch on a draw. `mountCelebration()` in express.js, mounted by
  showResult, torn down on navigation. THE cosmetic loop paying off in-game.
- **Idling home hero** — the home screen character is the v2 rig breathing the
  real idle (falls back to the static shipping model if express can't load).
- express.js refactored around one shared rig player (idle + emote channels);
  playing-state gold highlight on emote buttons; tab click SFX.
- Verified in real Chrome: Express idle stance (no T-pose), loss-shrug result
  screen from a real played match, superhero2 (trimmed) + dino onesie pose
  grids all correct, mobile 375px no-overflow with Curtsy mid-pose, 60/60 tests.

## 2026-07-23 — Drop4 → AMG Hub conversion (full build, autonomous, Devon at work)

Built the AMG Hub (nonprofit, educational, Chromebook) edition of Drop4 as a new
vanilla-JS + Canvas + three.js game at `arcade/drop4/`, on Firebase project
oda-hub-d4bef. `Desktop/Drop4` treated as read-only reference throughout — zero
commits there, zero imports back, isolation grep clean. Unlisted (not in
`js/oda-games.js`) so nothing shows to students until cutover. Branch
`drop4-hub-conversion`, not pushed. Ran in parallel with the amg-world chat;
stayed entirely in `arcade/drop4/` + `docs/` to avoid conflicts with its `world/`
WIP.

**Shipped, all verified in-browser at :3456:**
- Ported Drop4's pure brain out as framework-free ES modules: `engine.js`
  (connect-N rules + power pieces, zustand stripped → pure resolvers), `ai.js`
  (minimax), `career-data.js` (180 levels/15 cities, sim-tuned difficulty, gems→
  coins, species→character), `rarity.js`. 60 zero-dep Node tests green.
- `visuals.js` — Canvas piece-orb finish ramp (no white shine), slab board +
  holes, staged scene backdrops, 26 board themes + 15 piece skins.
- `game.js` — match driver: input, AI scheduling, boss scripts (Tommy parity /
  Sal flip / Warden seed — Tommy enforcement verified), timer, moves-limit,
  power pieces, drop/land/win-cascade FX.
- `characters.js` — 16 Polygon Kids picker via `amg-character-viewer.js`,
  mirroring `character.html`'s shared cross-game identity. Synty "Kits" removed.
- `shop.js` — single-coin economy, NO gems/ads/IAP, learn-to-earn nudge.
- `career.js` — Candy-Crush map (180 nodes/15 bosses), power-piece + character
  unlocks, level→match runner with intro cards.
- `index.html` — Hub shell (3D hero, VS Computer, Career, Characters, Shop,
  Records) on oda-core; 12 achievements, win effects, help, SFX.
- Internal `gameId:'connect4'` for data continuity (this REPLACES the connect4
  tile at cutover — repoint one registry line, reversible).

**Verified headlessly** (pane can't composite WebGL): 60 Node tests; in-browser
full match (click→drop→AI→win→result stars:3); career map 180 nodes/15 bosses;
Tommy parity rejects illegal taps; shop renders 41 items; all character assets
fetch 200; clean console.

**Deferred:** Express real-emote playback (Polygon rig re-export is
supervised-only — same blocker the amg-world chat diagnosed), Drop Rush minigame.

**Reusable pattern captured:** `docs/AMG_HUB_GAME_CONVERSION_STANDARD.md` — apply
to Tic Tac Toe and every other game next.

## 2026-07-23 — Emote diagnosis, Unity rescue, AMG World enrichment (remote-control day)

Devon out at work; drove the session by remote control. Branch `amg-world` in
`Desktop\ODA` (still unpushed — pushing = deploy, Devon's call). The Drop4→Hub
conversion is running IN PARALLEL in another chat (Phase 0 = pure connect-N
engine + AI + 41 tests landed on this branch as 913f3ee); this session stayed in
the AMG World / shared-hub lane to avoid conflicts.

### Emote clip transfer — precise final diagnosis, then parked
Isolated the failure with a NUMERIC test (bone world positions vs a Unity
ground-truth sample, in cm) instead of screenshots, which had misled repeatedly.
On the re-exported rig (bind POSITIONS match Unity exactly), "arms folded"
retargets the whole BODY to <5cm but the arm chain is off 20-30cm. TWO
independent retarget methods (local-frame delta + world-space delta) fail
IDENTICALLY on the arms → the fault is the data, not the math: Blender's
FBX→glTF round trip rolls the horizontal arm bones (armature bones must point
down their length), so hand positions match but bone frames don't. Fix =
Unity-native glTF exporter (gltfast), deferred to a supervised session (package
installs already caused one safe-mode incident today). Procedural emotes ship
and work. Full detail in docs/EMOTE_RIG_ISSUE.md.

### Unity safe-mode rescue
The Base Locomotion pack's Samples/Scripts/ (a demo controller) references the
new Input System with NO #if ENABLE_INPUT_SYSTEM guard, so with the package
absent it wouldn't compile and dropped the whole AMG Engine project into safe
mode (taking the MCP bridge down). Deleted Samples/Scripts/; clips live under
Animations/ so nothing was lost. Documented in tools/world/bake_locomotion.md.

### AMG World — NINE enhancements (all verified in real Chrome, committed)
- **NPC crowd** — wandering ambient kids so a solo park (everyone, 0 users) feels
  alive. Never counted in the live-player number (honest); no chat bubbles;
  scale down as real players arrive + by quality. Fixed a real Avatar bug:
  non-local avatars ran remote-interp unconditionally, dragging NPCs to origin.
- **Ambience** — generative wind + birds (WebAudio, no files, honours the toggle).
- **Onboarding coach** — one-time move→coins→zones→express, touch/kbd-aware,
  non-blocking.
- **Park achievements** — 8 badges via shared odaAchievements, counters persist,
  shown in the Help panel.
- **Character viewer rest-pose** — POLYGON Kids rest A-posed; the viewer now drops
  arms down (fixes the picker's first impression + the hub landing hero).
- **Coin combo** — streak juice on the most common action, bounded so it can't be
  farmed, milestone bonuses + confetti.
- **Sound mute toggle** — the world lacked one; now syncs odaSfx + ambience.
- **Daily park bonus** — first visit each day, bonus coins scaling with a visit
  streak (10→40, resets on a missed day); gold reward banner + confetti.
- **Hidden star hunt** — 5 glowing stars tucked across the park; find all → Star
  Hunter badge + big reward. The Poptropica discovery loop, distinct from coins.

### Also
- Sent a fresh Drop4→Hub bridge prompt to the "Drop 4 submission audit" chat, and
  surfaced that a complete conversion plan already existed at
  docs/DROP4_HUB_CONVERSION.md (from an earlier round) — Devon can paste it into
  the fresh chat without waiting.
- Re-verified the "games missing in-game cosmetics" audit gap: 13 of 14 were
  false positives (they read via myCosmetics[...]); only racers genuinely differs
  (its own garage). Games are in good shape.
- The parallel Drop4-hub conversion advanced well on this same branch: Phase 0
  (engine+AI, 41 tests) → full playable core (engine/AI/board/characters/economy/
  career) → achievements+Express. In arcade/drop4/ — left untouched to avoid
  conflicts; my work stayed in world/ + shared oda-core.

### Verified end-to-end
Fresh entry → picker (arms-down) → world → onboarding → NPCs + ambience →
coins/combo → achievements → sound toggle → solo presence. Zero console errors.

## 2026-07-23 — Synty animation + win effects (continued overnight session)

Continues the 2026-07-22 session below. Branch `amg-world`, still unpushed.

### Real animation replaced the sine waves
Devon already owned `ANIMATION_Base_Locomotion` — it was in `Downloads/`, just
never imported into the AMG Engine project, which is why searching the project
for walk/run clips came up empty and I nearly had him buy it again. Imported it
(1694 clips now, 346 POLYGON locomotion).

Baked 7 clips (idle/walk/run/sprint/jump/fall/land, 127 KB) onto the kid rig.
The kid characters and the Synty packs share an identical bone hierarchy and the
PolygonKids rig is a valid Mecanim humanoid, so Unity's own retargeter maps an
adult clip onto a 1.2 m child for free.

Two traps, both documented in `tools/world/bake_locomotion.md`:
- Bake DELTAS from the reference pose, not absolute local quaternions — the kid
  GLBs are centimetres with up along local Z, Unity's prefab is metres with up
  along +Y, and absolutes lay the character on its side.
- Deltas alone splayed the arms, because the rigs assign different local AXES
  per bone. Solvable from the two rest poses: `c_b = u_b^-1 * c_p * g_b`, then
  conjugate each delta into this rig's frame.

Movement speeds dropped 2.4/4.6 -> 1.6/3.4 m/s: measuring ankle travel puts the
walk clip at ~0.74 m/s on a kid's proportions, so adult speeds made the legs
whirl.

### Emotes: built, curated, and deliberately switched OFF
Baked 58 emotes from the two packs Devon already had imported, as Int16 binary,
one file per category, lazy-loaded (724 KB total; a kid who only waves downloads
83 KB). Tabbed wheel with a favourites row and digit shortcuts.

**Curation is a safeguarding decision** and is written down in
`tools/world/emote_allowlist.json`. The Synty packs ship gestures that must
never appear in a space where 9-13 year olds interact: the entire Taunt category
(it exists to mock another player), throat-slit, strangling, finger guns, the
Reproach set, drunk sway, and religious clips. 58 kept of 235.

**They don't transfer, so they're gated off** (`CLIP_EMOTES_ENABLED`). The bake
is provably correct — deltas match Unity byte for byte — but the exported kid
GLBs rest with arms DOWN (hands at 0.600) while Unity's bind is a T-POSE
(0.868). Head matches exactly, so spine and legs agree and only the arm chain
differs. The frame correction assumes the two rests are the same pose in
different axes, so it absorbs a real 103-degree pose difference and throws the
arms into the air. Three approaches measured against Unity ground truth; the
telling one is that re-baking against Unity's arms-down idle (8 cm from the
GLB's rest instead of 27 cm) barely helped — so the residual is in the arm
chain's BONE OFFSETS, not its rotations.

**Fix: re-export the kid characters from Unity so their rest matches the rig the
clips were authored against.** That's a change to Devon's character export
pipeline, not something to guess at from the runtime. Everything else is in
place and lights up when the flag flips. Full analysis: `docs/EMOTE_RIG_ISSUE.md`.

Locomotion is unaffected and live — its arm motion is small relative to rest.

### Win effects — the audit's biggest ecosystem win, now real
The shop sold 8 win effects and no game rendered any of them. Added
`odaWinEffect()` to oda-core (resolves + caches the student's equipped
cosmetics, warms on load, falls back for guests) and wired it into the
personal-best path of 8 more games. Verified live: 40 confetti elements spawn
and self-clean.

### Verified
- Gait blend clean at every speed; stride 0.25 m with proper foot lift
- Character stands, walks and runs correctly on real keyframes (screenshots)
- With clip emotes gated: procedural wheel works, locomotion live, no errors
- All edited inline scripts parse clean

### Open
- **Re-export the kid GLBs** to unblock 58 emotes (see EMOTE_RIG_ISSUE.md)
- Multiplayer still needs the RTDB instance + `firebase deploy --only database`
- Mobile still untested on a real device
- Foot-skate (`CLIP_SPEED` in clips.js) tuned from measurement, not by eye

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

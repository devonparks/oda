# Sprint Log

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

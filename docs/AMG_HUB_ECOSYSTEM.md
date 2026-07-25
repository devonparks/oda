# AMG Hub — Ecosystem Architecture

*Written 2026-07-24 with Devon. This is the reference for how accounts, shops,
profiles, characters, controls, and the economy fit together. Grounded in a full
codebase inventory (5-agent sweep) — "exists today" claims cite real code.*

**North star:** a kid can type the URL and be playing in five seconds (Cool Math
accessibility) · a teacher can write a code on the board and have a class
(Devon's proven system) · everything you unlock lives on ONE account across the
whole hub · learning is the accelerator, never the wall · **the games have to be
good.** The platform is Devon's own thing — teachers are amplifiers, never
dependencies; no district integration, ever.

---

## 1 · Accounts: one door, three paths

### Exists today (verified in code)
- **Student login**: class code → `classCodes/{code}` public lookup (no PII read)
  → roster name list → tap your name → session in localStorage (`studentId`,
  `studentName`, `classCode`). An **anonymous Firebase Auth bootstrap already
  runs** (`amgEnsureAnonAuth`, student.html) because hardened Firestore rules
  require `request.auth != null` for kid writes.
- **Teacher/Guardian**: email or Google → `teachers/{uid}` with
  `accountType: 'teacher' | 'parent'` — the parent product is the SAME engine
  with relabeled UI (`amgApplyParentLabels`: Roster→"My Kids", Class Code→
  "Family Code"). One codebase, two skins. Keep this — it's genuinely good.
- **Parent quick check**: kid's name + 4-digit `parentCode` → read-only
  `parent.html`. No auth at all (rules allow public reads on `students`).
- **Admin**: `admin.html`, hardcoded to Devon's email.

### To build (the pivot)
1. **[▶ Just Play]** on the front door: anonymous-auth account created silently;
   coins/cosmetics/XP save immediately to a real `students/{id}` doc (no
   teacher, no roster fields). A friendly **save code** (three-word phrase shown
   in the profile card) restores the account on any device. No OAuth — school
   Google is district-controlled and blockable; anonymous + save code is
   COPPA-clean (zero PII) and district-proof.
2. **Kid PIN** (fixes the real incident Devon saw): optional self-set 4-digit
   PIN on roster accounts, checked at name-pick; teacher can reset from the
   roster. ClassDojo-proven pattern.
3. **Join-a-class merge**: a solo anon account can attach to a roster name later
   and KEEP its cosmetics (summer kid → September classmate).
4. **Party codes** (multiplayer spine): short-lived room codes for head-to-head
   and world instances — the Quick Match room-code pattern already in ~10 games,
   promoted to a first-class hub concept. Class code = a long-lived party code
   with a teacher attached. Leaderboards scope to code + global.

Deferred: parent accounts beyond what exists (the relabeled engine + quick
check already cover it).

---

## 2 · Two-tier shops (exists — formalized here)

**Tier 1 — per-game shops** (`window.odaShop`, ~50 games): items whose `slot`
is game-specific ("Ball Skin", "Board Theme", "Snake Skin"…). Persist to
`students/{id}.gameCosmetics.{gameId}.owned[] / .equipped.{slot}` + localStorage
`oda_cosmetics_{gameId}` (the canonical fast read). **Rule: anything that only
renders inside one game belongs in that game's shop.** If you love one game you
can max it out — Devon's Drop4 boards-and-pieces model.

**Tier 2 — the AMG Shop** (`shop.html`): identity that follows you everywhere —
avatars, name colors, borders, titles, chat bubbles, profile backgrounds, win
effects, and (new) **calling cards + emblems + characters**. Persists to
`students/{id}.inventory[]` + `equipped.{slot}`.

**The bridge** (`amgIdentityCosmetics`, oda-core): exactly 5 site slots render
inside games today — `avatar, nameColor, winEffect, border, title`. Extend this
whitelist deliberately (calling cards join it via the player-card renderer);
never let per-game and site catalogs share item ids.

**Pricing ladder (standard, both tiers):** common 0–150 · uncommon/rare 300–600
· epic 1500–3000 · legendary 5000–10000 · **achievement-locked = cost 0, can't
be bought at any price**. The hub has NO real-money anything, ever — coins come
from play, learning multiplies them.

**Known debt (flag for cutover):** Drop4 Hub deliberately shares
`gameCosmetics.connect4` with old Four in a Row, but item ids/shapes differ —
old purchases won't be recognized. Ship a small id-migration map with the
cutover, or accept the re-buy and grant a courtesy coin refund.

## 3 · Profile: calling cards & emblems (Devon's CoD layer)

**Exists:** the Profile Card modal (student.html) — avatar+border, colored name,
title, stat tiles, XP bar, top-5 achievement showcase, profile background.
Devon remembered it as "calling cards and emblems"; git history shows it shipped
as one live-editable card. The data's all there (`equipped.*`).

**To build (this session):**
- **Calling cards** — a new shop category: wide code-drawn banner designs (CSS
  gradients/patterns/animations, zero image assets). Equips to
  `equipped.callingCard`. The banner IS the top strip of your player card.
- **Emblems** — small stamp equipped independently of the avatar
  (`equipped.emblem`), rendered on the card's corner. The CoD emblem slot.
- **`odaPlayerCard(el, profile)`** — ONE shared renderer in oda-core (injects
  its own styles, like odaShop does) that draws the full card: calling-card
  banner + emblem + avatar/border + name color + title. Used by the profile
  modal and the shop loadout now; adopted by each game's leaderboard as it gets
  its quality overhaul. That's when leaderboards stop being plain-text names
  and start being flexes — Devon's "easy retention" instinct.
- Scholar line: earned-only cards/emblems/titles granted by learning milestones
  (never buyable). The rarest-looking gear only exists on kids who did the work.

## 4 · Characters (the two rails)

- **Hub rail (Polygon Kids)**: `character.html` is ALREADY a character shop —
  first squad free, the rest coin goals, equips `equipped.character`, and the
  equipped 3D portrait already replaces the emoji avatar in the profile card.
  **Gap to close:** AMG World's picker ignores ownership (all 16 free) and
  doesn't read `equipped.character`. World should show locked kids with prices,
  route to the shop, and default to your equipped character.
- **Commercial rail (Synty Sidekick)**: Drop4/TTT full creator. Different
  skeleton — cosmetics can't literally transfer, so unlocks MIRROR instead via
  the verified TTT⇄Drop4 `grantCosmetic` bridge (hub milestone → themed Drop4
  item, and vice versa). One account, two wardrobes, mirrored trophies.

## 5 · Teacher / parent / kid control matrix

| Capability | Kid (solo) | Kid (in class) | Teacher | Guardian (parent mode) |
|---|---|---|---|---|
| Instant play, no signup | ✅ | ✅ (after name-tap) | — | — |
| Progress/cosmetics persist | ✅ anon+save code | ✅ roster account | own cosmetics | own cosmetics |
| Assignments ("Missions") | self-serve packs (build w/ overhauls) | ✅ from teacher | creates/grades | creates/grades ("Missions") |
| Gate arcade until work done | ❌ n/a | ✅ `arcadeLocked` (exists) | toggles it | toggles it |
| See progress | own profile | own profile | full roster | My Kids + quick check |
| PIN | — | set own | reset kid's | reset kid's |
| Coins/economy | ✅ same wallet | ✅ same wallet | ∞ (demo mode, exists) | ∞ |

**Design law:** every row a kid touches works WITHOUT the rows below it.
Teacher features gate *their class's* kids only; nothing gates the walk-in kid.

## 6 · Economy notes

One wallet: `students/{id}.coins` — every game, both shops, the world, all read
it. XP/levels separate and cosmetic-only (`odaXP`, cap 50). Earning stays
per-game formulas until each overhaul normalizes; learning tools should pay the
most per minute (the thesis, already reflected in Learn & Earn copy).
**Honest caveat (in firestore.rules comments too):** the economy is
client-trusted — fine for launch scale; Cloud-Function-mediated awards are the
eventual anti-cheat if it ever matters. Don't pretend otherwise.

## 7 · Build order (Devon's 3 weeks)

1. Flappy overhaul → **Wing It** (rename + gameplay bar + its shop + card on
   leaderboard) — the template for the rest
2. 3PT Showdown overhaul (Basketball-Stars DNA, Drop4 playbook)
3. Typing Race overhaul + code-race multiplayer (teacher vector)
4. Front door: Just Play + save codes + PIN (+ Drop4 cutover with migration)
5. Calling cards/emblems/renderer — **building tonight** (this doc's §3)

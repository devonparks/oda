# AMG Hub — Overhaul Plan (2026-07-12)

ODA Hub → **AMG Hub** (amghub.org). Public, direct-to-consumer educational game platform for
kids ~9–13. Fun-first. Character-centric. Learn-to-earn. No school required.

Work happens on branch **`amg-hub`** — main is untouched until Devon reviews and merges.
Pushing main deploys to the live site (GitHub Pages), so nothing is pushed by Claude.

---

## Ground rules (decisions taken)

1. **Firebase project stays `oda-hub-d4bef`.** Project IDs can't be renamed; migrating would delete every kid's account/coins. Invisible to users.
2. **Internal identifiers stay** (`js/oda-core.js`, `ODA_CONFIG`, `odaShop`, `odaRacers` collection...). Renaming ~118K LOC of internals is churn with zero user value. Only USER-FACING surfaces rebrand. Documented in `docs/REBRAND_NOTES.md`.
3. **Firestore schema stays.** `classCode` field now means "Family Code" in the UI; `teachers` collection becomes the "guardians" collection (docs carry `accountType: 'teacher' | 'parent'`). Existing users keep working unchanged.
4. **The teacher portal becomes the Parent Command Center.** Roster→My Kids, Assignments→Missions, arcade lock→screen controls, dashboards→progress. This is the "migrate oversight to parents" ask with minimal new code.
5. **Legacy class-code login keeps working.** Existing ODA students/teachers are not broken by this rebrand.

## Phases

### A — Docs + branch ✅
Audit (`AMG_HUB_AUDIT.md`), this plan, checkpoint commit of prior WIP on `amg-hub`.

### B — Rebrand every user-facing surface
- All page titles/headers/footers/toasts: ODA Hub → AMG Hub; "- ODA Arcade"/"- ODA Hub" title suffixes → "- AMG Arcade" (normalized).
- Deep-content renames: coinminer (ODA Bank→AMG Bank, ODA Multiverse→AMG Multiverse, "ODA Legend"→"AMG Legend", "Mr. ODA's cousin"→"Mr. Devon's cousin"), lemonade "ODA Coins"→"AMG Coins", racers `<h1>`→AMG Racers, retrobowl scoreboard 'ODA'→'AMG', shop items "ODA Logo/Special"→"AMG ...", wordle share text, student hub "ODA Shop" banner, "ODA World" coming-soon → "AMG World".
- Remove employer school/district dropdowns from signup.
- Create `manifest.json` (fixes 404, enables PWA install) + README.
- CNAME: **left as odahub.org** until Devon flips DNS (see launch checklist). amghub.org steps documented.

### C — Auth overhaul + family accounts
- **New: Parent signup** (email or Google) → doc in `teachers` collection with `accountType:'parent'`, auto Family Code. Add kids (name+grade) → same `students` schema. Kid login = Family Code → pick name (the proven class-code flow, relabeled).
- **Fix the 7 audit bugs**: logout clears all identity keys (shared `amgClearSession()` in core); redirect gating with a loading state instead of instant ping-pong; `snap.exists()` guard → clean re-login; role keys de-overloaded; duplicate-classCode detection at login.
- **Security hardening**: enable Firebase **Anonymous Auth** on kid login; new `firestore.rules` require `request.auth != null` for student writes (existing UX unchanged — sign-in is invisible). Teachers/guardians PII read locked to auth'd users; public class-code lookup moves to a new thin `classCodes/{code}` collection. One-time backfill script provided (`tools/migrate-classcodes.mjs`) — **Devon runs it + deploys rules** (prod actions).

### D — Cosmetics pipeline fix
- **Identity bridge**: games merge `students/{id}.equipped` (avatar/nameColor/winEffect) into their `myCosmetics` at load — one shared helper `odaIdentityCosmetics(d)` in oda-core.js + a mechanical per-game patch. Avatars/name colors/win effects finally render in games. This makes the character the identity thread the plan demands.
- Fix wrong-shape call sites (wordle object, uno `.id`, trivia slot-name mismatch).
- **Implement every dead paid cosmetic** (chess piece sets, tictactoe win lines, blockblast clear effects, 2048 tile themes, bowling lanes, solitaire card faces, typing trails/cars, whackamole mallets, memory card animations, mathsprint fonts, sudoku call-order, uno call sounds, lemonade cups; music removed+refund-priced). No selling nothing.

### E — Teacher tools → Learning Games ("Learn & Earn")
- Ship **built-in content packs** so every learning game is kid-solo: jeopardy starter boards, Quiz Blitz solo quizzes, flashcard starter decks, word search + crossword packs, library passages (public domain), spelling already has banks.
- **Coin hooks everywhere**: spelling finally awards coins; keyboard practice mode awards coins; learning games pay ~2-3× arcade rates (the acceleration IS the product).
- Student hub: "My Tools" tab → **"Learn & Earn"**; teacher-created content still appears when present.
- Retire/park: lemonade.html (employer program + real-world event), builder.html (author meta-tool), southeast-slime (school-specific). pitch.html loses "Young Entrepreneur Institute" branding. scoreboard/timer/raffle reframe to parent/family tools.
- Fix cross-tenant content leaks (crossword/library/wordsearch listing filters) + free-hints bug + wordsearch hint-cost desync.

### F — Landing page + parent trust
- New public index.html: kid-inviting hero (character + games front and center), learn-to-earn explained in kid language, parent section (what it is, no ads, no chat with strangers, parent controls), doors: **Play** (family code) / **Parents** (signup/login) / legacy class-code path preserved.

### G — Launch checklist + handoff
`docs/AMG_HUB_LAUNCH.md`: Namecheap DNS → GitHub Pages, CNAME swap, Firebase authorized domains,
App Check/reCAPTCHA domain, Cloud Function CORS domains, rules deploy, migration script, repo
rename decision, Devon review gates.

## AMG World readiness (build-aware, don't build)

- One account + one `students/{id}` doc + one `equipped` tree = the character record AMG World reads later.
- `oda-games.js` registry stays the single game index (a 3D zone later maps 1:1 to registry entries).
- character-creator/ prototype stays parked; its output should eventually write `students/{id}.equipped.character` — documented, not built.
- Nothing new hard-codes teacher/class assumptions.

## Explicitly deferred

- Real server-authoritative economy (Cloud Functions for coin awards) — post-launch hardening.
- Multiplayer anti-cheat (client-trust model documented).
- Racers/keyboard/library localStorage→cloud progress sync.
- character-creator integration + AMG World.

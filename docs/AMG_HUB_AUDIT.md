# AMG Hub — Full Codebase Audit (2026-07-12)

Audit of the ODA Hub codebase ahead of the AMG Hub rebrand. 8 parallel audit agents read every
game, tool, and infrastructure file (~118K LOC). This is the synthesis; findings cite files/lines.

---

## What exists

| Area | State |
|---|---|
| **49 arcade games** | 47 live + registered (`js/oda-games.js`), 1 empty stub (`pixelplaza/`), 1 orphan (`southeast-slime.html`, unlinked) |
| **8 learning tools** | jeopardy, kahoot (Quiz Blitz), spelling, flashcards, crossword, wordsearch, library, keyboard (Keyboard Warriors) |
| **8 misc tools** | canvas, timer, scoreboard, raffle, builder (ODA Studio), elevator, pitch, lemonade |
| **Portals** | index (login), student (hub), teacher (6-tab command center), parent (read-only viewer), shop (global cosmetics), admin (Devon-only ops) |
| **Backend** | Firebase project `oda-hub-d4bef`: Firestore (~70 collections), 1 Cloud Function (`ai` → Anthropic proxy, CORS-locked to odahub.org), App Check (reCAPTCHA v3), Hosting = GitHub Pages @ odahub.org |
| **Tests** | 11 Node suites (Admin SDK) — game logic only; zero auth/rules coverage |
| **Character creator** | `character-creator/` — standalone layered-PNG prototype (male/female, afros/braids/locs/Jordans/AF1s). NOT wired to accounts/Firebase at all yet |

## The economy loop (already real)

Every game awards coins via `awardCoins()` → Firestore `students/{id}.coins` increment.
Learning tools award MORE per session (jeopardy/kahoot 10–50 by accuracy, kahoot live 100 for 1st).
Coins spend in the global shop (avatars, name colors, borders, titles, win effects) and ~44 per-game
shops (board themes, skins, trails). XP/levels (`odaXP`, Lv1–50 Rookie→G.O.A.T.) run alongside.
**Learn-to-earn is already built — it just needs the teacher dependency removed.**

---

## BROKEN #1 — Cosmetics don't show up in games (root cause found)

Two cosmetics systems that never talk to each other:

1. **Global shop** (`shop.html`) writes `students/{id}.equipped.{avatar,nameColor,winEffect,border,title,...}` via raw `updateDoc`.
2. **Per-game shops** (`odaShop` in `js/oda-core.js`) write `students/{id}.gameCosmetics.{gameId}.equipped.{slot}` (+ localStorage mirror).

Games load ONLY `gameCosmetics.{gameId}.equipped` into `myCosmetics`, then read
`myCosmetics.avatar / .nameColor / .winEffect` — **keys that only ever exist in the global
`equipped` tree**. So identity cosmetics NEVER render in any game:

- Avatar/name color dead in: chess, connect4, tictactoe, rps, hangman, trivia, typing (in-game player panels fall back to letter initials).
- **Win effects (up to 8,000 coins — Nuclear/Aurora) never fire anywhere.** Every game calls `odaCelebrate(myCosmetics.winEffect?.type||'confetti')` → always plain confetti. wordle passes the whole object; uno reads `.id` — extra-wrong shapes.
- `window.loadCosmetics()` (oda-core.js:403) reads the CORRECT field and is **dead code — never called anywhere**.

Per-game cosmetics themselves mostly work (43–44 of 47 games write/read consistently).

### Dead PAID cosmetics (kids spend coins on nothing)
| Game | Item | Cost | Problem |
|---|---|---|---|
| chess | Piece Set (Crystal/Shadow/Gold) | up to **1000** | equippable, zero visual effect |
| typing | Car Style | up to 800 | doesn't change the car icon |
| tictactoe | Win Line | up to 600 | no `value` field, never read |
| trivia | Celebration Effect | up to 600 | key mismatch (`winEffect` vs `'Celebration Effect'`) |
| solitaire | Card Face | up to 600 | CSS vars never consumed |
| blockblast | Clear Effect | up to 500 | never wired at all |
| typing | Trail Effect | up to 500 | CSS vars never consumed |
| uno | UNO Call sound | up to 500 | sound hardcoded |
| 2048 | Tile Theme | up to 500 | `--2048-tile-accent` unread |
| bowling | Lane Theme | up to 400 | lane always default wood |
| memory | Card Animation | up to 400 | never applied |
| lemonade | Cup Design / Music | up to 1100 | never rendered/played |
| whackamole | Mallet Style | up to 300 | not even a CSS var |
| mathsprint | Number Style fonts | ~120 | fonts never imported in `<head>` |
| sudoku | Number Style | ~120 | call-order bug (applied before grid builds) |

---

## BROKEN #2 — Login is "iffy" (7 concrete causes)

Root cause: **two parallel auth systems** — real Firebase Auth (teachers only) and a bag of
localStorage flags (`studentId/studentName/userRole/odaUserRole/teacherId/parentStudentId`) that
stands in for "session" everywhere else. They leak into each other:

1. **Teacher logout never clears localStorage** (teacher.js:239) — role/identity keys persist after sign-out on shared devices; shop.html trusts them without checking live auth.
2. **Firestore rules allow unauthenticated writes to any student doc** (firestore.rules:35-43 — no `request.auth` check on update). Anyone with a student doc ID (it's in localStorage + query strings) can write coins/xp/equipped. The header comment claims teacher PII is protected; the actual rule is `allow read: if true`.
3. **parentCode backfill is forbidden by the rules** (teacher-roster.js:222 vs rules:38-41) — fails silently; legacy students can never get a parent code → parent login permanently "Not found."
4. **Class-code generation TOCTOU race** — duplicate codes possible; student login takes `snap.docs[0]` → can land in the wrong roster.
5. **Redirect ping-pong risk** — index.html ⇄ teacher.html both hard-redirect on auth state with no loading gate; slow IndexedDB auth rehydration on Chromebooks = "sometimes I can't log in."
6. **Session-timeout key overload** — teacher identity is written into `studentId`/`studentName` (shop compat); 4h sweeper clears the same keys with different meaning.
7. **No `snap.exists()` guard** on the student doc listener — deleted/stale ID = silently broken dashboard instead of clean re-login.

Also: economy writes are fully client-trusted (daily challenges, coin awards) — acceptable for
school context, needs hardening (anonymous auth + rules) for public launch.

---

## Employer/IP entanglements (must-handle for rebrand)

- **lemonade.html** — built around the national "Lemonade Day" program (former employer's program), rehosts a Mikaila Ulmer video, needs teacher approval flow, tracks real-money booth sales. **Structurally can't survive the pivot → retire/park.**
- **pitch.html** — header literally reads "ODA — Young Entrepreneur Institute" (employer program). Mechanically kid-solo already → keep, strip that branding.
- **southeast-slime.html** — "Southeast" = school-specific build; orphaned (nothing links it). Park until renamed.
- **index.html signup** — hardcoded dropdowns of the employer's districts/schools/programs (Breakthrough, CMSD, ODA sites...). Remove wholesale.
- **Trademark exposure in game names**: mostly already defused (uncommitted renames: Wordle→Word Guess, Tetris→Block Drop, Uno→Color Cards, etc.). Still exposed: **"Retro Bowl"** (real trademarked game), "2048" (weak mark, common), "Minesweeper"/"Solitaire"/"Sudoku" (generic, fine).

## Deep ODA branding (beyond find-and-replace)

- **coinminer** — generators "ODA Bank"/"ODA Multiverse", "Mr. ODA's cousin", achievement "ODA Legend", stat "ODA Coins Earned" (gameplay content, needs a real rename pass).
- **lemonade** — currency displayed as "ODA Coins", function `awardODACoins()`.
- **racers** — on-screen `<h1>ODA Racers</h1>` + Firestore collection `odaRacers` (keep collection, rename UI).
- **retrobowl** — scoreboard abbreviation hardcoded `'ODA'`; also loads nonexistent `js/oda-hub.js` → **records/coins never work at all**; no coins awarded; 900KB unused sprites.
- Shop items named "ODA Logo"/"ODA Special" card backs (uno, solitaire, memory); wordle share text "ODA Word Guess #N"; solitaire/rps/tictactoe use "- ODA Hub" title suffix vs everyone else's "- ODA Arcade".

## Other notable bugs found

- `index.html` links `manifest.json` — **file doesn't exist** (404; no PWA install).
- canvas.html: gallery viewer `openGallery()` fully built but **no button calls it**; +5 coins per share with no cap = infinite coin farming; no content moderation on public galleries (canvas, pitch).
- crossword: hint UI says "(5 coins)" but hints are free; student browser lists EVERY teacher's puzzles (cross-tenant leak — same in library with no classCode, wordsearch `isPublic:true` hardcoded).
- wordsearch: hint cost only deducts a localStorage mirror, never real coins.
- library: reading log/streak is localStorage-only — lost on device switch.
- keyboard: ALL progress (campaign/achievements/WPM) in one localStorage key — same loss.
- racers: garage economy spends a localStorage-only coin pool, disconnected from platform coins.
- dodgeball/doodlejump/flappy/helicopter: RAF game loop never cancelled on navigate (battery burn); fruitninja does it right.
- floodfill leaderboard: always `orderBy('best_easy')` — Medium/Hard-only players invisible.
- penaltykick tournaments: 3rd-place payout/badge can never fire (`results['3']` never computed).
- spelling: the ONLY kid-solo-ready tool today (built-in word banks) — and the only tool that awards **zero coins**.
- dominoes: achievements defined, never checkable/displayed.
- admin.html: full-collection reads just for counts (cost grows with users).

## What's genuinely good (keep/lean on)

- Design system (`css/oda-theme.css`) — tokenized, dark, "Discord meets Cool Math Games." Rebrand-ready.
- `oda-games.js` registry — already the modular game-loading system the plan wants (swap-in upgrades = edit one entry).
- Shared `odaShop`/`odaHelp`/`odaXP`/toast/confetti infrastructure — real engine reuse.
- connect4, suika, wordscramble, aimtrainer, helicopter, flappy — reference-quality cosmetic integrations.
- Learning tools' play engines (jeopardy/kahoot/flashcards/library) are strong kid games — only their CONTENT is teacher-gated.
- The security hardening that exists (CSP injection, XSS esc, App Check, framebusting, brute-force throttle) is genuinely above-average for this class of app.

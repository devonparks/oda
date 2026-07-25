# AMG Hub — Game Name Audit (2026-07-24)

Devon flagged that some games ship under real games' names. Full catalog swept
(51 entries in `js/oda-games.js` + root tools). **Mechanics are not protectable;
names and art are.** Drop4 is the house template: renamed, original art, original
SFX — every rename below doubles as brand-building (kids advertise OUR name).

Verdict counts: **1 HIGH · 6 MEDIUM · 24 low · 20 none.**
Most of the catalog was already de-branded in past passes (Sea Strike, Color
Cards, Word Guess, Color Recall, Fruit Merge, Block Drop, Gridiron Rush, Sky
Bounce — all good renames).

## Display-name changes (kid-facing — Devon veto, then 1-line swaps)

| Now | Risk | Why | Proposed AMG name |
|---|---|---|---|
| **Block Blast** | HIGH | Near-exact match to "Block Blast!" (Hungry Studio) — a specific, hugely popular, trademarked current game, not a genre term | **Blocksplode** |
| **Floppy Bird** | MED | One letter off "Flappy Bird" (the famous 2014 clone-purge target); same theme | **Wing It** (rename with its overhaul — it's overhaul #1) |
| **Whack-a-Mole** | MED | "Whac-A-Mole" is a registered mark (Bob's Space Racers); ours differs only by spelling | **Mole Patrol** |
| **2048** | MED | Identical to Cirulli's famous title (open-source game, but the NAME is his brand) | **Number Crunch** |
| Ping Pong | low | Genericized, but technically an Escalade Sports mark | *(optional)* **Paddle Battle** |

Everything else display-side is generic/public-domain (Chess, Snake, Solitaire,
Minesweeper, Sudoku, Hangman, War, Dominoes, Lights Out, Brick Breaker…) or
original. **Fruit Slash** display name is fine as-is.

## Internal directory names (NOT kid-facing — defer to each game's overhaul)

`arcade/flappy`, `arcade/fruitninja`, `arcade/tetris` (Block Drop),
`arcade/retrobowl` (Gridiron Rush), `arcade/wordle` (Word Guess),
`arcade/suika` (Fruit Merge), `arcade/simonsays` (Color Recall),
`arcade/doodlejump` (Sky Bounce), `arcade/2048`.

These appear in URLs but not in UI. **Do NOT batch-rename now**: the dir name is
the `gameId`, which keys Firestore record collections (`{gameId}Records`),
cosmetics (`gameCosmetics.{gameId}`, `oda_cosmetics_{gameId}`), and bookmarks.
Rename each during its quality overhaul with a legacy-read fallback, not before.
(`arcade/pixelplaza` is an empty dir — delete whenever.)

## Art/audio note

Name is only half of IP hygiene. During each overhaul, replace any borrowed
visual identity (bird-and-green-pipes reads as Flappy Bird regardless of name)
with AMG's code-drawn art direction, per the Drop4 precedent.

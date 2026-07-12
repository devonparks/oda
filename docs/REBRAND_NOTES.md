# Rebrand Notes — what says AMG, what stays `oda`

**Rule: users see AMG Hub. Code keeps `oda` internals.** Renaming ~118K LOC of identifiers,
filenames, localStorage keys, and Firestore collections would risk breaking every existing
player account for zero user value.

## Stays `oda` (do NOT rename)

| Thing | Why |
|---|---|
| `js/oda-core.js`, `js/oda-games.js`, `css/oda-theme.css` | referenced by 60+ pages |
| `ODA_CONFIG`, `odaShop`, `odaToast`, `odaHelp`, `odaXP`, `odaCelebrate`, `ODA_GAMES`, `ODA_TOOLS` | shared engine API across every page |
| localStorage keys: `oda_cosmetics_*`, `odaCoins_*`, `odaUID`, `odaLastActivity`, `odaUserRole`, `oda-pitch-projects`, `odaRacersState`, `oda-tetris` | live player data in browsers today |
| Firestore: `odaRacers`, `odaRacersLeaderboard` collections; all field names | live player data |
| Cosmetic item IDs: `back_oda`, `sol_back_oda`, ... | already in player inventories (display names DID change to "AMG Logo"/"AMG Special") |
| CSS classes `.oda-*` | styling contract |
| Firebase project `oda-hub-d4bef` | project IDs are permanent; all data lives here |

## Changed to AMG (user-facing)

- Every `<title>`, header, footer, toast, share string, meta description
- Game-title suffix normalized: `— AMG Arcade`
- Deep content: Coin Miner generators/achievements, Lemonade Stand currency label, AMG Racers h1, Gridiron Rush scoreboard `AMG`
- Shop item display names ("AMG Logo", "AMG Special")
- New: `manifest.json`, `assets/amg-icon.svg`, README

## Name changes for trademark safety (this pass)

- **Retro Bowl → Gridiron Rush** (Retro Bowl is New Star Games' trademark)
- **Jeopardy → Quiz Show** (Sony trademark; same logic as the earlier Wordle→Word Guess pass)
- Simon Says h1 → Color Recall (finishing an already-started rename)

## Later (when convenient, low priority)

- Repo rename `oda` → `amg-hub` on GitHub (redirects are automatic; update git remotes)
- `functions/` CORS + CSP already list odahub.org — amghub.org added at launch (see AMG_HUB_LAUNCH.md)

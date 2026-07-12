# AMG Hub

**Play games. Learn stuff. Level up.**

AMG Hub is a browser-based gaming platform for kids (~9–13) where **learning is the power-up**:
every player has one character and one coin balance across 44+ arcade games and learning
challenges — and doing the learning activities earns coins the fastest. Coins buy cosmetics,
skins, and effects for your character and your games. No ads, no purchases, no chatting with
strangers.

- **Live site:** [amghub.org](https://amghub.org) *(formerly ODA Hub / odahub.org)*
- **Stack:** vanilla HTML/CSS/JS + Firebase (Firestore, Auth, App Check) + one Cloud Function (AI proxy) + GitHub Pages
- **Runs on anything:** built Chromebook-first — no build step, no frameworks, loads fast

## Layout

```
index.html            landing + login (kid / parent / legacy class code)
student.html          the kid hub (missions, learn & earn, arcade)
teacher.html          command center (guardian: parent or teacher accounts)
parent.html           quick progress viewer
shop.html             global character shop (avatars, name colors, win effects)
arcade/<game>/        47 self-contained games (registered in js/oda-games.js)
*.html (root)         learning games & tools (quiz show, quiz blitz, spelling, flashcards, ...)
js/oda-core.js        shared engine: Firebase loader, shop system, XP, help, security
js/oda-games.js       THE game registry — one entry per game (modular swap-in point)
css/oda-theme.css     design tokens ("Discord meets Cool Math Games")
functions/            Cloud Function: AI endpoint (Anthropic proxy)
tests/                Node test suites (Firebase Admin SDK)
docs/                 audit, plan, launch checklist, sprint log
```

> Internal identifiers still use the `oda` prefix (files, JS globals, Firestore collections).
> That's deliberate — see `docs/REBRAND_NOTES.md`. User-facing surfaces say AMG Hub.

## Development

No build step. Open pages with any static server (e.g. `npx serve .`) — Firebase config is in
`js/oda-core.js`. Tests: `cd tests && node run-all.js` (needs `serviceAccountKey.json`, not in repo).

Deployment is a push to `main` (GitHub Pages). See `docs/AMG_HUB_LAUNCH.md` before deploying
the rebrand.

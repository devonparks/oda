# AMG Hub — Launch Checklist

Everything needed to take the `amg-hub` branch live at **amghub.org**. Steps marked **[DEVON]**
need your accounts/consoles — Claude can't (and shouldn't) do them.

---

## 0. Review gates (before anything ships)

- [ ] **[DEVON]** Read `docs/AMG_HUB_AUDIT.md` + skim the `amg-hub` branch commits
- [ ] **[DEVON]** Click through locally: `cd ODA && python -m http.server 3456` → landing, kid login, a few games, shop, a learning game (Quiz Show starter board), parent signup
- [ ] **[DEVON]** Decisions to confirm (all changeable):
  - "Gridiron Rush" as the Retro Bowl rename ("Retro Bowl" is New Star Games' trademark)
  - "Quiz Show" as the Jeopardy rename (Sony trademark — same logic as your Wordle→Word Guess pass)
  - Lemonade Day tool retired from the kid hub (employer program; file still in repo, just unlinked)
  - Landing page copy/tone

## 1. Merge + first deploy (site still on odahub.org — SAFE, no domain change yet)

- [ ] **[DEVON]** `git checkout main && git merge amg-hub && git push` → GitHub Pages redeploys odahub.org with the rebrand
- Existing users keep working: class-code login unchanged, all data intact. They just see AMG Hub branding.

## 2. Firebase console (project `oda-hub-d4bef` — stays forever, see REBRAND_NOTES)

- [ ] **[DEVON]** Authentication → Sign-in method → **enable Anonymous** (kid sessions ride this; everything works without it, but the hardened rules can't deploy until it's on)
- [ ] **[DEVON]** Run the classCodes backfill (guardians who never log in again — e.g. former ODA teachers — need it or their kids can't log in after the rules deploy):
  ```
  cd ODA/tools && node migrate-classcodes.mjs
  ```
  (uses tests/serviceAccountKey.json; idempotent; prints any duplicate class codes for manual review)
- [ ] **[DEVON]** Deploy the hardened rules — ONLY after the two steps above AND after step 1 is live:
  ```
  firebase deploy --only firestore:rules
  ```
- [ ] **[DEVON]** (Recommended) App Check → Firestore → set to **Enforced** once you've verified traffic is passing App Check (adds real friction against devtools coin-hacking)

## 3. Domain: amghub.org (Namecheap → GitHub Pages)

- [ ] **[DEVON]** Namecheap DNS for amghub.org:
  - `A` records @ → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
  - `CNAME` www → `devonparks.github.io`
- [ ] **[DEVON]** GitHub repo → Settings → Pages → Custom domain → `amghub.org` (this rewrites the CNAME file; commit it) → wait for DNS check → **Enforce HTTPS**
- [ ] **[DEVON]** Firebase console → Authentication → Settings → **Authorized domains** → add `amghub.org` + `www.amghub.org` (Google sign-in breaks on the new domain without this)
- [ ] **[DEVON]** reCAPTCHA admin (google.com/recaptcha/admin) → the v3 site key `6LcZII0s...` → add `amghub.org` to allowed domains (App Check breaks without this)
- [ ] Cloud Function CORS: `functions/index.js` allowlist needs `https://amghub.org` + `https://www.amghub.org` added, then:
  ```
  cd ODA/functions && firebase deploy --only functions
  ```
  (Claude can prep the code edit; the deploy is yours. Keep odahub.org in the list during transition.)
- [ ] CSP in `js/oda-core.js` already allows the Firebase/functions origins — no change needed for the domain swap.
- [ ] Optional: keep odahub.org registered and let GitHub Pages redirect (a custom domain serves one canonical; simplest is updating the old domain's DNS to the same target — both resolve, GitHub canonicalizes to the Pages custom domain).

## 4. After launch (near-term hygiene)

- [ ] Rename GitHub repo `oda` → `amg-hub` (redirects are automatic; update local remotes)
- [ ] Watch Firebase console → Authentication for anonymous-user growth (normal: one per kid device)
- [ ] `admin.html` stats: swap "Teachers" card wording for "Guardians"
- [ ] Update the `oda-*` Claude Code skills (oda-deploy / oda-game-dev / oda-ui-rules) to AMG naming

## Known limits (documented, deliberate)

- **Economy is still client-trusted.** Anonymous auth + App Check enforcement add friction, not proof.
  True anti-cheat = Cloud Function-mediated coin awards. Post-launch project.
- **Multiplayer trust**: opponents' full game state is client-readable (e.g. Sea Strike boards). Inherent
  to the Firestore-only architecture; fine at current scale.
- **Roster names are public-readable** (the kid name-picker requires it pre-auth). Families are
  small rosters; still, encourage first names or nicknames in the parent UI copy.
- COPPA posture: parent-created accounts, no ads, no open chat, no behavioral tracking beyond
  gameplay stats. Worth a proper legal review before any monetization.

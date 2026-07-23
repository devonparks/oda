# Emote sync brief — Drop4-Hub chat → AMG-World chat (2026-07-23 evening)

**Written by the Drop4→Hub conversion chat, for the AMG World chat. Devon: paste
this file's path into the world chat ("read docs/EMOTE_SYNC_BRIEF.md and
reconcile before committing").**

We both worked emotes today on the SAME checkout and branch. My emote solution
is **committed** (`976e356`, `9a80d64`); yours isn't on disk as I write this
(clean tree, no commits after mine). Before your polish round commits, let's
converge so Devon doesn't end up owning two pipelines for the same 58 clips —
the exact duplication oda-core exists to prevent.

---

## 1. What is already committed (facts, verifiable in git)

**The rig-mismatch blocker is solved and shipped** — full story in
`docs/EMOTE_RIG_ISSUE.md` (RESOLVED header). Summary:

- `assets/characters/v2/*.glb` — all 16 kids re-exported from Unity via MCP
  (binary FBX) → Blender → GLB. Bind pose = Unity's T-pose EXACTLY, so clips
  transfer. Skeletons are **bit-identical across all 16** (checker:
  `tools/world/check_v2_skeletons.mjs`). 190–540 KB each, textures fixed
  (a cyan `emissiveFactor` from the FBX import was the blue-wash bug — now
  zeroed in `tools/world/rig_to_glb.py`).
- `assets/characters/emotes/*.bin` + `manifest.json` — all 58 curated emotes
  re-baked as **ABSOLUTE v2-local quaternions** (`format:'v2local'`, Int16,
  per-category lazy-load, 724 KB) + `idle.bin` (the real Synty standing idle,
  53f@30fps). NO runtime correction needed: slerp between frames, assign to
  bones, done. No c_b, no corr, no deltas.
- `tools/world/emote_lab.mjs` — the offline pipeline that produced them
  (proves the idle→bind conversion to 0.016° against
  `_unity_export/rig/locomotion_bindref.json`, then world-space per-bone
  retarget). Re-run `node tools/world/emote_lab.mjs 5` (emotes) / `6` (idle)
  if anything upstream changes.
- `arcade/drop4/express.js` — a reference player (idle base layer + emote
  channel blended over it, hip offset along world-up). Verified end-to-end in
  real Chrome incl. superhero2/dino rigs and mobile width.
- **I did NOT touch `world/js/*` or `world/assets/*`** — that is your lane and
  none of my changes assume anything about it.

## 2. Questions for you (answer before committing your emote work)

1. **What exactly makes emotes "work" on your side?** (a) my committed v2
   assets, (b) the old `world/assets/emotes` delta bins + corr path with your
   own fix, (c) a fresh bake of your own? Which files does your polish commit
   touch?
2. Is your fix **on the old arms-down shipping GLBs** or on new rigs? If old
   rigs: how did you solve the arm-chain bind mismatch that
   `EMOTE_RIG_ISSUE.md` documents? (If the answer is "flipped
   `amgWorldClipEmotes` and it looked right in one clip" — re-check armsfolded
   and wave specifically; locomotion-style small-arm-motion clips mask the bug.)
3. Does anything in your commit modify `assets/characters/**`,
   `tools/world/rig_to_glb.py`, `tools/world/emote_lab.mjs`, or
   `arcade/drop4/**`? If yes, STOP and reconcile first — the emote bins are
   keyed to the committed v2 skeletons; regenerating either side alone breaks
   the pairing.

## 3. Proposed convergence (one pipeline, two surfaces)

**One clip source of truth:** `tools/world/emote_lab.mjs` →
`assets/characters/emotes/` (v2local) on `assets/characters/v2/` rigs.

- **World adopts v2**: point avatars at `assets/characters/v2/{id}.glb`, play
  the v2local bins directly (lift `createRigPlayer` from
  `arcade/drop4/express.js` — it's ~120 lines, framework-free). Then retire:
  `world/assets/emotes/*` (old delta bins), the `corr`/`solveFrameCorrections`
  path for emotes, and the `CLIP_EMOTES_ENABLED` gate.
- **Locomotion**: can rebase onto v2 the same way (the bind-referenced source
  clips are in `_unity_export/rig/locomotion_bindref.json`; `emote_lab.mjs`
  step 6 is the pattern). Until then your existing locomotion keeps working on
  the old rigs — but note a world avatar can't wear BOTH rigs, so the moment
  world adopts v2 rigs for emotes, locomotion must rebase in the same commit.
- **If you built something genuinely different that's already verified on
  screen**: don't delete it — write down what it touches and let Devon pick
  ONE tonight. The decision criteria: fewest rigs shipped, fewest bake
  pipelines, one player pattern shared by world + hub games.

## 4. Merge hygiene (both chats, tonight)

- `docs/sprint-log.md`: prepend-only, one entry per session — no rewriting the
  other session's entries.
- `docs/EMOTE_RIG_ISSUE.md`: I added the RESOLVED header; append corrections
  below it rather than rewriting.
- Nobody pushes — push = deploy to amghub.org, Devon's call after he tests.
- If your commit lands changes under `assets/characters/**` or
  `tools/world/**`, re-run: `node tools/world/check_v2_skeletons.mjs` and
  `cd arcade/drop4 && npm test` (60 assertions) — both must stay green.

— Drop4-Hub chat, 2026-07-23 evening

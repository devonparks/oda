# Why the Synty emote clips don't transfer (and locomotion does)

## ✅ RESOLVED 2026-07-23 (evening) — solved OFFLINE, no supervised session needed

All 58 emotes now play correctly. Proof: rendered frames (armsfolded folds,
wave waves right-handed, dab dabs) + the live Drop4 Hub Express screen
(`arcade/drop4` → Express). What cracked it:

1. **The idle→bind delta conversion was proven exactly** before use:
   `locomotion.json` (idle-ref) and `_unity_export/rig/locomotion_bindref.json`
   (bind-ref, preserved on disk — NOT lost) hold the same 7 clips in both
   frames, so `Δ_bind = bind⁻¹·idle·Δ_idle` could be checked against ground
   truth: worst error 0.016° (= Int16 noise). The earlier "arithmetic
   conversion → 3/58" failure was a composition-order bug (the wrong order
   shows 151°), not a data problem.
2. **World-space per-bone retarget** instead of the c_b recursion:
   `W_tgt(b,t) = M(W_U(b,t)·BindW_U(b)⁻¹)·BindW_tgt(b)` with M = mirror-X and
   the per-bone constant absorbing Blender's bone-frame roll. Implemented
   offline in `tools/world/emote_lab.mjs` (zero-dep Node; includes a minimal
   GLB parser + FK).
3. **All 16 characters re-exported from Unity via MCP** (binary FBX — the
   ExportModelOptions overload; the 2-arg default writes ASCII which Blender
   rejects) → `tools/world/rig_to_glb.py` → `assets/characters/v2/*.glb`
   (190–540 KB each, bind = Unity's T-pose exactly, skeletons bit-identical
   across all 16). Two traps fixed in that pipeline: a CYAN `emissiveFactor`
   the FBX import carried from Unity's material (washed everything pale blue —
   now zeroed in rig_to_glb.py), and the Superhero prefabs crashing Blender's
   FBX importer (fixed by trimming the prefab to its 6 kept parts in Unity
   BEFORE export).
4. **Production bake**: `emote_lab.mjs 5` → `assets/characters/emotes/*.bin`
   (58 emotes, 724 KB, per-category lazy-load) as ABSOLUTE v2-local quats —
   no runtime correction needed, players just slerp and assign.
   Player + wheel UI: `arcade/drop4/express.js`.

**For the world to adopt**: point avatars at `assets/characters/v2/{id}.glb`
and play `assets/characters/emotes/*.bin` (format `v2local`) directly —
`arcade/drop4/express.js` is the reference player. The old delta+corr path and
`CLIP_EMOTES_ENABLED` gate can then be retired. Locomotion would need the same
one-time rebase onto the v2 rigs (same lab, `locomotion_bindref.json` already
has the bind-referenced clips).

The original diagnosis below is kept for history — its core finding (the
shipping GLBs' arm frames/rest differ from Unity's) was correct; the "needs a
supervised Unity session" conclusion turned out to be avoidable.

---

**Status (historical):** clip emotes are baked and shipped but **gated off**. The world uses
the procedural emotes in `world/js/animator.js`, which are verified and look
right. Locomotion clips are **on** and working.

To test the clip path: `localStorage.amgWorldClipEmotes = '1'` and reload.

---

## FINAL DIAGNOSIS (2026-07-23) — it's the GLB's arm-bone orientations, not the math

Isolated this precisely with a numeric test (bone world positions vs a Unity
ground-truth sample, judged in cm — NOT screenshots, which misled repeatedly).
For "arms folded" frame 20 on the re-exported rig (`rig_to_glb.py`, whose bind
POSITIONS match Unity exactly):

| bone | error vs Unity |
|---|---|
| Head | 0.3 cm |
| Spine_03 | 0.4 cm |
| Hips | 2.2 cm |
| Shoulder_L | 5.0 cm |
| Ankle_L | 4.6 cm |
| **Elbow_L / Elbow_R** | **30 / 25 cm** |
| **Hand_L / Hand_R** | **29 / 20 cm** |

The **body retargets perfectly**; only the **arm chain below the shoulder**
fails. Two mathematically-independent retarget methods — local-frame delta with a
solved per-bone correction, and world-space delta with a single global axis flip
— give the **identical** arm error. When two sound methods fail the same way, the
fault is in the DATA, not the algorithm: the re-exported GLB's **arm bones have a
different orientation at bind than Unity's**, even though the hand POSITIONS
match. Blender cannot represent an arbitrary bone frame — an armature bone's Y
axis must point down the bone, and only roll is free — so the FBX→glTF round trip
rolls the horizontal arm bones. Position is preserved; orientation is not. No
runtime retarget can recover a pose from a rig whose arm frames are wrong.

Why "arms folded" exposed it and locomotion hid it: in armsfolded the spine and
legs barely move from bind, so a wrong formula still looks right there; only the
arms move enough to reveal the error. Locomotion's arm motion is small, so it
reads as slightly-off arm carriage rather than a broken pose — which is why
locomotion shipped and looks fine.

### The actual fix (needs a supervised session)

Get a kid GLB whose arm-bone **orientations** match Unity, then EITHER retarget
method works unchanged. Blender can't do it. The path is a **Unity-native glTF
exporter** (`com.unity.cloud.gltfast` / UnityGLTF) that writes the skinned mesh
straight from Unity, preserving exact bone matrices — no Blender in the loop.
NOT attempted unattended: installing a package already caused one safe-mode
incident this session (the Input System trap), so this waits for a session where
Devon can watch the import.

Everything downstream is ready and will work the moment the rig is right: the
58-emote bake, `world/js/emotes.js`, the tabbed wheel, the safeguarding
allowlist. Only the character GLBs need regenerating.

---

## What works

`world/assets/locomotion.json` — idle, walk, run, sprint, jump, fall, land.
Verified on screen: correct standing pose, correct stride, correct gait blend at
every speed. This is live.

## What doesn't

`world/assets/emotes/*.bin` — 58 curated clips. The bake is correct and the
decoding is correct, but the **poses land wrong**. "Arms folded" plays as arms
straight out and up. Roughly half the library is visibly off.

## The bake is not the problem

Verified end to end at the byte level. For `ArmsFolded` frame 10, `Shoulder_R`:

```
Unity delta   = -0.0229, 0.3994, 0.3560, 0.8445
browser reads = -0.0229, 0.3994, 0.3560, 0.8445
```

Int16 quantisation, byte offsets, frame indexing and interpolation are all fine.

## The actual cause: two different rest poses

Measured hand height above the feet, same character:

| | Hand_R | Hand_L | Head |
|---|---|---|---|
| Unity prefab, bind pose | 0.868 | 0.868 | 1.001 |
| Exported kid GLB, rest  | **0.600** | **0.600** | 1.001 |

The head matches exactly — spine and legs agree between the two rigs. The
**arms do not**: Unity's bind is effectively a T-pose (hands level with the
shoulders at 0.871), while the exported GLB rests with the arms hanging down.

That breaks the transfer in a way the per-bone frame correction can't fix.
The correction is solved from the relation

```
g_b = c_p⁻¹ · u_b · c_b      =>      c_b = u_b⁻¹ · c_p · g_b
```

which assumes the two rest poses are the **same physical pose** in different
bone axes. When the poses genuinely differ, `c_b` silently absorbs the pose
difference too — for `Shoulder_R` it comes out at **103°**, which is the T-pose-
to-arms-down rotation, not an axis convention. Conjugating a delta by that
rotates its axis by 103° and sends the arm somewhere unrelated.

Locomotion survives this because its arm motion is small relative to rest, so
the error reads as a slightly different arm carriage rather than a broken pose.

## What was tried

| approach | result |
|---|---|
| Delta from bind + `c_b` conjugation | 8/58 within 12 cm. Arms fly up. |
| Absolute Unity local rotations, no correction | Breaks locomotion badly — head collapses to 0.56 (should be 1.00), stride 0.09 m (should be 0.25). So the bone **axes** genuinely differ; identity is not the answer either. |
| Re-bake against Unity's **idle** pose instead of its bind (arms-down, hands at 0.521 — only 8 cm from the GLB's 0.600) | 11/58. Barely moved. |

The third result is the interesting one: making the reference poses nearly
identical *didn't* fix it, which says the remaining error is not in the
rotations at all — it's in the arm chain's **bone offsets**. The two rigs put
the elbow and wrist in different places relative to the shoulder, so even a
perfect rotation transfer produces a different hand position.

## Progress: the rig re-export works

`tools/world/rig_to_glb.py` plus Unity's FBX Exporter (already installed,
`com.unity.formats.fbx` 5.1.6) produces a kid GLB whose bind pose matches Unity
**exactly**:

| | Hand_R | Hand_L | Head | Shoulder_R |
|---|---|---|---|---|
| Unity bind | 0.868 | 0.868 | 1.001 | 0.871 |
| re-exported GLB | **0.868** | **0.868** | **1.001** | **0.871** |
| GLB that ships today | 0.600 | 0.600 | 1.001 | — |

387 KB, 42 joints, 4 parts, textures rebound and the atlas downscaled to 512.
So the blocker identified above is solved: a rig whose rest matches the clips
now exists and can be built for all 16 characters.

## What's still unresolved

The Blender FBX→GLB round trip rotates bone LOCAL frames by ~90° (Blender's
bones point along their own +Y), even though world positions match. So the
transfer still needs a per-bone axis correction — but now, with the binds
agreeing, that correction is a genuine axis-only rotation rather than the
polluted 103° it used to be.

**The combination that has NOT been tried yet is the obvious one:** re-bake the
deltas against Unity's **BIND** pose (the original bake did this; it was later
overwritten with an idle-referenced bake) and run those on the **new** rig, with
`c_b` solved bind-to-bind. Every previous test mixed one old element with one
new one:

| bake reference | rig | result |
|---|---|---|
| bind | old (arms down) | 8/58 — arms in the air |
| idle | old | 11/58 |
| idle | new, no correction | 25/58 within 12 cm |
| idle→bind converted arithmetically | new, bind-to-bind correction | 3/58 |
| **bind** | **new** | **untried — do this first** |

Unity's editor process died partway through exporting the 16 characters (4 of
16 landed as binary FBX, in `_unity_export/rig/`), so the bind re-bake needs
Unity restarted.

A caution learned the hard way: the hand-height metric in
`world/assets/emotes/_truth.json` is only good for RELATIVE comparison. The old
rig differed from Unity by 8 cm at rest in the arm chain, which is baked into
every number. Judge the result on screen, not on the metric — several times the
metric and the screenshot disagreed, and the screenshot was right.

## The fix

**Re-export the kid characters from Unity so their rest pose matches the rig the
clips were authored against.** That is a change to the character export
pipeline (whatever produced `assets/characters/*.glb`), not something to guess
at from the runtime side. Once the exported rest matches Unity's, deltas
transfer exactly and `c_b` collapses to a real axis-only correction.

Everything else is already in place and will work unchanged:

- `tools/world/emote_allowlist.json` — the curated 58, with the safeguarding
  exclusions documented (the whole Taunt category, throat-slit, finger guns…)
- the Unity bake — deltas, Int16 binary, one file per category
- `world/js/emotes.js` — lazy per-category loading, upper-body override while
  walking, hold-vs-one-shot handling
- `world/js/main.js` — the tabbed wheel with favourites and digit shortcuts

Flip `CLIP_EMOTES_ENABLED` and it all lights up.

## A note on the metric

`world/assets/emotes/_truth.json` holds Unity's peak/mean hand heights per
emote, and there's a comparison harness in the session history. Be careful with
it: the two rigs differ by ~8 cm at rest in the arm chain, so a raw hand-height
delta has that baked in. It is useful for **relative** comparison between
approaches, not as an absolute pass/fail.

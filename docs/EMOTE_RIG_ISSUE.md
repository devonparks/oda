# Why the Synty emote clips don't transfer (and locomotion does)

**Status:** clip emotes are baked and shipped but **gated off**. The world uses
the procedural emotes in `world/js/animator.js`, which are verified and look
right. Locomotion clips are **on** and working.

To test the clip path: `localStorage.amgWorldClipEmotes = '1'` and reload.

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

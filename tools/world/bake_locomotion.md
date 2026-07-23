# Baking Synty locomotion onto the kid rig

> **⚠️ Import gotcha (cost a safe-mode incident 2026-07-23).** The Base
> Locomotion `.unitypackage` includes `Samples/Scripts/` — a demo character
> controller that depends on Unity's **new Input System** package. Unlike the
> Sidekick sample scripts (which guard every reference with
> `#if ENABLE_INPUT_SYSTEM`), these have **no guard**, so if the Input System
> package isn't installed they fail to compile and drop the whole project into
> safe mode. The MCP bridge is itself a script, so it goes dark too.
>
> **Fix:** delete `Assets/Synty/AnimationBaseLocomotion/Samples/Scripts/` (and
> its `.meta`). The clips you bake from are all under `Animations/`, never
> `Samples/`, so nothing you need is lost. Do this right after importing the
> pack, before touching anything else. (Installing `com.unity.inputsystem`
> instead would also work, but it flips the project's input backend and forces
> an editor restart — not worth it for a demo you don't use.)


How `world/assets/locomotion.json` is produced. Re-run this only when changing
which clips ship, or if the kid character GLBs are ever re-exported.

**Devon already owns the source pack** — `ANIMATION_Base_Locomotion` (in
`Downloads/` and on the Desktop). It is not on the Unity Asset Store licence for
redistribution, so the raw FBX stays out of git; only the baked JSON ships.

---

## Why a custom bake instead of glTF animations

The clips live in ~700 separate FBX files, each with its own skeleton. Shipping
them as glTF would mean merging rigs in Blender first. Meanwhile Unity already
solves the hard part: the clips are **Mecanim humanoid** and the PolygonKids rig
has a valid humanoid avatar (`Characters_KidsAvatar`, `isHuman = true`), so
`clip.SampleAnimation(kid, t)` retargets an adult animation onto a 1.2 m child
for free.

So: sample in Unity, write plain arrays, rebuild in the browser.

What ships: **22 bones** (all 24 finger joints dropped — invisible at hub-world
camera distance and more than half the bytes), rotations only, plus one vertical
hip offset per frame. ~127 KB of JSON, roughly a third of that over gzip.

---

## The trap: two rigs, two sets of bone axes

**Do not bake absolute local rotations.** The kid GLBs in `assets/characters/`
went through an export that re-expressed the skeleton — their bone units are
centimetres with "up" running along local **Z**, while Unity's prefab is metres
with up along **+Y**. Applying Unity's local quaternions directly lays the
character flat on its side.

The bake therefore stores **deltas from the bind pose**:

```
D = restLocal⁻¹ · posedLocal
```

A delta is relative to the bone's own rest frame, so a constant difference in
rest orientation cancels. The runtime composes it back on: `pose = g_b · D`.

That is still not quite enough, because the two rigs also assign different
**local axes** to the same physical bone — with only the delta applied, the
character stands at the right height but the arms splay out sideways. Writing
`c_b` for the constant rotation between the two frames, the bind poses relate as

```
g_b = c_p⁻¹ · u_b · c_b        =>        c_b = u_b⁻¹ · c_p · g_b
```

so `c_b` is solvable by walking the hierarchy top-down, given Unity's bind pose
`u_b`. That is why the bake also ships a `bindPose` block. The runtime
(`solveFrameCorrections` in `world/js/clips.js`) solves it at load and applies

```
pose = g_b · (c_b⁻¹ · D · c_b)
```

`c` at the root's parent is taken as identity: any leftover constant there would
be a whole-character rotation, which would be obvious on screen.

The hip translation is a **scalar** vertical offset in metres for the same
reason — its axis differs too, so the runtime applies it along the parent-space
"world up" vector `RigAnimator` already computes, scaled ×100 into the rig's
centimetres.

---

## Re-running it

Both steps are Unity MCP `execute_code` calls against the AMG Engine project.
The full scripts are in this repo's git history — see the commit that added
`world/js/clips.js`, whose message names them.

1. **Sample the clips.** Instantiate `SM_Chr_Kid_Hoodie_01`, capture the bind
   pose, then for each wanted clip sample at 30 fps and write
   `D = rest⁻¹ · pose` per bone plus `hipsY - restHipsY`.
2. **Append the bind pose.** Write each bone's Unity local rest quaternion and
   its parent name into a `bindPose` block, so the runtime can solve `c_b`.

The clips currently shipped (masculine set, non-RootMotion — the controller
drives position in code, so root motion would double up):

| world name | Synty clip | loops |
|---|---|---|
| idle | `A_Idle_Standing_Masc` | yes |
| walk | `A_Walk_F_Masc` | yes |
| run | `A_Run_F_Masc` | yes |
| sprint | `A_Sprint_F_Masc` | yes |
| jump | `A_Jump_Idle_Masc` | no |
| fall | `A_InAir_FallShort_Masc` | yes |
| land | `A_Land_IdleSoft_Masc` | no |

There are 346 POLYGON-rig clips in the pack; almost all of them are strafes,
which this world will never need — the avatar always turns to face its travel
direction.

---

## Speed tuning

Measured by sampling one cycle of ankle travel on an actual kid: the walk clip
reads as **~0.74 m/s** and the sprint as **~1.9 m/s**. These were authored for
adults, so retargeted onto a 1.2 m child the stride is short.

That is why the world's movement speeds came down from 2.4 / 4.6 m/s to
**1.6 / 3.4** — the originals were an adult jogging pace and made the legs
whirl. `CLIP_SPEED` and `RATE_MIN/MAX` in `clips.js` are the tuning knobs; the
playback rate is `speed / CLIP_SPEED[gait]`, clamped.

**Tune these by eye on a real device, not by arithmetic.** Feet sliding forwards
means the number is too high; scuffing backwards means too low.

---

## Emotes

The two packs already imported — `AnimationEmotesAndTaunts` (280 clips) and
`AnimationIdles` (660) — use the same POLYGON rig and would bake through this
exact pipeline. They are **not** baked yet: the world's 8 emotes are still
procedural (`EMOTES` in `world/js/animator.js`). That is the obvious next
upgrade, and it costs nothing but bytes.

# AMG World Engine — M4 brief: the prop database

Handoff for the next session. M1–M3 are built, verified and deployed; this is
the milestone Devon actually cares about, plus the two things left red.

---

## Where things are

Repo `Desktop\ODA`, branch `drop4-hub-conversion`. Pushing to `main`
auto-deploys to amghub.org. The three.js park stays live and untouched at
`world/` — the new engine is `engine/`, and both read the same asset files.

```
/engine/          the engine (student bundle, ~1.2 MB gz)
/engine/?dev      same + the Babylon Inspector on the ~ key
```

Built and verified:

| | |
|---|---|
| **M1** | Babylon 9.18 + Havok 1.3.13, 275 prototypes / 1103 thin instances / 275 draw calls / 60 fps, Inspector |
| **M2** | Synty kid on `PhysicsCharacterController`, 22-bone v2local rig, 7 locomotion + 81 action clips, 105 mesh colliders on 761 static instances |
| **M3** | object layer — native `thinInstanceIndex` picking, delete, undo, persist, export |

Read first: `engine/README.md`, then `docs/sprint-log.md` (top two entries),
then `docs/AMG_WORLD_ENGINE_BRIEF.md` for the original why-Babylon handoff.

---

## The job

### 1. The prop database — the main event

Devon's recurring complaint, in his words: **"the character isn't sitting on
the seat."** Riders do not fit props. He wants:

- **A unique animation for every single prop. No shared clips.**
- **Authored mount data per prop, in the prop's own local space** — seat
  position, hand and foot IK targets, motion type.
- Eventually **every item from the Synty POLYGON packs in one library the
  engine can browse, with thumbnails.**

Schema he specified:

```jsonc
{
  "SM_Prop_Coin_Ride_Dragon": {
    "kind": "coinride",
    "seat":   { "pos": [0, 0.62, -0.05], "yaw": 0 },
    "clip":   "sit_dragon",
    "hands":  [[-0.12, 0.78, 0.30], [0.12, 0.78, 0.30]],
    "feet":   [[-0.18, 0.20, 0.10], [0.18, 0.20, 0.10]],
    "motion": { "type": "rock", "axis": "x", "amp": 0.30, "hz": 0.5 }
  }
}
```

Build it as: a JSON database + a seeding tool that measures candidate seat
surfaces off the real geometry (so the file starts from truth, not from
guesses) + a mount runtime that places the rider, plays the prop's own clip,
and pins hands/feet with `BoneIKController` + a gallery probe as acceptance.

**On "no shared clips" — be honest about the gap.** Today there are 23 baked
action clips, not one per prop. Two ways to close it, and they compose:

- `tools/world/unity/AMGActionBaker.cs` bakes new clips from Unity, and the
  export recipe is cracked — all 816 owned Synty clips are reachable. This is
  the real answer for genuinely distinct motions.
- IK on top of a base pose makes each prop's *fit* unique at runtime even
  where the underlying motion is shared. The original brief already concedes
  "IK makes it solvable at runtime instead of authored per pose, but something
  still has to say, per prop, where the seat is and which clip plays."

Do not quietly ship shared clips and call it done. Where a prop is using a
near-neighbour clip until a bespoke one is baked, put that in the data
(`"clip": "sit", "clipStatus": "placeholder"`) so the gap is a number, not a
vibe.

Contract constants already ported in `engine/js/clips.js` — use them, do not
re-derive:

```
BIND_PELVIS_Y      0.5437    rig bind pelvis above model origin
SEATED_HIP_OFFSET -0.261     baked into every seated clip by contract
SEATED_PELVIS_Y    0.2827    upright only — a TILTED rider rotates the two parts differently
BUTT_BELOW_PELVIS  0.105     pelvis joint to bottom of butt; 0.06 clipped the swing plank
```

Clip frame rates differ: **locomotion is 30 fps, the action/emote bins are
20.** Reading one with the other's fps plays it at 1.5×.

### 2. Stairs — the probe is currently RED

`node tools/engine/probe_character.mjs` fails on
`the kid CLIMBS the playground stairs`. Aimed at
`SM_Prop_Playground_Stairs_01` (3.5, 0, 0.75) the kid crosses from z = 3.5 to
z = −3.0 at y ≈ 0 and gains 0.06 m.

Known: the prototype IS on the terrain layer, DOES have a `PhysicsBody`, and
that body has all 7 instances — so it is **not** a missing collider. The kid
drifts x 3.51 → 3.98 while crossing, so a staircase ~1 m wide centred on
x = 3.5 could simply be missed at the edge; the approach vector is the first
suspect, not the physics. `maxStepHeight` is 0.45 m (treads ~22 cm, kerbs 12,
and a 45 cm bench seat is the next rung up and *should* stop you).

Open `/engine/?dev`, press `~`, and look at the collider against the mesh.
That is exactly the tool this whole engine move was for — use it before
writing code.

### 3. Ground seams

7 of 48 grid points slip through joins in the tiled ground onto the catch
floor at y = −2.6 (`seams at: [[-14,12],[-8,12],[10,24],[16,24],[22,12],[22,24],[28,-6]]`).
The catch floor is a band-aid and is labelled as one in the code. The real fix
is probably giving the ground tiles thickness in the collider rather than
using zero-thickness planes. The probe prints the seam count every run so it
cannot quietly become a fix — keep it that way.

### 4. Also open (lower priority)

- **No backdrop.** The live park has code-drawn hills and tree belts beyond
  the fence; without them this is "a plane floating in the middle of nowhere".
- Shadows are wired (kid casts, park receives) but barely visible — check the
  directional light's shadow frustum.

---

## Non-negotiable process

**Visually verify everything.** Drive real Chrome with puppeteer, walk up to
the thing, use it, screenshot it, and *look at the screenshot*. Numbers said
"on the chain" while the picture showed a hand holding air — the picture was
right.

```bash
python -m http.server 3457      # then:
node tools/engine/probe_boot.mjs        # 13 invariants + 6 shots
node tools/engine/probe_character.mjs   # rig, walking, stairs (RED), coverage grid
node tools/engine/probe_objects.mjs     # pick / delete / undo / persist
```

`tools/engine/probe_lib.mjs` is the harness — `boot()`, `shoot()`, `peek()`.
Shots land in `tools/engine/_shots/` (gitignored). The in-app browser pane
freezes `requestAnimationFrame`, so it must be real Chrome (`channel: 'chrome'`).

**A failing probe is not automatically a failing engine.** Last session four
bugs were real and *three assertions were wrong while the code was right* —
asserting −Z when the camera geometry makes it +Z, asserting "height must not
change" while the kid legitimately walked down into the skate bowl, and twice
reporting mid-air kids as holes because the settle time was shorter than the
fall. Check the assertion before you "fix" the engine.

---

## Traps already paid for — do not re-learn these

- **The scene is RIGHT-handed** (`scene.useRightHandedSystem = true`). The
  Unity exporter already writes glTF convention, so this keeps `__root__` at
  identity and every measured number from the three.js park applies verbatim.
  Flip it and the whole park silently mirrors.
- **Prototype node transforms are BAKED into the geometry.** Blender's
  Z-up→Y-up conversion rides on the exported *nodes*. Resetting them to
  identity — the obvious move for thin instancing — lays the park on its side
  (fountain measured 2.91×2.91×1.21 vs the truth 2.91×1.21×2.91).
- **Park geometry is vertex-coloured and converted linear→sRGB at load.** The
  kid GLBs are the opposite: they are TEXTURED and their COLOR_0 must be
  ignored (`useVertexColors = false`) or the kid renders solid black.
- **Havok's `integrate()` does not accelerate the character.** Gravity is
  `gravity * dt` applied in user code every airborne frame.
  `calculateMovement`'s `forwardWorld` must never be zero-length — it silently
  returns false on a degenerate cross product.
- **Name patterns over-match.** `/Grass/` matched `SM_Env_Ground_Tile_Grass`,
  the actual floor, and the kid sank. `^SM_Env_Tree` once caught
  `SM_Env_Tree_Large_01_Treehouse` and scattered cabins on the skyline.
  Check ground/structural names FIRST and let them win.
- **Never go back to a merged static shell.** The per-object export is what
  makes the object layer and the prop database possible. That decision cost
  weeks.
- **Typed arrays do not cross the puppeteer boundary as arrays.**
  `Matrix.asArray()` is a `Float32Array`; wrap in `Array.from` in `peek()`.

---

## Working agreement

Work autonomously in priority order. Commit per milestone with a real message.
Keep `docs/sprint-log.md` updated — including what went wrong, not just what
shipped. Deploy each increment once it is verified (`git push origin
drop4-hub-conversion:main`). Do not rebuild what already works; import,
configure, ship.

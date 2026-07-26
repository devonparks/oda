# AMG World Engine — brief for the Babylon build

Written 2026-07-26, at the end of the three.js park. This is the handoff: what
exists, what hurt, what to reuse, and what to build. The three.js park stays
LIVE at amghub.org/world while the engine is built — do not break it.

---

## 1. The decision

Move AMG World from raw three.js to **Babylon.js + Havok**. Devon's call, and
the reasoning is specific rather than fashionable:

| What hurt in three.js | What Babylon gives |
|---|---|
| Hand-written AABB collision, GPU heightfield, capsule resolve, every ride's motion (~1500 lines) | **Havok physics via WASM**, official: rigid bodies, joints, character controller |
| No IK, no animation state machine, no retargeting — all hand-rolled (rig_v2.js, a Unity C# baker, two-bone IK in C#) | Animation groups with weighted blending, **`BoneIKController`**, `BoneLookController` |
| Merging kills object identity; per-object hiding needed a vertex-range hack | **Thin instances** — per-instance transform AND one draw call |
| No inspector; every check was a puppeteer probe | Built-in **Inspector** with a live scene explorer |

PlayCanvas was considered and rejected: it is editor-centric (hosted visual
editor), which fights a workflow where Claude Code writes everything and git is
the source of truth. Babylon is all code, TypeScript-first.

**Babylon will NOT fix the hardest problem** — "the character isn't sitting on
the seat." IK makes it *solvable* at runtime instead of authored per pose, but
something still has to say, per prop, where the seat is and which clip plays.
That is §4, and it is the highest-value thing in this document.

---

## 2. What already exists and should be REUSED

### The asset pipeline (engine-agnostic — keep it)
`tools/world/unity/AMGParkExporter.cs` (Unity menu **AMG > Export Park Scene**)
exports any Synty scene as:
- `<prefix>_protos.obj` — one group per unique mesh, LOCAL space, atlas baked
  to vertex colours (no textures ship at all)
- `<prefix>_layout.json` — `{protos:[names], items:[{m,n,g,p,q,s}]}`, one row
  per object
- `<prefix>_collision.json` — one world AABB per object

`tools/world/protos_to_glb.py` converts with Blender (Draco level 6). The park
is **275 prototypes / 1103 placements / 1.3 MB**. Feeds Babylon unchanged.

> The single most expensive mistake in this project was the ORIGINAL export,
> which merged 741 objects into one baked mesh. Everything that needed to move
> then had to be carved out of it, which kept dragging scenery along. Devon
> diagnosed it: *"this is an export problem — if I open the demo scene in Unity
> I can select each item."* **Never ship a merged shell.**

### Logic worth porting (framework-free or nearly so)
- `world/js/editor.js` — the object registry (prefab, transform, AABB, picking)
- `world/js/inventory.js` — pure, no THREE, no DOM
- `world/js/collision.js` — the rules table and the refine-by-name reasoning
- `world/js/tag.js`, `fishing.js`, `achievements.js`, `stars.js`, `chat.js`,
  `presence.js` (Firebase RTDB, anon-auth keyed)
- The **water mask** and **ground heightfield** bakes (world.js) — the *ideas*
  transfer even if Havok replaces the collision they feed
- The measured seat/saddle rules in `rides.js` (§4)

### Content that transfers
- **23 baked action clips** (`assets/characters/emotes/actions.bin`) authored by
  `tools/world/unity/AMGActionBaker.cs` on the real Polygon Kid rig. glTF
  skinning is standard, so a Babylon-side player is the RigV2 equivalent.
- 16 rigged kid GLBs, 58 emotes, the locomotion bake.
- The park itself, and a second scene (`Overview.unity`) already exportable.

---

## 3. Hard-won facts — do not rediscover these

**Measure, don't eyeball — then LOOK.** Every alignment bug was found by
printing numbers, and every *remaining* one was found by looking at a
screenshot after the numbers said fine. Devon, three times: *"you're not
visually auditing the changes."* `tools/world/probe_ride_gallery.mjs` mounts
every ride and shoots a close-up; that loop is the standard of done.

| Trap | What happens |
|---|---|
| Blender truncates node names at **63 chars** | A 65-char prototype key silently lost the zip line's handle |
| Blender's OBJ importer splits on `o`, not `g` | Needs `use_split_groups=True` or all 275 prototypes arrive as one object |
| `setFromObject` inside a build loop | Reads a stale `matrixWorld`; measure in a SECOND pass |
| Facing ≠ `group.rotation.y` | It is 0 on every attraction; derive from the long axis toward the taller end, or a named steering part |
| Bbox top ≠ the seat | It is a dragon's horns, a car's steering wheel, a scooter's handlebars |
| A saddle is the **dip** in the top surface | On the prop's spine, above the base plate — not the highest or the lowest point |
| Seat sink is per-prop | 6.5 cm reads as sitting on a park bench, and pushes a kid through a thin picnic plank (1.5 cm there) |
| `camYaw` is the camera BOOM direction | Synthetic W walks OPPOSITE to it — two "failures" were the kid walking away |
| Synthetic key events need `document.body` | `window` has no `.matches`, so the handler throws first |
| The in-app browser pane freezes rAF | Every check runs through real Chrome + puppeteer (`channel: 'chrome'`) |
| Synty misspells the swing set | `SM_Prop_Plaground_Swings_01` — one `y` missing |

---

## 4. The thing that actually needs building: the PROP DATABASE

This is the fix for "the animations are still messed up", and it is
engine-independent. Every interactive prop needs authored properties, not
inference:

```jsonc
{
  "SM_Prop_Coin_Ride_Dragon": {
    "kind": "coinride",
    "seat":   { "pos": [0, 0.62, -0.05], "yaw": 0 },   // local to the prop
    "clip":   "sit_dragon",                             // its OWN clip
    "hands":  [[-0.12, 0.78, 0.30], [0.12, 0.78, 0.30]],// IK targets, local
    "feet":   [[-0.18, 0.20, 0.10], [0.18, 0.20, 0.10]],
    "motion": { "type": "rock", "axis": "x", "amp": 0.30, "hz": 0.5 }
  }
}
```

Then the runtime is dumb and correct: place the rider at `seat`, play `clip`,
IK the hands and feet to their targets **in the prop's own space**, and let
Havok drive `motion`. No measuring at load, no guessing, no shared clips —
which is exactly Devon's ask: *"we need a brand new animation for each prop,
we can't use any shared animations."*

Devon also wants this to scale to **every item in the Synty POLYGON packs** as
one library the engine can browse. `AMGParkExporter` already walks a scene; the
same walk over `Assets/*/Prefabs` gives a prototype library plus a thumbnail
per prefab. That is the AMG asset database.

---

## 5. Suggested build order

1. **Boot** — Babylon + Havok, load `park_protos.glb` + `park_layout.json`,
   thin-instance every placement. Inspector on. Target: the park renders and
   you can fly around it.
2. **Character** — Synty kid GLB, Havok character controller, the existing
   locomotion clips.
3. **Object layer** — port `editor.js` onto thin instances (per-instance
   visibility is native there); click-select, delete, save overrides.
4. **Prop database** — author §4 for the ~20 interactive props, with the
   gallery-screenshot loop as acceptance.
5. **Systems** — port fishing, tag, inventory, coins, presence.
6. **Parity check** against the live park, then switch amghub.org over.

---

## 6. Where things are

- Repo `Desktop\ODA`, branch `drop4-hub-conversion`. **Push = deploy**:
  `git push origin drop4-hub-conversion && git push origin drop4-hub-conversion:main`
  (main auto-deploys to amghub.org).
- The park: `world/` — `index.html`, `js/*.js`, `assets/park_protos.glb`,
  `assets/park_layout.json`, `assets/park_collision.json` (**curated** — 244
  walk-over-filtered boxes; do NOT overwrite with the exporter's 1103-box dump).
- Pipeline docs: `tools/world/README.md`. Probes: `tools/world/probe_*.mjs`.
- History: `docs/sprint-log.md` (newest first). Removed features and how to
  restore them: `docs/REMOVED_FOR_LATER.md`.
- Unity: `Desktop\Unity Games\AMG Engine`, MCP on 6400. Editor scripts live in
  `Assets/Editor/` and are **committed copies** of `tools/world/unity/*.cs` —
  edit the repo copy, copy across, refresh, run the menu item.

## 7. State of the park at handoff

Working: 32 interactable spots — swings (real Synty seats), 4 slides
(ride down, walk up), seesaw (two riders + an NPC playmate), 2 roundabouts
(incl. the tyre carousel), 3 coin rides, 3 spring riders, monkey bars, zip
line (both directions), 20 bench + 20 picnic seats, tyre-wall crawl,
climbing, fishing, freeze tag, hidden stars, coins, crouch, first/third
person, emotes, phrase chat, NPC crowd, presence.

Removed on purpose (`docs/REMOVED_FOR_LATER.md`): the rideable vehicle fleet
and the hula hoops. The props still stand in the park as scenery.

Known imperfect: rider poses on small props still read as approximate — the
reason §4 exists.

# AMG World — asset pipeline

How `world/assets/*` is produced from the Synty **POLYGON Kids** pack. You only
need this when changing the park itself; day-to-day work on the world is just
editing `world/js/*`.

The pack is licensed source and stays out of git (`.gitignore` excludes
`_polygon_kids_src/`). The generated GLBs are committed, so a fresh clone runs
the world without Unity or Blender installed.

---

## Why this shape

The Synty demo scene is **1117 renderers** sharing one 2048² texture atlas, but
they are only **275 unique meshes** — every renderer is a prefab instance.
Shipping the scene as-is to a school Chromebook fails twice over: ~1100 draw
calls, and a 2 MB texture download before anything appears.

Three decisions fix that:

1. **Bake the atlas into vertex colours.** Synty art is flat colour swatches and
   every face's UVs sit inside a single swatch, so sampling the atlas once per
   vertex reproduces the look almost exactly. The park ships with **no textures
   at all** — 1.3 MB total, and no texture memory on the GPU.
2. **Ship PROTOTYPES + PLACEMENTS**, not baked geometry: 275 meshes and 1103
   transforms. Deduplication alone pays for itself (133 grass tiles become one
   mesh and 133 transforms).
3. **Merge at runtime, not at export.** world.js joins everything that doesn't
   move into two meshes — `terrain` and `clutter` — so the draw-call budget is
   unchanged.

> **Do not go back to a merged static shell.** The original export merged 741
> renderers into one `park_static.glb`, and that single decision cost weeks: the
> purple Jeep, the pond floaties, the swing seats, the picnic tables and the
> tyre carousel's crown were all welded into the scenery, so making any of them
> move meant carving triangles back out of a merged mesh — which kept dragging
> neighbours along (a rock, then a plant). Devon diagnosed it exactly: *"this is
> an export problem — if I open the demo scene in Unity I can select each item."*
> With per-object placements, a prop becomes interactive by NAME and nothing is
> ever carved.

Unity does the baking because it already has the material→texture bindings
resolved; Blender only converts and Draco-compresses.

---

## Step 1 — Unity (the AMG Engine project, MCP on port 6400)

`tools/world/unity/AMGParkExporter.cs` is committed here; copy it to
`<AMG Engine>/Assets/Editor/` (same convention as `AMGActionBaker.cs`) and run:

- menu **AMG > Export Park Scene** — exports `Assets/PolygonKids/Scenes/Demo.unity`
- menu **AMG > Export Park Scene (Overview)** — the second scene, for a future map

Each writes into `_polygon_kids_src/obj/`:

| file | what |
|---|---|
| `park_protos.obj` | one OBJ **group** per unique mesh, LOCAL space, vertex-coloured |
| `park_layout.json` | `{protos:[names], items:[{m,n,g,p,q,s}]}` — one row per renderer |
| `park_collision.json` | one world-space AABB per renderer |

The exporter opens the scene with `EditorSceneManager.OpenPreviewScene`, so
whatever you had open is left alone. Textures must be CPU-readable
(`isReadable = true` on everything under `Assets/PolygonKids/Textures`) or
`GetPixelBilinear()` throws — they already are in this project.

**The collision file is NOT copied to `world/assets/`.** The committed
`world/assets/park_collision.json` is a curated, walk-over-filtered subset
(244 boxes) that the whole collision system is tuned against; the exporter's
1103-box version is for reference. Only re-derive it deliberately.

### Adding a new map
Export with a new prefix, drop `<prefix>_protos.glb` + `<prefix>_layout.json`
into `world/assets/`, and point the loader at them. Nothing else in the runtime
is map-specific.

### Coordinate conversion

Unity is Y-up **left**-handed; glTF is Y-up **right**-handed. The exporter
converts by **negating X**. That flips triangle winding, so it also emits each
triangle as `a, c, b` instead of `a, b, c`. Rotations are converted by negating
the quaternion's Y and Z.

Do the conversion in the exporter, once, and let everything downstream stay in
glTF space. Trying to fix handedness later — in Blender, or at runtime — is how
you end up with a mirrored park.

---

## Step 2 — Blender (headless)

```bash
"/c/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b --factory-startup --python tools/world/protos_to_glb.py -- "$(pwd)" park
```

Writes `world/assets/park_protos.glb` (+ `_park_proto_names.txt`).

**The other trap:** the exporter writes one OBJ `g <name>` per prototype, and
Blender's importer only splits on `o` — so `use_split_groups=True` is required
or the whole file arrives as ONE object and every prototype name is lost.

**The one trap:** import the OBJ with Blender's *default* axes
(`forward=-Z, up=Y`). The OBJ is already in glTF space, so declaring `up=Z`
tells Blender it's Z-up, and `export_yup` then rotates it a second time — the
whole park lands on its side with Y and Z swapped. It looks like the ground
vanished and the props float in the sky.

Draco is on (level 6). It takes the 193k unique verts from ~11.7 MB raw to
1.3 MB — smaller than the old merged shell + props split (1.76 MB), because
deduplicating 1103 placements down to 275 meshes is a bigger win than merging.

> Draco decodes in a **blob: Web Worker**. The site CSP must allow
> `worker-src 'self' blob:` — see `js/oda-core.js`. Without it the loader does
> not error, it **hangs forever** on a blank loading bar.

---

## Step 3 — copy the layout

```bash
cp _polygon_kids_src/obj/park_layout.json world/assets/park_layout.json
```

(Not the collision file — see the note in step 1.)

---

## Adding or moving things in the park

- **New zone / portal** → `world/js/zones.js`. Positions came from clustering the
  demo scene's props, so they land where the name says. Portals open a *category*
  of hub games, not one specific game, so the catalogue can grow without edits.
- **New prop that should animate / be ridden / be interactive** → add a name
  pattern to `ANIMATED`, `ATTRACTION_FAMILIES`, `VEHICLE_FAMILIES` or `DYNAMIC`
  in `world/js/world.js`. `_buildLayerMesh` diverts it out of the merge by name
  — no re-export and no geometry surgery.
- **Terrain vs clutter** → the `CLUTTER` regex in `world/js/world.js` decides
  which merged layer a placement lands in. Terrain feeds the ground
  heightfield, the water mask and every derived collision structure; clutter is
  drawn and casts shadows but is invisible to the ground bake.
- **Walk-over vs solid** → `COLLISION_RULES` in `world/js/collision.js` refines
  every raw export box by what the prop actually is ('solid' / 'trunk' /
  'none'). Boxes shorter than `STEP_HEIGHT` (0.55 m) are stepped onto rather
  than blocked.

## Character rig notes

The 16 kid GLBs in `assets/characters/` are rigged (42-joint Synty POLYGON rig)
but carry **no animation clips**, and the POLYGON locomotion pack isn't licensed
into this repo. `world/js/animator.js` generates poses procedurally instead.

Two facts about the rig that are easy to get wrong:

- Bone-local units are **centimetres**, but the model's root node carries a 0.01
  scale, so the avatar resolves to ~1.2 m and needs no extra scaling. Pose
  offsets in `animator.js` are therefore in centimetres.
- Bone rest orientations are **not** world-aligned — the Hips bone's local
  translation runs down its own Z. So poses are written as world-intent
  rotations (`_rot(bone, 'x'|'y'|'z', angle)`) and converted per bone using axes
  cached at bind time. Never assume "local X" means "swing forward".

Arm rest angles (`ARM_DOWN_Z` etc.) were solved numerically against the loaded
rig — pose the shoulder across a grid, measure the resulting world-space hand
position, keep the closest to a target. If you re-rig the characters, redo that
rather than eyeballing radians.

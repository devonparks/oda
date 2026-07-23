# AMG World — asset pipeline

How `world/assets/*` is produced from the Synty **POLYGON Kids** pack. You only
need this when changing the park itself; day-to-day work on the world is just
editing `world/js/*`.

The pack is licensed source and stays out of git (`.gitignore` excludes
`_polygon_kids_src/`). The generated GLBs are committed, so a fresh clone runs
the world without Unity or Blender installed.

---

## Why this shape

The Synty demo scene is **1117 renderers** sharing one 2048² texture atlas.
Shipping that as-is to a school Chromebook fails twice over: ~1100 draw calls,
and a 2 MB texture download before anything appears.

Two decisions fix both:

1. **Bake the atlas into vertex colours.** Synty art is flat colour swatches and
   every face's UVs sit inside a single swatch, so sampling the atlas once per
   vertex reproduces the look almost exactly. The park then ships with **no
   textures at all** — 1.34 MB total, and no texture memory on the GPU.
2. **Merge the static shell.** Scenery never moves, so it is joined into one
   mesh: one draw call for the entire park. Only props that actually animate
   (swings, seesaws, rockers, coin rides) stay separate.

Unity does the baking because it already has the material→texture bindings
resolved; Blender only converts and Draco-compresses.

---

## Step 1 — Unity (the AMG Engine project, MCP on port 6400)

Open the project that contains `Assets/PolygonKids`, then run these via the
Unity MCP `execute_code` tool. Each writes into `_polygon_kids_src/`.

1. **Make the atlases CPU-readable** — `GetPixels()` fails otherwise.
   Set `isReadable = true` on every texture under `Assets/PolygonKids/Textures`.
2. **Export the park.** Open `Assets/PolygonKids/Scenes/Demo.unity` with
   `EditorSceneManager.OpenPreviewScene` (a preview scene leaves whatever you
   were working on alone), then for every renderer:
   - sample the material's `mainTexture` at each vertex UV → vertex colour
   - split into *static* (baked to world space) and *interactive* (kept in local
     space, one prototype per mesh, with a separate placement list)
   - record each renderer's world-space AABB for collision
   - write `obj/park_static.obj`, `obj/park_props.obj`, `obj/props_layout.json`,
     `obj/collision.json`

The exact script used is in this repo's git history for the commit that added
`world/` — search the commit body for "park_static.obj".

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
blender -b --factory-startup --python tools/world/obj_to_glb.py -- "$(pwd)"
```

Writes `world/assets/park_static.glb` and `world/assets/park_props.glb`.

**The one trap:** import the OBJ with Blender's *default* axes
(`forward=-Z, up=Y`). The OBJ is already in glTF space, so declaring `up=Z`
tells Blender it's Z-up, and `export_yup` then rotates it a second time — the
whole park lands on its side with Y and Z swapped. It looks like the ground
vanished and the props float in the sky.

Draco is on (level 6). It takes 306k low-poly verts from ~11 MB raw to 1.34 MB.

> Draco decodes in a **blob: Web Worker**. The site CSP must allow
> `worker-src 'self' blob:` — see `js/oda-core.js`. Without it the loader does
> not error, it **hangs forever** on a blank loading bar.

---

## Step 3 — copy the JSON

```bash
cp _polygon_kids_src/obj/collision.json    world/assets/park_collision.json
cp _polygon_kids_src/obj/props_layout.json world/assets/park_props_layout.json
```

---

## Adding or moving things in the park

- **New zone / portal** → `world/js/zones.js`. Positions came from clustering the
  demo scene's props, so they land where the name says. Portals open a *category*
  of hub games, not one specific game, so the catalogue can grow without edits.
- **New prop that should animate** → add a name fragment to `ANIMATED` in
  `world/js/world.js`, then re-run step 2. Anything not matched gets merged into
  the static batch.
- **Walk-over vs solid** → the `WALKOVER` list in the Unity exporter decides what
  gets a collision box at all. Ground tiles, paths and flowers are walk-over;
  everything else blocks. Boxes shorter than `STEP_HEIGHT` (0.42 m) in
  `world/js/collision.js` are stepped onto rather than blocked.

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

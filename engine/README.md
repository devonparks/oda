# AMG World Engine — Babylon.js + Havok

The successor to the three.js park. **`/world` stays live and untouched** while
this is built; nothing here writes to it, and both read the same asset files.

```
/engine/           the engine (student bundle)
/engine/?dev       same, plus the Babylon Inspector on the ~ key
/engine/?npc=0     without the other kids (smaller download)
```

## Run it

```bash
python -m http.server 3457
```

Then <http://localhost:3457/engine/> — there is no build step for engine code.
`engine/js/*.js` is plain ESM the browser loads directly: edit, refresh, done.

## Controls

| | |
|---|---|
| `W A S D` / arrows | walk, `Shift` to run, `Space` to jump |
| `E` | ride the nearest prop — bench, swing, kart, slide, monkey bars |
| on a ride | `Space` hops off; a swing pumps on `W`, a seesaw pushes on `Space` and exits on `X`; anything wheeled drives on `W`/`S` and steers on `A`/`D` |
| `P` | the prop library — every prototype with a thumbnail, searchable, click to fly there |
| `O` | object edit mode — click to select, `Delete` removes, `Ctrl+Z` restores |
| `V` | first / third person &nbsp;·&nbsp; `F` stats &nbsp;·&nbsp; `~` Inspector (`?dev`) |

## Layout

| Path | What |
|---|---|
| `index.html` | picks the Babylon bundle via an import map (`?dev` swaps it) |
| `js/boot.js` | engine, scene, Havok, lights, camera, render loop, `window.__engine` |
| `js/park.js` | loads the export and thin-instances all 1103 placements |
| `js/collision.js` | mesh colliders from the real geometry, per-scale static bodies |
| `js/character.js` | the player on a Havok `PhysicsCharacterController` |
| `js/rig.js`, `js/clips.js` | the 22-bone v2local rig and the baked clip library |
| `js/props.js` | **the prop database runtime** — mounting, motion, IK pins, driving |
| `js/npc.js` | the other kids: wander the paths, sit on real prop-database seats |
| `js/backdrop.js` | the countryside — land, hills, tree belts, fog |
| `js/blobshadow.js` | soft contact shadows under every character |
| `js/objects.js` | the object layer: pick / delete / undo / persist / export |
| `js/library.js` | the `P` browser over `assets/prop_db.json` |
| `assets/prop_db.json` | **per-prop seat, clip, IK pins and motion** (see below) |
| `assets/thumbs/` | 275 prototype thumbnails, lazy-loaded by the library |
| `vendor/` | **committed** prebuilt Babylon + Havok + Draco (see below) |

## The prop database

The thing Devon actually asked for, and the reason the object layer exists.
`assets/prop_db.json` holds, per prototype and **in the prop's own local
space**: where the seat is and which way the rider faces, which clip plays,
where the hands and feet are pinned, and how the prop itself moves.

```jsonc
"SM_Prop_Coin_Ride_Dragon": {
  "kind": "coinride",
  "seat":   { "pos": [0.09, 0.80, -0.32], "yaw": 0 },
  "clip":   "sit_dragon",          // its OWN clip, not a near neighbour
  "clipStatus": "bespoke",         // 'placeholder' would name the gap
  "hands":  [[…], […]],
  "motion": { "type": "rock", "axis": "x", "amp": 0.14, "hz": 0.5, "pivot": […] }
}
```

Seeded from the real geometry, never guessed:

```bash
node tools/engine/seed_prop_db.mjs        # measures seats in real Chrome
node tools/engine/seed_prop_db.mjs --dry  # prints, writes nothing
```

Entries marked `"authored": true` are never overwritten by a reseed — the
tool starts the file from truth, it does not own it. **32 mountable props,
32 bespoke clips, 0 placeholders.** Nine of them drive.

Adding a new bespoke clip is a four-step recipe: a `Spec` + a `BuildRaw`
case (+ `Seated()` / `LifeAmount`) in `tools/world/unity/AMGActionBaker.cs`,
then `ORDER`/`ICONS` in `tools/world/bake_actions_v2.mjs`, then the Unity
menu **AMG > Bake World Action Clips**, then `node
tools/world/bake_actions_v2.mjs verify`. New clips append LAST so no
existing clip's bin offset moves.

## The decisions worth knowing

**1. The scene is RIGHT-handed.** `scene.useRightHandedSystem = true`. The Unity
exporter already converts to glTF/three.js convention, so with this flag
Babylon's glTF loader leaves `__root__` at identity and every number the
three.js park measured — collision boxes, seat positions, the water mask, zone
coordinates — still means what it says. Flip it and the whole park silently
mirrors. It also means the automatic shadow frustum does not work: it puts
the caster at negative clip depth, so the light's ortho box is driven by hand
in `boot.js`.

**2. Prototype node transforms are BAKED into the geometry.** The OBJ →
Blender → glTF trip puts Blender's Z-up→Y-up conversion on the exported
*nodes*, not in the vertex data. Resetting those nodes to identity (the obvious
thing) lays the park on its side: measured, the fountain came back
2.91 × 2.91 × 1.21 where `park_collision.json` says 2.91 × 1.21 × 2.91.

**3. Vertex colours are converted to sRGB at load** — and colour must LIVE in
the vertex buffer, not in `diffuseColor`. Babylon computes
`clamp(lighting × diffuseColor) × vertexColor`, and this park's light rig is
bright enough that anything in `diffuseColor` clips to white before the
vertex colour is applied. The backdrop learned this the hard way (its first
version rendered the whole countryside cream). Tone mapping is deliberately
OFF.

**4. Physics does not ride the render buffer.** A Havok shape cannot be
scaled per instance, so unit-scale placements share one instanced body on a
hidden `*_phys` mesh and every non-uniformly scaled placement gets its own
static body with the scale baked into a cached shape. Skipping this is what
made 7 of 48 drop points fall through "the ground" for two milestones.

**5. Staircases collide as their convex hull.** The exact tread mesh is
correct geometry and wedges the capsule in a solver equilibrium about half
the time. The hull of a staircase is the ramp under it, which is what every
shipped game uses. Measured: ramps 20/20 climbs, treads ~50%.

## The vendored bundle

Babylon ships as thousands of ES modules, which an import map cannot serve, and
the hub is a static push-to-deploy site with no bundler. So the dependency —
and only the dependency — is prebuilt and **committed**:

```bash
cd tools/engine && npm install && npm run vendor
node tools/engine/check_payload.mjs      # what a student actually downloads
```

Rebuilding re-emits the 12.5 MB `babylon.dev.js` blob into git history, so only
do it when the Babylon version changes. **When that next happens, add
`import "@babylonjs/core/Meshes/instancedMesh.js";` to
`tools/engine/vendor_entry.js`** — without it, `kid_explorer.glb` and
`kid_wizard.glb` (2 of the 16 costumes) refuse to load.

### What a student downloads

| | |
|---|---|
| first playable | **3.50 MB** — vendor gzipped + park, rig, clips, prop db |
| fully populated | **5.04 MB** — plus four NPC costumes, fetched after the world is interactive |
| library thumbnails | 1.53 MB, lazy — only the cards you scroll to |

`?npc=0` skips the costumes entirely.

## Verifying

Every check goes through real Chrome. The in-app browser pane freezes
`requestAnimationFrame`, so the world never steps there.

```bash
node tools/engine/probe_boot.mjs       # 13 invariants + 6 screenshots
node tools/engine/probe_character.mjs  # rig, walking, stairs, 48-point ground grid
node tools/engine/probe_props.mjs      # rides all 32 props, measures the fit, contact sheet
node tools/engine/probe_drive.mjs      # drives all 9 wheeled props
node tools/engine/probe_npc.mjs        # the other kids walk, sit, share seats
node tools/engine/probe_backdrop.mjs   # countryside, and its colour against the lawn
node tools/engine/probe_library.mjs    # the P browser
node tools/engine/probe_objects.mjs    # pick / delete / undo / persist
```

NPCs are OFF in probes unless one asks for them (`boot({ npc: true })`),
because a kid sitting on a bench would make `probe_props` fail at random.

Shots land in `tools/engine/_shots/` (gitignored). **Look at them.** The rule
this project runs on: numbers once said "on the chain" while the picture showed
a hand holding air, and the picture was right. M5 added four more entries to
that ledger in a single afternoon — a test plane buried under the grass, a
sample point that read grass as a shadow, and twice a patch compared on a
surface already clipped at white. The screenshot with the caster toggled is the
only measurement that could not lie.

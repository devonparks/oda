# AMG World Engine — M6 brief

Handoff for the next session. M1–M5 are built, verified and deployed. This is
what is left, what is deliberately unfinished, and the traps already paid for.

---

## Where things are

Repo `Desktop\ODA`, branch `drop4-hub-conversion`. Pushing to `main`
auto-deploys to amghub.org. The three.js park stays live and untouched at
`world/` — the engine is `engine/`, and both read the same asset files.

```
/engine/          the engine (student bundle)
/engine/?dev      same + the Babylon Inspector on the ~ key
/engine/?npc=0    without the other kids
```

| | |
|---|---|
| **M1** | Babylon 9.18 + Havok, 275 prototypes / 1103 thin instances / 60 fps, Inspector |
| **M2** | Synty kid on a Havok character controller, 22-bone rig, mesh colliders |
| **M3** | object layer — native picking, delete, undo, persist, export |
| **M4** | **the prop database** — 32 mounts, 32 bespoke clips, seeding tool, gallery probe, library browser |
| **M5** | countryside + fog, rides that drive, NPC kids, blob shadows |

Read first: `engine/README.md` (rewritten, current), then `docs/sprint-log.md`
(top five entries), then this.

**Eight probes, all green.** `probe_boot`, `probe_character`, `probe_props`,
`probe_drive`, `probe_npc`, `probe_backdrop`, `probe_library`,
`probe_objects`. Run them before and after anything.

---

## What is open, in the order I would do it

### 1. Thin-instanced ground does not receive shadows

The one genuinely unresolved thing in M5, and the reason `blobshadow.js`
exists. Everything on the CASTING side is now correct and verified:

- the park material is no longer frozen before the ShadowGenerator exists
  (a frozen StandardMaterial never recompiles, so its shader carried **zero**
  SHADOW defines — that was a real bug, fixed);
- the light's frustum is driven by hand, because Babylon's automatic one put
  the caster at clip depth **−0.63** in this right-handed scene, i.e. clipped
  out of the shadow map entirely (also a real bug, also fixed). It now lands
  at +0.14 and follows the player.

What remains: an A/B with the caster toggled is **pixel-identical** on the
park's thin-instanced grass, while a plain non-instanced mesh in the same
scene does show the shadow. So it is specifically thin-instance *receiving*.
Worth one look at Babylon's `receiveShadows` + thin-instance path, or a
minimal repro against a stock Babylon build. If it is a Babylon limitation,
the blobs already cover the gameplay need and this can be closed as "won't
fix" with a clear conscience.

**Do not** re-litigate the two fixed bugs — they are documented in the
2026-07-26 M5a sprint-log entry with the measured numbers.

### 2. NPCs cannot use moving props

`npc.js` deliberately restricts the other kids to stationary seats (benches,
picnic tables, the wagon). A swing, seesaw, rocker or kart carries a world
delta `W` that belongs to whoever is riding it, and `Props` tracks exactly
one active rider — so putting an NPC on a swing today would desync the
prop and its rider.

The fix is a real but contained refactor: move `active.W` from "the one
mount" onto the SPOT, so each spot owns its own delta and any number of
riders can be mid-motion at once. `_spotMatrix` already reads a per-spot
`parkedW`, so the shape is half there. A park with kids actually swinging is
a large visible win.

### 3. Two costumes cannot load

`kid_explorer.glb` and `kid_wizard.glb` fail with *"InstancedMesh needs to be
imported before as it contains a side-effect required by your code"*. The
other 14 load cleanly (all 16 tested). One line —
`import "@babylonjs/core/Meshes/instancedMesh.js";` in
`tools/engine/vendor_entry.js` — but rebuilding re-emits the 12.5 MB
`babylon.dev.js` blob into git, which `engine/README.md` says to do only on a
Babylon version change. **Bundle it with the next legitimate rebuild.**

### 4. Payload is 3.50 MB to first playable

`node tools/engine/check_payload.mjs` now measures assets, not just the
vendor bundle. First playable 3.50 MB, fully populated 5.04 MB, of which the
four NPC costumes are 1.54 MB (they load after the world is interactive, and
`?npc=0` skips them). Up from the ~1.2 MB the old README claimed. On school
wifi this deserves a decision rather than a footnote — options are fewer
costumes, a shared base mesh with swapped materials, or Draco/meshopt on the
kid GLBs.

### 5. Smaller things

- **Water is decorative.** The pond and fountain have a material but no
  wade/swim rules; the three.js park had them (`world/js/` has the logic).
- **No audio.** The park has none. `tools/gen_sfx.py` in Drop4 is the
  house pattern for original synth SFX (Epidemic cannot ship distributed).
- **The prop library is read-only.** It flies the camera to a prop; it could
  spawn or place one, which is the natural bridge to a real editor.
- **One clip per prop KIND, not per prototype.** Both pool floats share
  `sit_float`, both swing seats share `sit_swing`. Devon's line was "a unique
  animation for every single prop" — kind-level is where it honestly stands,
  and the data (`clipStatus`) would carry a per-prototype split if wanted.

---

## Traps already paid for — do not re-learn these

- **The scene is RIGHT-handed** and it is load-bearing (see README). It is
  also why the automatic shadow frustum fails.
- **Prototype node transforms are BAKED into the geometry.** Resetting them
  to identity lays the park on its side.
- **Colour must live in the VERTEX buffer, not `diffuseColor`.** Babylon
  computes `clamp(lighting × diffuseColor) × vertexColor`; this park's lights
  are bright enough that a mid-green diffuse clips to cream before the vertex
  colour applies. The backdrop's first version rendered the whole countryside
  the colour of sand and every numeric check passed.
- **`CreateGround` has four vertices.** Fog is interpolated per vertex, so a
  900 m plane takes its fog from 450 m away. Subdivide anything large.
- **Havok shapes cannot be scaled per instance.** Non-uniformly scaled
  placements need their own bodies (`collision.js`). This masqueraded as
  "seams in the ground" for two milestones.
- **A ground ray that starts inside geometry reports a hit at its own start.**
  Chasing it walked a scooter 42 m into the sky.
- **A horizontal ray cannot tell a ramp from a wall by height** — use the
  surface normal. And fly it UNDER the rider: at 0.62 m it hits
  `CCTransformNode`, the driver's own capsule.
- **The Synty kid is a CENTIMETRE rig** (node scale 0.01). Hip offsets in
  metres must go through the parent's inverted world matrix.
- **Never go back to a merged static shell.** The per-object export is what
  makes the object layer and the prop database possible.
- **Typed arrays do not cross the puppeteer boundary as arrays.**

---

## Non-negotiable process

**Visually verify everything.** Drive real Chrome with puppeteer, walk up to
the thing, use it, screenshot it, and *look at the screenshot*.
`tools/engine/probe_lib.mjs` is the harness.

**A failing probe is not automatically a failing engine — and a passing
measurement is not automatically a true one.** M5 alone produced four
confident, wrong readings: a test plane buried under the grass so a whole
bias sweep measured untouched lawn; a sample point that fell past a plane's
edge and read grass as a 165-level "shadow"; and twice, patches compared on
surfaces already clipped at white, where a shadow cannot show up in numbers
at all. Two assertions also failed correct code (a hardcoded placeholder
count that M4e made obsolete, a thin-instance total that the backdrop
legitimately raised). Check the measurement before you fix the engine.

**Commit per milestone, keep `docs/sprint-log.md` updated including what went
wrong, and deploy each increment once verified** (`git push origin
drop4-hub-conversion:main`).

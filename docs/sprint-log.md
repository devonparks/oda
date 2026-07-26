# Sprint Log

## 2026-07-26 (engine) — M2 + M3: a kid on Havok, and the object layer

**THE KID WALKS.** Synty kid on a `PhysicsCharacterController`, the 22-bone
v2local rig ported from `world/js/rig_v2.js`, all 7 locomotion clips plus the
81-clip action library. Third/first person, run, jump. 59 fps with mesh
collision under it.

**COLLISION IS THE REAL GEOMETRY NOW.** 105 `PhysicsShapeMesh` colliders, one
per prototype, carried by STATIC instanced bodies — 761 static instances, 44k
collider triangles, and no per-instance geometry. This is the answer to the
oldest complaint in the project: *one AABB per prop*. The three.js park needed
`_deriveCollision`, a voxel audit, a GPU ground heightfield and a curated
244-box exception file to approximate it. Here the collider IS the mesh. The
kid walks down into the skate bowl and stands on its carved floor at −1.14
without a single line of heightfield code.

**FOUR BUGS, AND THREE OF THEM WERE IN THE TESTS.** Worth writing down because
the ratio is the lesson.

1. **The kid hung motionless in mid-air at exactly its spawn height.** Havok's
   `integrate()` does NOT accelerate the character — its `gravity` argument is
   for resolving contacts against dynamic bodies. Babylon's own sample adds
   `gravity × dt` to the velocity in user code every airborne frame. Also
   found alongside it: `calculateMovement`'s `forwardWorld` was being zeroed by
   `scaleInPlace(input.f)` when standing still, and it silently returns false
   when `forward × up` is degenerate.

2. **The kid rendered solid black.** Synty's kid GLBs carry a COLOR_0 attribute
   that is not meant to tint anything — these are the one TEXTURED asset family
   here — and Babylon multiplies it in. `world/js/avatar.js` already says so in
   a comment: *"Synty exports a COLOR_0 attribute that three.js renders black"*.
   Same fix, Babylon spelling: `useVertexColors = false`. Note it is the exact
   opposite of the park geometry, which is nothing BUT vertex colours.

3. **`NO_COLLIDE = /Grass|…/` matched the lawn.** It was meant to skip grass
   tufts; it also matched `SM_Env_Ground_Round_Grass_01` and
   `SM_Env_Ground_Tile_Grass` — the actual FLOOR. The kid walked three metres
   and sank to y = −1.11. Same over-matching that once scattered treehouses
   across the skyline via `^SM_Env_Tree`. `GROUND` is now checked first and
   always wins.

4. **And the tests lied three separate times.** "W walks away from the camera"
   asserted −Z when the camera placement makes it +Z, and failed a correct
   engine. "Walking must not change height" failed the kid legitimately walking
   down into the skate bowl — the screenshot showed them standing on a ramp,
   exactly right. And the 48-point ground-coverage grid dropped the kid from
   6 m, waited 260 ms, and reported 47/48 "holes" in a floor that was fine —
   they were all still in mid-air. Then, once fixed, it reported 3 more that
   were seam-fallers who had not yet reached the catch floor. Every one of
   those was a passing engine and a failing assertion.

**THE STAIRS.** `maxStepHeight` (new in Babylon 9.18, enforced independently of
the capsule radius) is set to 0.45 m — the playground treads are ~22 cm and the
path kerbs 12, while a bench seat at 45 is the next rung up and should stop you.
**But stair climbing is NOT verified yet, and this check currently FAILS.** Say
that plainly because it is the headline claim for mesh colliders. The first
version of the test used coordinates nowhere near any steps and photographed a
kid on open grass — a meaningless pass. Aimed properly at
`SM_Prop_Playground_Stairs_01` (3.5, 0, 0.75), the kid walks from z = 3.5 to
z = −3.0 at y ≈ 0 the whole way and gains 0.06 m: straight past or through it.

What is known: the prototype IS on the terrain layer, DOES have a physics body,
and that body has all 7 instances. So it is not a missing collider. The kid
also drifts from x = 3.51 to x = 3.98 while crossing, and a staircase about a
metre wide centred on x = 3.5 could simply be missed at the edge — so the
approach vector is the first suspect, not the physics. Next session: put the
Inspector on it (`/engine/?dev`, `~`) and look at the collider against the
mesh, which is exactly the tool this move to Babylon was for.

Everything else about collision does check out — the kid stands on ground,
paths, ramps and the skate bowl's carved floor, at 41 of 48 grid points — so
"mesh collision works, one specific prop is not confirmed" is the accurate
statement, not "stairs are fixed".

**SEAMS, REPORTED NOT HIDDEN.** The ground is a mosaic of flat tiles and a mesh
collider built from zero-thickness geometry has joins. Measured on a 48-point
grid: 41 land on the park, 4 slip through a seam. A wide static catch floor at
y = −2.6 turns that from "fall out of the world forever" into "step down and
walk back up" — the three.js park had the same thing at −1.25. It is NOT a fix,
and the probe prints the seam count every run so it cannot quietly become one.

**THE OBJECT LAYER IS NOW SHORT.** Compare `engine/js/objects.js` to
`world/js/editor.js`. The three.js version had to record, for all 1103
placements, the exact slice of a merged vertex buffer that drew it, because
holding the draw-call budget meant merging and merging destroys identity;
hiding one bench was collapsing its own vertex range. With thin instances,
picking is native (`pickInfo.thinInstanceIndex`), hiding is writing one
zero-scale matrix, and nothing is rebuilt. `O` toggles edit mode, click
selects, Delete removes, Ctrl+Z restores, removals persist per map and
`objects.exportEdits()` prints the JSON to commit. That is the engine move
paying for itself in one file.

Known gaps carried forward: no backdrop (the live park's code-drawn hills and
tree belts), the ground seams above, and the prop database — M4, and the one
Devon actually cares about — not started.


## 2026-07-26 (engine) — M1: the park boots on Babylon + Havok

First milestone of `docs/AMG_WORLD_ENGINE_BRIEF.md`. New directory `engine/`;
**`/world` is untouched and still live**, and both read the same asset files.
275 prototypes, 1103 thin instances, 275 draw calls, 60 fps, Havok up, the
Inspector on backtick. 13 invariants green in `tools/engine/probe_boot.mjs`.

**THE ASSET PIPELINE FED BABYLON UNCHANGED, exactly as hoped.** No re-export, no
new tooling — `park_protos.glb` + `park_layout.json` straight in. That decision
is now paying for itself twice.

**THREE THINGS WENT WRONG, AND ALL THREE WERE FOUND BY LOOKING.** Every one of
them passed a plausible-sounding numeric check first, which is the whole lesson.

1. **The park came up on its side.** I reset each prototype node's transform to
   identity — the obvious move, since thin-instance matrices are relative to the
   mesh's own world matrix. But those node transforms *carry* Blender's
   Z-up→Y-up conversion (`export_yup=True` puts it on the nodes, not in the
   vertex data). Measured against `park_collision.json`: the fountain came back
   2.91 x 2.91 x 1.21 where the truth is 2.91 x 1.21 x 2.91 — Y and Z swapped,
   on all 275. The three.js park already solved this and said so in a comment I
   had read and not believed. **Bake the node's world matrix into the geometry**,
   guarded on the geometry so a shared one is never baked twice.

2. **The park was dark olive where the live park is vivid green.** The art is
   entirely vertex colours and glTF declares COLOR_0 LINEAR; three.js applies a
   linear→sRGB transfer at output (`outputColorSpace = SRGBColorSpace`, read off
   the live renderer) and Babylon's StandardMaterial path does not. Two wrong
   turns first, both recorded in the code: enabling Babylon's ACES tone mapping
   to "match three.js" made it WORSE (ACES crushes midtones and its gamma step
   never reached this material), and raising light intensity only blew out the
   reds while the shadows stayed crushed. The fix is the real sRGB transfer
   applied to the colour attribute once at load — exact, free per frame, and it
   leaves the material a plain frozen StandardMaterial.

3. **A passing check that was itself the bug.** "Inspector actually opens"
   failed while the screenshot showed a fully working Inspector. `debugLayer.show()`
   is async, so `isVisible()` on the next line is still false. The assertion was
   wrong, not the code — worth remembering before "fixing" anything a probe
   accuses.

**RIGHT-HANDED SCENE, and it is load-bearing.** `scene.useRightHandedSystem = true`
makes Babylon's glTF loader leave `__root__` at identity (confirmed in the loader
source), so the Unity exporter's output applies verbatim and every measurement
the three.js park paid for still holds: curated collision boxes, seat and saddle
positions, the water mask, zone coordinates. Flip that flag and all of it
silently mirrors.

**VENDORING, and why there are two bundles.** Babylon is thousands of ES modules,
which an import map cannot serve, and the hub has no bundler. So esbuild builds
a tree-shaken bundle that is COMMITTED: 3.2 MB / **508 KB gzipped**, or ~1.2 MB
with the Havok WASM and Draco — the Chromebook budget. The Inspector cannot be
the CDN UMD build (it installs a second `window.BABYLON`, so every `instanceof`
fails and the scene explorer comes up empty) and code splitting emitted **1242
chunk files**, so it is a second self-contained `babylon.dev.js` that
`index.html` swaps in via the import map on `?dev`. Draco is vendored too: the
park GLB lists it as *required*, so a school filter blocking cdn.babylonjs.com
would serve a park with no geometry. `probe_boot.mjs` asserts zero
cross-origin fetches.

**Thin instances deliver the thing merging could not.** 1103 placements keep
their identity AND cost 275 draw calls — the 133 grass tiles cost the same as
one. In three.js the same budget needed merged geometry, which is why hiding a
single bench meant collapsing a slice of a shared vertex buffer by hand. That
whole class of triangle surgery does not exist here, which is what should make
the object layer (M3) short.

Known gaps, carried forward: no backdrop yet (the live park's code-drawn hills
and tree belts — without them it is "a plane floating in the middle of
nowhere"), no shadow casters wired, and the fly camera stands in for the
character until M2.


## 2026-07-26 (final) — finishing the park: the green pool, real trees, and the object layer

Last pass on the three.js park before the engine decision (Devon is moving to
Babylon + Havok — see docs/AMG_WORLD_ENGINE_BRIEF.md).

**THE GREEN POOL WAS MINE.** "It looks like it has a green pool inside of it,
you can't see the bottom of the skate park anymore." The backdrop's ground
plane sat at y −0.6 — above the skate bowl's carved floor at −1.14 — so it
filled the bowl. Two shapes failed before the right one: a ring clear of the
park left a gap you saw sky through (a blue moat), so the answer is a plane
BELOW everything walkable, at −1.25. The 1.25 m drop past the fence reads as
the park sitting on a low rise.

**THE TREES ARE REAL SYNTY MODELS NOW.** Devon: "you can tell that background
is made by a Claude because of the tree models." They were code-drawn cones.
Now the backdrop instances the park's OWN tree and bush prototypes — already
loaded, same art, so the horizon belongs to the same world. One trap: matching
`^SM_Env_Tree` also catches `SM_Env_Tree_Large_01_Treehouse`, which scattered
little cabins across the skyline; the pattern matches whole trees only.

**THE OBJECT LAYER — `world/js/editor.js`.** Devon: *"I want Unity running
through three.js… every single item is a prefab, and you should be able to
just click on the bicycles and then just remove them."* Every one of the 1103
placements is now a live object carrying its prefab, transform, world AABB and
— the load-bearing part — the exact slice of the merged vertex buffer that
draws it. So hiding one bench inside a 130k-triangle batch is collapsing its
own vertex range: O(1), no rebuild, reversible, and the draw-call budget never
moves (36–52 calls).

Backtick toggles edit mode: click any object to select and name it, Delete
removes it, Ctrl+Z restores, removals persist per map in localStorage, and
`__world.editor.export()` prints the JSON to commit. Verified by deleting all
95 bikes/skateboards/scooters/jeep parts in one call and restoring them
byte-identical.

**Picnic table, third fix and the real one.** The seat had been placed at 82%
of the bench band's outer extent (the lip), then at the band's MEAN — but that
band also holds the table's central legs, which dragged the seat inward until
the kid sat half on the tabletop. It is the outermost vertex minus half a
plank width now. And the sink was wrong: 6.5 cm reads as contact on the park
bench's chunky seat but pushes a kid clean through a thin picnic plank, so
`_seatOriginY` takes a per-seat sink and the table uses 1.5 cm.


## 2026-07-26 (cont.) — Devon was right: it was an export problem

*"I think this is an export problem, because if I open up the demo scene in
Unity I should be able to select each item — so maybe we need to import those
separately."* That diagnosis was correct and it explains the whole month.

**THE NUMBERS MADE IT OBVIOUS.** The Synty demo scene is 1117 renderers, all
prefab instances, referencing only **275 unique meshes**. The original export
merged 741 of them into one baked `park_static.glb` — so the purple Jeep, the
pond floaties, the swing seats, the picnic tables and the tyre carousel's
crown were welded into the scenery, and every attempt to make one of them move
meant carving triangles back out of a merged mesh. That carve is where the
rock, the plant, the doubled swing chains and three sessions of pain came
from.

**NEW EXPORT: prototypes + placements.** `tools/world/unity/AMGParkExporter.cs`
(committed, menu **AMG > Export Park Scene**) writes 275 local-space prototypes
with the atlas baked to vertex colours, plus 1103 placements — name, position,
rotation, scale. `tools/world/protos_to_glb.py` converts. It is also **smaller**:
1.3 MB against the old 1.76 MB, because deduplicating 133 grass tiles into one
mesh beats merging them.

**RUNTIME: merge from parts.** `_buildLayerMesh` merges everything that doesn't
move into two meshes and diverts anything interactive **by name**. 51 draw
calls, i.e. unchanged. Two layers, and the split is by purpose rather than by
the scene's own folders: `terrain` (ground, paths, playground structure,
gazebo, fountain, pond, treehouse, swing frame) feeds the ground heightfield,
the water mask and every derived collision structure; `clutter` (toys, prams,
benches, slides) is drawn and casts shadows but is invisible to the ground
bake. Getting that split wrong first time cost the roof decks — worth knowing.

**WHAT THAT IMMEDIATELY FIXED, for free:**
- **The swings are the real Synty seats now.** Swing_1 and Swing_2 are their
  own objects whose ORIGIN is the pivot on the top bar, so swinging them is
  rotating an object about its own origin. The carve, the code-drawn chains,
  the hand-typed FRAME/BAR_Y/CARVE constants and the whole "two black bars, one
  moves and one stands still" bug class are deleted.
- **The tyre carousel is one object again** — base, pole and crown cluster by
  name, no shell carve.
- **The toy gun** behind the bush is skipped by name instead of being carved
  out by hand-typed coordinates.
- `_extractShellAttractions`, `_carveShellTriangles` and `buildCarvedGeometry`
  are gone: ~200 lines of triangle surgery deleted.

**AND THERE'S A WORLD OUT THERE NOW.** Devon: "it's just a plane floating in
the middle of nowhere." `_buildBackdrop` draws the country the park sits in —
a wide ground plane, a broken ring of low hills, and two tree belts at
different distances — code-drawn from cones and spheres, merged into three
meshes, deterministic so the skyline never shimmers. Fog far went 95 → 300 m,
because at 95 the haze swallowed the horizon and left the hills as pale
spikes; long fog turns the same haze into atmospheric perspective.

**One trap paid for:** Blender truncates object names at 63 characters. The
prototype key `SM_Prop_Playground_Track_Ride_01_Handle$PolygonKids_Material_01_A`
is 65, so the handle came back from the GLB under a clipped name, the runtime
couldn't find its prototype, and **the zip line silently vanished**. Keys are
`<mesh>#<n>` now — longest is 39.

Next map: export with a new prefix and drop the two files in. Nothing in the
runtime is map-specific any more.

## 2026-07-26 (cont.) — the step back: no vehicles, and the props fit properly

Devon called it: *"I think we need to take a step back because we are
struggling with this. Get rid of all the vehicles… let's just focus on making
the map traversable and all the props working."* He's right — three sessions
went into making a rider's body sit convincingly on a small moving toy, and
the Jeep still shed scenery when you drove away.

**THE FLEET IS PARKED.** Bikes, trikes, scooters, skateboards, the wagon, the
kart, the pogo stick, the Jeep and the pond floaties are no longer rideable.
Every one of them still STANDS in the park as scenery — with the family table
empty, the parts fall back into the merged static batch, exactly as they were
before any of this. The Jeep is a solid parked car again. The hula hoops are
gone too (they were headed for the shop as a carried item anyway).
Everything removed, why, and how to restore it is in
**`docs/REMOVED_FOR_LATER.md`**, which names commit `63b7d22` as the source.
What's left: **32 interactable spots**, no vehicles, 47 draw calls, no errors.

**THE SADDLE IS NOW A MEASUREMENT.** The one question every ride-on prop asks
is "where does the kid's backside go", and it finally has a real answer: a
saddle is the DIP in the prop's top surface — the low point between the
dragon's head and its tail, between a car's windscreen and its boot. So
`_saddleOf()` rasterises the top surface into 10 cm columns, drops the ones
that only see the base plate, keeps the ones on the prop's spine (a fin or a
running board is not a seat) and takes the lowest. Coin rides and spring
riders both use it, through `localToWorld`, so the rider rides the rocking.
The old answers were the assembly's bbox top (a dragon's horns) and a
hard-coded +0.5.

**AND SO IS THE FACING.** Riders inherited `group.rotation.y`, which is zero
for every attraction — so the kid on the rocket sat side-saddle facing the
lawn. `_frontYawOf()` takes the assembly's long axis and points it at the
taller end (head, nose cone, windscreen), or at the named steering wheel when
there is one.

**ONE SEAT FORMULA, TAKEN FROM THE BENCH.** Devon: the bench is the one that
looks right. Measured why: it sinks the kid 6.5 cm into the seat plane, and
that contact is what reads as sitting — tangency reads as hovering. Every
seat in the park now uses `_seatOriginY()`, the bench's own arithmetic.

**THE PICNIC TABLE MATCHES THE BENCH NOW.** Three separate bugs: the seat
height came from the MEAN of the plank band (so kids sat inside the wood, not
on it), the seat position was 82% of the way to the band's outer edge (which
is the far side of the far plank — kids sat on the lip), and the clip rested
hands 15 cm above the tabletop. All three measured and fixed: plank top, the
mean across-offset of each bench strip (its centreline), and a hand height
derived from the real 0.344 m seat-to-tabletop gap.

**Clip polish**: pogo hands wrap the stick, bike hands reach down to the toy
bars, the board twist eased to 45°, swing palms wrap the chain.

**The audit gallery got usable.** It hides the HUD and the zone signs (they
covered exactly the lap and seat I needed to see), shoots front-quarter at
kid height, and can hide the static park entirely — the gazebo's roof and
railing block every camera angle onto the coin rides inside it. It also
prints the sink number per seat next to the picture.

## 2026-07-26 (cont.) — playtest 8: the visual audit Devon asked for three times

Process change first: `tools/world/probe_ride_gallery.mjs` mounts EVERY ride
and takes a close-up screenshot; every image got LOOKED at, fixed, reshot.
That gallery is now the standing definition of done for animation work — the
FK numbers said "0.029 m from the chain" while the screenshots said "holding
air", and the screenshots were right.

**The "stripper pole" was a misdiagnosis of a missing structure.** The
roundabout Devon kept reporting is the TYRE CAROUSEL behind the fountain —
and only its spinning BASE is a layout prop. The pole and the entire
arms-plus-hanging-tyres crown were baked into the static shell: he rode an
invisible disc while the tyres stood still. Both carved out (2,296 triangles)
and folded into the spin group — the whole carousel turns now, and the rider
sits ON a hanging tyre at r 1.95, facing out, seat level measured as the
outer band's densest slab (the tyre itself, not the arm it hangs from).
Spinner riders face OUTWARD on tyre seats with hands resting beside them.

**The fishing rod was in every rider's hand.** Held-item visuals were hidden
during rides earlier, but fishing.js draws its own rod — gated now while
riding, seated or crouched. This alone polluted every "animation is wrong"
impression with a rod sticking through the kid.

**Seesaw solo reads right**: the sim owns the plank permanently (no ambient
sway — a real seesaw RESTS with one end down), and mounting seeds your
weight so your end starts sinking the instant you sit, even from the high
end. The NPC playmate and the two-rider alternation are untouched.

**The Jeep's plant is gone** — a tuft wholly inside a part's seed box seeded
itself; per part only connected components ≥25% of the largest keep their
claim. And the driver sits IN the tub now (mountY 0.30, was perched at
roll-bar height).

**Clip polish, 23 clips total**: NEW `scoot_stand` (hands ON the scooter
bars, low and close — scooters no longer share the skateboard's balance
arms), pogo hands wrap the stick (were 20 cm in front), bike hands reach
DOWN to the toy bars, board stance twist softened to 45° with relaxed arms
(the 58° twist over board-line legs read as impossible), swing grip dropped
6 cm so the PALM wraps the chain instead of the wrist floating beside it.

Audit verdicts worth keeping: kart, wagon, floatie, bench, picnic table,
seesaw and the 4-tyre roundabout all read FITTED now; monkey/zip stills were
probe staging flakes (their rides verified separately).

## 2026-07-26 (cont.) — playtest 7: sideways skating, tyre seats, saddles, and a crouch

Devon's verdict on the last four deploys was "definitely better," then a
precise list. Everything below measured before and after.

**THE SKATER STANDS SIDEWAYS NOW.** The earlier session misread him: "standing
straight ahead" meant the BOARD travels ahead — the RIDER stands across it.
New clip `board_stand` (ride_stand stays forward-facing for the scooters) +
`board_push` re-authored in the same frame: regular stance, front foot near
the nose, back foot near the tail, chest across the board, head turned to look
down the line. The baker grew LEG IK for it — "feet ON the board" is an exact
contact, so the ankles are IK targets now, not aims. Measured on the live rig:
feet along the board ±0.2 m, across ≈0, shoulders spread ALONG the deck.

**ROUNDABOUT RIDERS SIT ON THE TYRES.** "It's activating like a stripper
pole" — rider at radius·0.52 = 0.39 m, hugging the centre post, at the POLE's
top (deck = bbox top). The seat ring is measured from the assembly's verts
now: everything clear of the hub gives the surface level and its 70th-pct
radius — the 4-tyre roundabout seats at r 0.72 on the tyre tops (0.60), the
wheel-spinner on its disc at r 0.32. Riders face the hub, hands to the wheel.

**BIKE RIDERS SIT ON THE SADDLE.** The frame's whole top band mixes saddle
and handlebar STEM (they top out level — measured), so its centroid put the
kid between them. The mount is the REAR-half top band now. Rider-to-saddle:
0.000.

**THE DOUBLED SWING CHAINS ARE GONE — by one centimetre.** The chains are
single strips whose top verts sit at y 2.07; the carve box stopped at 2.06,
so the all-verts rule never cut them and the originals stood beside the
dynamic rebuilds. Box raised to 2.12 (the bar survives — every bar triangle
runs past the box in X). Zero live chain triangles after. (A prior probe
reported "zero triangles in the carve box" — it forgot matrixWorld, the
oldest trap in the table.)

**THE JEEP IS CLEAN — carve by CONNECTIVITY.** The rock and the grass rode
along because box membership alone claims any scenery that happens to sit
inside a part's renderer bound. Parts now SEED from triangles deep inside
their shrunken boxes and FLOOD along shared vertex positions, bounded by
their own box — debris is never vertex-welded to the vehicle, so it stays in
the park. Verified: drives clean, nothing on the wheels, the pebbles sit on
the pavement where they always were. (Also inherited by the floaties.)

**THE PLAYGROUND TOP IS SOLID.** The roof masks erase the deck from the
heightfield and the inpaint blends it with the ground outside — a real hole
at (3.0, −3.2) and a mush ring. The decks and walls beneath each roof are
derived from the shell now (window capped just BELOW the roof slab, so the
rim doesn't become a shin wall). The hole grid reads solid deck after.

**CROUCH is a button.** Hold X (or the new HUD button): short capsule
(0.58), crawl clip, 0.42× speed — you duck under the little roof building
instead of clipping through it. **Seesaw** gravity 3.1→5.2 with the push
retuned (peak +1.0 in 0.76 s) plus a dust thump when an end slams down.

## 2026-07-26 (cont.) — clips 20 and 21: the skateboard pushes, the tyres crawl

The Unity project was open, so the two asks that needed REAL animation went
through the established baker (AMGActionBaker.cs → actions_bindref.json →
bake_actions_v2.mjs verify) rather than being faked:

**`board_push`** — the stance leg stays welded to the deck while the right leg
reaches down past it, drives back along the ground, lifts and recovers; the
standing knee dips because the pushing foot has to reach the GROUND, a
deck-height below. rides.js drives the clip's playhead off the same push cycle
that surges speedScale — one system, like the swing pump, so the kick lands
exactly when the board accelerates. Standing still drops back to `ride_stand`.

**`crawl`** — hands-and-knees: trunk pitched until the near-straight arms reach
the ground, knees under the hips, opposite hand and knee advancing together.
Plays on the TYRE WALL at any height (Devon: "a crawl state to climb them,
rather than one locked animation") and on any low clamber (≤ 1.15 m — a grind
box, a ledge), which also skips the ladder-style heave at the top.

Both verified through the full FK gauntlet (loop seams 3.4°/3.6°, breath layer
present, existing bins byte-identical) and rendered to pose sheets before
wiring. 21 clips, 132 KB.

## 2026-07-26 (cont.) — P2: zip line, floaties on the pond, walking up the slides

**THE ZIP LINE RUNS — both ways.** SM_Prop_Playground_Track_Ride_01 with its
hanging handle, from the playground out over the lawn. Measured, the plan
changed: there's a 1.08 m ledge under the east end AND a 1.21 m shelf under
the west, both within a kid's reach of the 3 m track — so it boards from
EITHER end, like the real toy. The grab is the slide pattern (walk into the
waiting handle, moving toward it — Devon talked himself out of jump-to-grab),
the ride hangs off the monkey clip, Space drops early, the landing carries
the travel speed, and the idle handle trundles over to a kid waiting at the
other end. Verified end-to-end in Chrome: grab → ride → land on the far
ledge.

**THE FLOATIES PADDLE.** Both SM_Prop_Pool_Floats were baked into the shell,
so they went through the Jeep's carve path (now generalized:
`_carveShellTriangles`) and came out as vehicles that ride the WATER: y
pinned to their authored draught, movement fenced by the water mask (paddle
at the shore and you stop, still afloat), 0.55× paddle speed, ripple rings
and soft splashes. Their old export boxes were waist-high walls in the
swimming water — dropped. Get in, paddle around, hop off, wade out.

**YOU CAN WALK UP THE SLIDES.** First attempt derived the chute's real
triangles — and built a WALL: a steep surface crosses 25 cm bands, so every
band has the next overhead and fails the headroom rule. The fix is simpler
and exactly right: thin standable boxes laid along the same sagging path the
ride glides down. Measured: walked from the exit to the very top (2.33 vs
top 2.30), every rise inside the step gate, and the walk-on auto-slide still
only fires facing DOWN the chute.

Also: the P2 probes found their own trap — `camYaw` is the camera BOOM
direction, so synthetic W walks OPPOSITE to it. Two "failures" were the
probe walking the kid away from the target.

## 2026-07-26 (cont.) — P1: seesaw seats two, the roundabout has a direction, skateboards do tricks

**THE SEESAW IS A TWO-KID TOY NOW.** The plank's state moved off the rider and
onto the seesaw itself: a torque model on `lift` (+1 end's height) — the heavy
side sinks, balanced riders coast on momentum, a push only works from the
ground. One rider reduces exactly to the old lever. And because a one-kid
seesaw is emotionally wrong, a nearby NPC kid gets conscripted (the same
`controlled` contract freeze tag uses): walks over, takes the free end, and
pushes back on a kid-sized delay. Measured over 18 s of play: full travel both
ways, 14 alternations, clean release when the player hops off. The two-seat
rider model is exactly what multiplayer will plug into.

**THE ROUNDABOUT SPINS THE WAY YOU THROW IT.** Devon: "there's a little wheel
in the middle, and you spin that wheel." A/D throw it either way (D = your
screen-right as you sit facing outward — measured from the seat parametrisation,
not guessed), W keeps it going, S drags it down. Measured: A → +2.5 rad/s,
D → −2.8, S brakes to ~0. The tangential Space-fling still works in both
directions.

**SKATEBOARDS: slower, kicks, ollies, kickflips, grinds.** 2.05× was "too
fast" — it's 1.7× with thrust that comes in KICKS (speedScale surges on a push
cycle), so it reads as skating, not a conveyor. Space at speed is an OLLIE
(with coyote time — rolling downhill leaves `grounded` false most frames, and
a strict check dumped the kid off half the time), the board sticks to the feet
and kickflips; a clean rotation pays +2 coins (10 s cooldown so it can't be
farmed). Land on a SkatePark_Rail_Box and you GRIND: locked to the rail's own
line at 4.2 m/s, off the end or pop off with Space. Rails come from the
collision export's boxes, nothing hand-placed. Space only exits a board when
you've slowed down — never mid-run.

**Hula hoops lie on the grass** like dropped toys instead of standing
unsupported (still destined to be a shop item; the mechanics stay unlocked).

Still open from the feel list: a real push-off CLIP for the board (needs a
Unity bake session via AMGActionBaker — the 20th clip), and P2 (zip line,
pond floaties, walk-up slides, tyre crawl).

## 2026-07-26 — P0: the Jeep drives, riders sit on saddles, the pond knows its own edge

Working the backlog top-down. Everything below measured in real Chrome via the
new probe harness (`tools/world/probe_lib.mjs` + `probe_p0_verify.mjs` —
committed, reusable) before deploying.

**THE PURPLE JEEP DRIVES.** It was baked into the merged shell — in the
collision export but not the props layout, which is why the vehicle pass never
saw it. New `_extractShellVehicles` path: each shell triangle whose three
verts sit inside one of the Jeep's six export boxes (steering and wheels claim
first, body takes the rest, a union-box fallback catches straddlers) is pulled
into a per-part geometry, degenerated in the shell, and handed to rides.js as
ordinary vehicle parts. Two traps found by measuring:
- A CENTROID-in-box test grabbed a slab of the skate park (a big triangle's
  centroid can land inside a small box) and the Jeep drove off with it.
  All-three-verts is the rule now.
- **Facing came from the wheels' own names** — front-axle midpoint minus
  rear-axle midpoint (`def.axleFacing`) — because the Jeep parks diagonally
  (yaw 127°) and a diagonal body has a square AABB, so the long-axis test is a
  coin flip. The wheels' spin axles are the perpendicular of that same
  forward. Seat = the body export box centre (`def.seatAtOrigin`) — the carved
  mesh's AABB centre sits 0.29 m off it and put the kid on the rim of the tub.

**EVERY RIDER SITS ON THE SEAT NOW — one line.** The stored seat offset was
captured in WORLD space at build, but `_mountXZ` rotates it by the group's yaw
— which after normalization starts at the baked yaw, so it rotated twice. The
error is `2·|seat|·sin(yaw/2)`, and it reproduced every number in Devon's
report to the millimetre: bike 0.399 m (reported 0.40), scooters 0.173/0.364
(0.17), trike 0.024, kart 0.001 — the kart sat perfectly only because its seat
is at its origin. Fix: store the seat in the normalized local frame.
Re-measured: **0.000 on all 15 vehicles.**

**THE POND KNOWS WHERE ITS WATER IS.** The water disc (r 5.2 at the box
centre) was a guess, and Devon kept catching it: "where water ends and dirt
begins is still wrong." Measured from a top-down render: the real water is a
KIDNEY-shaped blob centred a metre north of the box centre — its edge runs
2.6 m out in one direction and 6.6 in another. No circle is honest, so there
isn't one any more: a 256² **water mask** is baked at load from the shell's
own colours (teal = water, the toy boat's blue counts too), enclosed dry
holes (lily pads, the boat's white sail) are flood-filled, and `waterAt` is a
texel lookup — wading now starts exactly at the drawn edge. The wading dish,
duck seeding, duck drift targets and the fishing cast's splash-down all snap
to the mask. Verified: hip-deep (-0.43) inside the drawn water, bone dry on
the south shore that used to be falsely wet, all 14 ducks afloat.

**POGO CONFIRMED WORKING** — mounts, hops, prompt shows, no NaN. It's at
(7.5, 26.6): tucked against the low wall on the path between the skate park
and the corner playground, a few steps east of the ground ramps. Devon
couldn't find it because it's a 40 cm stick parked in a visually busy corner,
not because it's broken.

## 2026-07-25 (overnight, cont.) — playtest 6: the crash, fishing, and alignment

Devon's longest playtest yet. Fixed and deployed this pass; the rest is the
backlog below, in his own words.

**THE CRASH (mine).** "The picnic tables broke the game — I had to go back to
the hub and load back in." `enterZone` checked `zone.seat` **before**
`zone.ride`, and the table zones carried a `seat` property, so they routed into
the BENCH sit — which reads `zone.x/z/yaw`. Those don't exist on a ride, so the
player position went `NaN` and took the renderer with it. Rides are checked
first now and the property is renamed `spot` so it can't recur.

**FISHING (mine).** "It was working, but it's not working now. I can't catch
the fish at all." An early press used to REEL IN — survivable when E was the
only way to fish, fatal once a *click* uses the held rod, because every stray
click during the wait cancelled the cast. Ignored now. Also: the rod is a
carried ITEM, no bank zone and no auto-pose, per "I just want to be able to use
the fishing rod wherever you want."

**THE SLIDE GRABBING YOU.** The entry gate (1 m radius, 0.75 m height slack,
0.3 facing dot) caught anyone lining up for the **zip line** on the same
platform. Now 0.62 m / 0.45 m / 0.72 dot, requires real walking speed, plus a
1.2 s cooldown.

**ALIGNMENT — one root cause behind three complaints.** "The wheels are
spinning on the wrong axis", "on a skateboard you're standing sideways", "the
character isn't on a seat… it's like that for literally everything."

- **Facing** was "+Z rotated by the root matrix" — an assumption. Measured error
  against reality: **kart −195°, pogo −71°, wagon 49°, scooter 33°, bike 20°**.
  A vehicle is longer along its travel axis, and the steering part says which
  end is the front. Rider-to-body alignment now **1.000 on all seven families**.
- **Wheels** orbited instead of spinning (mesh origin = the *vehicle's* origin)
  about an assumed local X. Each wheel now has a pivot at its own centre and
  spins about its **thinnest horizontal axis**.
- **Seat**: mounting used the group origin. It's the widest part's centre now.
  Measured rider-to-seat: kart 0.001, trike 0.024, board 0.039, wagon/pogo
  exact. **Bike still 0.40 out, scooter 0.17** — better, not yet right.

### Devon's remaining backlog, verbatim where it matters

**Physics / feel**
- **Seesaw**: "it should always lean towards the person on the ground because
  that's the side that weighs the most" — and it must work with **two riders**
  for multiplayer.
- **Roundabout**: "the way it works in real life is there's a little wheel in
  the middle, and you spin that wheel" — needs a directional control.
- **Skateboard**: too fast; wants a push-off animation, **tricks**, and
  collision with the **grind rails**. Tricks could pay XP.
- **Pond edge**: where water ends and dirt begins is still off.

**Missing interactables**
- The **purple car by the skate park** (it's `Coin_Ride_Car` — currently rocks
  in place; Devon expects to drive it: confirm which he wants).
- **Zip line** (`Playground_Track_Ride_01`): grab it and ride across.
- **Pond floaties** should be rideable like vehicles.
- Confirm the **pogo stick** works (he couldn't find it — it's at 7.5, 26.6).
- **Hula hoops** stand upright and look wrong; possibly better as a shop item.

**Movement / camera**
- "**Majority of the activities should just work from walking**" — no prompts.
- The **slide should have collision so you can walk up it**.
- **Tires**: a crawl state to climb, not one locked animation.
- **Camera zoom levels** in third person — "when you go to the top of the
  playground you can't even see the big green slide". Wants a settings option.
- General playground mobility.

**Bigger**
- **Fishing economy**: sell fish, a shop.
- **Background** — "it's just a plane floating in the middle of nowhere".
- Expand **freeze tag**.
- Then **multiplayer**.

## 2026-07-25 (overnight) — "full send it": everything in the park works now

Devon: *"I want every vehicle to be driven… a skateboard, the bicycles,
everything. And I want every single attraction to be interactable."* Two
commits, both deployed. The park now has **67 interactable spots**.

**Fourteen vehicles, one implementation.** The soapbox racer's trick — divert
the layout parts out of the static batch, re-parent them into a rigid group —
became a family table: **5 skateboards, 3 bikes, 2 scooters, a trike, a wagon,
a pogo stick, the kart**. Parts arrive as a FLAT list (five boards' worth of
decks and twenty wheels, all siblings), so they're clustered by proximity into
instances. `stepPlayer` keeps running with a per-vehicle `speedScale`, so a
skateboard (2.05×) really is quicker than a trike (1.25×), and every rider gets
real collision and real ground. Hop off and it parks there.

Two bugs found by measuring instead of eyeballing:
- **Mount height came from the whole assembly's bounding box, whose top is the
  HANDLEBARS** — scooter riders stood 1.63 m up, on the bars. It's the widest
  *part's* top now: footboard 0.13, board 0.23, wagon floor 0.32, trike seat
  0.50, bike saddle 0.66, kart body 0.91. The pogo overrides it (single part —
  you ride the pegs).
- **That measurement has to be a SECOND pass.** `setFromObject` reads
  `matrixWorld`, and inside the build loop the group's own `matrixWorld` is
  still stale, so every part measured against a garbage transform.

**Both roundabouts spin.** Devon named them: the four-tyre one behind the
fountain and the one next to the seesaw. Both were being animated as spring
rockers. Now you sit on the rim, hold a direction to push it round, and Space
flings you off tangentially. **The rocket** and the other two coin rides rock
and bob. **The monkey bars** read their two ends off the prop's own top band,
so you swing across hand over hand from either side.

**The seesaw became a lever.** It was `sin(t)` with an amplitude that grew when
someone stood near — the plank swung whether or not that made sense. Now one
rider's end falls to the ground and stays there; push off with a movement key
while you're down and you launch. Everything is expressed as `up` (−1 grounded
→ +1 top) so the signs stay honest. Push tuned against the arc, not by feel:
peak = v²/(2G), so 3.4 carries you from −1 to +0.89 (measured). 2.6 only
reached +0.11 and felt stuck.

**Picnic tables: four seats each, all five tables.** Derived from the benches —
the benches are the widest thing below the top, so find that band, take its long
axis, two seats a side facing in. No hand-placed coordinates and no layout
rotation to read, because these tables live in the shell.

**Six new clips** through the same baker: `ride_stand`, `bike_pedal` (legs
turning a real circle, half a turn apart), `pogo`, `monkey` (hanging, legs
swinging opposite the arms), `sit_table`, `spin_ride`. **19 clips, 118 KB.**

Verified in real Chrome: all 21 rides start, play the right clip, and the body
tracks the rider to the centimetre on every vehicle.

### What's left

Multiplayer — which is what Devon said comes after "everything here is
interactive". The four-seat tables and independent bench seats were built with
that in mind. Also unfinished: the kart driver position he mentioned in passing.

## 2026-07-25 (late night, cont.) — playtest 5: slides by walking, treehouse roof

Two calls from Devon, both right, both cheap.

**Slides lost their prompt.** "The most ideal situation would be to get rid of
the prompt to slide down. You go up the stairs, then you go to the top of the
slide, press W, and it just triggers the slide animation." Walk within a metre
of a chute's mouth, at its height, facing down it, actually moving → you go.
It's *less* code than the prompt was.

That also answers the other half of his report — "the slide doesn't have any
collision" — **without giving the chute any**. A slide you can walk on is a
ramp. The chute stays non-solid (its AABB wraps the whole diagonal, so as a
solid it's an invisible lid you land on) and the mouth catches you before you
reach the place where it isn't. The prompt used to sit at the EXIT because back
then the top was unreachable; it's reachable now, so that marker had no job.

Measured: all four chutes auto-start from their platform and ride to the exit
height, and it does **not** fire when walking away from a mouth or standing
still on one.

**The treehouse roof is no longer standable.** He climbed it, went first person,
and found "it's really not even that much room up there because the tree is in
the way… it's like I'm standing on top of it." Measured: the deck is **1.4 m²**
of balcony with the trunk straight through the middle, while the roof is **7.2**
— so the biggest surface up there was the one you're not meant to be on.
Clipped out (same `maxH` the gazebo uses). Small balcony, but it's what the prop
actually is.

## 2026-07-25 (late night, cont.) — playtest 4: interiors, first person, a real climb

Devon: "the hardest part is the tight spaces… you can't go into any interior…
the pirate ship is real small, I should be able to squeeze into spaces like
that", "we need the ability to switch between third and first person", and the
treehouse "has to actually be a separate climbing animation".

**Interiors — two causes, both in `_deriveCollision`.**

1. Voxelising **snapped every surface to the 25 cm grid**, so a 10 cm plank
   became a 25 cm wall and a doorway lost up to half a metre from each side.
   Cells now remember the **true extents** of the geometry inside them and rects
   are emitted at those. A thin wall stays thin; the doorway comes back. The
   ship's deck went from a shape you bounce off to one you can walk around, with
   the mast as the only thing in the middle of it.
2. **"Sometimes it bugs out and makes you try to climb and get on top of
   something."** A long thin wall sailed past the footprint-area test — 3 m ×
   0.25 m is plenty of area — so its top was a ledge. Standable is now decided by
   **headroom**: is there air above this? A wall has more wall above it; a step
   has sky.

   **The area rule had to go, and finding that out cost a debugging pass.**
   Splitting a band into open/solid groups fragments the greedy merge (a deck
   cell next to a bulwark cell can't merge with it), so rects come out small —
   and the area test then condemned every fragment. 82% of the ship was marked
   wall-only and every climb in the park broke. Headroom alone is enough: a pole
   has pole above it at every band but its tip, and the tip is unreachable
   because the band below it is blocked.

**A real climb.** The headroom rule also makes a ladder unwalkable, which is
correct and is exactly what Devon asked for. Two new baked clips (`climb`, hand
over hand with opposite arm and leg; `climb_top`, the heave over the lip) plus a
scripted ride. It's offered by **shape, not by a marker** — something solid
ahead and a standable ledge above within a kid's reach — so it covers the
treehouse ladder, the tyre wall and anything built like them, with no per-prop
list. Measured: from four of six approaches you climb the treehouse from the
ground to its floor at **3.04**. Space lets go mid-climb.

**First person** (`V`, or the 🎥 button). Third person physically cannot work in
a space the size of the ship's cabin — the boom is longer than the room. Eye
level rides the Head bone, hides the model, changes nothing else. Minimum zoom
also drops 3.2 → 1.4 m, since 3.2 was wider than the whole deck.

### Devon's stated goal, for whoever picks this up

> "I want every vehicle to be driven… a skateboard, the bicycles, everything.
> And I want every single attraction to be interactable."

Named, still to do: the **rocket ship** by the fountain; the **four-tyre spinner
behind the fountain** (supposed to spin); the **thing next to the seesaw** (also
supposed to spin — currently borrowing seesaw physics); **seesaw physics needs
work**; **monkey bars** need a crossing animation; **picnic tables** need a sit
with ~4 seats each (benches too). The kart already drives — the same
diversion-into-a-rigid-group pattern is how the bikes and skateboard should go.
Then multiplayer.

## 2026-07-25 (late night, cont.) — playtest round 3: poles, the corner, the pavilion

Devon walked the park again. Four findings, all fixed and deployed (`462cec9`):

- **"You can walk up the poles of the swing set."** Deriving collision slices
  geometry into 25 cm boxes, which turns a slanted A-frame leg into a perfect
  spiral staircase. Derived rects under **0.18 m² of footprint are now
  wall-only** — they block, but `groundAt` won't offer their top as a ledge. A
  real step merges across its whole tread and clears the bar easily. Sweep at
  the swing: y 0.25 (the ground) instead of climbing the frame.
- **"The whole slide area has no collision at all… you can't climb up the
  stairs, and that's the whole point of it."** This one was mine. The corner
  playground's stairs live in the shell, so dropping the 1 m `Stairs_01` cubes
  should have left the heightfield in charge — as it does for the main
  playground. But three `Playground_Cover` shade sails (~32 m² each) blanket
  that corner, and the heightfield **masks overhangs**, which also erases the
  steps beneath them. Dropping the cubes left nothing at all. Now the real
  geometry is derived around **every** stairs box: duplication of the truth
  where the heightfield already had it, the only collision there is where the
  mask ate it. Sweep: 0 → **y 2.0**, so you climb up and slide down.
- **"A little pavilion thing… you can't go up it at all."** collision.js swapped
  the gazebo's 25 m² box for four posts and a plinth — but the plinth topped out
  at 0.09, i.e. the floor, so there was never a deck. Derived now: **16.9 m² of
  standable deck at y 1.0**. Its ROOF is deliberately not derived (new `maxH`
  clip) — a roof is above head height and unreachable, so deriving it only cost
  boxes and handed out a walkable ramp to the top (the sweep strolled to 6.25).
  Clipping at 2.6 m fixed that and cut 413 boxes to 211.
- **The kid clipped into the swing seat.** Pelvis joint now rides 0.105 above
  the plank rather than 0.06 — the plank has thickness and the shorts volume.

No regressions: treehouse still 4.5, main stairs 3.25, ship 3.0, all 12
activities pass. 1397 boxes; `resolve()` 21.5 µs in the densest spot, 0.4 µs on
open ground.

## 2026-07-25 (late night) — AMG World: the collision sweep, the hotbar, the UI

Devon: "keep going on the collision and engine stuff and then I want to add the
hot bar and inventory system and upgrade the ui and functionality / controls."
Three commits, in that order, all deployed.

**Collision, by measurement instead of guesswork.** Wrote an audit that
voxelises the real meshes inside every solid box and ranks them by
empty-but-still-blocking volume. The ranking was unambiguous:

| lie | vol | fill | what |
|---|---|---|---|
| 55.8 m³ | 81.9 | 32% | **Fountain** — the biggest lie in the park, in the middle of it |
| 8.3 | 12.5 | 34% | **Swing set** — couldn't walk between the A-frame legs |
| 1.9 | 4.4 | 58% | **Tent** — a thing you go inside, with no doorway |
| ≤1.8 | | ~53% | every remaining entry is a tree, already refined to trunks on purpose |

All three now come from `_deriveCollision`. Walked engine-accurately
(`resolve()` from the previous position, not a naive point test): under the
swing bar, between its legs, into the tent, through the tunnels — never pushed
once. The fountain became a rim you step onto with the basin wall inside.
`_deriveCollision` gained `exclude`, which the swing needs: rides.js carves its
seats out of the shell AFTER load, so without it those triangles freeze into
collision boxes hanging in mid-air (verified 0 ghosts).

Also: **the `_Top` rule never matched anything.** Written `_Top_`, needing a
trailing underscore, so `Rocker_01_Top` and `Seesaw_01_Top` sailed past and
stayed solid — and the audit caught `Rocker_01_Top` at a measured fill of
**0.000**, pure phantom wall beside the spring rider, because those props are
ANIMATED and move out from under their static box every frame.

780 boxes now vs 255. `resolve()` measured at 2 µs by the swing, 11 µs inside
the treehouse's 257 — a rounding error at 60 fps.

**Hotbar + backpack** (`world/js/inventory.js`, pure — no THREE, no DOM). 8
hotbar + 16 backpack, stacks that merge, localStorage round trip, and a save
naming an unknown item drops that slot rather than wedging the file. You FIND
things: the pond hands you a rod, the lawn a hoop, the playground a ball, each
with a toast. Fish become keepsakes. `throwBall` fetches the park's nearest
existing ball rather than spawning one, or the park would end up being nothing
but balls.

**Three ways to use what you hold**, because one didn't cover three input
styles: click (desktop), E when you're not at a zone (E stays context-first),
and tapping the slot you already hold (the only one a tablet has). The click
path is what made it work — a kid holding a ball inside the playground ring
could never throw it, because E always went to the ring.

**UI/controls.** Fixed the conflict I'd just created (the first stage click
grabs the pointer for looking — use-on-click now requires the pointer already
captured). Unstacked the bottom of the screen (hotbar 18 / prompt 96 / held
name 152). Mobile: eight 42px slots is 374px, the whole width of a phone, so
the bar and the button column can't share a row — side by side instead, bar
left at 34px a slot, buttons right; measured no-overlap at 390×760. And **you
can see what you're holding** — ball and hoop are code-drawn and posed from the
Hand_R bone (0.082 m from the hand, measured), because a hotbar that's only
icons is a menu, not a possession.

Still open, Devon's own order: more of his playground ideas, kart driver
position, slide prompts to the tops (needs a climb first — see the note below),
and whatever the next playtest turns up.

## 2026-07-25 (night) — AMG World: collision from real geometry, and one swing

Devon's feedback on the animations: the bench sit "looks almost perfect", the
swing "still not synced up… make it one system instead of two". And then the
real headline — **"the main thing is the collision"**: falling through
playground floors, not fitting into spaces built for kids, and having to press
Space to get up stairs. "It's just one big invisible block on the object, so
you can't actually fit where you're supposed to." Bases before features.

Those three complaints are ONE bug: a single AABB per prop.

- **`World._deriveCollision`** — rasterise a mesh's TRIANGLES into 25 cm
  columns, band by height, greedy-merge each band into rectangles, emit one
  thin box per rectangle. Two dozen boxes describing the real shape instead of
  one that describes nothing. Thin bands are load-bearing: `resolve` skips a
  box whose bottom is over your head, so a 25 cm floor slab lets a kid walk
  underneath. Vertices alone wouldn't do — Synty floors are often two triangles
  across three metres.
- **Stairs walk now.** The heightfield ALREADY held a real staircase (0.10,
  0.22, 0.31, 0.44, 0.99, 1.16, 1.29 — every rise inside the step gate). You
  couldn't use one step of it because `Playground_Stairs_01` exports as 1 m
  cubes capped at 1.00 sitting on top. Dropped → walking with no Space traces
  0.09 → 1.40 and ends on the platform. Tunnels were the same cube pointed the
  other way.
- **The treehouse opens.** It hangs off `SM_Env_Tree_Large_01`, so it inherited
  the tree's `trunk` rule and a 3.6 × 3.4 m house became a 0.9 m post you walked
  through. Its floor can never come from the heightfield either — top-down
  first-hit, and it has a roof. Derived from the shell: 257 boxes, floor 3.0,
  roof 4.25, ladder between. A 12-approach step-climb sweep now reaches y 5.0
  **by walking**. Devon: "I need to be able to get into the treehouse."
- **The capsule was an adult** (0.28 × 1.4) for ~1.0 m kids. Now
  `KID_RADIUS`/`KID_HEIGHT` (0.24 × 1.05), shared by player, NPCs and tag.
- **THE TRAP:** derived boxes must skip the name rules. The treehouse's own 257
  boxes matched the `/Treehouse/` `'none'` rule written for its export AABB, so
  all 257 were silently dropped on insert and the house stayed walk-through.
  `derived: true` now bypasses the rules — they refine the RAW export only.

**The swing became one system.** It was a pendulum in rides.js and a clip
running beside it, agreeing by accident. Now: frequency from the chain length
(√(g/L) = 2.468 rad/s, the old hand-picked 2.35 was 5% slow); phase locked
(measured t = ph/2π·1.2 to the last digit across the 2π wrap); and **intensity
= the swing's own amplitude**, via a new second blended clip slot on RigV2
(`setOverlay`) — coasting is the calm sit, full pump is the pump, and they
arrive together instead of the clip flailing at full throw over a gentle sway.

Last piece: the pelvis was drifting 25 cm off the plank at full swing, because
RigV2 applies a seated clip's hip offset along **world** up while the avatar
rotates about its own origin. `pelvis = pos + R(tilt)·(0,BIND_PELVIS_Y,0) +
(0,SEATED_HIP_OFFSET,0)` — solving that for pos pins it at 0.060 m, Z exact, at
every amplitude.

Still open from Devon's list, in his order: **inventory system**, **UI//usability
pass**, more collision sweeps (he says there are still things you can walk
through — the systematic next step is running `_deriveCollision` over the
remaining structural props rather than fixing them one at a time), fine-tuning
the kart driver position, and then his backlog of playground ideas.

## 2026-07-25 (evening) — AMG World: the activities get REAL animations

Every park activity was borrowing an emote as a pose. `squat` frozen at 1.8 s
was the "sit" for benches, swings, the seesaw, the spring riders, the kart and
the slides; the `twist` dance was the "hula hoop"; the `baseball` bat swing was
the "fishing cast". They read as placeholders because they were. Eleven real
clips now ship in a new `actions` bin, and every activity plays one.

**Source check first** (price-to-quality): inventoried all 816 Polygon clips in
the three Synty animation packs the AMG Engine project owns — Base Locomotion,
Idles, Emotes & Taunts. **No sit, no swing pump, no slide, no cast, no hula.**
Synty sells exactly six animation packs; the three we don't own are Sword Combat
($18), Bow Combat ($30) and Goblin Locomotion ($21) — combat and creature sets,
none of them relevant. **Nothing to buy.** Mixamo would need an Adobe login and
file downloads, and its generic sit still wouldn't put a hand on a swing chain.
So the poses are authored ON the rig against measured contact points, and the
LIFE is sampled from the real Synty idle. Blender never opened.

- **The Unity export recipe got reverse-engineered and proved.** Nothing in the
  repo said how `_unity_export/rig/locomotion_bindref.json` was made. It is:
  sample the clip onto `Assets/PolygonKids/Models/Characters_Kids.fbx` at 30 fps
  via `clip.SampleAnimation`, take Δ = bind⁻¹·local per bone, hipY = the Hips'
  world-Y delta from rest. Re-exporting `A_POLY_IDL_Base_Masc` reproduces that
  committed file's bindPose exactly and its frame-0 deltas to the 4 decimals it
  carries. **All 816 Synty clips are now reachable by this route**, not just the
  11 baked here — that's the reusable part.

- **`tools/world/unity/AMGActionBaker.cs`** (menu: AMG > Bake World Action Clips)
  poses the real rig with world-space aim directions and analytic two-bone IK to
  contact points, so a grip lands ON the chain rather than near it, then stamps
  the Synty idle's residual (×3.5 — that idle is very still) plus authored
  breath, weight shift and a head that looks around.

- **`tools/world/bake_actions_v2.mjs`** retargets with emote_lab.mjs step-6's
  math (copied, as bake_locomotion_v2.mjs did — that file stays untouched) →
  `assets/characters/emotes/actions.bin` (70 KB) + one `hidden:true` manifest
  category. `verify` runs **43 FK assertions on the shipped bin**; all green.
  Existing bins are byte-identical and the run refuses to write if they aren't.

- **Wire-in:** benches, swings, seesaw, spring riders and the kart play real
  sits; the slide plays a slide ride; the hoops play a hula whose hip orbit the
  hoop now tracks off the actual Hips bone; fishing plays cast → wait → reel.
  The **swing pump is driven off the swing's own phase** (`RigV2.setEmoteTime`),
  not dt — measured in-browser at ph 1.72→4.59 against t 0.33→0.88, exactly
  `(ph/2π)·dur`, so the legs kick out at the back of the arc every time.

- Two traps worth writing down. (1) The seated clips carry `hipY = -0.261` on
  purpose — the same drop the frozen squat had — so **every seat offset already
  tuned in rides.js keeps working**; a verify assertion guards it. (2) The v2
  GLB is the Unity rig with **X negated** (Y and Z identical, so "forward" is
  still +Z) — the first contact assertions had the sign backwards and reported
  a 0.38 m miss on a grip that was actually exact.

- `_stop` added to the presence emote channel: the sits and the hula are `hold`
  clips, so standing up has to tell the other kids, or the park keeps watching a
  ghost sit on an empty bench.

Verified twice over: an offline 3/4-and-side render sheet of all 11 clips
(`tools/world/render_action.{html,mjs}`, one WebGL context blitted per cell —
the older harness's renderer-per-cell silently blanks the first rows past
Chrome's ~16 context cap), then every activity driven through its real key path
in real Chrome, with the pose numbers and screenshots to match. Zero console
errors, zero failed requests. The in-app browser pane freezes rAF, so the world
never steps there — real Chrome is the only way to check this.

Open: the seesaw plank's low end can dip a foot below ground (it did with the
squat too, 26 cm worse); the hula's arms could sit wider.

### Same session — the pirate ship opens up, and what the climbing block needs

`38de31c` fixed the specific blocker: the Playground_Ship export box ran from
the ground to the **mast tip**, one 3.3 m solid, so nothing about it was
climbable. `World._addShipDecks` now reads the real hull/deck/castle/mast off
the prop's vertices (deck 1.25, castle 2.15, mast 3.05) and the raw box is
dropped. Verified by running at it with W+Shift+Space and landing on the deck.

**The numbers the rest of the climbing block needs, so nobody re-derives them:**

- Jump is `JUMP 5.4`, `GRAVITY -19` → **apex 0.767 m**, and `STEP_HEIGHT` is
  0.55, so a jump lands you on anything up to **1.32 m** above where you took
  off. That is why the main playground's decks (heightfield reads 1.1–1.3 at
  x 0..3, z -3..1) are already reachable and the ship's deck now is too.
- The main playground IS in the shell, so its decks exist in the ground
  heightfield. The ship is a PROP, so it never was — that asymmetry is the
  whole reason the ship needed geometry surgery and the playground didn't.
- Slide tops: Slide_04/03 1.46, Slide_01 2.46, Slide_05 3.20. The two tall ones
  are more than one jump above the 1.3 decks, so **moving the slide prompts to
  the tops before there is a real climb would strand them** — do the climb
  first, in Devon's original order.
- The tyre wall is a single box `x[6.1,6.4] y[-0.10,2.47] z[-0.6,2.1]` — a thin
  2.5 m slab, the natural first climb surface. Monkey bars exist as a prop too
  (`SM_Prop_Playground_Monkey_Bars_01`).
- **Crouch is free now.** `Synty/AnimationBaseLocomotion` has real
  `A_Stand_ToCrouch`, `A_Idle_Crouching`, `A_Crouch_ToStand` and four
  `A_Shuffle_Crouching_*` clips on the Polygon rig, and the Unity export route
  proved this session reaches any of the 816 clips in those packs. Add them to
  `AMGActionBaker.CLIPS` as SOURCE clips (sample instead of authoring) and they
  fall out of the same bake. No authoring, no purchase.
- A climb wants the same shape as the slide ride: a scripted path (rides.js
  `_updateSlide` is the template) plus an authored `climb` loop, rather than
  anything that teleports.

## 2026-07-25 (day) — AMG World: the playtest-fix marathon (all deployed live)

Devon's first live playtest found the map "not rendered right" — poles flat,
slides inverted, ducks vertical, bikes in pieces — plus floating over the
skate bowl, and a wishlist: sit on benches, working swings/slides, fishing at
the water, drivable karts. Eight deploys, each verified in-browser first:

- **`1f91ab7` prop orientation (THE bug):** every prototype in park_props.glb
  carries a +90° X node rotation (Z-up geometry) that all three placement
  paths discarded — all 187 layout props rendered tipped over. One fix: bake
  each proto's matrixWorld into its vertices at load. Every landmark
  re-verified upright (lamps, benches, slides, ducks, coin rides, bikes,
  skateboards).
- **`84a6526` ground heightfield:** the ground was a flat y=0 plane + AABB
  lids. Now load() renders the shell top-down through a height-encoding
  shader (512², ~60ms, no asset file), masks canopy/roof footprints via the
  named collision boxes, inpaints, needle-cleans fence lines, carves a pond
  dish. Walk DOWN into the skate bowl (y=-1) and out its slopes; hip-deep
  wading (player, NPCs, tag). Two traps for the record: the needle pass must
  compare a SNAPSHOT (in-place min-propagation flooded the whole map from
  the -5 border), and the pond's own box top was the invisible waterline
  floor.
- **`fbf3879` sittable benches:** 20 seats derived from bench geometry
  (backrest side read from the tall vertices). RigV2 gained
  playEmote(freezeAt) — squat's deepest frame IS the sit.
- **`377d004` rideable swings + slides:** baked swing seats carved out of the
  shell (whole-triangle degeneration) and rebuilt dynamic: pump to amp 0.88,
  jump-off LAUNCH with tangential carry. Slides: exit-prompted scripted
  glide, top/exit read from vertices. avatar.tilt (YXZ) leans the kid.
- **`7920ab0` fishing:** whole pond bank fishable (water-distance annulus),
  marker AT the waterline, rod carried on the shoulder in the zone.
- **`3700ce0` playground: seesaw + 4 spring riders rideable, hula hoops**
  (code-drawn, twist-dance loop). Plus: multi-part props (coin rides) no
  longer wiggle apart — only true independents animate.
- **`6d857a0` drivable soapbox kart** (layout parts diverted into a rigid
  group; stepPlayer keeps running with speedScale → real collision at 6 m/s;
  parks where you hop out) **+ the fountain runs** (jet, drop ring, ripples).
- **`14aa6da` carved out SM_Wep_Makeshift_Gun_07** — a stray Synty toy gun
  baked into the shell behind a bush. Kids' park.

Still queued from the playtest: climbing (tire wall, ladders, treehouse) +
crouch, pond floatie seats, rideable bikes (same diversion pattern as the
kart), Tony Hawk-style skate mode, Minecraft-style hotbar/inventory.

## 2026-07-25 (deep night) — 3PT Showdown: your character takes the shots

Devon: "research Basketball Stars, then make 3PT as good as it — with the
characters doing the shooting." Research first (shooting race: perfect-power
tick, ON FIRE at 3 straight = bonus points until a miss, bank = risky
overshoot band that pays more, money balls, 60s), then the pass (`b42ce84`):

- **The equipped AMG kid shoots.** Same Polygon Kid as the 3D world, loaded
  from character.html's amgCharacterId mirror, driven by the SHARED RigV2
  player: Synty idle while aiming, charge crouch on the meter, the real JUMP
  clip as the jump shot, ball held in the actual Hand_R bone (flight launches
  from the hand). Reactions via the 58-emote system: fistpump/amped on hot
  makes, facepalm on bricks. Capsule-person kept as placeholder/fallback.
- **rig_v2.setAssetBase()** — the world's rig player now works from ANY hub
  page (fetches resolve per-page). This is the pattern every game overhaul
  will use to put the kid on screen. First cross-page consumer proven live.
- **ON FIRE**: 3 straight → double points until a miss, ember trail + emissive
  ball + HUD banner. **Bank = 4** (> swish 3, gold bank 8) per the research —
  the purple band is the risky one; BANK! popups (BANK_TEXTS finally used).

Verified through the real mode flow (kidReady/rigOk/handBone true cross-page,
bank delta 4, fire swish delta 8 = (3+1)x2, miss extinguishes, no errors).
Jump-shot MOTION needs a composited frame — Devon's first play test will be
the eyes; everything under it is the world-proven rig machinery.

Same night, earlier: ecosystem discovery + name audit + AMG_HUB_ECOSYSTEM.md +
calling cards/emblems/odaPlayerCard (see entry below).

## 2026-07-24 (late night) — Ecosystem: discovery, name audit, calling cards & emblems

Devon: "figure out the whole ecosystem… two-tier shop… calling cards and
emblems… full send it." Three deliverables, all committed:

**Discovery first** (5-agent parallel inventory): mapped all 51 games + IP risk,
oda-core's full API, the complete auth flow (class code → classCodes lookup →
name pick, anon-auth bootstrap already live, teacher/parent = one engine with
accountType relabel, parentCode quick-check), both shop systems and their
5-slot identity bridge, and found that Devon's remembered "calling cards"
shipped as the Profile Card modal — data model intact on students/{id}.equipped.

**docs/AMG_NAME_AUDIT.md** (`3bcdb84`): 1 HIGH (Block Blast — collides with a
trademarked hit; propose "Blocksplode"), 6 medium (Floppy Bird→"Wing It",
Whack-a-Mole→"Mole Patrol", 2048→"Number Crunch" + internal dir names deferred
to overhauls since gameId keys Firestore collections). Most of the catalog was
already de-branded.

**docs/AMG_HUB_ECOSYSTEM.md** (`3bcdb84`): the reference — one-door auth (Just
Play anon + save codes / class code + PIN + join-class merge), two-tier shops
formalized, calling-cards plan, character rails, control matrix, economy notes,
Devon's 3-week build order. Flags the Drop4/connect4 cosmetics-namespace
re-buy issue for cutover.

**Calling cards + emblems SHIPPED** (`135488c`): odaPlayerCard in oda-core v2.0
— one shared card renderer (banner+emblem+avatar+border+name+title), 17
code-drawn CSS banners + 14 emblems in the shop with rarity pricing and
achievement locks, loadout preview IS the card, profile modal wears it.
Verified live on a second dev server (this session's own): 17 live banner
previews, renderer produces cc-royal + 🐐 + gradient title. Leaderboards adopt
the card as each game gets its quality overhaul.

OPEN next: world picker ↔ character.html ownership gap (world shows all 16
free); Wing It overhaul is the template game (rename + gameplay bar + card on
leaderboard).

## 2026-07-24 (continued) — "Don't stop": FISHING, play-as-It, map/help, coin magnetism

Devon: "keep going and make the world as good as you can." Five more commits,
each verified live before landing:

- **FISHING (`1e4a6c9`)** — the pond finally pays off. Fishing Spot marker on the
  south bank; E casts (baseball emote = the wind-up), bobber arcs out with a rod
  line from the Hand_R bone, then the little story: bobbing… teasing dip… the
  DIVE — E/click within 0.9 s hooks it. Ten catches (minnow → golden koi, an Old
  Boot, a Message Bottle whose four notes include one breadcrumb: "C.E. was
  here — 755 Broadway"), persistent fishing log under the badge grid, Angler /
  Master Angler badges, coins through the shared economy. E is routed so the
  zone prompt never double-casts; the sporty emote bin is pre-warmed so the
  first cast animates.
- **Play as the It (`798fb48`)** — the GDD's other seat. First runner win
  unlocks it (toast reveal); rounds then alternate roles. As the It you tag by
  touch, sprint to catch, and the kids RESCUE each other while you hunt — the
  verification round took 6 tags to freeze 5 kids. Clean sweep +20 coins.
- **Map + Help (`c7bcaf4`)** — activities now render on the minimap as icons;
  the Help modal teaches the real controls (click-to-look landed yesterday) and
  advertises the park's verbs. Caught in self-review: an HTML entity was
  U+1F3B0 SLOT MACHINE instead of U+1F3A0 CAROUSEL — wrong glyph for a kids'
  product; all entities now verified by Unicode name.
- **Coin magnetism (`61e8a11`)** — coins within 2.4 m fly to the player;
  respawns snap back to authored homes; distant coins never drift.

Full-system regression at the end: RigV2 + finite stride phase, 58 emotes
reachable, 5 NPCs, 17 dynamic props (14 ducks in-pond), 6 butterflies, tag and
fishing idle, wading at exactly 0.88, 30 coins, zero console errors. Unpushed.

## 2026-07-24 (overnight) — "Bring the world alive": ducks, FREEZE TAG, playing kids, butterflies

Devon (heading to sleep): "just try to cook… bring that whole thing alive…
physics, animations, everything," + the **Recess GDD** (asymmetric freeze tag on
a playground; the hang-out hub IS this world) as inspiration — not to build the
Steam game, but its soul. Six commits, every feature verified live before
committing (the pane stops rAF while hidden, so sims were driven manually
through the real code paths).

**Ducks (`1fcca78`)** — Devon's call: all 14 on the pond (golden-angle spread),
floating, lazily paddling between drift targets, facing where they swim, and
actually bobbing. 'Feed the ducks' marker moved to the real pond's bank; feeding
= beckon + crumbs splash + every duck in range paddles over and nibbles. Ducks
kicked out of the water waddle home.

**FREEZE TAG (`fe2d7be`)** — the GDD's loop at hub scale, solo-vs-AI on the NPC
kids (its own "anti-death floor" idea). world/js/tag.js: 3s countdown, 60s to
the bell; nearest 5 NPCs conscripted (1 It — red ring, faster than runners,
slower than a sprinting player — so YOU do the risky rescues). Tagged kids
freeze in an armsfolded hold with an ice ring; touch thaws (thanks/thumbsup,
brief immunity). Survive the bell: +15 coins + Unfrozen badge. Balance came from
simulation: pure nearest-target made the It ping-pong forever (an idle player
won untouched) → target COMMIT (lock until tagged or beaten by 4m) + 0.75x
player bias. Re-sim: idle player frozen twice, rescued twice by AI teammates.

**Kids play (`317606f`)** — NPCs chase and boot the balls (2-3 kicks then wander),
answer your emotes after a human half-beat (wave/clap/thumbsup/cheer/heart, 9s
cooldown), and walking into the rockers/seesaw gives them a real push that rings
down (~4s). The swings turned out to be baked static — push went to what animates.

**Sensory layer (`2e570d5`)** — six code-drawn butterflies (two triangles a wing,
closed-form figure-eights, flee when charged — skipped on low quality), soft
filtered-noise pond swashes near the water, impact-scaled ball thumps.

**Audit round (`bd64d7d`)** — 15-agent adversarial sweep over tonight's code:
9 confirmed, 1 refuted. Headline: TAG REENTRANCY — `active` excluded the 4s
'over' state, so mashing E after a round started a new one mid-celebration,
permanently orphaning conscripted NPCs (controlled=true forever; the crowd
skips them and refuses to retire them) and crashing on a stale _lock
(_freeze(undefined)). Kids WILL mash E. Also: victory-screen-while-frozen,
frozen kids still kicking balls (kick has a velocity floor), beached ducks
stranding, dead bob code, eaten emote-back replies, NPCs not slowing in water.
All fixed and re-verified live.

Not pushed — Devon's deploy call, as always. Full dawn regression green:
58 emotes reachable, wading 0.88, tag idle, 14 ducks in pond, 6 butterflies,
5 shelter boxes, zero console errors.

## 2026-07-23 (evening, later) — AMG World adopts the v2 rig: real 58 emotes + rebased locomotion (remote)

Follow-on to the Drop4-Hub "EMOTES SOLVED" entry below. That chat shipped the v2
kid rigs + absolute-quat emote bake; per `docs/EMOTE_SYNC_BRIEF.md` I converged
the WORLD onto the same one pipeline (answered its 3 questions first, stayed in
lane — no changes to `assets/characters/**`, `emote_lab.mjs`, `rig_to_glb.py`, or
`arcade/drop4/**`).

**What landed (all in the world's lane):**
- `tools/world/bake_locomotion_v2.mjs` — rebases the 7 locomotion clips
  (idle/walk/run/sprint/jump/fall/land) from `_unity_export/rig/locomotion_bindref.json`
  onto the v2 rigs, reusing emote_lab step-6's retarget math VERBATIM (copied,
  not imported, so emote_lab.mjs is untouched). Output: `world/assets/
  locomotion_v2.{bin,json}` (34 KB, absolute Int16 v2-local quats, same byte
  layout as the emote bins so one sampler reads both).
- `world/js/rig_v2.js` — ONE absolute-quat player: locomotion gait blend + an
  emote channel layered over it (upper-body override while moving, hip offset
  along world-up). Same math as `arcade/drop4/express.js`, extended with the
  multi-clip locomotion base. No deltas, no corr.
- `world/js/avatar.js` — `RIG` flag (default `'v2'`; `localStorage.amgWorldRig
  ='v1'` = full rollback) + `characterUrl()`; avatars load `assets/characters/
  v2/{id}.glb` and use `RigV2`. `npc.js`/`main.js` rewired (v2 emote ids, wheel
  points at the v2 library, boot preloads the 34 KB bake so no T-pose flash).

**Verification (real Chrome, in-page — the pane can't composite this):**
- Bake proof: my `idle` bake == the committed `assets/characters/emotes/idle.bin`
  BYTE-IDENTICAL (worst int16 diff 0) → same pipeline, not a divergent second one.
- Runtime rig (kid_hoodie): 22/22 bones driven; idle = arms-down (hands 0.52, NOT
  the T-pose 0.87), feet on ground; walk = real stride, head steady 0.96 (no
  collapse); **armsfolded folds** (hands 0.75/0.79 at chest — the exact pose that
  flew overhead on the old rigs); wave raises Hand_R 0.52→1.09.
- Real `Avatar` path: `RIG='v2'`, `rig` is `RigV2`, materials clean (emissive 0,
  maps bound); offscreen render = 17.3% coverage, colored, **0% black pixels**.
- No console errors. `check_v2_skeletons.mjs` ✓, `arcade/drop4` tests 60/60 ✓.

**Retirable after Devon A/Bs on device** (kept this session as the `v1` rollback,
not deleted): `world/assets/emotes/*` (old delta bins), `emotes.js` EmotePlayer +
`CLIP_EMOTES_ENABLED`, the `corr`/`solveFrameCorrections` emote use, and the
delta locomotion in `clips.js`. Once v2 is confirmed on a real Chromebook, delete
those and drop the flag branch in `avatar.js`.

### Physics round (same session, Devon's walkaround feedback)

Devon walked the park remotely and reported: inverted W/S, hold-click-to-look,
Shift-run dead, invisible walls everywhere, back-from-game breaking immersion,
"needs more life / water physics". All addressed (`87b6fb1`, `4aa7524`, `2350721`):

- **W/S inversion**: stepPlayer's basis was the camera BOOM direction (points
  player→camera), so W walked INTO the camera. Verified against
  camera.getWorldDirection() at 6 yaws: W = +1.00 forward everywhere.
- **Free mouse-look**: pointer lock — click once, mouse looks, Esc releases;
  wheels/modals release it automatically. Touch unchanged.
- **Shift-run**: never intermittent — `d > 0.85` auto-run (a touch-stick
  affordance) made keyboard ALWAYS run, so Shift changed nothing. Stick-only now.
- **Invisible walls**: renderer-bounds AABBs. Tree canopies spanned up to
  10.95x12.28 m down to the ground; 36.1% of the park was blocked. Boxes now
  refined by prop kind (trees→0.45 m trunks, foliage/clutter/pickups/water→none):
  10.1% blocked, 544 m2 reclaimed. Same disease found twice more: the pond rock
  RING's AABB was a phantom 0.3 m floor over the whole pond, and the gazebo's
  AABB walled off the shelter (now 4 posts + steppable plinth).
- **Back-from-game**: world sets a one-shot sessionStorage marker; oda-core
  repoints every game's Back button at the park. Without the marker all 49 games
  behave exactly as before (verified both directions).
- **Physics layer** (`world/js/physics.js`): the layout's own 3 balls + 14 toy
  ducks (a flock around the fountain — surprise from the data) are now dynamic:
  kick balls (NPCs kick too), bounce off collision, float with a wake in the
  pond; duck bobs. Wading slows to 0.55x with splash + ripples; landing puffs
  dust. All measured live (wade speed exactly 0.88, duck at surface, no errors).

OPEN OBSERVATION for Devon: the 'pond / Feed the ducks' ACTIVITY marker sits at
(-9.5,-4), but the actual pond is at (21,0) r~8 and the duck flock is around the
fountain (-8,8.5). The marker may be pointing at grass — didn't move it without
knowing the intent. Next obvious build: fishing at the real pond (cast → wait →
catch table → collection), now that the water is real.

### Polish round (same session) — 5 more commits

Ran a 5-dimension adversarial audit over `world/` (18 agents: find → refute).
13 findings, **11 confirmed, 2 refuted** — and the refutations were the sweep
working: both were already-fixed issues the verifier correctly read as fixed.

- **P0, my own regression** (`8a256e5`): `footsteps()` gates the step tone on
  `p.rig.phase`. v1's RigAnimator had it; RigV2 didn't — so
  `Math.floor(undefined/π)` is NaN, `NaN !== NaN` is always true, and the tone
  fired **every frame** while walking. `odaSfx.tone()` has no throttle and builds
  a fresh oscillator per call: an audible buzz plus ~60 WebAudio nodes/sec on the
  target Chromebooks. RigV2 now tracks `phase` (2π per gait cycle); `footsteps()`
  bails on a non-finite phase so this class of bug can't recur. Measured: 3s of
  walking now fires **11 triggers, was 180**; standing fires 0.
- **Wheel layout** (`c1f9660`): unscoped v1 `.wheel button` rules out-specified
  the v2 wheel (0,1,1 vs 0,1,0), pinning buttons to 58px inside 79px cells and
  rendering tab icons at 25px so they spilled over neighbours. Scoped to
  `.wheel.wheel-grid`. The tab row also scrolled horizontally with the scrollbar
  hidden and no affordance — at phone width **38 of 58 emotes were unreachable**;
  it now wraps to two rows. Unselected tab text --text3 → --text2 (~1.9:1 → ~3.9:1;
  still short of 4.5 AA — a panel-opacity call left to Devon).
- **Honesty** (`abd1a68`, `b2a5498`): Show-off ("try *every* emote") unlocked at 8
  of 58 because the threshold came from the 8 procedural fallbacks; category tabs
  rendered "undefinedHello" because the v2 bake stores icons per emote, not per
  category.
- **Presence** (`a975f67`): join-then-drop mid-download left a frozen ghost avatar
  inflating the player count; favourites could hold stale v1 ids that desynced
  the digit-key row from the visible buttons; and `MAX_RENDERED=24` + `visible()`
  were never called despite world.js's draw-call budget assuming them. All fixed;
  the cap is guarded so it's the old path exactly below 24. Remote-race and cap
  paths are reasoned, not exercised — multiplayer is off until RTDB exists.

## 2026-07-23 (evening) — EMOTES SOLVED: 58 Synty clips live on all 16 kids (remote, Devon at work)

Devon flipped this chat to Fable 5 and asked for "a real shot" at the emote
blocker. It's solved — offline, no supervised Unity session, no package installs.
Drop4 Hub now has a working **Express Mode** (🎭 card → stage + 6-category wheel →
real clip playback), verified end-to-end in real Chrome with screenshots.

**How the blocker fell:**
- `_unity_export/rig/locomotion_bindref.json` turned out to hold the SAME 7
  locomotion clips as the shipped idle-referenced bake, in BIND reference — a
  ground-truth pair. That let the idle→bind conversion be PROVEN (worst error
  0.016° = quantization) before touching emotes. The old "arithmetic conversion
  → 3/58" was a composition-order bug (wrong order = 151° error).
- New retarget (tools/world/emote_lab.mjs, zero-dep Node with its own GLB
  parser/FK): world-space per-bone transfer W_tgt = M(W_U·BindW_U⁻¹)·BindW_tgt,
  M = mirror-X, per-bone constant absorbs Blender's bone-frame roll. Judged by
  RENDERED FRAMES (puppeteer + system Chrome), per the doc's own warning that
  the hand-height metric misleads.
- All 16 characters re-exported from the RUNNING Unity via MCP (binary FBX via
  the ExportModelOptions overload — the default writes ASCII, which Blender
  rejects; the property is named ModelAnimIncludeOption, type Include).
  Superheros crashed Blender's FBX importer → fixed by trimming the prefab to
  its kept parts in Unity BEFORE export. rig_to_glb.py also gained a fix for a
  CYAN emissiveFactor the FBX import carried from Unity (washed characters blue).
- Result: `assets/characters/v2/*.glb` — 16 rigs, 190-540 KB, bind = Unity
  T-pose exactly, skeletons bit-identical → ONE bake serves all 16.
- `assets/characters/emotes/*.bin` — 58 emotes, 724 KB, ABSOLUTE v2-local quats
  (format 'v2local'), per-category lazy-load. Player: `arcade/drop4/express.js`.

**Verified:** pose grid renders (armsfolded folds, wave is right-handed, dab
dabs, textures correct) + live Express screen screenshot mid-wave + engine/career
suites still 60/60 green.

**World adoption path** (documented in EMOTE_RIG_ISSUE.md RESOLVED header):
point avatars at the v2 rigs, play the v2local bins directly, retire the
corr/delta path + CLIP_EMOTES_ENABLED gate. Locomotion rebase = same lab.
world/js deliberately untouched — that's the world chat's lane.

**Final polish round (same evening):**
- **Idle base layer** — baked the real Synty standing idle (53f @30fps, 9 KB,
  from the bind-referenced locomotion in `locomotion_bindref.json`) and made it
  Express's base layer: the character NEVER shows a T-pose; emotes blend over
  idle and blend back to it. `manifest.idle` + `idle.bin`.
- **Victory celebrations** — the result screen now shows the equipped character
  playing a random happy emote on a win (cheer/fistpump/dab/…), a kind shrug on
  a loss, checkwatch on a draw. `mountCelebration()` in express.js, mounted by
  showResult, torn down on navigation. THE cosmetic loop paying off in-game.
- **Idling home hero** — the home screen character is the v2 rig breathing the
  real idle (falls back to the static shipping model if express can't load).
- express.js refactored around one shared rig player (idle + emote channels);
  playing-state gold highlight on emote buttons; tab click SFX.
- Verified in real Chrome: Express idle stance (no T-pose), loss-shrug result
  screen from a real played match, superhero2 (trimmed) + dino onesie pose
  grids all correct, mobile 375px no-overflow with Curtsy mid-pose, 60/60 tests.

## 2026-07-23 — Drop4 → AMG Hub conversion (full build, autonomous, Devon at work)

Built the AMG Hub (nonprofit, educational, Chromebook) edition of Drop4 as a new
vanilla-JS + Canvas + three.js game at `arcade/drop4/`, on Firebase project
oda-hub-d4bef. `Desktop/Drop4` treated as read-only reference throughout — zero
commits there, zero imports back, isolation grep clean. Unlisted (not in
`js/oda-games.js`) so nothing shows to students until cutover. Branch
`drop4-hub-conversion`, not pushed. Ran in parallel with the amg-world chat;
stayed entirely in `arcade/drop4/` + `docs/` to avoid conflicts with its `world/`
WIP.

**Shipped, all verified in-browser at :3456:**
- Ported Drop4's pure brain out as framework-free ES modules: `engine.js`
  (connect-N rules + power pieces, zustand stripped → pure resolvers), `ai.js`
  (minimax), `career-data.js` (180 levels/15 cities, sim-tuned difficulty, gems→
  coins, species→character), `rarity.js`. 60 zero-dep Node tests green.
- `visuals.js` — Canvas piece-orb finish ramp (no white shine), slab board +
  holes, staged scene backdrops, 26 board themes + 15 piece skins.
- `game.js` — match driver: input, AI scheduling, boss scripts (Tommy parity /
  Sal flip / Warden seed — Tommy enforcement verified), timer, moves-limit,
  power pieces, drop/land/win-cascade FX.
- `characters.js` — 16 Polygon Kids picker via `amg-character-viewer.js`,
  mirroring `character.html`'s shared cross-game identity. Synty "Kits" removed.
- `shop.js` — single-coin economy, NO gems/ads/IAP, learn-to-earn nudge.
- `career.js` — Candy-Crush map (180 nodes/15 bosses), power-piece + character
  unlocks, level→match runner with intro cards.
- `index.html` — Hub shell (3D hero, VS Computer, Career, Characters, Shop,
  Records) on oda-core; 12 achievements, win effects, help, SFX.
- Internal `gameId:'connect4'` for data continuity (this REPLACES the connect4
  tile at cutover — repoint one registry line, reversible).

**Verified headlessly** (pane can't composite WebGL): 60 Node tests; in-browser
full match (click→drop→AI→win→result stars:3); career map 180 nodes/15 bosses;
Tommy parity rejects illegal taps; shop renders 41 items; all character assets
fetch 200; clean console.

**Deferred:** Express real-emote playback (Polygon rig re-export is
supervised-only — same blocker the amg-world chat diagnosed), Drop Rush minigame.

**Reusable pattern captured:** `docs/AMG_HUB_GAME_CONVERSION_STANDARD.md` — apply
to Tic Tac Toe and every other game next.

## 2026-07-23 — Emote diagnosis, Unity rescue, AMG World enrichment (remote-control day)

Devon out at work; drove the session by remote control. Branch `amg-world` in
`Desktop\ODA` (still unpushed — pushing = deploy, Devon's call). The Drop4→Hub
conversion is running IN PARALLEL in another chat (Phase 0 = pure connect-N
engine + AI + 41 tests landed on this branch as 913f3ee); this session stayed in
the AMG World / shared-hub lane to avoid conflicts.

### Emote clip transfer — precise final diagnosis, then parked
Isolated the failure with a NUMERIC test (bone world positions vs a Unity
ground-truth sample, in cm) instead of screenshots, which had misled repeatedly.
On the re-exported rig (bind POSITIONS match Unity exactly), "arms folded"
retargets the whole BODY to <5cm but the arm chain is off 20-30cm. TWO
independent retarget methods (local-frame delta + world-space delta) fail
IDENTICALLY on the arms → the fault is the data, not the math: Blender's
FBX→glTF round trip rolls the horizontal arm bones (armature bones must point
down their length), so hand positions match but bone frames don't. Fix =
Unity-native glTF exporter (gltfast), deferred to a supervised session (package
installs already caused one safe-mode incident today). Procedural emotes ship
and work. Full detail in docs/EMOTE_RIG_ISSUE.md.

### Unity safe-mode rescue
The Base Locomotion pack's Samples/Scripts/ (a demo controller) references the
new Input System with NO #if ENABLE_INPUT_SYSTEM guard, so with the package
absent it wouldn't compile and dropped the whole AMG Engine project into safe
mode (taking the MCP bridge down). Deleted Samples/Scripts/; clips live under
Animations/ so nothing was lost. Documented in tools/world/bake_locomotion.md.

### AMG World — NINE enhancements (all verified in real Chrome, committed)
- **NPC crowd** — wandering ambient kids so a solo park (everyone, 0 users) feels
  alive. Never counted in the live-player number (honest); no chat bubbles;
  scale down as real players arrive + by quality. Fixed a real Avatar bug:
  non-local avatars ran remote-interp unconditionally, dragging NPCs to origin.
- **Ambience** — generative wind + birds (WebAudio, no files, honours the toggle).
- **Onboarding coach** — one-time move→coins→zones→express, touch/kbd-aware,
  non-blocking.
- **Park achievements** — 8 badges via shared odaAchievements, counters persist,
  shown in the Help panel.
- **Character viewer rest-pose** — POLYGON Kids rest A-posed; the viewer now drops
  arms down (fixes the picker's first impression + the hub landing hero).
- **Coin combo** — streak juice on the most common action, bounded so it can't be
  farmed, milestone bonuses + confetti.
- **Sound mute toggle** — the world lacked one; now syncs odaSfx + ambience.
- **Daily park bonus** — first visit each day, bonus coins scaling with a visit
  streak (10→40, resets on a missed day); gold reward banner + confetti.
- **Hidden star hunt** — 5 glowing stars tucked across the park; find all → Star
  Hunter badge + big reward. The Poptropica discovery loop, distinct from coins.

### Also
- Sent a fresh Drop4→Hub bridge prompt to the "Drop 4 submission audit" chat, and
  surfaced that a complete conversion plan already existed at
  docs/DROP4_HUB_CONVERSION.md (from an earlier round) — Devon can paste it into
  the fresh chat without waiting.
- Re-verified the "games missing in-game cosmetics" audit gap: 13 of 14 were
  false positives (they read via myCosmetics[...]); only racers genuinely differs
  (its own garage). Games are in good shape.
- The parallel Drop4-hub conversion advanced well on this same branch: Phase 0
  (engine+AI, 41 tests) → full playable core (engine/AI/board/characters/economy/
  career) → achievements+Express. In arcade/drop4/ — left untouched to avoid
  conflicts; my work stayed in world/ + shared oda-core.

### Verified end-to-end
Fresh entry → picker (arms-down) → world → onboarding → NPCs + ambience →
coins/combo → achievements → sound toggle → solo presence. Zero console errors.

## 2026-07-23 — Synty animation + win effects (continued overnight session)

Continues the 2026-07-22 session below. Branch `amg-world`, still unpushed.

### Real animation replaced the sine waves
Devon already owned `ANIMATION_Base_Locomotion` — it was in `Downloads/`, just
never imported into the AMG Engine project, which is why searching the project
for walk/run clips came up empty and I nearly had him buy it again. Imported it
(1694 clips now, 346 POLYGON locomotion).

Baked 7 clips (idle/walk/run/sprint/jump/fall/land, 127 KB) onto the kid rig.
The kid characters and the Synty packs share an identical bone hierarchy and the
PolygonKids rig is a valid Mecanim humanoid, so Unity's own retargeter maps an
adult clip onto a 1.2 m child for free.

Two traps, both documented in `tools/world/bake_locomotion.md`:
- Bake DELTAS from the reference pose, not absolute local quaternions — the kid
  GLBs are centimetres with up along local Z, Unity's prefab is metres with up
  along +Y, and absolutes lay the character on its side.
- Deltas alone splayed the arms, because the rigs assign different local AXES
  per bone. Solvable from the two rest poses: `c_b = u_b^-1 * c_p * g_b`, then
  conjugate each delta into this rig's frame.

Movement speeds dropped 2.4/4.6 -> 1.6/3.4 m/s: measuring ankle travel puts the
walk clip at ~0.74 m/s on a kid's proportions, so adult speeds made the legs
whirl.

### Emotes: built, curated, and deliberately switched OFF
Baked 58 emotes from the two packs Devon already had imported, as Int16 binary,
one file per category, lazy-loaded (724 KB total; a kid who only waves downloads
83 KB). Tabbed wheel with a favourites row and digit shortcuts.

**Curation is a safeguarding decision** and is written down in
`tools/world/emote_allowlist.json`. The Synty packs ship gestures that must
never appear in a space where 9-13 year olds interact: the entire Taunt category
(it exists to mock another player), throat-slit, strangling, finger guns, the
Reproach set, drunk sway, and religious clips. 58 kept of 235.

**They don't transfer, so they're gated off** (`CLIP_EMOTES_ENABLED`). The bake
is provably correct — deltas match Unity byte for byte — but the exported kid
GLBs rest with arms DOWN (hands at 0.600) while Unity's bind is a T-POSE
(0.868). Head matches exactly, so spine and legs agree and only the arm chain
differs. The frame correction assumes the two rests are the same pose in
different axes, so it absorbs a real 103-degree pose difference and throws the
arms into the air. Three approaches measured against Unity ground truth; the
telling one is that re-baking against Unity's arms-down idle (8 cm from the
GLB's rest instead of 27 cm) barely helped — so the residual is in the arm
chain's BONE OFFSETS, not its rotations.

**Fix: re-export the kid characters from Unity so their rest matches the rig the
clips were authored against.** That's a change to Devon's character export
pipeline, not something to guess at from the runtime. Everything else is in
place and lights up when the flag flips. Full analysis: `docs/EMOTE_RIG_ISSUE.md`.

Locomotion is unaffected and live — its arm motion is small relative to rest.

### Win effects — the audit's biggest ecosystem win, now real
The shop sold 8 win effects and no game rendered any of them. Added
`odaWinEffect()` to oda-core (resolves + caches the student's equipped
cosmetics, warms on load, falls back for guests) and wired it into the
personal-best path of 8 more games. Verified live: 40 confetti elements spawn
and self-clean.

### Verified
- Gait blend clean at every speed; stride 0.25 m with proper foot lift
- Character stands, walks and runs correctly on real keyframes (screenshots)
- With clip emotes gated: procedural wheel works, locomotion live, no errors
- All edited inline scripts parse clean

### Open
- **Re-export the kid GLBs** to unblock 58 emotes (see EMOTE_RIG_ISSUE.md)
- Multiplayer still needs the RTDB instance + `firebase deploy --only database`
- Mobile still untested on a real device
- Foot-skate (`CLIP_SPEED` in clips.js) tuned from measurement, not by eye

## 2026-07-22 — AMG World + shared game systems (overnight session)

**Mission:** build AMG World (the 3D hub Devon described as Poptropica x Club Penguin x
PlayStation Home) and keep improving AMG Hub. Devon is doing the Drop4 -> AMG Hub
conversion in a separate chat; this session stayed out of that lane entirely.

**Branch:** `amg-world` off `main`. Not merged, not pushed — pushing deploys to
amghub.org, and that stays Devon's call.

### Commits this session
1. `da22552` AMG World: 3D hub park + the Synty -> web asset pipeline
2. `dd1f037` World entry point in the hub, RTDB presence rules, pipeline docs
3. `d675201` Shared achievements + SFX in oda-core; cleared the P0 audit queue
4. (this commit) world README + sprint log

### AMG World — what shipped
A working 3D park at `world/`, reachable from a new **World** tab on student.html.
Walk around as one of the 16 kid characters, collect coins, emote, use safe chat,
and walk into any of 6 zone portals to open a themed set of hub games.

Asset pipeline (`tools/world/`): the Synty POLYGON Kids demo scene is 1117 renderers
sharing one 2048^2 atlas. Unity bakes each vertex's atlas colour into a vertex colour
and writes OBJ; Blender converts to Draco GLB. The whole park is **1.34 MB with no
textures at all**, and the static shell is **one draw call**. Measured solo on medium
with shadows: 49 draw calls, 206k triangles.

The kid GLBs are rigged but ship no animation clips, and the POLYGON locomotion pack
isn't licensed here — so walk/run/idle/jump and 8 emotes are generated procedurally
from named bones. Costs no bytes, suits the genre, and the arm rest angles were solved
numerically against the real rig rather than guessed at.

### Key decisions (revisitable)
- **Presence rides Firebase Realtime Database, not Firestore.** A 2 Hz position feed is
  ~2.4k document writes per player per session; one class would burn the Firestore free
  quota before lunch. RTDB is bandwidth-priced and gives onDisconnect().
- **No free-text chat, ever.** Fixed phrase book; the wire carries only an INDEX into it.
  A hostile client can at worst make someone say "Nice one!". This is the single
  non-negotiable design constraint of the whole feature.
- **Presence nodes are keyed by anon-auth UID, not studentId** — that is what makes
  "you may only move your own avatar" enforceable in rules.
- Zone portals open a game *category*, not a fixed game, so the catalogue can grow
  without touching the world.
- Vertex-colour bake over texture atlas: near-identical look on Synty's flat swatches,
  zero texture download, zero texture memory.

### Shared systems added to `js/oda-core.js` (v1.8)
- `odaSfx` — Web Audio with a named sound library. **47 of the 49 games** had each
  hand-rolled the same getAudio()/playTone() pair.
- `odaAchievements` — defs, unlock toast, localStorage + Firestore persistence, rendered
  grid. Every game that had achievements had invented its own shape, which is part of
  why several had none at all.

Upgrading the remaining ~45 games to The Bar is now a short job per game.

### P0 audit queue — cleared
- **retrobowl** — sound on every action, 12 achievements, win effect. Also renamed the
  in-game title from "Retro Bowl" (a real commercial game) to **Gridiron Rush**, which
  is what the registry already called it.
- **bowling** — 12 achievements + win effect on a personal best.
- **coinminer** — Shop tab (coin skins + backdrops) priced in AMG coins.
- **racers** — the audit said "add shop", but the real problem was bigger: the garage ran
  an entirely private wallet and the game never wrote to `students/{id}.coins` at all, so
  a kid could play it all lunch and earn nothing toward the hub. Now pays AMG coins per
  run (capped) with the garage wallet left intact, plus 10 achievements and the win effect.

### Bugs found and fixed along the way
- **Site-wide CSP bug:** `worker-src` fell back to `default-src 'self'`, so blob: workers
  were blocked. three.js's Draco loader doesn't error on that — it **hangs forever**.
  Added `worker-src`/`child-src 'self' blob:`.
- `switchTab()` in student.js paired `tabs[i]` with `sections[i]` plus a hardcoded
  name->index map; adding a fourth tab silently mismatched the pairs. Now resolves by id.
- Bowling's strike-streak invariant lived in one caller, so a different path kept a stale
  streak alive. Moved into an `applyBall()` wrapper.

### Verified in Chrome (not the preview pane — it can't composite WebGL)
- Park loads, character walks, jumps, emotes; coins collect and credit; zone portal opens
  11 real multiplayer games; safe-chat bubble renders; world pauses/unpauses with modals
- With no RTDB instance provisioned: world runs solo and says so
- Bowling achievements driven through the real scorer via a new `window.__bowl` hook:
  streak 1, 2, resets to 0 on an open ball, then 1, 2, 3 -> turkey
- Coin Miner shop renders priced cosmetics and they visibly apply
- All edited inline scripts parse clean

### Open / next
- **Multiplayer is off until Devon creates the RTDB instance** and runs
  `firebase deploy --only database`. World is fully playable meanwhile.
- **Mobile untested on a real device** — touch stick and insets are implemented but
  browser resizing doesn't reproduce a phone.
- `tetris` still has no achievements (it was the shop/cosmetics exemplar) — now ~15 lines.
- World has no audio yet; `odaSfx` is right there.
- Playground structures are obstacles, not climbable.

## 2026-07-12 — The AMG Hub Overhaul (overnight session)

**Mission:** rebrand ODA Hub → AMG Hub (amghub.org), go direct-to-consumer, fix the two
long-broken things (login, cosmetics), reframe teacher tools as kid-solo Learn & Earn games.

**Branch:** `amg-hub` (main untouched; merging + pushing = deploy, Devon's call).

### Commits this session
1. `cd91abc` Checkpoint of ~3 months of uncommitted WIP (trademark renames, Gridiron Rush game, character-creator prototype)
2. `54bdcaf` Audit + plan docs (8-agent parallel audit of all 118K LOC)
3. `df082e0` Full user-facing rebrand + new public landing page + family-accounts UI
4. `e476314` Auth overhaul: session hygiene, anonymous-auth plumbing, hardened rules (staged), classCodes migration
5. `9627cb5` Cosmetics pipeline fix (root cause: equipped vs gameCosmetics tree mismatch) + every dead paid cosmetic implemented + Learn & Earn starter packs wired into 6 tools + coin hooks
6. (this commit) version bump + sprint log + launch checklist polish

### Key decisions (revisitable)
- Internal `oda-*` identifiers/collections stay; only user-facing rebrands (REBRAND_NOTES.md)
- `teachers` collection = guardians (accountType parent|teacher); Family Code == classCode
- Teacher portal = Parent Command Center via label swap for parent accounts
- Renames: Retro Bowl→Gridiron Rush, Jeopardy→Quiz Show (trademark defense)
- Retired from kid hub: Lemonade Day tool (employer program), Builder (author tool)
- Anonymous Firebase auth for kids (invisible), rules v2 staged NOT deployed — deploy order in AMG_HUB_LAUNCH.md

### Verified
- Landing page renders + all login panels flow (live Firestore round-trip tested)
- Stale/forged studentId → clean session-clear → re-login (tested in browser)
- Starter Quiz Show board plays end-to-end kid-solo (5x5 grid rendered, coin path intact)
- All edited pages parse clean (node --check on every inline script)
- 17 fleet agents (audit 8, rebrand 5, cosmetics/repairs 5, learn-earn 4 = 22 total), zero errors

### Open items for Devon
- Review gates + console/DNS steps: docs/AMG_HUB_LAUNCH.md
- Legal peek: pitch.html content still derived from an entrepreneurship curriculum frame (branding stripped)
- southeast-slime.html remains parked/unlinked (confirm what "Southeast" refers to)
- Post-launch: server-authoritative coin awards (Cloud Function) is the real anti-cheat fix

---

## 2026-07-21 — AMG Hub "Vivid Arcade" full visual overhaul (autonomous, Devon at work)

**Brief:** "Brand new thing, not ODA v2 — more color, overhaul all the UI, make it look
award-winning. And the 3D characters are cut off / look unfinished." Unity AMG Engine on :6400
available. Full autonomous authorization; deploy without pre-review.

**Shipped & deployed to https://amghub.org (3 pushes, all verified live in Chrome):**

- **Vivid Arcade theme** (`css/oda-theme.css`) — the keystone. Every page + all 48 games read
  this file's `var(--*)` tokens, so re-skinning via token VALUES (names unchanged) upgraded the
  whole platform at once. Deep violet-tinted dark base, brighter rainbow accents, `--brand-grad`,
  chunkier radii, stronger glows. New reusable kit: `.amg-bg` (animated aurora), `.grad-text`,
  `.amg-coin`, `.pill-tabs`, `.chip`, `.eyebrow`.
- **Character cutoff FIX** (`js/amg-character-viewer.js`) — `frame()` now fits both height AND
  width against the aspect ratio with padding (old `size.y*1.7` @32°FOV framed ~0.97× the model →
  clipped heads/feet) + re-frames on resize. Verified full-body across the whole hero cast + the
  character page (which was refactored off its own buggy inline three.js onto the shared viewer).
- **Landing** (`index.html` + `css/index.css`) rebuilt: nav bar, big Fredoka hero w/ rainbow
  "Level up.", stat row, live 3D character, registry-driven 12-tile featured grid, Learn&Earn
  multiplier badges, colorful parents cards. All login-panel IDs + JS hooks preserved.
- **Student hub** (surgical, no rewrite): per-game colors on arcade cards, rainbow Learn&Earn
  cards, gradient name, purple level badge, gold coin chip, brand-grad XP bar, colorful pill tabs.
- **Character page**: shared viewer + spotlight-glow stage.
- **Aurora bg** rolled out to shop, parent, guardian dashboard + all learning tools.

**Verified:** landing (desktop + mobile 375px, no horizontal overflow, responsive grids), character
page, hub (via harness), shop, Quiz Show, 4 arcade games (theme is CSS-only → cannot break game JS).

**Recommended next (needs Devon's input):** which specific games he considers "low quality" so I can
add Jetpack-Joyride-style juice like helicopter got — didn't guess blind. Optional: per-game color on
game *menus* (48 files, low incremental value since the shell already looks great).

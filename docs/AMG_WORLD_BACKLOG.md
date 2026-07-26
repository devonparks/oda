# AMG World — the backlog

**Start here.** This is Devon's outstanding list for the 3D park, written after
the 2026-07-25 build-and-playtest marathon. It carries the technical context a
fresh session needs so nothing gets rebuilt or rediscovered.

- **Repo / branch:** `Desktop\ODA`, branch `drop4-hub-conversion`.
- **Deploy = push.** `git push origin drop4-hub-conversion && git push origin
  drop4-hub-conversion:main` — main auto-deploys to **amghub.org**.
- **Live at** `/world/index.html`. Dev server: `.claude/launch.json` name
  `amghub2`, port 3457.
- **History:** `docs/sprint-log.md`, newest first. Read the top few entries.

> Devon's framing, verbatim: *"I want every vehicle to be driven… I want every
> single attraction to be interactable… once we get everything here interactive,
> then we could work on the multiplayer aspect."*

---

## 1. How to verify anything in this world

**The in-app browser pane freezes rAF, so the world never steps there.** Every
check in this project runs through real Chrome with puppeteer:

```bash
NODE_PATH="C:/Users/devon/OneDrive/Desktop/Drop4/node_modules" node <probe>.mjs
```

Boot flow: load the page → click **"Enter the park"** → wait for
`window.__world.state.player`. Debug hooks: `window.__world.tp(x, z)`,
`.stats()`, camera via `state.world.camYaw / camPitch / camDist`.

**Synthetic key events must be dispatched on `document.body`, not `window`** —
main.js's handler does `e.target.matches(...)` and `window` has no `.matches`,
so a window-targeted event throws before it reaches the handler.

**Measure, don't eyeball.** Nearly every real bug this session was found by
printing numbers (fill ratios, bone distances, mount heights, facing dots), and
several were *caused* by assuming instead of measuring.

---

## 2. Systems that already exist — reuse these, don't rebuild

### Animation clips
`tools/world/unity/AMGActionBaker.cs` (Unity menu **AMG > Bake World Action
Clips**) authors poses on the real Polygon Kid rig and writes
`tools/world/actions_bindref.json`. Then `node tools/world/bake_actions_v2.mjs
verify` retargets to `assets/characters/emotes/actions.bin` (+ a hidden
`actions` manifest category) and runs ~58 FK assertions.

- **19 clips today:** sit, sit_swing, swing_pump, slide_ride, sit_kart,
  sit_seesaw, sit_rocker, hula, fish_cast, fish_wait, fish_reel, climb,
  climb_top, ride_stand, bike_pedal, pogo, monkey, sit_table, spin_ride.
- Poses are **world-space aim directions + two-bone IK to contact points**,
  never Euler angles. Torso gets the real Synty idle residual (×3.5) for life.
- **All 816 Synty clips in the AMG Engine Unity project are reachable** through
  this route if a real captured clip beats an authored one. Devon owns Base
  Locomotion, Idles, and Emotes & Taunts. Crouch clips exist and are unused.
- **20 fps** — RigV2 plays the whole emote lane at the manifest's single fps.
- Render check: `node tools/world/bake_actions_v2.mjs poses` then
  `node tools/world/render_action.mjs`.

### Collision
`World._deriveCollision(geo, matrix, name, {clip, exclude, cell, band})` —
rasterises triangles into 25 cm columns, bands by height, greedy-merges, emits
thin boxes. Used for the ship, treehouse, fountain, swing frame, tent, gazebo,
every stairs box.

- Cells store **true geometry extents**, not grid-snapped bounds. Snapping
  inflates walls and eats doorways.
- **Standable = headroom** (air above), never footprint area. A long thin wall
  has plenty of area; that's how kids ended up climbing on walls.
- `noStand: true` boxes block but are not ledges.
- Derived boxes carry `derived: true` and **skip the name rules** — the rules
  refine the RAW Synty export only.
- `SHELL_STRUCTURES` table in world.js drives shell-clipped derivation;
  `maxH` clips above a roof (roofs need no collision and giving them some hands
  out a walkable ramp to the top).
- Player capsule: `KID_RADIUS 0.24`, `KID_HEIGHT 1.05` (collision.js), shared by
  player, NPCs and tag.
- Jump reach: `JUMP 5.4`, `GRAVITY -19` → apex **0.767 m**, + `STEP_HEIGHT 0.55`
  = you land on anything **≤1.32 m** above take-off.

### Rides and vehicles — `world/js/rides.js`
- `VEHICLE_FAMILIES` (world.js) diverts layout parts out of the static batch;
  `VEHICLE_DEFS` + `clusterParts()` (rides.js) group them into instances and
  assemble rigid bodies. 14 vehicles today.
- **Facing** = the assembly's long horizontal axis, with the steering part
  naming the front. **Wheels** each get a pivot at their own centre, spinning
  about their thinnest horizontal axis. **Seat** = the widest part's centre.
- Other kinds: `spinner`, `coinride`, `monkey`, `tableseat`, `swing`, `seesaw`,
  `rocker`, `hoop`, `slide` (walk-on, no prompt), `climb` (shape-detected).
- Seat constants live in `rig_v2.js`: `BIND_PELVIS_Y 0.5437`,
  `SEATED_HIP_OFFSET -0.261`, `SEATED_PELVIS_Y`, `BUTT_BELOW_PELVIS 0.105`.
  **The hip offset is applied along WORLD up**, so a tilted seat must decompose
  `pelvis = pos + R(tilt)·(0,BIND_PELVIS_Y,0) + (0,SEATED_HIP_OFFSET,0)`.

### Inventory — `world/js/inventory.js`
Pure module (no THREE, no DOM). 8 hotbar + 16 backpack, merging stacks,
localStorage. Items: rod / hoop / ball + every fish as a keepsake. Three ways to
use the held item: **click** (needs `document.pointerLockElement`), **E** when
not at a zone, **tap the held slot** (the only one a tablet has).

---

## 3. Traps already paid for — do not re-learn these

| Trap | What happened |
|---|---|
| `enterZone` checks `zone.seat` before `zone.ride` | A ride zone carrying `seat` routed into the bench sit → undefined coords → **NaN player position → renderer dead**. Never name a zone key `seat`. |
| Early fishing press reeled in | Fine for E, fatal once *click* used the rod — every stray click cancelled the cast. |
| Overhang masks eat the heightfield | `Playground_Cover` shade sails mask the whole corner playground. "The heightfield has it" is not safe reasoning — check the mask before ruling a box `'none'`. |
| `setFromObject` inside a build loop | Reads `matrixWorld`; the group's own is still stale. **Measure in a second pass.** |
| Bounding-box top ≠ deck | The assembly's top is the HANDLEBARS. Scooter riders stood 1.63 m up. |
| Vehicle forward ≠ +Z | Measured error: kart −195°, pogo −71°, wagon 49°, scooter 33°, bike 20°. |
| Area rule + open/solid split | Splitting a band fragments the greedy merge; an area test then condemns every fragment (82% of the ship went wall-only). |
| Renderer per cell | Chrome's ~16 live WebGL context cap silently blanks the EARLIEST rows white. |
| The v2 GLB mirrors X | Y and Z are identical, so "forward" is still +Z, but `Hand_L` is at **+X**. |
| Python heredocs + `\u{...}` | Write patch scripts to a file; don't inline JS escapes in a bash heredoc. |

---

## 4. THE BACKLOG

### P0 — known broken / missing

1. **The purple Jeep is not rideable.** It's `SM_Veh_4x4` at **(−7.4, 17.9)**
   (+ `_SteeringW`, `_Wheel_fl/fr/rl/rr`). It is in `park_collision.json` but
   **NOT in `park_props_layout.json`** — its geometry is baked into the shell,
   which is why the vehicle pass missed it. Needs the *derive-from-shell* path
   (like the treehouse) to extract a rigid body, then the normal vehicle rig.
   Devon: *"the purple car next to the skate park, you can't drive that one."*
2. **Bike/scooter rider offset.** Rider-to-seat is 0.40 m out on the bike, 0.17
   on the scooter (kart 0.001, trike 0.024, board 0.039). The widest part is the
   frame, not the saddle.
3. **Pond edge.** Where water ends and dirt begins is still wrong.
4. **Confirm the pogo stick works** — Devon couldn't find it. It's at (7.5, 26.6).

### P1 — physics and feel

5. **Seesaw.** *"It should always lean towards the person on the ground because
   that's the side that weighs the most."* And it must work with **two riders**
   — this is multiplayer-facing. Currently a single-rider lever in
   `_updateSeesaw` (`up` from −1 to +1).
6. **Roundabout direction.** *"The way it works in real life is there's a little
   wheel in the middle, and you spin that wheel, and that makes the whole thing
   spin."* Needs a directional control, not just "hold a key".
7. **Skateboard.** Too fast. Wants a **push-off animation**, **tricks**, and
   **collision with the grind rails**. Tricks could pay XP.
8. **Hula hoops** stand upright and look wrong. Devon: *"I feel like that could
   just be an item you purchase."*

### P2 — new interactables

9. **Zip line** — `SM_Prop_Playground_Track_Ride_01` at (−0.5, 3.0, −1.8) with
   `_Handle` at (−2.0, 3.0, −1.8). Grab it and ride across. Devon floated
   "jump and press to grab" but said that may be too complicated — a simpler
   grab is fine.
10. **Pond floaties as vehicles** — get in, paddle around the pond, get out.
11. **Slide should have collision so you can walk UP it.**
12. **Tyres: a crawl state** to climb them, rather than one locked animation.

### P3 — movement, camera, UI

13. **"The majority of the activities should just work from walking. There
    shouldn't be a prompt."** Slides already work this way; extend the pattern.
14. **Camera zoom levels in third person.** *"When you go to the top of the
    playground before you go down the slide, you can't even see the big green
    slide."* He likes the current wide angle but wants to zoom in quickly —
    ideally a camera settings option, or stepped zoom levels alongside the
    existing `V` first/third-person toggle.
15. **General playground mobility.**

### P4 — bigger features

16. **Fishing economy** — sell fish for money, a shop. Ties into the existing
    hub coin economy (`awardCoins`).
17. **Background/skybox** — *"it's just a plane floating in the middle of
    nowhere, there's nothing around there."*
18. **Expand freeze tag** (`world/js/tag.js`). Devon's Recess GDD is the
    reference; the world's tag is its browser-scale seed.
19. **MULTIPLAYER.** Devon's explicit sequencing: after everything is
    interactive. Presence already exists (`world/js/presence.js`, RTDB, anon-auth
    UID keyed). The 4-seat picnic tables and independent bench seats were built
    with this in mind. **Safety rule, non-negotiable: no free-text chat, ever** —
    fixed phrase book, the wire carries only an index.

---

## 5. Open questions for Devon

- **Coin rides**: the three by the gazebo (dragon, car, rocket) currently rock
  in place, which is what a coin-operated kiddie ride does. Leave as is?
- **Hula hoops**: convert to a purchasable item and remove the fixed
  attraction, or fix the standing pose?

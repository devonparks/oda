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

> **2026-07-26 session: items 1–12 are DONE and deployed** (see sprint-log for
> the details and the traps found). New systems that session added, for reuse:
> - **Water MASK** (`_bakeWaterMask`): pond wading/ducks/casting follow the
>   drawn water edge exactly. `waterAt` is a texel lookup.
> - **Shell-carve vehicles** (`_extractShellVehicles` + `_carveShellTriangles`):
>   the Jeep and both Pool_Floats are carved from the merged shell and driven.
>   All-three-verts-in-box is the claim rule; a centroid test drags scenery.
> - **Seat offsets are vehicle-local** — a world-frame seat gets double-rotated
>   by the parked yaw (that WAS the bike/scooter offset, 2·|seat|·sin(yaw/2)).
> - **Seesaw sim lives on the seesaw** (two seats; an NPC kid is conscripted to
>   the free end — the `controlled` contract). Multiplayer plugs into
>   `seesawSim.riders`.
> - **21 baked clips** now (was 19): `board_push` (playhead driven off the
>   skateboard push cycle) and `crawl` (tyre wall + low clambers).
> - **Probe harness** `tools/world/probe_lib.mjs` (+ per-pass probes) — boots
>   the real park in real Chrome. NOTE: `camYaw` is the BOOM direction; a
>   synthetic W walks OPPOSITE to it.

### P0 — known broken / missing — ✅ ALL DONE 2026-07-26

1. ~~The purple Jeep is not rideable~~ — **DONE**: carved from the shell,
   drives (`axleFacing` — forward from the named front/rear wheel midpoints).
2. ~~Bike/scooter rider offset~~ — **DONE**: seat stored in the normalized
   local frame; measured 0.000 on all vehicles.
3. ~~Pond edge~~ — **DONE**: baked water mask; wading starts at the drawn edge.
4. ~~Confirm the pogo stick works~~ — **CONFIRMED working.** It's at
   (7.5, 26.6): tucked against the low wall between the skate park and the
   corner playground — hard to SEE (a 40 cm stick in a busy corner), not
   broken. If Devon still can't find it, consider moving it into the open.

### P1 — physics and feel — ✅ ALL DONE 2026-07-26

5. ~~Seesaw~~ — **DONE**: leans to the grounded rider, seats two, NPC playmate
   takes the free end and pushes back.
6. ~~Roundabout direction~~ — **DONE**: A/D spin it either way, W keeps it
   going, S brakes.
7. ~~Skateboard~~ — **DONE**: 1.7× with kick-pulse thrust + baked `board_push`
   clip synced to the surge; Space = ollie/kickflip (+2 coins, capped);
   landing on a rail box grinds along it.
8. ~~Hula hoops~~ — **DONE**: they lie on the grass. Still to become a shop
   item when the shop lands.

### P2 — new interactables — ✅ ALL DONE 2026-07-26

9. ~~Zip line~~ — **DONE**: boards from EITHER end (ledges under both), walk-in
   grab, Space drops, idle handle trundles to a waiting kid.
10. ~~Pond floaties~~ — **DONE**: carved from the shell, paddled on the water
    mask, ripples and all.
11. ~~Walk UP the slide~~ — **DONE**: standable ramp boxes along the ride path
    (deriving the chute's real triangles makes a headroom-rule WALL — don't).
12. ~~Tyre crawl~~ — **DONE**: `crawl` clip on the tyre wall (any height) and
    on low clambers (≤1.15 m).

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

## 5. Decisions Devon has already made

- **The gazebo coin rides stay as they are.** Dragon, car and rocket rock in
  place and do not travel. Devon: *"that's how they're supposed to be in real
  life."* Do not make them drivable.
- **Everything rideable eventually becomes a SHOP ITEM.** The vehicles, the
  hula hoop, and the rest of the toys are all destined for the hub shop. But:
  *"I just want to make it work, though, and then it all will be shop items."*

  **So: build the mechanics unlocked and working NOW.** Do not gate anything
  behind currency yet, and do not design a system that would fight a shop
  later. Concretely, keep "can I ride this?" a *separate* question from "do I
  own this?" — a single ownership check in front of the existing ride/zone
  path, added when the shop lands, should be the whole change. The inventory
  module (`world/js/inventory.js`) is already the natural home for ownership,
  and the hub already has a coin economy (`awardCoins`) and a shop
  (`odaShop` in `js/oda-core.js`) to hang it off.

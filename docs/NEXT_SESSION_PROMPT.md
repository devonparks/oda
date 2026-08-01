# Prompt for the next session — finish the playground

Copy everything below the line into a fresh Claude Code session.

---

Finish the playground in the AMG World Engine. Repo `Desktop\ODA`, branch
`drop4-hub-conversion`. Pushing to `main` auto-deploys to amghub.org.

**Read first, in this order:** `engine/README.md`, then the top ~8 entries of
`docs/sprint-log.md`, then `docs/AMG_WORLD_ENGINE_M6_BRIEF.md`. They contain
the architecture, the traps already paid for, and what is deliberately
unfinished. Do not re-litigate anything the log marks as settled.

**Then run the tour and LOOK at it before touching code:**

```bash
python -m http.server 3457
node tools/engine/probe_tour.mjs      # -> tools/engine/_shots/tour/index.html
```

Twelve captioned scenes of the whole park. Nine probes exist
(`probe_boot`, `probe_character`, `probe_props`, `probe_drive`, `probe_npc`,
`probe_backdrop`, `probe_library`, `probe_objects`, `probe_tour`). All are
green today. Run them before and after everything.

---

## Job 1 — strip every rideable vehicle out of the park

I do not want vehicles in the playground. Remove them from the map:
bicycles, trike, scooters, pogo stick, skateboards, the jeep, the soapbox.

**Exactly what to remove** — `SM_Veh_*` plus `SM_Prop_Skateboard_*`, and
their sibling part placements (wheels, handlebars, pedals, pegs, baskets,
training wheels, steering wheels):

```
SM_Veh_4x4              SM_Veh_Bike_01      SM_Veh_Scooter_01
SM_Veh_Soapbox_Racer_03 SM_Veh_Bike_02      SM_Veh_Scooter_02
SM_Veh_Trike_01         SM_Veh_Pogo_Stick_01
SM_Prop_Skateboard_01   SM_Prop_Skateboard_02
```

Measured: **88 placements** (14 main + 74 parts). The park goes from 1103
placements to **1015**. Use those numbers as the acceptance check.

**KEEP these — they are attractions or scenery, not vehicles:**
- the three coin rides (`SM_Prop_Coin_Ride_Car` / `_Dragon` / `_Rocket`) —
  they are spring-mounted playground attractions and I want them working
- the small scenery toys: pram, RC car + controller, toy truck, toy loader
- **ASK ME** about the sled, the red wagon and the two pool floats before
  removing them. They are ride-on toys rather than vehicles and I have not
  decided.

**How to remove it properly:** removals currently only live in
`localStorage` via the object layer (`objects.applyRemoved()` reads
localStorage; `objects.exportEdits()` prints JSON). That is not a permanent
map edit. Build a committed mechanism — a small file the engine loads at
boot and applies before collision and the prop database are built, so the
props genuinely do not exist rather than being hidden. Removed props must
not appear in the prop library, must not be mountable, and must leave no
collider behind.

Then delete what becomes dead: the `drive` motion type is only used by
these props, so `probe_drive.mjs`, the drive code in `props.js`, and the
drive rules in `tools/engine/seed_prop_db.mjs` all go with them. Do not
leave a half-removed system behind. (If you would rather keep the drive code
for a future shop-bought vehicle, say so and keep it — but say so.)

---

## Job 2 — make every playground interaction look right

This is the actual point of the session. What I said after playing it:

**Already good, do not touch:** sitting on the **bench**, and the **swing**.
The main playground structure works — walking, the stairs, the deck.

**Fixed since that playtest — verify, do not redo:** the seesaw now sinks
under a lone rider either end and remembers its tilt; the picnic table
seats on the bench instead of the tabletop; the roundabout rider faces the
hub; spring riders and coin rides use a real spring (restoring force,
damping, push to pump) instead of a fixed sine.

**Still to judge and fix — go through EVERY mountable prop and look at it:**
- the **coin rides** (dragon, car, rocket) — I said these were the biggest
  problem. They rock properly now; check the seating and the hands.
- the **monkey bars**, the **zip line / track ride**, the **slides**
- anything else in the gallery that reads wrong

`node tools/engine/probe_props.mjs` rides all 32 props, measures
butt-to-seat, hand/foot pin distance, limb angles and facing, and writes a
contact sheet to `_shots/props/index.html`. **The numbers are not the
acceptance — the pictures are.** A prop can measure 25 mm from its grip
with the elbow bent backwards through the joint; that exact thing shipped.

**How to fix a bad one:** author it in `engine/assets/prop_db.json`. Entries
marked `"authored": true` are never overwritten by a reseed. Measure the
real geometry first (there are examples in the log of measuring cabin floors
and bench planks off the vertex data) — do not guess and do not re-run a
global heuristic, which has broken working props before. Five entries are
already authored; follow their shape and leave a `seatNote` saying what was
measured and why.

---

## Job 3 — the spiral slide needs its own animation

`SM_Prop_Playground_Slide_05` at world (3.5, 0, −1.3) is the tall one that
**curves round in a loop** on the way down. Measured: 3.25 m tall, and its
centreline turns about 640° from top to bottom — its horizontal centroid
orbits the axis, which is what a helix looks like sliced horizontally. The
other three slides (01, 03, 04) are straight chutes.

Its database entry already admits the problem: `motion: { type: "slide",
path: "straight", pathStatus: "approx" }` — the rider is currently
interpolated in a **straight line** from the top mouth to the bottom mouth,
so on a spiral they cut through the outside of the tube.

What I want: the rider follows the actual curve of the chute, leaning into
it, and the animation reads as a spiral slide rather than a straight one.
Sample the real geometry for a centreline path (a list of waypoints down the
tube) and put it in the database rather than hard-coding it, so the same
mechanism works for any curved chute later. If the existing `slide_ride`
clip does not sell the lean, a new bespoke clip is fine — the recipe for
baking one through Unity is in `engine/README.md` and it is four steps.

---

## After that

One addition at a time, and I will pick the next one. Do not start new
systems without asking.

---

## Non-negotiable process

**Verify everything visually.** Drive real Chrome with puppeteer, walk up to
the thing, use it, screenshot it, and *look at the screenshot*.
`tools/engine/probe_lib.mjs` is the harness. The rule this project runs on:
numbers once said "on the chain" while the picture showed a hand holding
air, and the picture was right.

**A failing probe is not automatically a failing engine, and a passing
measurement is not automatically a true one.** Both have happened repeatedly
— a test plane buried under the grass made a whole sweep measure nothing; a
hard-coded expectation failed correct code after the thing it described was
fixed. Check the measurement before you fix the engine.

**Bump the build id** (`node tools/engine/bump_build.mjs`) with any change to
engine JS or assets, or I will be staring at a cached copy telling you it is
not fixed. The build id shows in the `F` stats line.

**Commit per milestone, keep `docs/sprint-log.md` updated including what
went wrong, and deploy each increment once verified**
(`git push origin drop4-hub-conversion:main`). Then check the live site, not
just localhost.

**Ask me before removing anything I did not list, and before adding any
system I did not ask for.**

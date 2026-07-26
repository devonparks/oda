# Removed for later — AMG World

Things that were built, then deliberately taken out of AMG World on
**2026-07-26**. Devon: *"get rid of all the vehicles… let's just focus on
making the map traversable and all the props working."* Nothing here was
broken beyond repair — the ride mechanics all worked; what kept failing was
making a rider's body sit convincingly on a small moving prop, and that was
eating every session.

**Everything below is recoverable from commit `63b7d22`** (the last commit
where it all shipped). `git show 63b7d22:world/js/rides.js` has the vehicle
implementation intact.

---

## 1. The rideable vehicle fleet

All of these still STAND IN THE PARK as scenery — they're back in the merged
static batch, exactly as they were before any of this. What's gone is the
ability to get on them.

| Thing | Where it is | What it did |
|---|---|---|
| Skateboards ×5 | skate park | sideways stance, kick-pulse speed, **ollie + kickflip** (paid 2 coins), **rail grinding** |
| Bikes ×3 | bike rack, sports field | pedalling clip, saddle mount |
| Trike | sports field | slower pedal |
| Scooters ×2 | skate park | `scoot_stand`, hands on the bars |
| Soapbox racer (kart) | west lawn | sit-and-steer |
| Red wagon | sports field | sit-and-steer |
| Pogo stick | (7.5, 26.6) | hop cycle |
| **Purple Jeep** | (−7.4, 17.9) by the skate park | carved out of the static shell, axle-derived facing, four spinning wheels |
| **Pond floaties ×2** | the pond | carved from the shell, paddled on the water mask with ripples |

### Why the Jeep and the floaties were extra trouble
They aren't layout props — their geometry is **baked into the merged park
shell**, so riding them meant carving triangles out of the shell at load. That
carve kept taking scenery with it (a rock, then a plant), because "which
triangles belong to this object" has no clean answer in a merged mesh. Two
fixes shipped (all-three-verts claiming, then connected-component filtering)
and debris still came back. **If these ever return, the right move is to fix
the SOURCE — re-export the Jeep and the floats as their own props — rather
than to carve harder.**

### What still exists and costs nothing to keep
- **Every baked clip**: `sit_kart`, `bike_pedal`, `board_stand`, `board_push`,
  `scoot_stand`, `ride_stand`, `pogo` are all still in
  `assets/characters/emotes/actions.bin` (23 clips) and still authored in
  `tools/world/unity/AMGActionBaker.cs`.
- **`clusterParts()`** in rides.js (still used by the attractions).
- **`World._carveShellTriangles()`** — the seed-and-flood shell carve, still
  used by the tyre carousel.
- `VEHICLE_FAMILIES` in world.js is an **empty array with the restore recipe**
  in its comment.

### To restore
1. Put the rows back in `VEHICLE_FAMILIES` (world.js).
2. Lift the vehicle block out of `git show 63b7d22:world/js/rides.js` —
   `VEHICLE_DEFS`, `_buildVehicles`, `_assembleVehicle`, `_mountXZ`, `_mountY`,
   `_beginVehicle`, `_updateVehicle`, `driving`/`speedScale`, `_railUnder`,
   `_beginGrind`, `_updateGrind` — plus the `'vehicle'` cases in `begin()` and
   `update()`.
3. Restore the main.js loop block that set `intent.speedScale` / `dismount`.
4. Re-add the `'none'` collision rules for `SM_Veh_4x4`.

---

## 2. Hula hoops

Two code-drawn rings on the lawn at (−5.0, −1.2), a `hoop` ride zone, a `hoop`
inventory item, its held-in-hand visual and its pickup. Devon had already
said the hoop should become a purchasable item rather than a fixed attraction,
so this is a step toward that, not away from it.

- The **`hula` clip is still baked** (hips orbiting, arms up).
- `Inventory._load()` drops unknown item ids, so a hoop saved in a kid's
  localStorage from the old build vanishes cleanly on next load.

---

## 3. Not removed — still in and working

Listed here because it's the obvious next question: **the park's fixed
attractions all stayed.** Swings, the four slides, the seesaw (two riders +
an NPC playmate), both roundabouts including the tyre carousel, the three
gazebo coin rides, spring riders, monkey bars, the zip line, picnic-table and
bench seats, the tyre-wall crawl, climbing, fishing, freeze tag, and the
crouch.

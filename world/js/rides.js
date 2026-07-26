/**
 * AMG World — the park's interactive playthings.
 *
 * NOTE (2026-07-26): the RIDEABLE VEHICLE FLEET — bikes, trikes, scooters,
 * skateboards, the wagon, the kart, the pogo stick, the purple Jeep and the
 * pond floaties — is REMOVED. Devon: "get rid of all the vehicles… let's just
 * focus on making the map traversable and all the props working." Everything
 * about that system (and the hula hoop) is catalogued in
 * docs/REMOVED_FOR_LATER.md, with the commit to lift the code back out of.
 * The props themselves still stand in the park as scenery.
 *
 * Swings: the Synty swing set is baked into the static shell, so its seats and
 * chains are surgically degenerated out of the merged mesh at load and rebuilt
 * as dynamic assemblies. Hop on, pump with W/S to go higher, jump off at speed
 * to launch — the dismount carries the swing's tangential velocity into a real
 * arc (Recess energy). The kid leans with the chains via avatar.tilt.
 *
 * Slides: prompts sit at each chute's EXIT (always reachable); riding runs a
 * scripted glide from the top point down a sagging quadratic path. Top/exit
 * points come from world.slideData (vertex analysis in world.js), so all four
 * slides work without a single hand-placed coordinate.
 */
import * as THREE from 'three';
import { getEmoteLibraryV2, BIND_PELVIS_Y, SEATED_HIP_OFFSET, SEATED_PELVIS_Y, BUTT_BELOW_PELVIS } from './rig_v2.js';

const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _tiltQ = new THREE.Quaternion();   // seesaw tilt, reused per frame
const _up = new THREE.Vector3(0, 1, 0);

// The swing frame (SM_Prop_Plaground_Swings_01) in world space, from the
// collision export: c=(27.5, 1.16, 25.0), e=(1.46, 1.22, 0.88). Bar along X.
const FRAME = { x: 27.5, z: 25.0, topY: 2.38 };
const BAR_Y = 2.16;          // chains hang from just under the top bar
const SEAT_Y = 0.55;         // seat rest height (matches the carved original)
const SWING_L = BAR_Y - SEAT_Y;
const SEAT_DX = 0.62;        // two seats, either side of centre
const CARVE = {              // seats + chains live here; legs and bar do not
  minX: FRAME.x - 1.05, maxX: FRAME.x + 1.05,
  // maxY 2.12, not 2.06: the baked chains are single strips whose TOP verts
  // sit at y 2.07 — one centimetre above the old box, so the all-verts carve
  // left every chain standing as a static double next to the dynamic ones
  // (Devon: "two black bars… one moves, one just stands still"). 2.12 catches
  // exactly the chains (measured: 56 tris) and no bar — every bar triangle
  // spans past the box in X and fails the carve anyway.
  minY: 0.18, maxY: 2.12,
  minZ: FRAME.z - 0.8, maxZ: FRAME.z + 0.8,
};
/**
 * The swing's frequency is the PENDULUM's, derived from its own chain length,
 * not a hand-picked feel number. w = sqrt(g/L). With L = 1.61 that is 2.47
 * rad/s (the old hand-tuned 2.35 was 5% slow). It matters because the kid's
 * pose is now driven off this same phase — a swing running at one rate and a
 * body running at another is exactly the "two different systems" mismatch.
 */
const SWING_FREQ = Math.sqrt(9.81 / SWING_L);
/** Amplitude a full-effort pump settles at — the pose blend's 100% mark. */
const PUMP_AMP = 0.88;
/** Where an un-pumped swing coasts down to — the pose blend's 0% mark, so
 *  coasting is the calm grip-the-chains sit and not a fraction of a pump. */
const COAST_AMP = 0.30;
const SLIDE_TIME = 1.15;     // s top→exit
/** How close to a chute's top counts as stepping onto it. */
const SLIDE_MOUTH = 0.62;
/** How far below a monkey bar a hanging kid's feet-origin sits. */
const HANG_DROP = 1.15;
// 5.2, up from 3.1: at 3.1 the plank FLOATED ("the physics still don't make
// sense") — a kid-laden seesaw drops fast and thumps. Push re-tuned to match:
// peak = v^2/(2*G), so 4.6 carries you from the ground (-1) to +1.03 — one
// good shove slams the far end down with a thump, which is the point.
const SEESAW_G = 5.2;
const SEESAW_PUSH = 4.6;
const SEESAW_MAX = 0.34;     // rad at either extreme

/**
 * Group loose layout rows into individual objects by proximity.
 *
 * A prop arrives as a FLAT list of sibling parts, so "which part belongs to
 * which instance" is a clustering problem. Single-link within `spread` metres.
 * (Written for the vehicle fleet, which is PARKED for now — see
 * docs/REMOVED_FOR_LATER.md — and still used by the attractions.)
 */
function clusterParts(list, spread = 1.4) {
  const pos = list.map((p) => new THREE.Vector3().setFromMatrixPosition(p.matrix));
  const seen = new Array(list.length).fill(false);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (seen[i]) continue;
    const group = [i]; seen[i] = true;
    for (let g = 0; g < group.length; g++) {
      for (let j = 0; j < list.length; j++) {
        if (seen[j]) continue;
        if (pos[group[g]].distanceTo(pos[j]) <= spread) { seen[j] = true; group.push(j); }
      }
    }
    out.push(group.map((k) => list[k]));
  }
  return out;
}
/** How far above your feet a ledge can be and still be climbable. */
const CLIMB_REACH = 3.4;
const CLIMB_SPEED = 1.15;    // m/s up the rungs

export class Rides {
  constructor(world, state) {
    this.world = world;
    this.state = state;
    this.zones = [];
    this.swings = [];
    this.active = null;      // { kind:'swing'|'slide', ... }
    this.launch = null;      // airborne carry after a swing dismount
    this._buildSwings();
    this._buildSlides();
    this._buildPlayground();
    this._buildAttractions();
    this._buildMonkeyBars();
    this._buildTableSeats();
    this._buildZipline();
    // Warm the ACTIONS bin: every ride below plays out of it, and a lazy fetch
    // on the first hop-on would swallow the pose for a beat.
    getEmoteLibraryV2().then((lib) => lib && lib.loadCategory('actions').catch(() => {}));
  }

  get busy() { return !!this.active; }

  // ── swings ────────────────────────────────────────────────────────────────

  _buildSwings() {
    // 1. carve the baked seats/chains out of the shell (degenerate whole
    //    triangles only — collapsing single verts would smear slivers).
    let shellMesh = null;
    this.world.shell.traverse((o) => { if (o.isMesh && !shellMesh) shellMesh = o; });
    if (shellMesh) {
      this._carve(shellMesh, CARVE);
      // One stray Synty prop is baked into the shell: SM_Wep_Makeshift_Gun_07,
      // a toy gun tucked behind the bush at (-14.3, 16.2). Not in a kids'
      // park — carved out. (Box from the collision export, slightly padded.)
      this._carve(shellMesh, {
        minX: -14.42, maxX: -14.10, minY: 0.67, maxY: 0.93, minZ: 16.03, maxZ: 16.37,
      });
    }

    // 2. dynamic replacements
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.55, metalness: 0.35 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xd9483b, roughness: 0.8 });
    const chainGeo = new THREE.CylinderGeometry(0.02, 0.02, SWING_L, 6);
    const seatGeo = new THREE.BoxGeometry(0.5, 0.055, 0.26);
    for (const side of [-1, 1]) {
      const group = new THREE.Group();
      group.position.set(FRAME.x + side * SEAT_DX, BAR_Y, FRAME.z);
      for (const dx of [-0.19, 0.19]) {
        const chain = new THREE.Mesh(chainGeo, chainMat);
        chain.position.set(dx, -SWING_L / 2, 0);
        group.add(chain);
      }
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(0, -SWING_L, 0);
      seat.castShadow = !!this.world.quality?.shadows;
      group.add(seat);
      this.world.scene.add(group);
      this.swings.push({ group, pivot: group.position, phase0: Math.random() * Math.PI * 2 });
    }

    this.zones.push({
      id: 'swing', ride: 'swing',
      icon: '\u{1F4BA}', name: 'Swing Set', prompt: 'Hop on a swing',
      pos: [FRAME.x, FRAME.z + 1.55], radius: 1.7,
    });
  }

  /** Degenerate every triangle that sits entirely inside the world-space box. */
  _carve(mesh, box) {
    mesh.updateWorldMatrix(true, false);
    const m = mesh.matrixWorld;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    const inside = (i) => {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      return v.x > box.minX && v.x < box.maxX && v.y > box.minY && v.y < box.maxY
        && v.z > box.minZ && v.z < box.maxZ;
    };
    let cut = 0;
    if (geo.index) {
      const idx = geo.index;
      for (let t = 0; t < idx.count; t += 3) {
        const a = idx.getX(t);
        if (inside(a) && inside(idx.getX(t + 1)) && inside(idx.getX(t + 2))) {
          idx.setX(t + 1, a); idx.setX(t + 2, a); cut++;
        }
      }
      idx.needsUpdate = true;
    } else {
      for (let t = 0; t < pos.count; t += 3) {
        if (inside(t) && inside(t + 1) && inside(t + 2)) {
          const x = pos.getX(t), y = pos.getY(t), z = pos.getZ(t);
          pos.setXYZ(t + 1, x, y, z); pos.setXYZ(t + 2, x, y, z); cut++;
        }
      }
      pos.needsUpdate = true;
    }
    return cut;
  }

  _beginSwing(player) {
    // nearest seat to where the kid is standing
    let seat = this.swings[0], best = Infinity;
    for (const s of this.swings) {
      const d = Math.abs(player.pos.x - s.pivot.x);
      if (d < best) { best = d; seat = s; }
    }
    this.active = { kind: 'swing', seat, phase: 0, amp: 0.22 };
    player.playAction('sit_swing');
    this.state.presence?.broadcast({ emote: 'sit_swing' });
    return 'Pump with W · jump off with Space!';
  }

  _updateSwing(dt, player, intent) {
    const a = this.active, s = a.seat;
    a.phase += dt * SWING_FREQ;
    const pumping = Math.abs(intent.move.y) > 0.3;
    const target = pumping ? PUMP_AMP : COAST_AMP;
    a.amp += Math.max(-dt * 0.10, Math.min(dt * 0.26, target - a.amp));
    const ang = Math.sin(a.phase) * a.amp;
    s.group.rotation.x = ang;

    // ── ONE SYSTEM ────────────────────────────────────────────────────────────
    // Devon: "the angle and the speed the character is swinging isn't the same
    // as the actual swing — make it one system instead of two."
    //
    // So the kid's pose is not an animation that happens to run alongside the
    // swing; it is a FUNCTION of the swing's own state. Two couplings do it:
    //
    //   PHASE — u = phase/2pi makes the pump clip's own sin(2*pi*u) equal
    //   sin(phase) exactly, so the legs shoot out at the BACK of the arc (max
    //   +ang; the kid faces +Z, so +ang is behind them) and tuck at the front.
    //   Set every frame, never free-running.
    //
    //   AMPLITUDE — the pump is blended over the calm grip-the-chains sit by
    //   amp/PUMP_AMP. Before, the clip threw its legs out at full stretch while
    //   the swing was still rocking gently, because the pose had no idea how
    //   hard the swing was actually going. Now a gentle sway IS a gentle pose
    //   and they arrive at full throw together.
    const dur = player.rig.overlay?.info?.dur || 1.2;
    player.rig.setEmoteTime?.('swing_pump', (a.phase / (Math.PI * 2)) * dur);
    player.rig.setOverlay?.('swing_pump', (a.amp - COAST_AMP) / (PUMP_AMP - COAST_AMP));

    // Where rotation.x REALLY puts the seat: child (0,-L,0) rotated about X
    // lands at z = -L·sin. The old +L·sin put the KID mirror-opposite the
    // seat — "swinging and crossing each other like pendulums" (Devon).
    const py = s.pivot.y - Math.cos(ang) * SWING_L;
    const pz = s.pivot.z - Math.sin(ang) * SWING_L;
    // Put the kid's PELVIS on the seat, not their feet near it — solved for THIS
    // tilt, so the kid rides the plank instead of drifting off it as the arc
    // grows. The avatar rotates about its own origin, but the seated clip's hip
    // drop is applied along WORLD up (see SEATED_HIP_OFFSET), so the two parts
    // decompose differently:
    //   pelvis = pos + R(ang)·(0, BIND_PELVIS_Y, 0) + (0, SEATED_HIP_OFFSET, 0)
    // Solving that for pos, with the pelvis joint sitting BUTT above the plank.
    player.pos.set(
      s.pivot.x,
      py + BUTT_BELOW_PELVIS - BIND_PELVIS_Y * Math.cos(ang) - SEATED_HIP_OFFSET,
      pz - BIND_PELVIS_Y * Math.sin(ang));
    player.yaw = player.targetYaw = 0;          // swing plane faces +Z
    player.tilt = ang;                          // lean with the chains
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    // creak at each peak once it's really going
    const peak = Math.cos(a.phase) * Math.cos(a.phase - dt * SWING_FREQ) < 0;
    if (peak && a.amp > 0.45 && window.odaSfx) window.odaSfx.tone(210 + Math.random() * 30, 0.09, 'triangle', 0.03);
    if (intent.jump) this._dismountSwing(player, a, ang);
  }

  _dismountSwing(player, a, ang) {
    player.rig.setOverlay?.(null, 0);
    const dAng = Math.cos(a.phase) * a.amp * SWING_FREQ;   // dθ/dt
    const v = -dAng * SWING_L;                             // seat z = -L·sin(θ), so dz/dt is NEGATIVE dθ
    player.tilt = 0;
    player.rig.stopEmote?.();
    this.state.presence?.broadcast({ emote: '_stop' });
    player.vel.y = 3.4 + Math.min(2.4, Math.abs(v) * 0.8);
    player.grounded = false;
    this.launch = { x: 0, z: v * 1.15 };
    this.active = null;
    window.odaSfx && window.odaSfx.play('whoosh');
  }

  // ── slides ────────────────────────────────────────────────────────────────

  /**
   * Slides have NO prompt. You walk to the top and go.
   *
   * Devon's playtest, once the stairs were climbable: "the most ideal situation
   * would be to get rid of the prompt to slide down. You go up the stairs, and
   * then you go to the top of the slide, press W, and it just triggers the
   * slide animation." He's right, and it's less code than the prompt was.
   *
   * It also quietly fixes the other half of his report — "the slide doesn't
   * have any collision" — without giving the chute any. A slide you can WALK on
   * is a ramp; the chute stays non-solid (its AABB wraps the whole diagonal, so
   * as a solid it's an invisible lid you land on) and the top catches you before
   * you can fall through the place where it isn't.
   *
   * The prompt used to sit at the EXIT, because back then the top was
   * unreachable. It is reachable now, so the exit marker has no job left.
   */
  _buildSlides() { /* no zones: entry is by walking, see _checkSlideEntry */ }

  /** Walked to the top of a chute, facing down it, actually moving? Then go. */
  _checkSlideEntry(player) {
    if (this.active || this.state.seated) return;
    if (!player.grounded || player.speed < 0.9) return;      // properly walking
    if (this._slideCool > 0) return;
    for (const d of this.world.slideData || []) {
      if (Math.hypot(player.pos.x - d.top.x, player.pos.z - d.top.z) > SLIDE_MOUTH) continue;
      if (Math.abs(player.pos.y - d.top.y) > 0.45) continue;
      // Heading DOWN the chute, and meaning it. The old gate (1.0 m, 0.75 m of
      // height slack, a 0.3 dot) fired while Devon was lining up for the ZIP
      // LINE further along the same platform: "when you try to stand up there
      // where you're about to go on the zip line, it just automatically makes
      // you go down the slide." Tighter on every axis now.
      const ex = d.exit.x - d.top.x, ez = d.exit.z - d.top.z;
      const el = Math.hypot(ex, ez) || 1;
      if ((Math.sin(player.yaw) * ex + Math.cos(player.yaw) * ez) / el < 0.72) continue;
      const line = this._beginSlide(player, { data: d });
      if (line) this.state.toast?.(line);
      return;
    }
  }

  _beginSlide(player, zone) {
    const d = zone.data;
    const p0 = new THREE.Vector3(d.top.x, d.top.y + 0.12, d.top.z);
    const p2 = new THREE.Vector3(d.exit.x, d.exit.y + 0.05, d.exit.z);
    // control point pulled below the midpoint: the path sags like a chute
    const p1 = p0.clone().lerp(p2, 0.5);
    p1.y = p0.y * 0.42 + p2.y * 0.58;
    this.active = { kind: 'slide', t: 0, p0, p1, p2 };
    player.playAction('slide_ride');
    this.state.presence?.broadcast({ emote: 'slide_ride' });
    window.odaSfx && window.odaSfx.play('whoosh');
    return 'Wheee!';
  }

  _updateSlide(dt, player) {
    const a = this.active;
    a.t += dt / SLIDE_TIME;
    const k = Math.min(1, a.t);
    const e = k * k;                       // ease-in: gravity, not an elevator
    const u = 1 - e;
    const x = u * u * a.p0.x + 2 * u * e * a.p1.x + e * e * a.p2.x;
    const y = u * u * a.p0.y + 2 * u * e * a.p1.y + e * e * a.p2.y;
    const z = u * u * a.p0.z + 2 * u * e * a.p1.z + e * e * a.p2.z;
    player.pos.set(x, y, z);
    player.yaw = player.targetYaw = Math.atan2(a.p2.x - a.p0.x, a.p2.z - a.p0.z);
    player.tilt = -0.22;                   // lean back into the chute
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    if (k >= 1) {
      player.tilt = 0;
      player.rig.stopEmote?.();
      this.state.presence?.broadcast({ emote: '_stop' });
      const g = this.world.collision.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.3);
      player.pos.y = g;
      this.world.fx.spawn(player.pos.x, g + 0.03, player.pos.z, { color: 0xcbb794, from: 0.2, to: 0.9, dur: 0.45, alpha: 0.4 });
      window.odaSfx && window.odaSfx.tone(170, 0.08, 'triangle', 0.07);
      this._slideCool = 1.2;         // don't instantly re-grab at the bottom
      this.active = null;
    }
  }

  // ── playground: seesaw and spring riders ──────────────────────────────────

  _buildPlayground() {
    const props = this.world.animatedProps || [];

    this.seesaw = props.find((p) => /Seesaw_01_Top/.test(p.userData.kind)) || null;
    if (this.seesaw) {
      const g = this.seesaw.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
      this.seesawAxis = sx >= sz ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      this.seesawHalf = Math.max(sx, sz) * 0.39;   // sit near the plank end
      /**
       * The plank's state lives on the SEESAW, not on this.active — a seesaw
       * with one rider is half a seesaw. `lift` is the +1 end's height, -1..1;
       * `riders` holds an entry per end (the player, an NPC kid today, a
       * remote player when multiplayer lands).
       */
      this.seesawSim = { lift: 0, vel: 0, riders: { '-1': null, '1': null }, npc: null, npcTimer: 0 };
      // The sim owns the plank PERMANENTLY. The old ambient sine (world.js)
      // made the seesaw sway on its own and amplified as you walked up — but
      // a real seesaw doesn't sway in the breeze, it RESTS with one end on
      // the ground, and the sim's empty-plank gravity gives exactly that.
      this.seesaw.userData.ridden = true;
      this.zones.push({
        id: 'seesaw', ride: 'seesaw', icon: '⚖️', name: 'Seesaw',
        prompt: 'Ride the seesaw', pos: [this.seesaw.position.x, this.seesaw.position.z], radius: 1.5,
      });
    }

    this.rockers = props.filter((p) => /Playground_Rocker_\d+_Top/.test(p.userData.kind));
    this.rockers.forEach((r) => { r.userData.saddle = this._saddleOf(r); });
    this.rockers.forEach((r, i) => this.zones.push({
      id: `rocker${i}`, ride: 'rocker', mesh: r, icon: '\u{1F40E}', name: 'Spring Rider',
      prompt: 'Bounce!', pos: [r.position.x, r.position.z], radius: 1.1,
    }));

    // (The hula hoops used to be built here — removed with the vehicles, see
    // docs/REMOVED_FOR_LATER.md. The `hula` clip is still in the actions bin.)
  }

  _beginSeesaw(player) {
    const m = this.seesaw, sim = this.seesawSim;
    _va.copy(this.seesawAxis).applyQuaternion(m.quaternion);
    let end = Math.sign(_va.dot(_vb.copy(player.pos).sub(m.position))) || 1;
    if (sim.riders[end]) end = -end;         // that end is taken — sit opposite
    if (sim.riders[end]) return null;        // both taken
    sim.riders[end] = { kind: 'player' };
    // your weight lands NOW: the plank starts moving your way the instant you
    // sit, even if your end was resting in the air (Devon: "I'm the only one
    // on it — I should be weighing it down")
    if (sim.vel * end > -1.6) sim.vel = -1.6 * end;
    this.active = { kind: 'seesaw', end };
    player.playAction('sit_seesaw');
    this.state.presence?.broadcast({ emote: 'sit_seesaw' });
    return 'Push off the ground to launch! Space to hop off.';
  }

  /**
   * A seesaw is a LEVER — and it seats TWO.
   *
   * Devon: "it should always lean towards the person on the ground because
   * that's the side that weighs the most" — and it has to work with two
   * riders, because that's what multiplayer will do to it. So the plank runs a
   * torque model on `lift` (the +1 end's height, -1..1): the heavier side
   * sinks under SEESAW_G, balanced riders coast on momentum with a light
   * bleed, and a push only works from the ground, like actually pushing off.
   * With one rider that reduces exactly to the old behaviour: your end falls
   * and stays down until you shove. With two, the pushes alternate and the
   * plank actually seesaws. Runs every frame the plank is occupied or still
   * settling, whether or not the LOCAL player is one of the riders.
   */
  _updateSeesawSim(dt) {
    const m = this.seesaw, sim = this.seesawSim;
    if (!m) return;
    const w1 = sim.riders['1'] ? 1 : 0, w0 = sim.riders['-1'] ? 1 : 0;
    sim.vel -= SEESAW_G * (w1 - w0) * dt;    // the heavy side sinks
    if (w1 && w0) sim.vel *= Math.exp(-0.35 * dt);   // two kids: bleed a little
    // EMPTY plank: it falls to whichever side it's already leaning and RESTS
    // there, one end on the ground — a seesaw's actual resting shape (it
    // used to settle level and sway, which is a mobile, not a seesaw)
    if (!w1 && !w0) sim.vel += (sim.lift >= 0 ? 1 : -1) * SEESAW_G * 0.5 * dt;
    sim.lift += sim.vel * dt;
    if (sim.lift <= -1) {
      sim.lift = -1;
      if (sim.vel < -1.2) this._seesawThump(1);    // the +1 end just hit
      sim.vel = Math.max(0, sim.vel);        // legs absorb the landing
    }
    if (sim.lift >= 1) {
      sim.lift = 1;
      if (sim.vel > 1.2) this._seesawThump(-1);
      sim.vel = Math.min(0, sim.vel);
    }
    if (!w1 && !w0 && Math.abs(sim.lift) < 0.04 && Math.abs(sim.vel) < 0.06) {
      sim.lift = 0; sim.vel = 0;
    }
    const ang = sim.lift * SEESAW_MAX;
    m.userData.angle = ang;
    m.quaternion.copy(m.userData.restQuat)
      .multiply(_tiltQ.setFromAxisAngle(m.userData.tiltAxis, ang));
  }

  /** A plank end hit the ground hard: thump + a puff of dust where it landed. */
  _seesawThump(end) {
    const m = this.seesaw;
    window.odaSfx && window.odaSfx.tone(95, 0.08, 'sine', 0.06);
    _va.copy(this.seesawAxis).multiplyScalar(end * this.seesawHalf / m.scale.x);
    m.localToWorld(_vb.copy(_va));
    this.world.fx.spawn(_vb.x, 0.05, _vb.z,
      { color: 0xcbb794, from: 0.2, to: 0.85, dur: 0.4, alpha: 0.45 });
  }

  /** Park a rider (player or NPC) on their end of the tilted plank. */
  _seatSeesawRider(end, avatar) {
    const m = this.seesaw;
    _va.copy(this.seesawAxis).multiplyScalar(end * this.seesawHalf / m.scale.x);
    m.localToWorld(_vb.copy(_va));
    avatar.pos.set(_vb.x, _vb.y + 0.02, _vb.z);
    avatar.yaw = avatar.targetYaw = Math.atan2(m.position.x - _vb.x, m.position.z - _vb.z);
    avatar.tilt = (m.userData.angle || 0) * end;
    avatar.speed = 0; avatar.vel.y = 0; avatar.grounded = true;
  }

  /** The local player's half of the seesaw: their seat, their pushes. */
  _updateSeesaw(dt, player, intent) {
    const sim = this.seesawSim, a = this.active;
    const upE = sim.lift * a.end;            // MY end's height, -1..1
    if (upE <= -0.985 && Math.hypot(intent.move.x, intent.move.y) > 0.3) {
      sim.vel = a.end * SEESAW_PUSH;         // shove off — only from the ground
      window.odaSfx && window.odaSfx.tone(150, 0.07, 'square', 0.05);
    }
    this._seatSeesawRider(a.end, player);
    if (intent.jump) {
      sim.riders[a.end] = null;
      this._exitToGround(player, this.seesaw.position);
    }
  }

  /**
   * The other end of the seesaw is a SEAT, and an NPC kid takes it.
   *
   * A one-kid seesaw is physically honest but emotionally wrong — the whole
   * toy is the other person. Until multiplayer, a nearby NPC is conscripted
   * (same `controlled` contract freeze tag uses: the crowd leaves them alone
   * and we drive their avatar), walks to the free end, hops on, and pushes
   * back from the ground on a kid-sized delay. When the player hops off, the
   * NPC does too and goes back to wandering.
   */
  _updateSeesawNpc(dt) {
    const sim = this.seesawSim;
    if (!sim) return;
    const playerEnd = this.active?.kind === 'seesaw' ? this.active.end : 0;
    const crowd = this.state.npcs;

    // recruit after the player has settled in for a moment
    if (playerEnd && !sim.npc && crowd) {
      sim.npcTimer += dt;
      if (sim.npcTimer > 1.6) {
        let best = null, bd = 15;
        for (const n of crowd.npcs) {
          if (n.controlled) continue;
          const d = n.avatar.pos.distanceTo(this.seesaw.position);
          if (d < bd) { bd = d; best = n; }
        }
        if (best) {
          best.controlled = 'seesaw';
          sim.npc = { npc: best, end: -playerEnd, phase: 'walk', pushT: 0 };
        }
        sim.npcTimer = -4;   // if nobody was near, look again in a few seconds
      }
    }
    const rec = sim.npc;
    if (!rec) { if (!playerEnd) sim.npcTimer = 0; return; }
    const av = rec.npc.avatar;

    // player left → the NPC hops off and goes back to wandering
    if (!playerEnd) {
      sim.riders[rec.end] = null;
      av.tilt = 0;
      av.rig.stopEmote && av.rig.stopEmote();
      av.pos.y = this.world.collision.groundAt(av.pos.x, av.pos.z, av.pos.y + 0.5);
      rec.npc.controlled = false;
      rec.npc.state = 'idle';
      rec.npc.timer = 1 + Math.random() * 2;
      sim.npc = null;
      sim.npcTimer = 0;
      return;
    }

    if (rec.phase === 'walk') {
      _va.copy(this.seesawAxis).multiplyScalar(rec.end * this.seesawHalf / this.seesaw.scale.x);
      this.seesaw.localToWorld(_vb.copy(_va));
      const dx = _vb.x - av.pos.x, dz = _vb.z - av.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.45) {
        rec.phase = 'ride';
        sim.riders[rec.end] = { kind: 'npc' };
        av.playAction('sit_seesaw');
      } else {
        const wantYaw = Math.atan2(dx / dist, dz / dist);
        let dy = (wantYaw - av.yaw) % (Math.PI * 2);
        if (dy > Math.PI) dy -= Math.PI * 2;
        if (dy < -Math.PI) dy += Math.PI * 2;
        av.yaw += dy * Math.min(1, 8 * dt);
        av.speed += (1.45 - av.speed) * Math.min(1, 8 * dt);
        const solved = this.world.collision.resolve(
          av.pos.x + (dx / dist) * av.speed * dt,
          av.pos.z + (dz / dist) * av.speed * dt, av.pos.y);
        av.pos.x = solved.x; av.pos.z = solved.z;
        av.pos.y = this.world.collision.groundAt(av.pos.x, av.pos.z, av.pos.y + 0.3);
      }
    } else {
      this._seatSeesawRider(rec.end, av);
      const upE = this.seesawSim.lift * rec.end;
      if (upE <= -0.985) {
        rec.pushT += dt;
        if (rec.pushT > 0.4) {               // a beat on the ground, then push
          rec.pushT = 0;
          this.seesawSim.vel = rec.end * SEESAW_PUSH;
          window.odaSfx && window.odaSfx.tone(140, 0.07, 'square', 0.04);
        }
      } else {
        rec.pushT = 0.15;
      }
    }
    av.update(dt, this.world.camera);
  }

  /**
   * WHERE THE SADDLE IS, measured — the one question every ride-on toy asks.
   *
   * A saddle is the DIP in a toy's top surface: the low point between the
   * dragon's head and its tail, between a car's windscreen and its boot,
   * between a rocket's nose and its fin. So: rasterise the prop's top surface
   * into 10 cm columns, keep the highest vertex in each, throw away the
   * columns that only see the base plate, and take the LOWEST of what's left
   * near the middle. That is the seat, on every one of these props, without a
   * single hand-typed height.
   *
   * (The old answer was the assembly's bounding-box top, which is a dragon's
   * horns and a car's steering wheel — kids perched on both.)
   *
   * @returns {THREE.Vector3|null} the saddle in the prop's LOCAL space, so a
   *          rocking prop carries its rider exactly.
   */
  _saddleOf(root) {
    const CELL = 0.1;
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    const R = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
    // ignore everything in the bottom 45% — that's the base/spring/plinth, and
    // a column that only sees it would win the "lowest" test every time
    const floorY = bb.min.y + (bb.max.y - bb.min.y) * 0.45;
    const cells = new Map();
    const v = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const k = Math.floor(v.x / CELL) + ',' + Math.floor(v.z / CELL);
        const e = cells.get(k);
        if (!e) cells.set(k, { y: v.y, x: v.x, z: v.z, n: 1 });
        else { e.n++; if (v.y > e.y) { e.y = v.y; e.x = v.x; e.z = v.z; } }
      }
    });
    // You sit ON THE SPINE of a ride-on toy, so the saddle has to be near its
    // long centre line — otherwise the lowest central column is a wing, a fin
    // or a running board, and the kid rides along beside the rocket.
    const alongX = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z);
    let best = null;
    for (const c of cells.values()) {
      if (c.n < 4 || c.y < floorY) continue;
      if (Math.hypot(c.x - cx, c.z - cz) > R * 0.6) continue;   // not the skirt
      if (Math.abs(alongX ? c.z - cz : c.x - cx) > 0.22) continue;   // on the spine
      if (!best || c.y < best.y) best = c;
    }
    if (!best) return null;
    return root.worldToLocal(new THREE.Vector3(best.x, best.y, best.z));
  }

  /**
   * Park a rider's ORIGIN so their backside lands on a seat at world `seatY`.
   *
   * One formula for every seat in the park, taken from the bench — the pose
   * Devon calls the good one. It sinks the kid 6.5 cm into the seat plane,
   * and that contact is exactly what reads as SITTING; sitting a rider
   * tangent to the surface (the old `BUTT_BELOW_PELVIS - SEATED_PELVIS_Y`
   * form) reads as hovering.
   */
  _seatOriginY(seatY) { return seatY + 0.04 - SEATED_PELVIS_Y; }

  /**
   * Which way a ride-on toy FACES, measured off its own shape.
   *
   * The rider used to inherit `group.rotation.y`, which is 0 for every
   * attraction (their parts carry their own baked matrices), so a kid on the
   * rocket sat side-saddle facing the park. A dragon, a rocket and a car are
   * all longer along their travel axis, and their FRONT is the taller end —
   * the head, the nose cone, the windscreen. A named steering part settles it
   * outright when there is one.
   */
  _frontYawOf(root, cluster) {
    const steer = (cluster || []).find((q) => /SteeringW|Handlebar/i.test(q.mesh));
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (steer) {
      _va.setFromMatrixPosition(steer.matrix);
      return Math.atan2(_va.x - cx, _va.z - cz);
    }
    const alongX = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z);
    let posTop = -Infinity, negTop = -Infinity;
    const v = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const t = alongX ? v.x - cx : v.z - cz;
        if (t > 0) { if (v.y > posTop) posTop = v.y; }
        else if (v.y > negTop) negTop = v.y;
      }
    });
    const s = posTop >= negTop ? 1 : -1;
    return Math.atan2(alongX ? s : 0, alongX ? 0 : s);
  }

  _beginRocker(player, zone) {
    this.active = { kind: 'rocker', mesh: zone.mesh };
    player.playAction('sit_rocker');
    this.state.presence?.broadcast({ emote: 'sit_rocker' });
    return 'Yeehaw! Move to hop off.';
  }

  _updateRocker(dt, player, intent) {
    const m = this.active.mesh;
    m.userData.push = 1;
    const rock = m.userData.angle || 0;
    // ride the measured saddle THROUGH the rock: the offset is in the mesh's
    // own space, so localToWorld carries the kid with the tilt
    if (m.userData.saddle) {
      m.localToWorld(_vb.copy(m.userData.saddle));
      player.pos.set(_vb.x, this._seatOriginY(_vb.y), _vb.z);
    } else {
      player.pos.set(m.position.x, this._seatOriginY(m.position.y + 0.5), m.position.z);
    }
    player.yaw = player.targetYaw = m.rotation.y;
    player.tilt = rock;
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    if (Math.hypot(intent.move.x, intent.move.y) > 0.25 || intent.jump) this._exitToGround(player);
  }


  // ── climbing ──────────────────────────────────────────────────────────────

  /**
   * Is there something to climb from where the kid is standing and facing?
   *
   * Walking up a ladder was never right, and once derived collision started
   * gating standable surfaces on headroom it stopped being possible at all — a
   * rung has another rung right above it, so it is a wall, not a step. That is
   * the correct answer; this is the other half of it. Devon: the treehouse "has
   * to actually be a separate climbing animation… and one could be used for the
   * tires, the playground."
   *
   * The test is deliberately about SHAPE, not about names: something solid
   * directly ahead, and a surface you could stand on above it, within a kid's
   * climbing reach. That covers the treehouse ladder, the tyre wall and
   * anything else built like them, with no per-prop list to maintain.
   *
   * @returns {{x:number, z:number, y:number} | null} where you'd end up
   */
  findClimb(player) {
    const col = this.world.collision;
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    const feet = player.pos.y;
    // 1. blocked straight ahead?
    const ax = player.pos.x + fx * 0.42, az = player.pos.z + fz * 0.42;
    const hit = col.resolve(ax, az, feet);
    if (Math.hypot(hit.x - ax, hit.z - az) < 0.04) return null;
    // 2. a ledge above it, far enough up to be worth a climb and near enough to reach
    const tx = player.pos.x + fx * 0.85, tz = player.pos.z + fz * 0.85;
    for (let h = 0.8; h <= CLIMB_REACH; h += 0.2) {
      const g = col.groundAt(tx, tz, feet + h);
      if (g > feet + 0.7 && g < feet + CLIMB_REACH) {
        // and headroom to actually stand there
        if (col.groundAt(tx, tz, g + 0.05) > g + 0.3) continue;
        return { x: tx, z: tz, y: g };
      }
    }
    return null;
  }

  _beginClimb(player, spot) {
    // A LOW obstacle (a ledge, a grind box) is a CLAMBER, not a ladder —
    // and the TYRE WALL clambers at any height. Devon: the tyres need "a
    // crawl state to climb them, rather than one locked animation."
    if (this._tyres === undefined) {
      this._tyres = this.world.collision.boxes.filter((b) => /Tyrewall/i.test(b.name)) || null;
    }
    const onTyres = this._tyres.some((b) =>
      spot.x > b.minX - 0.6 && spot.x < b.maxX + 0.6
      && spot.z > b.minZ - 0.6 && spot.z < b.maxZ + 0.6);
    const low = onTyres || spot.y - player.pos.y <= 1.15;
    this.active = { kind: 'climb', t: 0, spot, base: player.pos.y, topping: false, low };
    player.rig.forceLegEmote = true;      // the legs are climbing, not walking
    player.playAction(low ? 'crawl' : 'climb', null);
    this.state.presence?.broadcast({ emote: low ? 'crawl' : 'climb' });
    window.odaSfx && window.odaSfx.tone(240, 0.06, 'triangle', 0.04);
    return low ? 'Clamber over! \u{1F9CE}' : 'Climbing! \u{1F9D7}';
  }

  _updateClimb(dt, player, intent) {
    const a = this.active, s = a.spot;
    a.t += dt;
    player.speed = 0; player.vel.y = 0; player.grounded = true; player.tilt = 0;
    // face the wall the whole way up
    player.yaw = player.targetYaw = Math.atan2(s.x - player.pos.x, s.z - player.pos.z) || player.yaw;

    if (!a.topping) {
      player.pos.y += (a.low ? 1.5 : CLIMB_SPEED) * dt;
      // a rung-by-rung tick, so it reads as effort rather than an elevator
      const rung = Math.floor((player.pos.y - a.base) / 0.34);
      if (rung !== a._rung) { a._rung = rung; window.odaSfx && window.odaSfx.tone(190 + Math.random() * 40, 0.04, 'triangle', 0.025); }
      if (player.pos.y >= s.y - 0.12) {
        // a clamber just crests — the heave is a ladder thing
        if (a.low) { this._endClimb(player, true); return; }
        a.topping = true; a.t = 0;
        player.playAction('climb_top', null);
      }
      // bail out: let go and drop
      if (intent.jump) this._endClimb(player, false);
      return;
    }
    // the heave over the lip: ride the clip, then land ON the surface
    const k = Math.min(1, a.t / 1.0);
    player.pos.y = s.y + 0.02;
    player.pos.x += (s.x - player.pos.x) * Math.min(1, 6 * dt);
    player.pos.z += (s.z - player.pos.z) * Math.min(1, 6 * dt);
    if (k >= 1) this._endClimb(player, true);
  }

  _endClimb(player, landed) {
    const a = this.active;
    player.rig.forceLegEmote = false;
    player.rig.stopEmote?.();
    this.state.presence?.broadcast({ emote: '_stop' });
    if (landed && a) {
      player.pos.set(a.spot.x, a.spot.y + 0.02, a.spot.z);
    } else {
      player.grounded = false;            // let go — gravity takes it from here
    }
    this.active = null;
  }

  /** Common hop-off: stand on real ground beside whatever was ridden. */
  _exitToGround(player, awayFrom) {
    if (awayFrom) {
      _va.copy(player.pos).sub(awayFrom); _va.y = 0;
      const l = _va.length() || 1;
      player.pos.x += (_va.x / l) * 0.45;
      player.pos.z += (_va.z / l) * 0.45;
    }
    player.tilt = 0;
    player.rig.stopEmote?.();
    this.state.presence?.broadcast({ emote: '_stop' });
    player.pos.y = this.world.collision.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.3);
    this.active = null;
  }

  // ── spinners and coin rides ───────────────────────────────────────────────
  //
  // Devon: "there's a thing behind the fountain that has like four tires and
  // it's supposed to spin. Even on the playground next to the seesaw, that
  // thing is supposed to spin — right now it's got the same physics as the
  // seesaw." Both are roundabouts, and both were being animated as spring
  // rockers. They spin now, and you spin with them.

  _buildAttractions() {
    this.spinners = [];
    this.coinRides = [];
    const parts = this.world.attractionParts || [];
    const byFamily = new Map();
    for (const p of parts) {
      if (!byFamily.has(p.family)) byFamily.set(p.family, []);
      byFamily.get(p.family).push(p);
    }
    for (const [family, list] of byFamily) {
      for (const cluster of clusterParts(list, 1.6)) {
        const group = new THREE.Group();
        const root = cluster[0];
        const rootPos = new THREE.Vector3().setFromMatrixPosition(root.matrix);
        const rootInv = new THREE.Matrix4().makeTranslation(-rootPos.x, -rootPos.y, -rootPos.z);
        group.position.copy(rootPos);
        const bb = new THREE.Box3();
        for (const p of cluster) {
          const mesh = new THREE.Mesh(p.proto.geometry, p.proto.material);
          mesh.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, p.matrix));
          mesh.castShadow = !!this.world.quality?.shadows;
          group.add(mesh);
          mesh.updateMatrixWorld(true);
          bb.expandByObject(mesh);
        }
        this.world.scene.add(group);
        const radius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
        /**
         * WHERE you sit on a spinner: the outer SEAT ring, not the hub.
         *
         * The deck used to be the assembly's bbox top — which is the centre
         * POLE on the 4-tyre roundabout and the hand-WHEEL on the little
         * spinner, so the rider orbited the pole at hub height ("it's
         * activating like a stripper pole… they're supposed to be on the
         * TIRE"). Measured from the verts instead: everything clear of the
         * hub (r > 0.2) gives the seat surface level (90th pct y), and the
         * 70th percentile radius of that surface lands ON the tyres of the
         * roundabout (≈0.66) and on the seat disc of the wheel-spinner
         * (≈0.30).
         */
        let seatR = radius * 0.7, seatY = bb.max.y - rootPos.y;
        {
          group.updateMatrixWorld(true);   // SECOND pass — build-loop matrices are stale
          const vv = new THREE.Vector3();
          const pts = [];
          let maxR = 0;
          group.traverse((o) => {
            if (!o.isMesh) return;
            const posA = o.geometry.attributes.position;
            for (let i = 0; i < posA.count; i++) {
              vv.fromBufferAttribute(posA, i).applyMatrix4(o.matrixWorld);
              const r = Math.hypot(vv.x - rootPos.x, vv.z - rootPos.z);
              if (r > 0.2) { pts.push([r, vv.y - rootPos.y]); if (r > maxR) maxR = r; }
            }
          });
          // the SEAT lives in the outer band, below a kid's reach (the tyre
          // carousel's arms rise to 3 m — they're structure, not seats). The
          // seat LEVEL is the band's densest horizontal slab — that's the
          // tyre itself, not the arm it hangs from.
          const outer = pts.filter((p) => p[0] > maxR * 0.55 && p[1] < 2.0);
          if (outer.length > 20) {
            const BIN = 0.15;
            const hist = new Map();
            for (const p of outer) {
              const k = Math.floor(p[1] / BIN);
              hist.set(k, (hist.get(k) || 0) + 1);
            }
            const best = [...hist.entries()].sort((q, w) => w[1] - q[1])[0][0];
            seatY = (best + 1) * BIN;          // the slab's TOP — you sit on it
            const ring = outer.filter((p) => Math.abs(p[1] - seatY) < 0.3)
              .map((p) => p[0]).sort((q, w) => q - w);
            if (ring.length > 10) seatR = ring[Math.floor(ring.length * 0.7)];
          }
        }
        const item = {
          group, spin: 0, rate: 0, t: Math.random() * 6,
          // a coin ride is SAT ON: the saddle is the dip in its own top
          // surface. (Spinners use the seat RING below instead — you sit out
          // on a tyre, not on the hub.)
          saddle: family === 'coinride' ? this._saddleOf(group) : null,
          faceYaw: family === 'coinride' ? this._frontYawOf(group, cluster) : 0,
          deck: seatY, seatR: Math.max(0.28, seatR),
          // Sitting far out (the tyres) you face OUTWARD, legs dangling over
          // the edge, hands on the tyre beside you — facing the hub from out
          // there stretched the legs at the pole and read as pole-hugging.
          // Sitting close (the wheel-spinner's disc) you face IN, hands on
          // the wheel you spin.
          faceOut: seatR >= 0.45,
          radius,
        };
        const isSpin = family === 'spinner';
        (isSpin ? this.spinners : this.coinRides).push(item);
        item.zone = {
          id: `${family}${this.zones.length}`, ride: family,
          icon: isSpin ? '\u{1F3A0}' : '\u{1F680}',
          name: isSpin ? 'Roundabout' : 'Coin Ride',
          prompt: isSpin ? 'Spin!' : 'Take a ride!',
          pos: [rootPos.x, rootPos.z], radius: Math.max(1.4, item.radius + 0.7), item,
        };
        this.zones.push(item.zone);
      }
    }
  }

  _beginSpinner(player, item) {
    this.active = { kind: 'spinner', item, dir: 1 };
    player.rig.forceLegEmote = true;
    const clip = item.faceOut ? 'sit' : 'spin_ride';
    player.playAction(clip, null);
    this.state.presence?.broadcast({ emote: clip });
    return 'A/D spin it either way \u00b7 S slows it \u00b7 Space to fly off';
  }

  /**
   * The spin has a DIRECTION now. Devon: "the way it works in real life is
   * there's a little wheel in the middle, and you spin that wheel, and that
   * makes the whole thing spin." So: steer left/right to throw it that way
   * (D = toward your right as you sit facing outward), W keeps it going the
   * way it already turns, S drags it down like grabbing the wheel.
   */
  _updateSpinner(dt, player, intent) {
    const a = this.active, it = a.item;
    // steering: D throws it toward your screen-right. Facing the hub, right =
    // spin-negative (from the seat parametrisation pos = (sin, cos)\u00b7r);
    // facing outward it's the opposite.
    if (Math.abs(intent.move.x) > 0.3) {
      a.dir = (intent.move.x > 0 ? -1 : 1) * (it.faceOut ? -1 : 1);
    }
    const braking = intent.move.y > 0.3;
    const pushing = !braking && (Math.abs(intent.move.x) > 0.3 || intent.move.y < -0.3);
    // big carousels cap lower: 3.4 rad/s on a 2 m tyre arm is 7 m/s of kid
    const target = pushing ? Math.min(3.4, 4.6 / Math.max(1, it.seatR)) * a.dir : 0;
    it.rate += (target - it.rate) * Math.min(1, dt * (pushing ? 0.9 : braking ? 2.4 : 0.5));
    it.spin += it.rate * dt;
    it.group.rotation.y = it.spin;
    // sit ON the measured seat ring (the tyres / the seat disc), facing the hub
    const r = it.seatR;
    const g = this.world.collision.groundAt(it.group.position.x, it.group.position.z, it.group.position.y + 0.6);
    player.pos.set(
      it.group.position.x + Math.sin(it.spin) * r,
      this._seatOriginY(g + it.deck),
      it.group.position.z + Math.cos(it.spin) * r);
    player.yaw = player.targetYaw = it.spin + (it.faceOut ? 0 : Math.PI);
    player.speed = 0; player.vel.y = 0; player.grounded = true; player.tilt = 0;
    if (Math.abs(it.rate) > 1.4 && Math.random() < dt * 4 && window.odaSfx) {
      window.odaSfx.tone(150 + Math.abs(it.rate) * 20, 0.05, 'triangle', 0.02);
    }
    if (intent.jump) {
      // fling off tangentially — the best bit of a roundabout
      player.rig.forceLegEmote = false;
      this.launch = { x: Math.cos(it.spin) * it.rate * r, z: -Math.sin(it.spin) * it.rate * r };
      player.vel.y = 2.6;
      player.grounded = false;
      this._endRide(player);
    }
  }

  _beginCoinRide(player, item) {
    this.active = { kind: 'coinride', item, t: 0 };
    player.rig.forceLegEmote = true;
    player.playAction('sit_rocker', null);
    this.state.presence?.broadcast({ emote: 'sit_rocker' });
    return 'Whee! \u00b7 Space to hop off';
  }

  _updateCoinRide(dt, player, intent) {
    const a = this.active, it = a.item;
    a.t += dt;
    const rock = Math.sin(a.t * 3.1) * 0.30, bob = Math.sin(a.t * 6.2) * 0.05;
    it.group.rotation.x = rock * 0.5;
    // sit on the measured SADDLE, carried through the rock by localToWorld —
    // the old mount was the assembly's bbox top at the group's origin, i.e.
    // the dragon's horns / the car's steering wheel
    if (it.saddle) {
      it.group.localToWorld(_vb.copy(it.saddle));
      player.pos.set(_vb.x, this._seatOriginY(_vb.y) + bob, _vb.z);
    } else {
      const g = this.world.collision.groundAt(it.group.position.x, it.group.position.z, it.group.position.y + 0.6);
      player.pos.set(it.group.position.x, this._seatOriginY(g + it.deck) + bob, it.group.position.z);
    }
    player.yaw = player.targetYaw = it.faceYaw + it.group.rotation.y;
    player.tilt = rock * 0.5;
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    if (intent.jump || Math.hypot(intent.move.x, intent.move.y) > 0.25) {
      it.group.rotation.x = 0;
      player.rig.forceLegEmote = false;
      this._endRide(player);
    }
  }

  // ── monkey bars ───────────────────────────────────────────────────────────

  _buildMonkeyBars() {
    const b = (this.world.monkeyBars || null);
    if (!b) return;
    this.zones.push({
      id: 'monkey', ride: 'monkey', icon: '\u{1F412}', name: 'Monkey Bars',
      prompt: 'Swing across!', pos: [b.a.x, b.a.z], radius: 1.2, bars: b, from: 'a',
    });
    this.zones.push({
      id: 'monkey2', ride: 'monkey', icon: '\u{1F412}', name: 'Monkey Bars',
      prompt: 'Swing across!', pos: [b.b.x, b.b.z], radius: 1.2, bars: b, from: 'b',
    });
  }

  _beginMonkey(player, zone) {
    const b = zone.bars;
    const from = zone.from === 'a' ? b.a : b.b, to = zone.from === 'a' ? b.b : b.a;
    this.active = { kind: 'monkey', t: 0, from, to, dur: from.distanceTo(to) / 1.05 };
    player.rig.forceLegEmote = true;
    player.playAction('monkey', null);
    this.state.presence?.broadcast({ emote: 'monkey' });
    return 'Hand over hand!';
  }

  _updateMonkey(dt, player) {
    const a = this.active;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    player.pos.lerpVectors(a.from, a.to, k);
    player.pos.y = a.from.y - HANG_DROP;          // hanging below the bars
    player.yaw = player.targetYaw = Math.atan2(a.to.x - a.from.x, a.to.z - a.from.z);
    player.speed = 0; player.vel.y = 0; player.grounded = true; player.tilt = 0;
    if (k >= 1) {
      player.rig.forceLegEmote = false;
      player.pos.y = this.world.collision.groundAt(player.pos.x, player.pos.z, player.pos.y);
      this._endRide(player);
    }
  }

  // ── zip line ──────────────────────────────────────────────────────────────
  //
  // SM_Prop_Playground_Track_Ride_01: a straight overhead track with a hanging
  // handle, from the playground's top platform out over the lawn. Devon: "grab
  // it and ride across" — he floated jump-to-grab and then talked himself out
  // of it ("that may be too complicated"), so the grab is the SLIDE pattern:
  // walk up to the handle on the platform, moving toward it, and you're on.

  _buildZipline() {
    const props = this.world.animatedProps || [];
    const handle = props.find((p) => /Track_Ride_01_Handle/.test(p.userData.kind)) || null;
    const track = props.find((p) => /Track_Ride_01$/.test(p.userData.kind)) || null;
    if (!handle || !track) return;
    const bb = new THREE.Box3().setFromObject(track);
    const alongX = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z);
    const y = (bb.min.y + bb.max.y) / 2;
    const inset = 0.28;                        // stop under the end brackets
    const a = alongX
      ? new THREE.Vector3(bb.min.x + inset, y, (bb.min.z + bb.max.z) / 2)
      : new THREE.Vector3((bb.min.x + bb.max.x) / 2, y, bb.min.z + inset);
    const b = alongX
      ? new THREE.Vector3(bb.max.x - inset, y, (bb.min.z + bb.max.z) / 2)
      : new THREE.Vector3((bb.min.x + bb.max.x) / 2, y, bb.max.z - inset);
    // BOTH ends are boarding points — measured: a 1.08 m ledge sits under the
    // east end and a 1.21 m shelf under the west, either within a kid's reach
    // of the 3 m track. So the zip line runs both ways, like the real toy.
    this.zip = { handle, a, b, cool: 0 };
    const hp = handle.position;
    const near = hp.distanceTo(a) <= hp.distanceTo(b) ? a : b;
    handle.position.set(near.x, hp.y, near.z);
  }

  /** Walked into the waiting handle, in reach below the track, moving at it? Go. */
  _checkZipGrab(player) {
    const z = this.zip;
    if (!z || this.active || this.state.seated) return;
    if (z.cool > 0) return;
    if (!player.grounded || player.speed < 0.5) return;
    const h = z.handle.position;
    const d = Math.hypot(player.pos.x - h.x, player.pos.z - h.z);
    if (d > 0.62) return;
    // hands can reach the handle: feet up to ~2 m below the track (the east
    // ledge is 1.92 below it — arms up, a kid makes that)
    if (player.pos.y < z.a.y - 2.0 || player.pos.y > z.a.y - 0.2) return;
    const dot = (Math.sin(player.yaw) * (h.x - player.pos.x)
      + Math.cos(player.yaw) * (h.z - player.pos.z)) / (d || 1);
    if (dot < 0.5) return;
    // ride from the end the handle is at toward the other one
    const fromA = Math.hypot(h.x - z.a.x, h.z - z.a.z) <= Math.hypot(h.x - z.b.x, h.z - z.b.z);
    this.active = { kind: 'zip', from: fromA ? z.a : z.b, to: fromA ? z.b : z.a, u: 0, v: 0.8 };
    player.rig.forceLegEmote = true;
    player.playAction('monkey', null);
    this.state.presence?.broadcast({ emote: 'monkey' });
    window.odaSfx && window.odaSfx.play('whoosh');
    this.state.toast?.('Zip line! Hold on \u{1F412} · Space to drop');
  }

  _updateZip(dt, player, intent) {
    const a = this.active, z = this.zip;
    a.v = Math.min(4.2, a.v + 3.0 * dt);
    const len = a.from.distanceTo(a.to);
    a.u = Math.min(1, a.u + (a.v / len) * dt);
    _va.lerpVectors(a.from, a.to, a.u);
    z.handle.position.set(_va.x, z.handle.position.y, _va.z);
    player.pos.set(_va.x, _va.y - HANG_DROP, _va.z);
    player.yaw = player.targetYaw = Math.atan2(a.to.x - a.from.x, a.to.z - a.from.z);
    player.speed = 0; player.vel.y = 0; player.grounded = true; player.tilt = 0;
    if (Math.random() < dt * 6 && window.odaSfx) {
      window.odaSfx.tone(900 + a.v * 160 + Math.random() * 120, 0.04, 'triangle', 0.02);
    }
    if (a.u >= 1 || intent.jump) {
      // let go: carry the travel speed into the landing arc
      const dir = _vb.copy(a.to).sub(a.from).normalize();
      this.launch = { x: dir.x * a.v * 0.55, z: dir.z * a.v * 0.55 };
      player.rig.forceLegEmote = false;
      player.grounded = false;
      player.vel.y = 0.5;
      z.cool = 1.5;
      this._endRide(player);
    }
  }

  // ── picnic tables ─────────────────────────────────────────────────────────
  // Devon: "you can't sit down on the picnic tables, but you can on the
  // benches. So I want a sit animation for the picnic tables as well, and they
  // should have like four different spots you could sit at." Four per table,
  // two a side, each facing in — which is also the shape multiplayer wants.

  _buildTableSeats() {
    for (const t of this.world.tableSeats || []) {
      this.zones.push({
        id: `table${this.zones.length}`, ride: 'tableseat',
        icon: '\u{1F37D}\uFE0F', name: 'Picnic Table', prompt: 'Sit down',
        pos: [t.x, t.z], radius: 0.85, spot: t,
      });
    }
  }

  _beginTableSeat(player, zone) {
    const t = zone.spot;
    this.active = { kind: 'tableseat', t };
    player.pos.set(t.x, this._seatOriginY(t.y), t.z);
    player.yaw = player.targetYaw = t.yaw;
    player.speed = 0; player.vel.y = 0; player.grounded = true; player.tilt = 0;
    player.playAction('sit_table');
    this.state.presence?.broadcast({ emote: 'sit_table' });
    return 'Pull up a seat \u{1F37D}\uFE0F \u00b7 move to get up';
  }

  _updateTableSeat(dt, player, intent) {
    const t = this.active.t;
    player.pos.set(t.x, this._seatOriginY(t.y), t.z);
    player.yaw = player.targetYaw = t.yaw;
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    if (Math.hypot(intent.move.x, intent.move.y) > 0.25 || intent.jump) {
      this._exitToGround(player, new THREE.Vector3(t.tx, t.y, t.tz));
    }
  }

  /** Shared teardown for the rides that just stop. */
  _endRide(player) {
    player.rig.forceLegEmote = false;
    player.rig.stopEmote?.();
    this.state.presence?.broadcast({ emote: '_stop' });
    this.active = null;
  }

  // ── shared ────────────────────────────────────────────────────────────────

  /** Start a ride from its prompt zone. Returns a toast line or null. */
  begin(zone, player) {
    if (this.active || this.state.seated || this.state.tag?.playerFrozen) return null;
    switch (zone.ride) {
      case 'swing': return this._beginSwing(player);
      case 'slide': return this._beginSlide(player, zone);
      case 'seesaw': return this._beginSeesaw(player);
      case 'rocker': return this._beginRocker(player, zone);
      case 'spinner': return this._beginSpinner(player, zone.item);
      case 'coinride': return this._beginCoinRide(player, zone.item);
      case 'monkey': return this._beginMonkey(player, zone);
      case 'tableseat': return this._beginTableSeat(player, zone);
      case 'climb': return this._beginClimb(player, zone.spot);
      default: return null;
    }
  }

  update(dt, player, intent) {
    if (this._slideCool > 0) this._slideCool -= dt;
    this._checkSlideEntry(player);
    if (this.zip) {
      if (this.zip.cool > 0) this.zip.cool -= dt;
      this._checkZipGrab(player);
      // idle handle trundles over to a kid waiting at the other end
      if (this.active?.kind !== 'zip' && this.zip.cool <= 0) {
        const h = this.zip.handle.position;
        for (const end of [this.zip.a, this.zip.b]) {
          const pd = Math.hypot(player.pos.x - end.x, player.pos.z - end.z);
          if (pd > 2.5) continue;
          if (Math.hypot(h.x - end.x, h.z - end.z) > 0.05) {
            h.x += (end.x - h.x) * Math.min(1, 1.2 * dt);
            h.z += (end.z - h.z) * Math.min(1, 1.2 * dt);
          }
          break;
        }
      }
    }
    const t = this.world.clock.elapsedTime;
    // unoccupied swings sway in the breeze
    for (const s of this.swings) {
      if (this.active?.kind === 'swing' && this.active.seat === s) continue;
      s.group.rotation.x = Math.sin(t * 1.1 + s.phase0) * 0.1;
    }
    // dismount arc: carry horizontal velocity until touchdown
    if (this.launch) {
      if (player.grounded) {
        this.world.fx.spawn(player.pos.x, player.pos.y + 0.03, player.pos.z, { color: 0xcbb794, from: 0.2, to: 1.0, dur: 0.45, alpha: 0.4 });
        this.launch = null;
      } else {
        player.pos.x += this.launch.x * dt;
        player.pos.z += this.launch.z * dt;
        const c = this.world.collision.clampToBounds(player.pos.x, player.pos.z, 1.2);
        player.pos.x = c.x; player.pos.z = c.z;
      }
    }
    // the seesaw is a shared object now: its physics and its NPC playmate run
    // whether or not the local player is on it
    if (this.seesaw) {
      this._updateSeesawSim(dt);
      this._updateSeesawNpc(dt);
    }
    if (!this.active) return;
    switch (this.active.kind) {
      case 'swing': this._updateSwing(dt, player, intent); break;
      case 'slide': this._updateSlide(dt, player); break;
      case 'seesaw': this._updateSeesaw(dt, player, intent); break;
      case 'rocker': this._updateRocker(dt, player, intent); break;
      case 'spinner': this._updateSpinner(dt, player, intent); break;
      case 'coinride': this._updateCoinRide(dt, player, intent); break;
      case 'monkey': this._updateMonkey(dt, player); break;
      case 'tableseat': this._updateTableSeat(dt, player, intent); break;
      case 'climb': this._updateClimb(dt, player, intent); break;
      case 'zip': this._updateZip(dt, player, intent); break;
    }
  }
}

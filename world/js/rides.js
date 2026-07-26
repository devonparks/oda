/**
 * AMG World — rideable playthings: the swing set and the slides.
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
  minY: 0.18, maxY: 2.06,
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
const SEESAW_G = 3.1;        // how fast your end drops
// Tuned against the arc, not by feel: peak = v^2/(2*G) in `up` units, so 3.4
// carries you from the ground (-1) to about +0.9 — one good shove takes you
// almost all the way up, which is the entire point of a seesaw. 2.6 only
// reached +0.11 and felt like the plank was stuck.
const SEESAW_PUSH = 3.4;
const SEESAW_MAX = 0.34;     // rad at either extreme
const GRIND_SPEED = 4.2;     // m/s along a rail
const FLIP_T = 0.45;         // s for a full kickflip rotation

/** Ride rules per vehicle family, mirrored from world.js VEHICLE_FAMILIES. */
const VEHICLE_DEFS = {
  kart: { style: 'sit', clip: 'sit_kart', speed: 1.75, name: 'Soapbox Racer', icon: '\u{1F3CE}\uFE0F', verb: 'Drive it!', spread: 1.6 },
  bike: { style: 'bike', clip: 'bike_pedal', speed: 1.9, name: 'Bike', icon: '\u{1F6B2}', verb: 'Ride the bike!' },
  trike: { style: 'bike', clip: 'bike_pedal', speed: 1.25, name: 'Trike', icon: '\u{1F6B2}', verb: 'Ride the trike!' },
  scooter: { style: 'stand', clip: 'ride_stand', speed: 1.6, name: 'Scooter', icon: '\u{1F6F4}', verb: 'Scoot!' },
  // 2.05 was "too fast" (Devon) — and flat anyway. 1.7 with the kick-pulse in
  // speedScale averages ~1.6 and actually reads like skating.
  board: { style: 'stand', clip: 'ride_stand', speed: 1.7, name: 'Skateboard', icon: '\u{1F6F9}', verb: 'Skate!', spread: 0.9 },
  wagon: { style: 'sit', clip: 'sit_kart', speed: 1.3, name: 'Wagon', icon: '\u{1F6D2}', verb: 'Ride the wagon!' },
  pogo: { style: 'pogo', clip: 'pogo', speed: 0.85, name: 'Pogo Stick', icon: '\u{1F998}', verb: 'Boing!', mountY: 0.28 },
  /**
   * The purple Jeep — not a layout prop: world.js carves it out of the shell
   * (_extractShellVehicles) and pushes its parts here. `axleFacing` because it
   * parks diagonally (square AABB, so the long-axis test is a coin flip);
   * `mountY` because its bounding-box top is the WINDSCREEN, not the seat.
   */
  jeep: { style: 'sit', clip: 'sit_kart', speed: 1.85, name: 'Jeep', icon: '\u{1F699}', verb: 'Drive it!', spread: 1.6, axleFacing: true, mountY: 0.4, seatAtOrigin: true },
  /**
   * Pond floaties — carved from the shell like the Jeep, but they ride the
   * WATER: y pinned to their authored draught, movement fenced by the water
   * mask, slow paddling with ripples. Devon: "the floaties should be rideable
   * like the vehicles… get in, paddle around the pond, get out."
   */
  floatie: { style: 'sit', clip: 'sit_kart', speed: 0.55, name: 'Floatie', icon: '\u{1F6F6}', verb: 'Paddle!', seatAtOrigin: true, water: true },
};

/**
 * Group loose layout rows into individual objects by proximity.
 *
 * The layout is a flat list — five skateboards' worth of decks and twenty
 * wheels, all as siblings — so "which wheel belongs to which board" is a
 * clustering problem. Single-link within `spread` metres, which is safe here
 * because the park never parks two of the same vehicle inside a metre of each
 * other (measured: the closest pair of skateboards is 3.9 m apart).
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
    this._buildVehicles();
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

  // ── playground: seesaw, spring riders, hula hoops ─────────────────────────

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
      this.zones.push({
        id: 'seesaw', ride: 'seesaw', icon: '⚖️', name: 'Seesaw',
        prompt: 'Ride the seesaw', pos: [this.seesaw.position.x, this.seesaw.position.z], radius: 1.5,
      });
    }

    this.rockers = props.filter((p) => /Playground_Rocker_\d+_Top/.test(p.userData.kind));
    this.rockers.forEach((r, i) => this.zones.push({
      id: `rocker${i}`, ride: 'rocker', mesh: r, icon: '\u{1F40E}', name: 'Spring Rider',
      prompt: 'Bounce!', pos: [r.position.x, r.position.z], radius: 1.1,
    }));

    // Hula hoops: nothing in the kit, so two code-drawn rings on the lawn.
    // They LIE on the grass like dropped toys — standing upright with nothing
    // holding them read as a glitch (Devon: "the hula hoops look weird
    // standing straight up"). Destined for the shop as a carried item anyway.
    this.hoops = [];
    const hoopGeo = new THREE.TorusGeometry(0.42, 0.035, 8, 22);
    const rack = { x: -5.0, z: -1.2 };
    [0xf6c344, 0xe85fa2].forEach((color, i) => {
      const mesh = new THREE.Mesh(hoopGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
      const home = {
        pos: new THREE.Vector3(rack.x + i * 0.62 - 0.31, 0.045 + i * 0.03, rack.z + i * 0.34),
        rot: new THREE.Euler(Math.PI / 2 - 0.07 + i * 0.05, 0.6 * i, 0),
      };
      mesh.position.copy(home.pos);
      mesh.rotation.copy(home.rot);
      this.world.scene.add(mesh);
      this.hoops.push({ mesh, home });
    });
    this.zones.push({
      id: 'hoops', ride: 'hoop', icon: '⭕', name: 'Hula Hoops',
      prompt: 'Hula hoop!', pos: [rack.x, rack.z], radius: 1.4,
    });
  }

  _beginSeesaw(player) {
    const m = this.seesaw, sim = this.seesawSim;
    _va.copy(this.seesawAxis).applyQuaternion(m.quaternion);
    let end = Math.sign(_va.dot(_vb.copy(player.pos).sub(m.position))) || 1;
    if (sim.riders[end]) end = -end;         // that end is taken — sit opposite
    if (sim.riders[end]) return null;        // both taken
    sim.riders[end] = { kind: 'player' };
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
    if (!w1 && !w0 && Math.abs(sim.lift) < 0.01 && Math.abs(sim.vel) < 0.02) {
      m.userData.ridden = false;             // hand the idle drift back to world.js
      return;
    }
    m.userData.ridden = true;
    sim.vel -= SEESAW_G * (w1 - w0) * dt;    // the heavy side sinks
    if (w1 && w0) sim.vel *= Math.exp(-0.35 * dt);   // two kids: bleed a little
    if (!w1 && !w0) sim.vel -= Math.sign(sim.lift) * SEESAW_G * 0.6 * dt;  // empty: settle
    sim.lift += sim.vel * dt;
    if (sim.lift <= -1) {
      sim.lift = -1;
      if (sim.vel < -1.2) window.odaSfx && window.odaSfx.tone(95, 0.08, 'sine', 0.06);
      sim.vel = Math.max(0, sim.vel);        // legs absorb the landing
    }
    if (sim.lift >= 1) {
      sim.lift = 1;
      if (sim.vel > 1.2) window.odaSfx && window.odaSfx.tone(95, 0.08, 'sine', 0.06);
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
    player.pos.set(m.position.x, m.position.y + 0.5 + Math.abs(rock) * 0.12, m.position.z);
    player.yaw = player.targetYaw = m.rotation.y;
    player.tilt = rock;
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    if (Math.hypot(intent.move.x, intent.move.y) > 0.25 || intent.jump) this._exitToGround(player);
  }

  _beginHoop(player) {
    this.active = { kind: 'hoop', t: 0, hoop: this.hoops[0], hips: null };
    player.playAction('hula', 'twist', null);
    this.state.presence?.broadcast({ emote: 'hula' });
    return 'Hips like a helicopter! Move to stop.';
  }

  _updateHoop(dt, player, intent) {
    const a = this.active;
    a.t += dt;
    const h = a.hoop.mesh;
    // The hoop rides the REAL pelvis. The hula clip actually orbits the hips
    // (~6 cm in X and Z), so tracking the Hips bone instead of player.pos is
    // what makes the hoop look driven BY the kid rather than floating near her.
    if (!a.hips) player.model.traverse((o) => { if (!a.hips && o.name === 'Hips') a.hips = o; });
    if (a.hips) a.hips.getWorldPosition(_va); else _va.set(player.pos.x, player.pos.y + 0.62, player.pos.z);
    h.position.set(
      _va.x + Math.sin(a.t * 7) * 0.10,
      _va.y + 0.09,
      _va.z + Math.cos(a.t * 7) * 0.10,
    );
    h.rotation.set(Math.PI / 2 + Math.sin(a.t * 7 + 1.2) * 0.16, 0, Math.cos(a.t * 7) * 0.16);
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    if (!player.rig.emote) player.playAction('hula', 'twist', null);   // keep it looping
    if (Math.hypot(intent.move.x, intent.move.y) > 0.25 || intent.jump) {
      h.position.copy(a.hoop.home.pos);
      h.rotation.copy(a.hoop.home.rot);
      this._exitToGround(player);
    }
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
    this.active = { kind: 'climb', t: 0, spot, base: player.pos.y, topping: false };
    player.rig.forceLegEmote = true;      // the legs are climbing, not walking
    player.playAction('climb', null);
    this.state.presence?.broadcast({ emote: 'climb' });
    window.odaSfx && window.odaSfx.tone(240, 0.06, 'triangle', 0.04);
    return 'Climbing! \u{1F9D7}';
  }

  _updateClimb(dt, player, intent) {
    const a = this.active, s = a.spot;
    a.t += dt;
    player.speed = 0; player.vel.y = 0; player.grounded = true; player.tilt = 0;
    // face the wall the whole way up
    player.yaw = player.targetYaw = Math.atan2(s.x - player.pos.x, s.z - player.pos.z) || player.yaw;

    if (!a.topping) {
      player.pos.y += CLIMB_SPEED * dt;
      // a rung-by-rung tick, so it reads as effort rather than an elevator
      const rung = Math.floor((player.pos.y - a.base) / 0.34);
      if (rung !== a._rung) { a._rung = rung; window.odaSfx && window.odaSfx.tone(190 + Math.random() * 40, 0.04, 'triangle', 0.025); }
      if (player.pos.y >= s.y - 0.12) {
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

  // ── vehicles: everything in the park you can get on ───────────────────────
  //
  // The soapbox racer proved the pattern and this is every vehicle on it. Each
  // one's layout parts are diverted out of the static batch (world.js), then
  // clustered by position into instances and re-parented into ONE rigid group,
  // so the whole thing moves and steers as a body. stepPlayer keeps running
  // with a speedScale, which means a rider gets real collision and real ground
  // instead of a bespoke physics path. Hop off and it parks where you left it.
  //
  // Devon: "I want every vehicle to be driven… a skateboard, the bicycles,
  // everything." Fifteen of them, one implementation.

  _buildVehicles() {
    this.vehicles = [];
    const parts = this.world.vehicleParts || [];
    const byFamily = new Map();
    for (const p of parts) {
      if (!byFamily.has(p.family)) byFamily.set(p.family, []);
      byFamily.get(p.family).push(p);
    }
    for (const [family, list] of byFamily) {
      const def = VEHICLE_DEFS[family];
      if (!def) continue;
      for (const cluster of clusterParts(list, def.spread || 1.4)) {
        const v = this._assembleVehicle(family, def, cluster);
        if (v) this.vehicles.push(v);
      }
    }
  }

  /** One cluster of layout rows → a rigid group + its ride zone. */
  _assembleVehicle(family, def, cluster) {
    // Root = the part whose name has no _Suffix (the frame), else the first.
    const root = cluster.find((p) => !/_[A-Za-z]+(_[a-z]{1,2})?$/.test(p.mesh.replace(/_\d+$/, '')))
      || cluster[0];
    const rootPos = new THREE.Vector3().setFromMatrixPosition(root.matrix);
    const rootInv = new THREE.Matrix4().makeTranslation(-rootPos.x, -rootPos.y, -rootPos.z);
    const group = new THREE.Group();
    group.position.copy(rootPos);
    const wheels = [];
    // The part with the biggest FOOTPRINT is the thing you stand or sit on — a
    // scooter's footboard, a wagon's floor, a bike's saddle rail, a
    // skateboard's deck. Measured across all seven families, and much better
    // than the whole assembly's bounding box, whose top is the HANDLEBARS:
    // that mounted scooter riders 1.63 m up, standing on the bars.
    let deckTop = -Infinity, deckArea = -Infinity;
    const bb = new THREE.Box3(), pb = new THREE.Box3();
    const wheelMeshes = [];
    const deckCentre = new THREE.Vector3();
    for (const p of cluster) {
      const mesh = new THREE.Mesh(p.proto.geometry, p.proto.material);
      mesh.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, p.matrix));
      mesh.castShadow = !!this.world.quality?.shadows;
      group.add(mesh);
      mesh.updateMatrixWorld(true);
      bb.expandByObject(mesh);
      if (/Wheel/i.test(p.mesh)) wheelMeshes.push(mesh);
    }
    this.world.scene.add(group);
    // SECOND pass, and it has to be second: setFromObject reads matrixWorld,
    // and inside the build loop the group's own matrixWorld is still stale, so
    // every part measured against a garbage parent transform. That silently
    // mounted scooter riders on the handlebars.
    group.updateMatrixWorld(true);
    for (const c of group.children) {
      pb.setFromObject(c);
      const area = (pb.max.x - pb.min.x) * (pb.max.z - pb.min.z);
      if (area > deckArea) {
        deckArea = area; deckTop = pb.max.y;
        // ...and WHERE it is, not just how high. A bike's saddle sits behind
        // the frame's origin and a wagon's floor sits ahead of its handle, so
        // mounting at the group origin put the rider next to the vehicle
        // rather than on it. Devon: "the character isn't on the seat, and it
        // doesn't match up with the handlebars… it's like that for literally
        // everything." Group rotation is still 0 here, so this offset is in
        // the model's own frame and rotates with it later.
        pb.getCenter(_va);
        deckCentre.set(_va.x - group.position.x, 0, _va.z - group.position.z);
      }
    }

    /**
     * A WHEEL spins about its own centre, around its own thin axis.
     *
     * It used to be rotated in place about a guessed local X — which is why
     * Devon saw "the wheels are spinning on the wrong axis, they're not
     * spinning how bike wheels are supposed to spin." Two things were wrong:
     * the mesh's origin is the VEHICLE's origin (so it orbited rather than
     * spun), and the axle was assumed rather than measured. Now each wheel gets
     * a pivot at its own bbox centre, and the axle is the THINNEST horizontal
     * axis of the wheel — which is what an axle is.
     */
    for (const mesh of wheelMeshes) {
      pb.setFromObject(mesh);
      pb.getCenter(_va);
      const pivot = new THREE.Object3D();
      pivot.position.copy(_va).sub(group.position);
      group.remove(mesh);
      mesh.position.sub(pivot.position);
      mesh.updateMatrix();
      // re-bake the offset into the mesh so the pivot really is its centre
      mesh.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0));
      pivot.add(mesh);
      group.add(pivot);
      const thinX = (pb.max.x - pb.min.x) <= (pb.max.z - pb.min.z);
      wheels.push({ mesh: pivot, axle: thinX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1) });
    }
    group.updateMatrixWorld(true);

    /**
     * Which way does this thing FACE?
     *
     * The old answer was "+Z rotated by the root part's matrix", i.e. an
     * assumption about how the artist modelled it — and it was wrong often
     * enough that Devon reported it across the board: "on a skateboard you're
     * not standing sideways, you're standing straight ahead", "the position of
     * the character is wrong… it's like that for literally everything."
     *
     * A vehicle is LONGER along the way it travels, so the long horizontal axis
     * of the assembly is the travel axis. Which END is the front comes from the
     * steering part (handlebars, steering wheel, tow handle) when there is one.
     * Both measured, neither assumed.
     */
    const bakedQ = new THREE.Quaternion().setFromRotationMatrix(root.matrix);
    _va.set(0, 0, 1).applyQuaternion(bakedQ);
    const yaw = Math.atan2(_va.x, _va.z);          // the baked orientation
    bb.setFromObject(group);
    const longX = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z);
    _vb.set(longX ? 1 : 0, 0, longX ? 0 : 1);
    const steer = cluster.find((q) => /Handlebar|SteeringW|_Handle$/i.test(q.mesh));
    if (steer) {
      _va.setFromMatrixPosition(steer.matrix).sub(rootPos);
      if (_vb.dot(_va) < 0) _vb.negate();
    }
    /**
     * axleFacing (the Jeep): a diagonally parked body has a near-square AABB,
     * so the long-axis test above is a coin flip there. Its wheels carry
     * front/rear in their NAMES, which is exact: forward = front-axle midpoint
     * minus rear-axle midpoint. The wheels' spin axles follow for free — the
     * horizontal perpendicular of a measured forward beats the thinnest-axis
     * guess, which is equally ambiguous on a diagonal wheel's square AABB.
     */
    let axlePerp = null;
    if (def.axleFacing) {
      const wfP = cluster.filter((q) => /_Wheel_f[lr]$/i.test(q.mesh));
      const wrP = cluster.filter((q) => /_Wheel_r[lr]$/i.test(q.mesh));
      if (wfP.length === 2 && wrP.length === 2) {
        const midX = (l) => (l[0].matrix.elements[12] + l[1].matrix.elements[12]) / 2;
        const midZ = (l) => (l[0].matrix.elements[14] + l[1].matrix.elements[14]) / 2;
        _vb.set(midX(wfP) - midX(wrP), 0, midZ(wfP) - midZ(wrP)).normalize();
        axlePerp = new THREE.Vector3(_vb.z, 0, -_vb.x);
        for (const w of wheels) w.axle.copy(axlePerp);
      }
    }
    const fwdYaw = Math.atan2(_vb.x, _vb.z);
    // how far the MODEL's forward sits from the orientation baked into the parts
    const fwdOffset = fwdYaw - yaw;
    // Where a rider goes: feet on the deck for a stand-up, pelvis on it for a
    // sit-down. Read off the assembled body rather than typed in per vehicle.
    // `mountY` overrides it for the pogo stick, which is a single part: its
    // widest slab is the whole pole, but you ride the PEGS near the bottom.
    const deck = def.mountY != null ? def.mountY : deckTop - rootPos.y;
    /**
     * The seat offset is stored in the vehicle's NORMALIZED local frame.
     *
     * It was stored as the raw world-space offset — but _mountXZ rotates the
     * stored seat by group.rotation.y, and after _beginVehicle's normalization
     * that starts at the baked yaw, so a world-frame offset got rotated TWICE.
     * The miss is 2·|seat|·sin(yaw/2): measured rider-to-saddle bike 0.399,
     * scooter 0.173/0.364, trike 0.024, kart 0.001 — the formula reproduces
     * every one of those to the millimetre, which is why the kart sat perfectly
     * (seat ≈ origin) while Devon watched bike riders float beside the saddle.
     */
    /**
     * seatAtOrigin (the Jeep): its group origin IS the body's export-box
     * centre (world.js puts it there), which beats the carved mesh's AABB
     * centre — edge triangles claimed by the wheel boxes skew that 0.29 m
     * sideways, and the kid rode the rim of the tub instead of the seat.
     */
    const v = {
      family, def, group, wheels, yaw, deck, fwdOffset,
      baseY: rootPos.y,        // authored rest height — a floatie's draught
      seat: def.seatAtOrigin ? new THREE.Vector3() : deckCentre.applyAxisAngle(_up, -yaw).clone(),
      zone: {
        id: `veh_${family}_${this.vehicles.length}`, ride: 'vehicle',
        icon: def.icon, name: def.name, prompt: def.verb,
        pos: [rootPos.x, rootPos.z], radius: 1.5,
      },
    };
    v.zone.vehicle = v;
    this.zones.push(v.zone);
    return v;
  }

  /** Where the rider's origin goes: the vehicle's SEAT, rotated with the body. */
  _mountXZ(v, out) {
    return out.copy(v.seat).applyAxisAngle(_up, v.group.rotation.y).add(v.group.position);
  }

  _mountY(v, groundY) {
    // 'stand' rides put the feet on the deck; 'sit' rides put the pelvis there.
    if (v.def.style === 'sit' || v.def.style === 'bike') {
      return groundY + v.deck + BUTT_BELOW_PELVIS - SEATED_PELVIS_Y;
    }
    return groundY + v.deck;
  }

  _beginVehicle(player, v) {
    // Strip the parts' baked layout yaw down to a GROUP yaw so steering works.
    // Full matrix, not just the quaternion: part POSITIONS have to rotate about
    // the group origin too, or the thing un-assembles on the first turn.
    if (!v.normalized) {
      v.normalized = true;
      const undo = new THREE.Matrix4().makeRotationY(-v.yaw);
      for (const c of v.group.children) c.applyMatrix4(undo);
      v.group.rotation.y = v.yaw;
    }
    this.active = { kind: 'vehicle', v, hop: 0 };
    this._mountXZ(v, _vb);
    const g = this.world.collision.groundAt(_vb.x, _vb.z, v.group.position.y + 0.6);
    player.pos.set(_vb.x, this._mountY(v, g), _vb.z);
    // face the way the VEHICLE faces, not the way its parts happened to be baked
    player.yaw = player.targetYaw = v.group.rotation.y + v.fwdOffset;
    player.rig.forceLegEmote = true;
    player.playAction(v.def.clip, null);
    this.state.presence?.broadcast({ emote: v.def.clip });
    return `${v.def.verb} \u00b7 WASD \u00b7 Space to hop off`;
  }

  get driving() { return this.active?.kind === 'vehicle'; }
  /** stepPlayer asks how much faster this ride is than walking. */
  get speedScale() {
    if (this.active?.kind !== 'vehicle') return 1;
    const a = this.active;
    // A skateboard's thrust comes in KICKS — surge, glide, surge — driven off
    // the push cycle _updateVehicle advances. Constant speed read as a
    // conveyor belt (and "too fast").
    if (a.v.family === 'board' && !a.grind && !a.air) {
      const k = Math.max(0, Math.sin(a.pushPhase || 0));
      return a.v.def.speed * (0.82 + 0.34 * k * k);
    }
    return a.v.def.speed;
  }

  _updateVehicle(dt, player, intent) {
    const a = this.active, v = a.v;
    if (a.grind) return this._updateGrind(dt, player, intent);
    const board = v.family === 'board';
    const ground = this.world.collision.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.4);
    // A pogo stick HOPS. Everything else rides the ground.
    // Place the BODY so its seat lands under the rider, rather than dragging
    // the rider to the body's origin.
    _va.copy(v.seat).applyAxisAngle(_up, v.group.rotation.y);
    if (v.def.style === 'pogo') {
      a.hop += dt * 7.4;
      const bounce = Math.abs(Math.sin(a.hop)) * 0.34;
      v.group.position.set(player.pos.x - _va.x, ground + bounce, player.pos.z - _va.z);
      player.pos.y = this._mountY(v, ground + bounce);
      if (Math.sin(a.hop) < 0 && Math.sin(a.hop - dt * 7.4) >= 0 && window.odaSfx) {
        window.odaSfx.tone(300 + Math.random() * 60, 0.06, 'square', 0.03);
      }
    } else if (v.def.water) {
      // ── a floatie rides the WATER, fenced by the mask ──
      const wet = this.world.waterAt(player.pos.x, player.pos.z) != null;
      if (!wet && a.lastWet) { player.pos.x = a.lastWet.x; player.pos.z = a.lastWet.z; }
      else if (wet) {
        if (!a.lastWet) a.lastWet = { x: 0, z: 0 };
        a.lastWet.x = player.pos.x; a.lastWet.z = player.pos.z;
      }
      a.bobT = (a.bobT || 0) + dt;
      const baseY = v.baseY + Math.sin(a.bobT * 2.1) * 0.03;
      v.group.position.set(player.pos.x - _va.x, baseY, player.pos.z - _va.z);
      player.pos.y = this._mountY(v, baseY);
      if (player.speed > 0.25) {
        a.rippleT = (a.rippleT || 0) - dt;
        if (a.rippleT <= 0) {
          a.rippleT = 0.3;
          this.world.fx.spawn(player.pos.x, this.world.water.y + 0.02, player.pos.z,
            { from: 0.3, to: 1.2, dur: 0.8, alpha: 0.4 });
          window.odaSfx && window.odaSfx.tone(220 + Math.random() * 80, 0.06, 'sine', 0.03);
        }
      }
    } else if (board && a.air) {
      // ── airborne trick: the board sticks to the feet and kickflips ──
      a.trickT += dt;
      v.group.position.set(player.pos.x - _va.x, player.pos.y - v.deck, player.pos.z - _va.z);
      if (a.trickFlip) v.group.rotation.z = Math.min(1, a.trickT / FLIP_T) * Math.PI * 2;
      if (player.grounded) {
        // touched down: a rail underfoot becomes a grind, a full rotation pays
        v.group.rotation.z = 0;
        const clean = a.trickFlip && a.trickT >= FLIP_T * 0.9;
        a.air = false;
        const rail = this._railUnder(player.pos.x, player.pos.z, player.pos.y);
        if (rail) this._beginGrind(rail, player);
        else if (clean) {
          window.odaSfx && window.odaSfx.play('powerup');
          const now = performance.now();
          if (!this._trickPayAt || now - this._trickPayAt > 10000) {
            this._trickPayAt = now;
            this.state.award?.(2);
            this.state.toast?.('Kickflip! +2 \u{1F6F9}', 'gold');
          } else {
            this.state.toast?.('Kickflip! \u{1F6F9}');
          }
        }
      }
    } else {
      v.group.position.set(player.pos.x - _va.x, ground, player.pos.z - _va.z);
      player.pos.y = this._mountY(v, ground);
      // the skateboard's push cycle — speedScale surges on each kick
      if (board && player.speed > 0.4) a.pushPhase = (a.pushPhase || 0) + dt * 5.2;
      // rolling down a slope leaves `grounded` false most frames (constant
      // micro-airtime), so the ollie gets COYOTE TIME off this stamp
      if (board && player.grounded) a.lastGroundMs = performance.now();
    }
    // Steer the BODY so its own forward lines up with where the rider is
    // heading. Without the offset a skateboard travels sideways under a kid who
    // is facing forwards, which is exactly what Devon saw.
    const prev = v.group.rotation.y;
    let dy = ((player.yaw - v.fwdOffset) - prev) % (Math.PI * 2);
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    v.group.rotation.y = prev + dy * Math.min(1, 10 * dt);
    player.tilt = 0;
    for (const w of v.wheels) w.mesh.rotateOnAxis(w.axle, player.speed * dt / 0.16);
    if (player.speed > 0.5 && Math.random() < dt * 6 && window.odaSfx) {
      window.odaSfx.tone(70 + player.speed * 14 + Math.random() * 18, 0.05, 'square', 0.025);
    }
    if ((intent.dismount || intent.jump) && !a.air) {
      // On a skateboard at speed, Space is an OLLIE, not an exit — Devon wants
      // tricks. Slow down (or stop) and Space hops off like everywhere else.
      if (board && player.speed >= 0.6) {
        // grounded OR just was (riding a slope flickers `grounded` every
        // frame; a strict check dumped the kid off half the time instead)
        if (player.grounded || (a.lastGroundMs && performance.now() - a.lastGroundMs < 220)) {
          a.air = true;
          a.trickT = 0;
          a.trickFlip = true;
          player.vel.y = 4.9;
          player.grounded = false;
          window.odaSfx && window.odaSfx.play('whoosh');
        }
        return;   // moving fast: Space never means "bail off the board"
      }
      player.rig.forceLegEmote = false;
      player.rig.stopEmote?.();
      this.state.presence?.broadcast({ emote: '_stop' });
      player.pos.x += Math.cos(player.yaw) * 0.8;
      player.pos.z -= Math.sin(player.yaw) * 0.8;
      player.pos.y = this.world.collision.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.5);
      this._mountXZ(v, _vb);
      v.zone.pos = [_vb.x, _vb.z];      // the prompt sits on the seat, not the origin
      this.active = null;
    }
  }

  /** The grind rails, read once off the collision export's own boxes. */
  _railUnder(x, z, y) {
    if (!this._rails) {
      this._rails = this.world.collision.boxes
        .filter((b) => /SkatePark_Rail_Box/.test(b.name))
        .map((b) => {
          const alongX = (b.maxX - b.minX) >= (b.maxZ - b.minZ);
          return {
            cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, top: b.maxY,
            ax: alongX ? 1 : 0, az: alongX ? 0 : 1,
            half: (alongX ? b.maxX - b.minX : b.maxZ - b.minZ) / 2,
            width: (alongX ? b.maxZ - b.minZ : b.maxX - b.minX) / 2,
          };
        });
    }
    for (const r of this._rails) {
      const along = (x - r.cx) * r.ax + (z - r.cz) * r.az;
      const across = (x - r.cx) * r.az - (z - r.cz) * r.ax;
      if (Math.abs(along) > r.half + 0.1 || Math.abs(across) > r.width + 0.2) continue;
      if (Math.abs(y - r.top) > 0.45) continue;
      return r;
    }
    return null;
  }

  _beginGrind(rail, player) {
    const a = this.active;
    const dir = Math.sign(Math.sin(player.yaw) * rail.ax + Math.cos(player.yaw) * rail.az) || 1;
    a.grind = {
      rail, dir,
      along: (player.pos.x - rail.cx) * rail.ax + (player.pos.z - rail.cz) * rail.az,
    };
    this.state.toast?.('Grind! \u{1F6F9}');
    window.odaSfx && window.odaSfx.tone(2200, 0.1, 'square', 0.03);
  }

  /**
   * Grinding: the board rides the rail's own line. Devon: the skateboard needs
   * "collision with the grind rails" — the rails ARE solid (you can ollie onto
   * them); this is what happens when you land there. Slide to the end and drop
   * off, or Space pops off with a fresh flip.
   */
  _updateGrind(dt, player, intent) {
    const a = this.active, v = a.v, g = a.grind, r = g.rail;
    g.along += g.dir * GRIND_SPEED * dt;
    const offEnd = Math.abs(g.along) > r.half + 0.15;
    player.pos.x = r.cx + r.ax * g.along;
    player.pos.z = r.cz + r.az * g.along;
    player.pos.y = r.top + v.deck;             // board on the rail, feet on the board
    player.yaw = player.targetYaw = Math.atan2(r.ax * g.dir, r.az * g.dir);
    player.speed = GRIND_SPEED;
    player.vel.y = 0; player.grounded = true; player.tilt = 0;
    _va.copy(v.seat).applyAxisAngle(_up, v.group.rotation.y);
    v.group.position.set(player.pos.x - _va.x, r.top, player.pos.z - _va.z);
    let dy = ((player.yaw - v.fwdOffset) - v.group.rotation.y) % (Math.PI * 2);
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    v.group.rotation.y += dy * Math.min(1, 14 * dt);
    // metal rasp while it slides
    if (Math.random() < dt * 10 && window.odaSfx) {
      window.odaSfx.tone(1800 + Math.random() * 500, 0.03, 'square', 0.018);
    }
    if (intent.dismount || intent.jump || offEnd) {
      a.grind = null;
      a.air = true;
      a.trickT = offEnd ? FLIP_T : 0;          // rolling off the end doesn't re-flip
      a.trickFlip = !offEnd;                   // popping off with Space does
      player.vel.y = offEnd ? 1.6 : 3.8;
      player.grounded = false;
      if (!offEnd) window.odaSfx && window.odaSfx.play('whoosh');
    }
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
        const item = {
          group, spin: 0, rate: 0, t: Math.random() * 6,
          deck: bb.max.y - rootPos.y,
          radius: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2,
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
    player.playAction('spin_ride', null);
    this.state.presence?.broadcast({ emote: 'spin_ride' });
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
    // rider faces OUT, so their screen-right is spin-negative (measured from
    // the seat parametrisation: pos runs (sin, cos)\u00b7r, right = (-cos, sin))
    if (Math.abs(intent.move.x) > 0.3) a.dir = intent.move.x > 0 ? -1 : 1;
    const braking = intent.move.y > 0.3;
    const pushing = !braking && (Math.abs(intent.move.x) > 0.3 || intent.move.y < -0.3);
    const target = pushing ? 3.4 * a.dir : 0;
    it.rate += (target - it.rate) * Math.min(1, dt * (pushing ? 0.9 : braking ? 2.4 : 0.5));
    it.spin += it.rate * dt;
    it.group.rotation.y = it.spin;
    // ride a seat out on the rim, so you actually travel round
    const r = Math.max(0.35, it.radius * 0.52);
    const g = this.world.collision.groundAt(it.group.position.x, it.group.position.z, it.group.position.y + 0.6);
    player.pos.set(
      it.group.position.x + Math.sin(it.spin) * r,
      g + it.deck + BUTT_BELOW_PELVIS - SEATED_PELVIS_Y,
      it.group.position.z + Math.cos(it.spin) * r);
    player.yaw = player.targetYaw = it.spin + Math.PI;   // facing out
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
    const g = this.world.collision.groundAt(it.group.position.x, it.group.position.z, it.group.position.y + 0.6);
    player.pos.set(it.group.position.x, g + it.deck + bob + BUTT_BELOW_PELVIS - SEATED_PELVIS_Y, it.group.position.z);
    player.yaw = player.targetYaw = it.group.rotation.y;
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
    player.pos.set(t.x, t.y + BUTT_BELOW_PELVIS - SEATED_PELVIS_Y, t.z);
    player.yaw = player.targetYaw = t.yaw;
    player.speed = 0; player.vel.y = 0; player.grounded = true; player.tilt = 0;
    player.playAction('sit_table');
    this.state.presence?.broadcast({ emote: 'sit_table' });
    return 'Pull up a seat \u{1F37D}\uFE0F \u00b7 move to get up';
  }

  _updateTableSeat(dt, player, intent) {
    const t = this.active.t;
    player.pos.set(t.x, t.y + BUTT_BELOW_PELVIS - SEATED_PELVIS_Y, t.z);
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
      case 'hoop': return this._beginHoop(player);
      case 'vehicle': return this._beginVehicle(player, zone.vehicle);
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
      case 'hoop': this._updateHoop(dt, player, intent); break;
      case 'vehicle': this._updateVehicle(dt, player, intent); break;
      case 'spinner': this._updateSpinner(dt, player, intent); break;
      case 'coinride': this._updateCoinRide(dt, player, intent); break;
      case 'monkey': this._updateMonkey(dt, player); break;
      case 'tableseat': this._updateTableSeat(dt, player, intent); break;
      case 'climb': this._updateClimb(dt, player, intent); break;
      case 'zip': this._updateZip(dt, player, intent); break;
    }
  }
}

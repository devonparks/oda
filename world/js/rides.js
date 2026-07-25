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
const SWING_FREQ = 2.35;     // rad/s — pendulum feel for L≈1.6
const SLIDE_TIME = 1.15;     // s top→exit

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
  }

  get busy() { return !!this.active; }

  // ── swings ────────────────────────────────────────────────────────────────

  _buildSwings() {
    // 1. carve the baked seats/chains out of the shell (degenerate whole
    //    triangles only — collapsing single verts would smear slivers).
    let shellMesh = null;
    this.world.shell.traverse((o) => { if (o.isMesh && !shellMesh) shellMesh = o; });
    if (shellMesh) this._carve(shellMesh, CARVE);

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
    player.playEmote('squat', { freezeAt: 1.8 });
    this.state.presence?.broadcast({ emote: 'squat' });
    return 'Pump with W · jump off with Space!';
  }

  _updateSwing(dt, player, intent) {
    const a = this.active, s = a.seat;
    a.phase += dt * SWING_FREQ;
    const pumping = Math.abs(intent.move.y) > 0.3;
    const target = pumping ? 0.88 : 0.3;
    a.amp += Math.max(-dt * 0.10, Math.min(dt * 0.26, target - a.amp));
    const ang = Math.sin(a.phase) * a.amp;
    s.group.rotation.x = ang;
    const py = s.pivot.y - Math.cos(ang) * SWING_L;
    const pz = s.pivot.z + Math.sin(ang) * SWING_L;
    player.pos.set(s.pivot.x, py - 0.42, pz);   // squat butt (~0.45) on the seat
    player.yaw = player.targetYaw = 0;          // swing plane faces +Z
    player.tilt = ang;                          // lean with the chains
    player.speed = 0; player.vel.y = 0; player.grounded = true;
    // creak at each peak once it's really going
    const peak = Math.cos(a.phase) * Math.cos(a.phase - dt * SWING_FREQ) < 0;
    if (peak && a.amp > 0.45 && window.odaSfx) window.odaSfx.tone(210 + Math.random() * 30, 0.09, 'triangle', 0.03);
    if (intent.jump) this._dismountSwing(player, a, ang);
  }

  _dismountSwing(player, a, ang) {
    const dAng = Math.cos(a.phase) * a.amp * SWING_FREQ;   // dθ/dt
    const v = dAng * SWING_L;                              // tangential, +Z forward
    player.tilt = 0;
    player.rig.stopEmote?.();
    player.vel.y = 3.4 + Math.min(2.4, Math.abs(v) * 0.8);
    player.grounded = false;
    this.launch = { x: 0, z: v * 1.15 };
    this.active = null;
    window.odaSfx && window.odaSfx.play('whoosh');
  }

  // ── slides ────────────────────────────────────────────────────────────────

  _buildSlides() {
    for (const d of this.world.slideData || []) {
      this.zones.push({
        id: `slide${this.zones.length}`, ride: 'slide', data: d,
        icon: '\u{1F6DD}', name: 'Slide', prompt: 'Ride the slide!',
        pos: [d.exit.x, d.exit.z], radius: 1.2,
      });
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
    player.playEmote('squat', { freezeAt: 1.8 });
    this.state.presence?.broadcast({ emote: 'squat' });
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
      const g = this.world.collision.groundAt(player.pos.x, player.pos.z, player.pos.y + 0.3);
      player.pos.y = g;
      this.world.fx.spawn(player.pos.x, g + 0.03, player.pos.z, { color: 0xcbb794, from: 0.2, to: 0.9, dur: 0.45, alpha: 0.4 });
      window.odaSfx && window.odaSfx.tone(170, 0.08, 'triangle', 0.07);
      this.active = null;
    }
  }

  // ── shared ────────────────────────────────────────────────────────────────

  /** Start a ride from its prompt zone. Returns a toast line or null. */
  begin(zone, player) {
    if (this.active || this.state.seated || this.state.tag?.playerFrozen) return null;
    return zone.ride === 'swing' ? this._beginSwing(player) : this._beginSlide(player, zone);
  }

  update(dt, player, intent) {
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
    if (!this.active) return;
    if (this.active.kind === 'swing') this._updateSwing(dt, player, intent);
    else this._updateSlide(dt, player);
  }
}

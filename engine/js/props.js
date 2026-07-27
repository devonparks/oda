/**
 * AMG World Engine — the prop database runtime: mounts, motion, IK.
 *
 * This is M4, the milestone Devon actually cares about. His words: *"the
 * character isn't sitting on the seat."* The fix is data, not cleverness:
 * every mountable prop has an entry in engine/assets/prop_db.json giving, in
 * the PROP'S OWN LOCAL SPACE — measured off the real geometry by
 * tools/engine/seed_prop_db.mjs, not guessed —
 *
 *   seat   where the butt goes, and which way the rider faces
 *   clip   the prop's own animation (+ clipStatus: 'placeholder' means a
 *          near-neighbour clip stands in until a bespoke one is baked — the
 *          gap is recorded in the data, not waved away)
 *   hands  / feet   IK pin points (chains, grips, bars, pedals)
 *   motion how the prop itself moves (rock / swing / seesaw / spin / slide /
 *          zip / traverse), with the pivot and axis in the data too
 *
 * THE PLACEMENT CONTRACT (ported from the three.js park, engine/js/clips.js):
 * seated clips bake hipY −0.261, so when the seated pose holds, the pelvis
 * sits at BIND_PELVIS_Y + hip(t) above the model origin and the bottom of the
 * butt is BUTT_BELOW_PELVIS below the pelvis. The mount reads the rig's LIVE
 * hip offset each frame, so the butt tracks the seat even while the pose is
 * still blending in — placing against the final pose made kids sink through
 * seats for a beat on every mount in the old park.
 *
 * MOTION AND THIN INSTANCES. A moving prop is one world-space rigid delta W
 * per frame (rotation about a pivot, or a translation along a track), written
 * into the moving parts' thin-instance matrices — the exact mechanism the
 * object layer already uses to hide things. The rider's seat and pins ride
 * through the same W, which is what keeps the kid ON the swing instead of
 * near it: one transform, one truth.
 */
import { Vector3, Quaternion, Matrix } from 'babylon';
import { BIND_PELVIS_Y, BUTT_BELOW_PELVIS } from './clips.js';

const INTERACT_RADIUS = 1.7;     // how close before a prop offers itself
const PUMP_AMP = 0.88;           // swing amplitude at full pump (three.js park value)
const COAST_AMP = 0.30;          // where an un-pumped swing settles
const SEESAW_G = 5.2;            // the lever sim, straight from world/js/rides.js
const SEESAW_PUSH = 4.6;
const TRAVERSE_SPEED = 0.75;     // m/s along monkey bars / the track ride

// module scratch — the per-frame path allocates nothing
const _m = new Matrix();
const _w = new Matrix();
/**
 * The active spot's frame matrix, held for the WHOLE update. It must not be
 * a shared scratch: the first version computed it into `_m`, handed it into
 * the IK by reference, and the hand solver reused `_m` internally — so the
 * FEET pins were transformed by leftover rotation garbage and both ankles
 * chased points half a metre off the pedals while the hands sat perfect.
 */
const _spotM = new Matrix();
const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();

export class Props {
  /**
   * @param {Scene} scene
   * @param {{items:Array, protos:Map}} park
   * @param {Character} player
   * @param {object} db  the parsed prop_db.json
   */
  constructor(scene, park, player, db) {
    this.scene = scene;
    this.park = park;
    this.player = player;
    this.db = db;
    this.active = null;                    // { spot, seat, sim }
    this.spots = this._buildSpots();
    this.prompt = null;                    // nearest mountable spot, set each frame
    this._promptEl = null;
    this._ik = null;                       // lazy: built on first mount
    this._time = 0;
  }

  static async load(scene, park, player) {
    const db = await (await fetch(new URL('../assets/prop_db.json', import.meta.url))).json();
    return new Props(scene, park, player, db);
  }

  /**
   * One SPOT per mountable placement: the placement row, its db entry, and
   * the sibling part placements that move with it (clustered by horizontal
   * distance, the three.js park's clusterParts rule).
   */
  _buildSpots() {
    const spots = [];
    const partRows = this.park.items.filter((it) => {
      const e = this.db[it.proto];
      return !e || !e.seat;                // anything without its own seat can be a part
    });
    for (const it of this.park.items) {
      const entry = this.db[it.proto];
      if (!entry || !entry.seat) continue;
      const spot = {
        id: spots.length, item: it, entry,
        pos: it.pos, parts: [],
        moving: [it],                      // instances W applies to (self by default)
        parkedW: null,                     // where a driven prop was left
      };
      if (entry.parts && entry.parts.length) {
        for (const p of partRows) {
          if (!entry.parts.includes(p.proto)) continue;
          if (Math.hypot(p.pos[0] - it.pos[0], p.pos[2] - it.pos[2]) > 1.6) continue;
          spot.parts.push(p);
        }
        if (entry.moving) {
          // a coin ride's pedestal stays put; only the listed parts rock
          spot.moving = spot.parts.filter((p) => entry.moving.includes(p.proto));
        } else {
          spot.moving = [it, ...spot.parts];
        }
      }
      // props with no motion move nothing
      if (!entry.motion) spot.moving = [];
      spots.push(spot);
    }
    console.log(`[props] ${spots.length} mountable spots from ${Object.keys(this.db).length - 1} db entries`);
    return spots;
  }

  /** All spots whose prototype or entry kind matches, for the probes. */
  find(pattern) {
    const re = new RegExp(pattern, 'i');
    return this.spots.filter((s) => re.test(s.item.proto) || re.test(s.entry.kind));
  }

  // ── seats ─────────────────────────────────────────────────────────────────

  /**
   * The seat positions a spot offers, in the spot's local space.
   * Benches seat two, picnic tables four, the seesaw one per end.
   */
  _seatsOf(spot) {
    const e = spot.entry;
    const base = { pos: e.seat.pos, yaw: e.seat.yaw };
    const span = e.seatSpan;
    if (!span || span.half < 0.25) return [base];
    const ax = span.axis === 'x' ? [1, 0, 0] : [0, 0, 1];
    const off = (k) => ({
      pos: [base.pos[0] + ax[0] * k, base.pos[1], base.pos[2] + ax[2] * k],
      yaw: base.yaw,
    });
    if (e.kind === 'seesaw') {
      // one seat per end, facing the pivot
      const a = off(span.half), b = off(-span.half);
      a.yaw = Math.atan2(-ax[0] * span.half, -ax[2] * span.half);
      b.yaw = Math.atan2(ax[0] * span.half, ax[2] * span.half);
      a.end = 1; b.end = -1;
      return [a, b];
    }
    const seats = [off(-span.half * 0.55), off(span.half * 0.55)];
    if (e.tableSides) {
      // mirror the bench across the table for the other two seats
      const lat = e.tableSides.axis === 'x' ? 0 : 2;
      for (const s of seats.slice()) {
        const m2 = { pos: s.pos.slice(), yaw: s.yaw + Math.PI };
        m2.pos[lat] = -m2.pos[lat];
        seats.push(m2);
      }
    }
    return seats;
  }

  /**
   * World matrix of a spot right now: its placement, times whatever delta
   * applies — the live motion while it is ridden, or the pose it was PARKED
   * in once the rider hops off. Leaving the kart where you left it is the
   * whole point of driving it somewhere.
   */
  _spotMatrix(spot, out) {
    out.copyFrom(spot.item.matrix);
    const d = (this.active && this.active.spot === spot) ? this.active.W : spot.parkedW;
    if (d && !d.isIdentity()) out.multiplyToRef(d, out);
    return out;
  }

  // ── mounting ──────────────────────────────────────────────────────────────

  /** The nearest free spot within reach of the player, or null. */
  nearest() {
    const p = this.player.position;
    let best = null, bd = INTERACT_RADIUS;
    for (const s of this.spots) {
      if (s.item.hidden) continue;
      const d = Math.hypot(s.pos[0] - p.x, s.pos[2] - p.z);
      // big props (slides, monkey bars) measure from their seat instead
      if (d < bd + Math.max(...s.entry.dims) * 0.5) {
        Vector3.TransformCoordinatesFromFloatsToRef(
          s.entry.seat.pos[0], s.entry.seat.pos[1], s.entry.seat.pos[2], s.item.matrix, _v);
        const ds = Math.hypot(_v.x - p.x, _v.z - p.z);
        const dd = Math.min(d, ds);
        if (dd < bd) { bd = dd; best = s; }
      }
    }
    return best;
  }

  /** Mount a spot (nearest seat to the player). Returns false if it refused. */
  async mount(spot = this.nearest()) {
    if (!spot || this.active) return false;
    const seats = this._seatsOf(spot);
    const p = this.player.position;
    let seat = seats[0], bd = Infinity;
    for (const s of seats) {
      Vector3.TransformCoordinatesFromFloatsToRef(s.pos[0], s.pos[1], s.pos[2], spot.item.matrix, _v);
      const d = Math.hypot(_v.x - p.x, _v.z - p.z);
      if (d < bd) { bd = d; seat = s; }
    }

    this.active = {
      spot, seat,
      W: Matrix.Identity(),
      t: 0,
      env: 0,                       // motion envelope, eases 0→1
      sim: { angle: 0, vel: 0, phase: 0, amp: COAST_AMP, s: 0, dir: 1 },
      returnTo: { x: p.x, y: p.y, z: p.z },
    };
    this.player.mounted = this;
    const ok = await this.player.rig.play(spot.entry.clip, { loop: true });
    if (!ok) console.warn('[props] clip missing:', spot.entry.clip);
    console.log(`[props] mounted ${spot.item.proto} (${spot.entry.kind}) — clip ${spot.entry.clip}`
      + (spot.entry.clipStatus === 'placeholder' ? ` [placeholder, wants ${spot.entry.wantClip || '?'}]` : ''));
    return true;
  }

  dismount() {
    const a = this.active;
    if (!a) return false;

    /**
     * A DRIVEN PROP STAYS WHERE YOU LEFT IT. Its final delta is kept as the
     * spot's parked pose and written into the instances, so the kart you
     * rode across the park is over there now — not snapped back to the
     * layout. Everything else (a swing, a seesaw) returns to rest, because
     * a swing that keeps its tilt forever just looks broken.
     */
    const driven = a.spot.entry.motion && a.spot.entry.motion.type === 'drive';
    if (driven) a.spot.parkedW = a.W.clone();
    const rest = driven ? a.spot.parkedW : null;
    for (const it of a.spot.moving) {
      if (rest) it.matrix.multiplyToRef(rest, _w);
      it.mesh.thinInstanceSetMatrixAt(it.index, rest ? _w : it.matrix, true);
    }

    // step off BESIDE where the prop actually is now, not where it started
    const M = this._spotMatrix(a.spot, _spotM);
    Vector3.TransformCoordinatesFromFloatsToRef(
      a.seat.pos[0], a.seat.pos[1], a.seat.pos[2], M, _v);
    const side = a.seat.yaw + Math.PI / 2;
    const ox = _v.x + Math.sin(side) * 0.85;
    const oz = _v.z + Math.cos(side) * 0.85;

    this.active = null;
    this.player.mounted = null;
    this.player.rig.stop();
    this._ikRelease();
    this.player.tp(ox, oz, Math.max(_v.y + 0.6, 0.8));
    console.log('[props] dismounted', a.spot.item.proto);
    return true;
  }

  // ── the per-frame update ──────────────────────────────────────────────────

  /**
   * Runs from Character.update while mounted — the character controller is
   * bypassed entirely (its capsule would fight every moving seat) and the
   * model is placed straight from the seat frame.
   *
   * @param {number} dt seconds
   * @param {{f:number, r:number, run:boolean, jump:boolean}} input
   */
  update(dt, input) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    this._time += dt;
    const e = a.spot.entry;

    // Space hops off (except the seesaw, where it pushes — X hops off there)
    const wantOff = input.jump && !(e.kind === 'seesaw');
    if (wantOff) { input.jump = false; this.dismount(); return; }

    // ── 1. the motion sim → world delta W ─────────────────────────────
    this._motion(a, dt, input);

    // ── 2. seat → world, rider on it ──────────────────────────────────
    const M = this._spotMatrix(a.spot, _spotM);
    Vector3.TransformCoordinatesFromFloatsToRef(
      a.seat.pos[0], a.seat.pos[1], a.seat.pos[2], M, _v);

    // rider orientation: seat yaw composed with the prop's (tilting) frame
    Quaternion.FromRotationMatrixToRef(M.getRotationMatrix(), _q);
    Quaternion.FromEulerAnglesToRef(0, a.seat.yaw, 0, this.player.model.rotationQuaternion);
    _q.multiplyToRef(this.player.model.rotationQuaternion, this.player.model.rotationQuaternion);

    /**
     * Butt on the seat — the clips.js contract, both terms in their own
     * frames:
     *
     *   pelvis = origin + R·(0, BIND_PELVIS_Y, 0) + (0, hip, 0)
     *   butt   = pelvis − R·(0, BUTT_BELOW_PELVIS, 0)
     *
     * The bind offset ROTATES with the kid; the hip drop is WORLD-vertical
     * (the rig applies it along world up — see rig.js step 5). `hipApplied`
     * is read live, so the butt tracks the seat even while the pose is
     * still blending in.
     */
    const rig = this.player.rig;
    if (e.mode === 'sit') {
      const lift = BIND_PELVIS_Y - BUTT_BELOW_PELVIS;      // rotates with the kid
      const hip = rig.hipApplied || 0;                     // world-vertical
      this.player.model.rotationQuaternion.toRotationMatrix(_w);
      Vector3.TransformNormalToRef(Vector3.UpReadOnly, _w, _v2);
      this.player.model.position.set(
        _v.x - _v2.x * lift, _v.y - _v2.y * lift - hip, _v.z - _v2.z * lift);
    } else {
      // 'stand' and 'hang': the model origin (the feet) goes on the seat point
      this.player.model.position.set(_v.x, _v.y, _v.z);
    }

    // ── 3. animation: drive the clip from the prop where the prop leads ──
    rig.update(dt, { speed: 0, grounded: true, vy: 0 });
    if (e.motion && (e.motion.type === 'rock' || e.motion.type === 'swing') && rig.playing === e.clip) {
      // the pose only reads as riding if it moves IN TIME with the prop
      const info = rig.actions.info(e.clip);
      if (info) {
        const cyc = ((a.sim.phase / (Math.PI * 2)) % 1 + 1) % 1;
        rig.setActionTime(e.clip, cyc * info.dur);
      }
    } else if (e.motion && e.motion.pedal && rig.playing === e.clip) {
      // legs turn with the WHEELS, so a parked bike does not pedal the air
      const info = rig.actions.info(e.clip);
      if (info) {
        const cyc = ((a.sim.roll / 1.6) % 1 + 1) % 1;
        rig.setActionTime(e.clip, cyc * info.dur);
      }
    }

    // ── 4. pin hands and feet ─────────────────────────────────────────
    this._ikApply(a, M);

    // keep the physics capsule parked under the seat so nothing collides oddly
    // and the camera boom (which reads model.position) stays smooth
    this.player.cc.setPosition(_v.set(
      this.player.model.position.x,
      this.player.model.position.y + 0.9,
      this.player.model.position.z));
    this.player.cc.setVelocity(Vector3.Zero());
  }

  /** The prompt line for the HUD, refreshed by boot each frame-ish. */
  hudText() {
    if (this.active) {
      const e = this.active.spot.entry;
      if (e.kind === 'seesaw') return 'SPACE push · X hop off';
      if (e.kind === 'swing') return 'W pump · SPACE hop off';
      if (e.motion && e.motion.type === 'drive') return 'W/S drive · A/D steer · SPACE hop off';
      return 'SPACE hop off';
    }
    const near = this.nearest();
    return near ? `E — ride the ${labelOf(near)}` : null;
  }

  // ── motion sims ───────────────────────────────────────────────────────────

  /**
   * Every motion is ONE rigid world-space delta W applied to the moving
   * instances, the seat, and the pins. Rotations happen about the measured
   * pivot along the measured axis — both from the database, both in the
   * prop's local space, transformed by the placement like everything else.
   */
  _motion(a, dt, input) {
    const e = a.spot.entry;
    const mo = e.motion;
    a.W.copyFrom(Matrix.IdentityReadOnly);
    if (!mo) return;
    a.env = Math.min(1, a.env + dt / 0.6);
    const sim = a.sim;

    switch (mo.type) {
      case 'rock': {
        sim.phase += dt * Math.PI * 2 * (mo.hz || 0.6);
        sim.angle = (mo.amp || 0.2) * Math.sin(sim.phase) * a.env;
        this._rotW(a, mo, sim.angle);
        break;
      }
      case 'swing': {
        const L = Math.max(0.5, mo.length || 1.8);
        const w = Math.sqrt(9.81 / L);                    // the pendulum's own frequency
        sim.phase += dt * w;
        const want = input.f > 0 ? PUMP_AMP : COAST_AMP;  // hold W to pump
        sim.amp += (want - sim.amp) * Math.min(1, dt * 0.8);
        sim.angle = sim.amp * Math.sin(sim.phase) * a.env * 0.5;
        this._rotW(a, mo, sim.angle);
        break;
      }
      case 'seesaw': {
        // sim.angle is the +1 end's lift, −1..1; the ridden end sinks and a
        // push only works from the ground — you shove off, like the real thing
        const end = a.seat.end || 1;
        sim.vel -= SEESAW_G * end * dt;
        if (input.jump) {
          input.jump = false;
          if (end * sim.angle < -0.6) sim.vel = SEESAW_PUSH * end;
        }
        sim.angle += sim.vel * dt;
        if (sim.angle < -1) { sim.angle = -1; sim.vel = Math.max(0, sim.vel); }
        if (sim.angle > 1) { sim.angle = 1; sim.vel = Math.min(0, sim.vel); }
        this._rotW(a, mo, sim.angle * (mo.max || 0.34));
        break;
      }
      case 'spin': {
        const push = input.f > 0 ? 1.4 : 0;               // hold W to spin up
        sim.vel = Math.max(0, Math.min(2.4, sim.vel + (push - 0.25) * dt));
        sim.phase += sim.vel * dt;
        this._rotW(a, mo, sim.phase);
        break;
      }
      case 'slide': {
        // ride the chute top→exit once, then hop off at the bottom
        sim.s = Math.min(1, sim.s + dt / (mo.time || 1.15));
        const k = sim.s * sim.s * (3 - 2 * sim.s);        // smoothstep: gains speed
        a.seat = {
          ...a.seat,
          pos: [
            e.seat.pos[0] + (mo.to[0] - e.seat.pos[0]) * k,
            e.seat.pos[1] + (mo.to[1] - e.seat.pos[1]) * k,
            e.seat.pos[2] + (mo.to[2] - e.seat.pos[2]) * k,
          ],
        };
        if (sim.s >= 1) { this.dismount(); return; }
        break;
      }
      /**
       * DRIVING. The prop gets a world pose of its own — position, heading,
       * speed — and W is simply "what turns the placement into that pose":
       * spin about the prop's own origin by the heading change, then
       * translate by how far it has travelled. Everything else falls out of
       * machinery that already exists: the rider sits in the prop's frame,
       * so it steers with the kart for free, and the wheels/handlebars are
       * sibling instances in `moving`, so the whole vehicle goes as one.
       *
       * The ground is followed by a downward physics ray each frame rather
       * than by giving the vehicle a body: a Havok body would have to fight
       * the character controller for the rider, which is exactly the
       * two-systems mismatch mounting exists to avoid. A short ray FORWARD
       * stops the kart at fences and walls — crude next to real vehicle
       * physics, but it is honest about what it is and it keeps kids inside
       * the park.
       */
      case 'drive': {
        if (!sim.driving) {
          const m0 = a.spot.item.matrix.m;
          const q = a.spot.item.quat;
          sim.x0 = m0[12]; sim.y0 = m0[13]; sim.z0 = m0[14];
          sim.yaw0 = Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0]));
          sim.x = sim.x0; sim.y = sim.y0; sim.z = sim.z0;
          sim.yaw = sim.yaw0; sim.speed = 0; sim.roll = 0;
          sim.driving = true;
        }
        const top = mo.maxSpeed || 4;
        sim.speed += (input.f || 0) * (mo.accel || 3) * dt;
        sim.speed *= Math.exp(-1.5 * dt);                    // rolling friction
        sim.speed = Math.max(-top * 0.4, Math.min(top, sim.speed));
        if (Math.abs(sim.speed) < 0.02) sim.speed = 0;

        /**
         * Steering bites with speed and reverses in reverse — but a rider
         * holding the throttle can always turn, even at a standstill. That
         * is not physics, it is the difference between "nosed into the
         * fence, shuffle round and drive off" and "nosed into the fence,
         * stuck forever": with speed-only steering a blocked kart has zero
         * speed, so zero steering, so no way out.
         */
        const rolling = Math.min(1, Math.abs(sim.speed) / 1.2) * Math.sign(sim.speed || 1);
        const bite = Math.abs(rolling) > 0.35 ? rolling : (input.f ? 0.35 : rolling);
        sim.yaw -= (input.r || 0) * (mo.turn || 1.8) * dt * bite;

        const fx = Math.sin(sim.yaw), fz = Math.cos(sim.yaw);
        const step = sim.speed * dt;
        const nx = sim.x + fx * step, nz = sim.z + fz * step;
        if (step !== 0 && this._blocked(sim.x, sim.y, sim.z, fx, fz, step)) {
          sim.speed = 0;
        } else {
          sim.x = nx; sim.z = nz;
        }
        const gy = this._groundAt(sim.x, sim.z, sim.y);
        if (gy != null) sim.y += (gy - sim.y) * Math.min(1, dt * 12);

        // pedal cadence rides the wheels, so a bike only pedals when moving
        sim.roll += sim.speed * dt;

        // W = spin about the prop's own origin, then travel
        Matrix.TranslationToRef(-sim.x0, -sim.y0, -sim.z0, a.W);
        Matrix.RotationAxisToRef(Vector3.UpReadOnly, sim.yaw - sim.yaw0, _w);
        a.W.multiplyToRef(_w, a.W);
        Matrix.TranslationToRef(sim.x, sim.y, sim.z, _w);
        a.W.multiplyToRef(_w, a.W);
        break;
      }
      case 'traverse': case 'zip': {
        // move along the bar/track axis with A/D (or W to keep going)
        const dir = (input.r || input.f || 0);
        sim.s = Math.max(-1, Math.min(1, sim.s + dir * dt * TRAVERSE_SPEED / Math.max(0.5, mo.half)));
        const ax = mo.axis === 'x' ? [1, 0, 0] : [0, 0, 1];
        const off = sim.s * mo.half;
        if (mo.type === 'zip') {
          // the handle travels too — W is a pure translation
          Matrix.TranslationToRef(ax[0] * off, 0, ax[2] * off, a.W);
        }
        a.seat = {
          ...a.seat,
          pos: mo.type === 'zip' ? e.seat.pos : [
            e.seat.pos[0] + ax[0] * off, e.seat.pos[1], e.seat.pos[2] + ax[2] * off,
          ],
        };
        break;
      }
      default: break;
    }

    // write the delta into every moving instance (renderer AND the static
    // collider read this same buffer — the object layer's own mechanism)
    if (a.spot.moving.length && !a.W.isIdentity()) {
      for (const it of a.spot.moving) {
        it.matrix.multiplyToRef(a.W, _w);
        it.mesh.thinInstanceSetMatrixAt(it.index, _w, true);
      }
    }
  }

  /**
   * Ground height under a point, by physics ray. Returns null over a hole,
   * which leaves the vehicle at its last height rather than dropping it
   * through the world.
   */
  _groundAt(x, z, y) {
    const pe = this.scene.getPhysicsEngine();
    if (!pe) return null;
    const top = y + 1.2;
    _v.set(x, top, z);
    _v2.set(x, y - 2.5, z);
    const hit = pe.raycast(_v, _v2);
    if (!hit || !hit.hasHit) return null;
    const gy = hit.hitPointWorld.y;
    /**
     * REJECT A HIT AT THE RAY'S OWN START. Starting a ray inside geometry
     * makes Havok report a hit at distance zero — i.e. at `top`, which is
     * ABOVE the vehicle. Chasing that every frame walked a scooter 42 m
     * into the sky (measured: seat y 8.91 → 51.23 in two seconds). Ground
     * can rise under a kart, but not by more than a kerb per step.
     */
    if (gy > y + 0.75) return null;
    return gy;
  }

  /**
   * Is something solid right in front of the vehicle — a fence, a wall — as
   * opposed to ground that simply rises?
   *
   * TWO THINGS THIS HAD TO LEARN, both by measurement:
   *
   *   1. **A horizontal ray cannot tell a ramp from a wall by HEIGHT**, because
   *      its hit is always at the ray's own height. Judging by height called
   *      the skate bowl's rising floor a wall and a skateboard parked on it
   *      never moved a centimetre. The discriminator is the surface NORMAL:
   *      a wall's points sideways, a ramp's points mostly up.
   *   2. **The ray must fly UNDER the rider.** At 0.62 m it hit
   *      `CCTransformNode` — the character controller capsule of the very
   *      kid doing the driving — so the kart was blocked by its own driver,
   *      and which props it struck depended on where each seat sits. Probed
   *      per height: 0.35 m is clear of the capsule, 0.62 m is not.
   */
  _blocked(x, y, z, fx, fz, step) {
    const pe = this.scene.getPhysicsEngine();
    if (!pe) return false;
    const reach = Math.abs(step) + 0.45;
    const s = Math.sign(step);
    const h = y + 0.35;                    // below the rider's capsule
    _v.set(x, h, z);
    _v2.set(x + fx * reach * s, h, z + fz * reach * s);
    const hit = pe.raycast(_v, _v2);
    if (!hit || !hit.hasHit) return false;
    const n = hit.hitNormalWorld;
    if (!n) return true;                   // no normal to judge by: play it safe
    return Math.abs(n.y) < 0.6;            // steep face = wall, flat = ramp
  }

  /** W = rotate `angle` about the prop's pivot/axis, in world space. */
  _rotW(a, mo, angle) {
    const M = a.spot.item.matrix;
    Vector3.TransformCoordinatesFromFloatsToRef(mo.pivot[0], mo.pivot[1], mo.pivot[2], M, _v);
    Vector3.TransformNormalFromFloatsToRef(mo.axisV[0], mo.axisV[1], mo.axisV[2], M, _v2);
    _v2.normalize();
    Matrix.TranslationToRef(-_v.x, -_v.y, -_v.z, a.W);
    Matrix.RotationAxisToRef(_v2, angle, _w);
    a.W.multiplyToRef(_w, a.W);
    Matrix.TranslationToRef(_v.x, _v.y, _v.z, _w);
    a.W.multiplyToRef(_w, a.W);
  }

  // ── IK pins ───────────────────────────────────────────────────────────────

  /**
   * Two-bone analytic IK, written straight onto the rig's transform nodes.
   *
   * Why not Babylon's BoneIKController: this skeleton is DRIVEN by linked
   * transform nodes (the glTF loader links every bone), and the rig writes
   * those nodes every frame — the same reason rig.js hand-rolls its sampling.
   * A controller fighting the rig for the same bones through a different
   * write path is exactly the two-systems mismatch this milestone removes.
   * The solver below is the standard law-of-cosines two-bone reach: rotate
   * the upper bone so the chain plane contains the target, bend the elbow /
   * knee to close the distance. It writes AFTER rig.update, so the clip
   * poses the body and the pins only correct the last 30 cm.
   */
  _ikBuild() {
    const rig = this.player.rig;
    const byName = new Map(rig.loco.bones.map((n, i) => [n, rig.bones[i]]));
    const limb = (upper, lower, end) => {
      const u = byName.get(upper), l = byName.get(lower), t = byName.get(end);
      return u && l && t ? { u, l, t } : null;
    };
    this._ik = {
      handL: limb('Shoulder_L', 'Elbow_L', 'Hand_L'),
      handR: limb('Shoulder_R', 'Elbow_R', 'Hand_R'),
      footL: limb('UpperLeg_L', 'LowerLeg_L', 'Ankle_L'),
      footR: limb('UpperLeg_R', 'LowerLeg_R', 'Ankle_R'),
    };
  }

  _ikRelease() { /* nothing persistent: the rig re-poses every frame anyway */ }

  _ikApply(a, M) {
    const e = a.spot.entry;
    if (!e.hands && !e.feet) return;
    if (!this._ik) this._ikBuild();
    // pins are authored relative to the PRIMARY seat; a rider on a span seat
    // (the seesaw's far end, a bench's second spot) carries them along
    const dx = a.seat.pos[0] - e.seat.pos[0];
    const dy = a.seat.pos[1] - e.seat.pos[1];
    const dz = a.seat.pos[2] - e.seat.pos[2];
    if (e.hands) this._pinPair(this._ik.handL, this._ik.handR, e.hands, M, dx, dy, dz);
    if (e.feet) this._pinPair(this._ik.footL, this._ik.footR, e.feet, M, dx, dy, dz);
  }

  /**
   * Pin a PAIR of limbs to a pair of targets, assigning each target to the
   * nearer limb. The database stores "two grips", not "the left grip then
   * the right": whether prop-local −X is the rider's left depends entirely
   * on the seat yaw, and the first version hard-wired it — the kid gripped
   * the swing's chains with crossed arms, left hand fine, right hand 70 cm
   * short on the far chain.
   */
  _pinPair(limbA, limbB, targets, M, dx, dy, dz) {
    if (!limbA || !limbB) return;
    const t0 = Vector3.TransformCoordinates(
      new Vector3(targets[0][0] + dx, targets[0][1] + dy, targets[0][2] + dz), M);
    const t1 = Vector3.TransformCoordinates(
      new Vector3(targets[1][0] + dx, targets[1][1] + dy, targets[1][2] + dz), M);
    limbA.u.computeWorldMatrix(true);
    limbB.u.computeWorldMatrix(true);
    const pa = limbA.u.getAbsolutePosition();
    const pb = limbB.u.getAbsolutePosition();
    const straight = Vector3.DistanceSquared(pa, t0) + Vector3.DistanceSquared(pb, t1);
    const crossed = Vector3.DistanceSquared(pa, t1) + Vector3.DistanceSquared(pb, t0);
    if (straight <= crossed) {
      this._solve(limbA, t0); this._solve(limbB, t1);
    } else {
      this._solve(limbA, t1); this._solve(limbB, t0);
    }
  }

  /**
   * Close a 2-joint chain onto a world target: CCD on the REAL matrices.
   *
   * An analytic two-bone solve was tried first and left 25–70 cm of
   * steady-state error: it reasons from rest offsets and bend planes, and a
   * clip-posed skeleton keeps invalidating both. CCD reasons from nothing —
   * each step reads the end effector's ACTUAL world position and rotates one
   * joint to swing it toward the target, so its geometry cannot drift from
   * the truth. Child first (elbow/knee), then parent (shoulder/hip), a few
   * clamped iterations; the clip re-poses every frame, so there is no
   * accumulation to fight and no springiness to damp.
   *
   * Everything stays in the engine's one convention: a world-space
   * correction becomes a node-local one through the parent's inverted world
   * matrix (which also unscales — this rig is a centimetre rig, see rig.js).
   */
  _solve(limb, targetW) {
    const chain = [limb.l, limb.u];                 // child first converges faster here
    for (let it = 0; it < 3; it++) {
      for (const node of chain) {
        limb.t.computeWorldMatrix(true);
        node.computeWorldMatrix(true);
        const E = limb.t.getAbsolutePosition();
        const J = node.getAbsolutePosition();
        _v.copyFrom(E).subtractInPlace(J);          // joint → end effector
        _v2.copyFrom(targetW).subtractInPlace(J);   // joint → target
        if (_v.lengthSquared() < 1e-8 || _v2.lengthSquared() < 1e-8) continue;
        _v.normalize(); _v2.normalize();
        const dot = Math.max(-1, Math.min(1, Vector3.Dot(_v, _v2)));
        const ang = Math.acos(dot);
        if (ang < 2e-3) continue;
        const axisW = Vector3.Cross(_v, _v2);
        if (axisW.lengthSquared() < 1e-9) continue;
        axisW.normalize();
        // world axis → this node's parent-local axis (un-rotate AND un-scale)
        node.parent.computeWorldMatrix(true);
        node.parent.getWorldMatrix().invertToRef(_w);
        Vector3.TransformNormalToRef(axisW, _w, _v);
        if (_v.lengthSquared() < 1e-9) continue;
        _v.normalize();
        Matrix.RotationAxisToRef(_v, Math.min(ang, 0.6), _m);
        node.rotationQuaternion.toRotationMatrix(_w);
        _w.multiplyToRef(_m, _w);                    // R then Δ (row-vector order)
        Quaternion.FromRotationMatrixToRef(_w, node.rotationQuaternion);
      }
    }
  }
}

/** A human name for the prompt line. */
function labelOf(spot) {
  const k = spot.entry.kind;
  const names = {
    bench: 'bench', table: 'picnic table', coinride: 'coin ride', rocker: 'spring rider',
    seesaw: 'seesaw', swing: 'swing', slide: 'slide', monkey: 'monkey bars', zip: 'track ride',
    kart: 'kart', bike: 'bike', scooter: 'scooter', pogo: 'pogo stick', board: 'skateboard',
    sit_on: 'seat', spinner: 'spinner',
  };
  return names[k] || spot.item.proto;
}

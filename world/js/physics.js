/**
 * AMG World — lightweight prop physics + ground FX.
 *
 * The park's layout already has balls and a toy duck lying around; they were
 * baked into the static prop batch, which made them scenery. Now they're
 * DYNAMIC: walk into a ball and it rolls away, kick it at a wall and it
 * bounces, kick it into the pond and it floats. The duck bobs on the water and
 * can be nudged. NPCs kick too, so the park plays with itself a little.
 *
 * This is deliberately not a physics engine: spheres with gravity, rolling
 * friction, restitution against the existing collision grid, and buoyancy
 * inside the pond disc. A few dozen lines of integration, allocation-free per
 * frame, fine on a Chromebook. If we ever need boxes/joints, THEN we talk.
 *
 * GroundFX is a shared pool of expanding rings used for water ripples, splash
 * bursts and landing dust — one pool, tinted per use.
 */
import * as THREE from 'three';

const GRAVITY = -13;          // slightly floaty reads better for toys
const GROUND_REST = 0.45;     // vertical bounce kept
const WALL_REST = 0.55;       // horizontal bounce kept
const ROLL_DRAG = 1.6;        // e-folding /s on ground
const WATER_DRAG = 2.6;       // stronger in water
const STOP_SPEED = 0.06;
const MAX_SPEED = 9;
const KICK_COOLDOWN = 0.3;
const KICKER_R = 0.34;        // a kid's "foot circle"

const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();

export class DynamicProps {
  /** @param {World} world  needs .scene, .collision, .waterAt(), .quality */
  constructor(world) {
    this.world = world;
    this.items = [];
    /** called with (item, kickerSpeed) whenever something gets kicked */
    this.onKick = null;
    this.onSplash = null;
  }

  /**
   * Adopt a prop mesh as a dynamic item.
   * @param {THREE.Mesh} proto     the source mesh from the props GLB
   * @param {object} p             its layout entry { p, q, s }
   * @param {object} opts          { kind: 'ball'|'floater' }
   */
  add(proto, p, opts = {}) {
    const mesh = new THREE.Mesh(proto.geometry, proto.material);
    mesh.quaternion.fromArray(p.q);
    mesh.scale.fromArray(p.s);
    mesh.castShadow = !!this.world.quality?.shadows;
    // radius from the scaled bounding sphere — Synty balls are origin-centred
    if (!proto.geometry.boundingSphere) proto.geometry.computeBoundingSphere();
    const r = proto.geometry.boundingSphere.radius * Math.max(...p.s);
    const item = {
      mesh,
      kind: opts.kind || 'ball',
      r: Math.max(0.12, Math.min(r, 0.6)),
      pos: new THREE.Vector3().fromArray(p.p),
      vel: new THREE.Vector3(),
      cooldown: 0,
      bobPhase: Math.random() * Math.PI * 2,
      rippleT: 0,
      // floaters only: lazy paddling between drift targets, or a beeline to
      // thrown crumbs (see callDucks)
      driftT: 2 + Math.random() * 6,
      target: null,
      crumbT: 0,
    };
    // settle onto whatever is actually below the authored position
    item.pos.y = Math.max(item.pos.y, this.world.collision.groundAt(item.pos.x, item.pos.z, item.pos.y + 1) + item.r);
    mesh.position.copy(item.pos);
    this.world.scene.add(mesh);
    this.items.push(item);
    return item;
  }

  /**
   * @param {number} dt
   * @param {Array<{pos:THREE.Vector3, speed:number}>} kickers  player + NPCs (+ remotes)
   */
  update(dt, kickers) {
    const col = this.world.collision;
    for (const it of this.items) {
      it.cooldown -= dt;
      const water = this.world.waterAt(it.pos.x, it.pos.z);
      const inWater = water != null && it.pos.y - it.r < water + 0.15;

      // ── kicks: any avatar walking into it sends it away ──
      if (it.cooldown <= 0) {
        for (const k of kickers) {
          if (!k) continue;
          const dx = it.pos.x - k.pos.x, dz = it.pos.z - k.pos.z;
          const d2 = dx * dx + dz * dz;
          const reach = KICKER_R + it.r;
          if (d2 > reach * reach || d2 < 1e-6) continue;
          if (Math.abs(it.pos.y - k.pos.y) > 1.1) continue;
          const d = Math.sqrt(d2);
          const push = it.kind === 'floater' ? 0.45 : 1.0;   // nudge the duck, boot the ball
          const v = (1.2 + Math.min(k.speed, 4) * 1.35) * push;
          it.vel.x = (dx / d) * v;
          it.vel.z = (dz / d) * v;
          if (it.kind === 'ball') it.vel.y = Math.min(1.2 + k.speed * 0.5, 2.6);
          it.cooldown = KICK_COOLDOWN;
          this.onKick && this.onKick(it, k.speed);
          break;
        }
      }

      // ── floater steering: crumbs first, else lazy drifting ──
      if (it.kind === 'floater' && inWater) {
        let want = null, speed = 0;
        if (it.target && it.crumbT > 0) {
          it.crumbT -= dt;
          want = it.target; speed = 0.7;                  // paddling for food
        } else {
          it.driftT -= dt;
          if (it.driftT <= 0) {
            // a new spot to mosey toward, kept well inside the water
            const w = this.world.water;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * (w.r * 0.72);
            it.target = { x: w.x + Math.cos(a) * rr, z: w.z + Math.sin(a) * rr };
            it.crumbT = 0;
            it.driftT = 6 + Math.random() * 8;
          }
          if (it.target) { want = it.target; speed = 0.25; }   // no hurry
        }
        if (want) {
          const dx = want.x - it.pos.x, dz = want.z - it.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.35) {
            // arrived: crumbs get a happy nibble-bob + ring
            if (it.crumbT > 0) {
              it.crumbT = 0;
              it.bobPhase += 2.5;
              this.onSplash && this.onSplash(it.pos.x, water + 0.02, it.pos.z, 0.5);
            }
            it.target = null;
          } else {
            const k = 1 - Math.exp(-3 * dt);
            it.vel.x += ((dx / d) * speed - it.vel.x) * k;
            it.vel.z += ((dz / d) * speed - it.vel.z) * k;
            // face the way it's paddling
            it.mesh.rotation.y = Math.atan2(dx, dz);
          }
        }
      }

      // ── integrate ──
      if (inWater) {
        // buoyancy: spring toward the surface, heavy damping, gentle bob
        const target = water + it.r * 0.25;
        it.vel.y += (target - it.pos.y) * 8 * dt;
        it.vel.y *= Math.exp(-4 * dt);
        it.bobPhase += dt * 2.1;
        const dragK = Math.exp(-WATER_DRAG * dt);
        it.vel.x *= dragK; it.vel.z *= dragK;
        // moving through water leaves a wake
        it.rippleT -= dt;
        const sp = Math.hypot(it.vel.x, it.vel.z);
        if (sp > 0.25 && it.rippleT <= 0) {
          it.rippleT = 0.3;
          this.onSplash && this.onSplash(it.pos.x, water + 0.02, it.pos.z, 0.35 + it.r);
        }
      } else {
        it.vel.y += GRAVITY * dt;
      }
      it.pos.addScaledVector(it.vel, dt);

      // ── ground ──
      const ground = col.groundAt(it.pos.x, it.pos.z, it.pos.y, it.r) + it.r;
      if (it.pos.y < ground && !inWater) {
        it.pos.y = ground;
        if (it.vel.y < -0.8) it.vel.y = -it.vel.y * GROUND_REST;
        else it.vel.y = 0;
        const k = Math.exp(-ROLL_DRAG * dt);
        it.vel.x *= k; it.vel.z *= k;
      }
      if (inWater) {
        const bob = Math.sin(it.bobPhase) * 0.02;
        it.pos.y = Math.max(it.pos.y, water - it.r * 0.4) + bob * 0;
        it.mesh.rotation.z = Math.sin(it.bobPhase) * 0.06;
        it.mesh.rotation.x = Math.cos(it.bobPhase * 0.8) * 0.05;
      }

      // ── walls: slide-resolve the sphere, reflect velocity off the push ──
      const solved = col.resolve(it.pos.x, it.pos.z, it.pos.y - it.r, it.r, it.r * 2);
      if (solved.hit) {
        const nx = solved.x - it.pos.x, nz = solved.z - it.pos.z;
        const nl = Math.hypot(nx, nz);
        if (nl > 1e-6) {
          const dot = (it.vel.x * nx + it.vel.z * nz) / nl;
          if (dot < 0) {   // moving into the wall → reflect
            it.vel.x -= (1 + WALL_REST) * dot * (nx / nl);
            it.vel.z -= (1 + WALL_REST) * dot * (nz / nl);
          }
        }
        it.pos.x = solved.x; it.pos.z = solved.z;
      }
      const b = col.bounds;
      if (it.pos.x < b.minX + it.r) { it.pos.x = b.minX + it.r; it.vel.x = Math.abs(it.vel.x) * WALL_REST; }
      if (it.pos.x > b.maxX - it.r) { it.pos.x = b.maxX - it.r; it.vel.x = -Math.abs(it.vel.x) * WALL_REST; }
      if (it.pos.z < b.minZ + it.r) { it.pos.z = b.minZ + it.r; it.vel.z = Math.abs(it.vel.z) * WALL_REST; }
      if (it.pos.z > b.maxZ - it.r) { it.pos.z = b.maxZ - it.r; it.vel.z = -Math.abs(it.vel.z) * WALL_REST; }

      // clamp + stop
      const sp = it.vel.length();
      if (sp > MAX_SPEED) it.vel.multiplyScalar(MAX_SPEED / sp);
      if (!inWater && it.pos.y <= ground + 1e-4 && Math.hypot(it.vel.x, it.vel.z) < STOP_SPEED) {
        it.vel.x = 0; it.vel.z = 0;
      }

      // ── rolling: ω = (up × v) / r ──
      if (it.kind === 'ball') {
        const hx = it.vel.x, hz = it.vel.z;
        const hsp = Math.hypot(hx, hz);
        if (hsp > 0.02) {
          _axis.set(hz / hsp, 0, -hx / hsp);
          it.mesh.rotateOnWorldAxis(_axis, (hsp * dt) / it.r);
        }
      }
      it.mesh.position.copy(it.pos);
    }
  }

  /**
   * Crumbs hit the water at (x, z): every floater within `radius` paddles over.
   * Returns how many ducks answered — the toast reads differently for zero.
   */
  callDucks(x, z, radius = 11) {
    let n = 0;
    for (const it of this.items) {
      if (it.kind !== 'floater') continue;
      const d = Math.hypot(it.pos.x - x, it.pos.z - z);
      if (d > radius) continue;
      // fan out around the crumb point so they don't stack on one spot
      const a = Math.random() * Math.PI * 2;
      it.target = { x: x + Math.cos(a) * 0.5, z: z + Math.sin(a) * 0.5 };
      it.crumbT = 7;
      it.driftT = 3 + Math.random() * 4;   // resume drifting a bit after
      n++;
    }
    return n;
  }

  get count() { return this.items.length; }
}

/**
 * A pool of expanding, fading rings lying flat on the ground: water ripples,
 * splash bursts, landing dust. One geometry, one material per ring (opacity is
 * per-ring), meshes hidden when idle.
 */
export class GroundFX {
  constructor(scene, size = 14) {
    this.scene = scene;
    this.pool = [];
    const geo = new THREE.RingGeometry(0.42, 0.5, 24);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      scene.add(mesh);
      this.pool.push({ mesh, t: 0, dur: 0, from: 0.3, to: 1.3, alpha: 0.5 });
    }
    this._i = 0;
  }

  /** @param {object} o  { color, from, to, dur, alpha } */
  spawn(x, y, z, o = {}) {
    const r = this.pool[this._i];
    this._i = (this._i + 1) % this.pool.length;
    r.t = 0;
    r.dur = o.dur ?? 0.7;
    r.from = o.from ?? 0.3;
    r.to = o.to ?? 1.3;
    r.alpha = o.alpha ?? 0.5;
    r.mesh.material.color.set(o.color ?? 0xdff4ff);
    r.mesh.position.set(x, y, z);
    r.mesh.visible = true;
  }

  update(dt) {
    for (const r of this.pool) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.mesh.visible = false; r.mesh.material.opacity = 0; continue; }
      const s = r.from + (r.to - r.from) * k;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = r.alpha * (1 - k);
    }
  }
}

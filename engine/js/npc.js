/**
 * AMG World Engine — other kids in the park.
 *
 * A park with one child in it is a diagram. These are the other kids: they
 * walk the paths, they sit on the benches and the picnic tables, and they
 * get up and wander off again.
 *
 * WHY THIS IS SHORT. Every hard part was already paid for by M4. An NPC is
 * a Synty kid model, a `Rig` (the same one the player uses, reading the same
 * shared clip buffers), and a four-state loop. Sitting is not special-cased
 * anywhere: an NPC picks a spot out of the SAME `prop_db.json` the player
 * mounts from, and is placed by the SAME `seatRider()` contract, so if a
 * bench seat is right for the player it is right for them too. That is the
 * prop database proving it generalises past the one kid it was built for.
 *
 * WHAT THEY DELIBERATELY DO NOT DO:
 *   - no physics body. They are visual life, not obstacles; a capsule each
 *     would fight the player's controller for no gain, and the ground is
 *     followed by one downward ray apiece.
 *   - no moving props. Swings, seesaws and karts carry a world delta that
 *     belongs to whoever is riding, and `Props` tracks exactly one active
 *     rider. NPCs take stationary seats only, which is honest and cannot
 *     desync. (Wiring them onto swings means giving each spot its own
 *     delta — worth doing, not worth faking.)
 *   - no pathfinding. Waypoints ARE the park's path tiles, so hopping
 *     between nearby ones keeps them on the paths without a navmesh.
 *
 * PAYLOAD. Each costume is a separate ~350 KB GLB, so this is the one part
 * of the engine that meaningfully adds to what a Chromebook downloads.
 * They are therefore loaded AFTER the world is interactive, and `?npc=0`
 * turns them off entirely.
 */
import { Vector3, Quaternion, Matrix, SceneLoader } from 'babylon';
import { Rig } from './rig.js';
import { seatRider } from './props.js';

/**
 * Costumes, chosen to read as a group of different kids at a glance.
 *
 * TWO OF THE SIXTEEN CANNOT BE USED YET. `kid_explorer` and `kid_wizard`
 * fail to load with *"InstancedMesh needs to be imported before as it
 * contains a side-effect required by your code"* — those two GLBs use
 * instanced sub-meshes and the vendored bundle does not include
 * `@babylonjs/core/Meshes/instancedMesh.js`. The other fourteen load
 * cleanly (tested, all sixteen). Fixing it is one line in
 * tools/engine/vendor_entry.js, but rebuilding the bundle re-emits the
 * 12.5 MB `babylon.dev.js` blob into git history, which engine/README.md
 * says to do only when the Babylon version changes — so it waits for the
 * next legitimate rebuild rather than costing 12.5 MB for two costumes.
 */
const COSTUMES = ['kid_footballer', 'kid_princess', 'kid_tracksuit', 'kid_dino'];

/**
 * Things a kid does while standing about. The engine already ships 81
 * emote clips for the player's wheel and they cost nothing extra to use —
 * a park where everyone stands perfectly still between walks reads as a
 * screensaver. Curated to what looks right on a playground rather than
 * taking the whole library.
 */
const EMOTES = ['wave', 'cheer', 'clap', 'thumbsup', 'dab', 'twist', 'spin',
  'stretch', 'think', 'shrug', 'nod', 'fistpump', 'dustshoulder', 'lookaround'];
const EMOTE_CHANCE = 0.45;       // of any given idle pause

const WALK_SPEED = 1.35;         // m/s — the locomotion clip's honest pace
const TURN_RATE = 6;             // rad/s
const ARRIVE = 0.45;             // m
const SIT_MIN = 7, SIT_MAX = 18; // seconds on a bench
const PAUSE_MIN = 0.6, PAUSE_MAX = 3.0;

const _v = new Vector3();
const _v2 = new Vector3();
/** Each rider needs its OWN frame matrix — sharing Props's scratch would let
 *  one kid's prop overwrite another's mid-frame. */
const _mat = new Matrix();

export class Npcs {
  constructor(scene, park, props) {
    this.scene = scene;
    this.park = park;
    this.props = props;
    this.kids = [];
    this.waypoints = this._buildWaypoints();
    this.seats = this._buildSeats();
  }

  /**
   * Load `count` kids. Resolves once they are in the scene; the caller is
   * expected NOT to await this during boot.
   */
  static async load(scene, park, props, count = 4) {
    const n = new Npcs(scene, park, props);
    const base = new URL('../../assets/characters/v2/', import.meta.url).href;
    /**
     * Costumes are REUSED past the fourth kid rather than downloading more:
     * a fifth GLB is another ~350 KB, and by then the point (a group of
     * different kids) is already made. Babylon reloads a cached URL from
     * memory, so the extra kids cost frame time, not bandwidth.
     */
    for (let i = 0; i < count; i++) {
      const costume = COSTUMES[i % COSTUMES.length];
      try {
        const res = await SceneLoader.ImportMeshAsync('', base, `${costume}.glb`, scene);
        const model = res.meshes.find((m) => m.name === '__root__') || res.meshes[0];
        model.name = 'npc_' + costume + '_' + i;
        model.rotationQuaternion = Quaternion.Identity();
        for (const m of res.meshes) {
          // The kid GLBs are the one TEXTURED family here and their COLOR_0
          // renders them solid black — the same trap as the player's model.
          m.useVertexColors = false;
          m.isPickable = false;
          m.alwaysSelectAsActiveMesh = true;
        }
        const rig = new Rig(model, props.player.rig.loco, props.player.rig.actions);
        if (!rig.ok) { console.warn('[npc] rig did not bind for', costume); }
        const kid = {
          model, rig, costume,
          state: 'idle', timer: 0.5 + Math.random() * 2,
          heading: Math.random() * Math.PI * 2,
          speed: 0, target: null, spot: null, seat: null,
        };
        n._placeAtStart(kid, i);
        n.kids.push(kid);
      } catch (e) {
        console.warn('[npc] could not load', costume, e.message);
      }
    }
    console.log(`[npc] ${n.kids.length} kids, ${n.waypoints.length} waypoints, ${n.seats.length} free seats`);
    return n;
  }

  /** Path tiles make a ready-made walkable graph — no navmesh needed. */
  _buildWaypoints() {
    const out = [];
    for (const it of this.park.items) {
      if (!/^SM_Env_Path_(01|Round_0\d)$/.test(it.proto)) continue;
      out.push([it.pos[0], it.pos[2]]);
    }
    return out;
  }

  /**
   * Every seat an NPC may use, with its point already in world space.
   *
   * Benches and tables sit still. Swings and spring riders MOVE, and that is
   * now allowed because the motion delta lives on the spot rather than on
   * the player's single mount — each prop animates itself and each rider
   * reads the frame of the prop they are on. What is still excluded is
   * anything whose motion belongs to a rider's INPUT or runs once and ends:
   * driving, slides, the zip and the monkey bars' traverse, and the seesaw
   * (a lever needs two ends negotiated, which is its own feature).
   */
  _buildSeats() {
    const out = [];
    for (const spot of this.props.spots) {
      const e = spot.entry;
      const kind = e.kind;
      const motion = e.motion ? e.motion.type : null;
      const sittable = ['bench', 'table', 'sit_on'].includes(kind)
        || motion === 'swing' || motion === 'rock';
      if (!sittable) continue;
      for (const seat of this.props._seatsOf(spot)) {
        Vector3.TransformCoordinatesFromFloatsToRef(
          seat.pos[0], seat.pos[1], seat.pos[2], spot.item.matrix, _v);
        out.push({ spot, seat, world: [_v.x, _v.y, _v.z], taken: false, moving: !!motion });
      }
    }
    return out;
  }

  _placeAtStart(kid, i) {
    const w = this.waypoints.length
      ? this.waypoints[(i * 7 + 3) % this.waypoints.length]
      : [0, 8];
    const y = this._groundAt(w[0], w[1], 3) ?? 0.1;
    kid.model.position.set(w[0], y, w[1]);
  }

  /**
   * Is a kid about to walk into something?
   *
   * They hop in straight lines between path tiles, which keeps them on the
   * paths but does not stop them clipping the corner of a big central
   * structure. Measured before fixing: 2.8% of walking samples had
   * something solid within half a metre — all of it the fountain and the
   * gazebo, the two things the paths run around. So they look ahead and
   * pick somewhere else, which is cheaper and more honest than a navmesh
   * for a park this size. Throttled: one ray every 0.25 s per kid, not one
   * per frame.
   */
  _blockedAhead(kid, dt) {
    kid.lookT = (kid.lookT || 0) - dt;
    if (kid.lookT > 0) return false;
    kid.lookT = 0.25;
    const pe = this.scene.getPhysicsEngine();
    if (!pe) return false;
    const p = kid.model.position;
    _v.set(p.x, p.y + 0.45, p.z);
    _v2.set(p.x + Math.sin(kid.heading) * 0.55, p.y + 0.45, p.z + Math.cos(kid.heading) * 0.55);
    const hit = pe.raycast(_v, _v2);
    return !!(hit && hit.hasHit);
  }

  _groundAt(x, z, y) {
    const pe = this.scene.getPhysicsEngine();
    if (!pe) return null;
    _v.set(x, y + 1.2, z);
    _v2.set(x, y - 3.0, z);
    const hit = pe.raycast(_v, _v2);
    if (!hit || !hit.hasHit) return null;
    const gy = hit.hitPointWorld.y;
    return gy > y + 0.75 ? null : gy;     // a hit above us is the ray's own start
  }

  /** Somewhere to go next: usually a nearby path tile, sometimes a seat. */
  _pickTarget(kid) {
    const p = kid.model.position;
    const wantSeat = Math.random() < 0.35;
    if (wantSeat) {
      const free = this.seats.filter((s) => !s.taken && !s.spot.taken
        && Math.hypot(s.world[0] - p.x, s.world[2] - p.z) < 14);
      if (free.length) {
        const s = free[(Math.random() * free.length) | 0];
        s.taken = true;
        kid.spot = s;
        kid.target = [s.world[0], s.world[2]];
        kid.state = 'walk';
        return;
      }
    }
    // a path tile within a short hop, so they follow the path network
    const near = this.waypoints.filter((w) => {
      const d = Math.hypot(w[0] - p.x, w[1] - p.z);
      return d > 2.5 && d < 13;
    });
    const pool = near.length ? near : this.waypoints;
    if (!pool.length) { kid.state = 'idle'; kid.timer = 2; return; }
    kid.target = pool[(Math.random() * pool.length) | 0];
    kid.spot = null;
    kid.state = 'walk';
  }

  _sitDown(kid) {
    const s = kid.spot;
    kid.state = 'sit';
    kid.timer = SIT_MIN + Math.random() * (SIT_MAX - SIT_MIN);
    kid.seat = s;
    kid.speed = 0;
    s.spot.taken = true;              // the player cannot mount it either
    // a kid who chose a swing came to swing on it
    kid.pumping = s.moving ? 1 : 0;
    kid.rig.play(s.spot.entry.clip, { loop: true });
  }

  /** Play one emote through once, then go back to deciding. */
  _emote(kid) {
    const id = EMOTES[(Math.random() * EMOTES.length) | 0];
    const info = kid.rig.actions.info(id);
    if (!info) { this._pickTarget(kid); return; }
    kid.state = 'emote';
    kid.emote = id;
    // loop:false — most emotes are one-shots, and the rig would otherwise
    // loop anything whose manifest `hold` is false
    kid.rig.play(id, { loop: false });
    kid.timer = (info.dur || 2) + 0.2;
  }

  _standUp(kid) {
    if (kid.seat) {
      kid.seat.taken = false;
      // hand the prop back so it eases to rest instead of holding its tilt
      this.props.release(kid.seat.spot);
      kid.seat = null;
    }
    kid.spot = null;
    kid.pumping = 0;
    kid.rig.stop();
    kid.state = 'idle';
    kid.timer = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN);
  }

  update(dt) {
    for (const kid of this.kids) {
      switch (kid.state) {
        case 'idle': {
          kid.timer -= dt;
          kid.speed += (0 - kid.speed) * Math.min(1, dt * 6);
          if (kid.timer <= 0) {
            if (Math.random() < EMOTE_CHANCE) this._emote(kid);
            else this._pickTarget(kid);
          }
          break;
        }
        case 'emote': {
          kid.timer -= dt;
          kid.speed += (0 - kid.speed) * Math.min(1, dt * 8);
          if (kid.timer <= 0) {
            kid.rig.stop();
            kid.state = 'idle';
            kid.timer = 0.3 + Math.random() * 0.8;
          }
          break;
        }
        case 'walk': {
          const p = kid.model.position;
          const dx = kid.target[0] - p.x, dz = kid.target[1] - p.z;
          const d = Math.hypot(dx, dz);
          if (d < ARRIVE) {
            if (kid.spot) this._sitDown(kid);
            else { kid.state = 'idle'; kid.timer = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN); }
            break;
          }
          if (this._blockedAhead(kid, dt)) {
            // something is in the way — go somewhere else instead of into it
            if (kid.spot) { kid.spot.taken = false; kid.spot = null; }
            kid.state = 'idle';
            kid.timer = 0.2;
            break;
          }
          const want = Math.atan2(dx, dz);
          let turn = want - kid.heading;
          while (turn > Math.PI) turn -= Math.PI * 2;
          while (turn < -Math.PI) turn += Math.PI * 2;
          kid.heading += turn * Math.min(1, dt * TURN_RATE);
          kid.speed += (WALK_SPEED - kid.speed) * Math.min(1, dt * 4);
          p.x += Math.sin(kid.heading) * kid.speed * dt;
          p.z += Math.cos(kid.heading) * kid.speed * dt;
          const gy = this._groundAt(p.x, p.z, p.y);
          if (gy != null) p.y += (gy - p.y) * Math.min(1, dt * 10);
          break;
        }
        case 'sit': {
          kid.timer -= dt;
          if (kid.timer <= 0) this._standUp(kid);
          break;
        }
        default: break;
      }

      // orientation + pose
      if (kid.state === 'sit' && kid.seat) {
        const s = kid.seat;
        if (s.moving) {
          /**
           * A MOVING PROP DRIVES ITSELF AND ITS RIDER. Both go through the
           * same calls the player's mount uses — `animate` steps the prop's
           * own delta, `placeRider` puts the kid in the prop's frame, and
           * `syncClipPhase` ties the pose to the swing's phase so the kid
           * pumps in time rather than flailing near it. `input.f = 1` is
           * this kid deciding to pump.
           */
          this.props.animate(s.spot, dt, { f: kid.pumping, r: 0, jump: false });
          this.props.placeRider(s.spot, s.seat, kid.model, kid.rig, s.spot.entry.mode, dt, _mat);
          this.props.syncClipPhase(s.spot, kid.rig);
        } else {
          Quaternion.FromEulerAnglesToRef(0, s.seat.yaw, 0, kid.model.rotationQuaternion);
          // the prop's own frame, then the seat's facing within it
          const M = s.spot.item.matrix;
          Quaternion.FromRotationMatrixToRef(M.getRotationMatrix(), _q0);
          _q0.multiplyToRef(kid.model.rotationQuaternion, kid.model.rotationQuaternion);
          kid.rig.update(dt, { speed: 0, grounded: true, vy: 0 });
          _v.set(s.world[0], s.world[1], s.world[2]);
          seatRider(kid.model, kid.rig, _v, s.spot.entry.mode);
        }
      } else {
        Quaternion.FromEulerAnglesToRef(0, kid.heading, 0, kid.model.rotationQuaternion);
        kid.rig.update(dt, { speed: kid.speed, grounded: true, vy: 0 });
      }
    }
  }

  /** For the probes. */
  stats() {
    return this.kids.map((k) => ({
      costume: k.costume, state: k.state,
      pos: [+k.model.position.x.toFixed(2), +k.model.position.y.toFixed(2), +k.model.position.z.toFixed(2)],
      seat: k.seat ? k.seat.spot.item.proto : null,
      moving: k.seat ? !!k.seat.moving : false,
      emote: k.state === 'emote' ? k.emote : null,
      rigOk: k.rig.ok,
    }));
  }
}

const _q0 = new Quaternion();

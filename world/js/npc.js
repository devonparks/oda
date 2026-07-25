/**
 * AMG World — ambient NPC kids.
 *
 * The whole point: right now (and for a while) most players are ALONE in the
 * park. An empty world reads as broken. A handful of kid avatars wandering,
 * pausing, and waving makes it feel like recess — the Club Penguin / Poptropica
 * trick of populating a space so a solo visitor isn't staring at emptiness.
 *
 * Two honesty rules, both load-bearing for a kids' product:
 *   1. NPCs are NEVER counted in the "players here" number. That count reflects
 *      real presence only (see main.js). NPCs are scenery, not fake friends.
 *   2. NPCs wave and play but never use the chat bubbles. Ambient life, not
 *      simulated conversation — nothing that pretends to be a real classmate
 *      talking to you.
 *
 * Population scales DOWN as real players arrive: a lone visitor gets a lively
 * park; once real kids fill it, the NPCs thin out so the space is theirs.
 *
 * They reuse Avatar + the baked locomotion, so they walk and idle exactly like
 * players. Steering is plain seek-with-collision against the shared world grid.
 */
import * as THREE from 'three';
import { Avatar, preloadCharacter, characterUrl, RIG } from './avatar.js';

/** Little idle bursts of life. Ids must exist in the active rig's emote set:
 *  the v2 library (real Synty clips) vs the v1 procedural set have different
 *  names. 'wave' exists in both and is used for the greet-a-passer-by beat. */
const IDLE_EMOTES = RIG === 'v2'
  ? ['twist', 'cheer', 'nod', 'think', 'clap', 'dab', 'thumbsup']
  : ['dance', 'cheer', 'yes', 'think', 'laugh'];

/** Friendly, generic names — deliberately not styled to impersonate a real
 *  roster entry. These read as "some kids in the park", not specific people. */
const NAMES = [
  'Milo', 'Zara', 'Finn', 'Nia', 'Theo', 'Ivy', 'Kai', 'Luna',
  'Otis', 'Remy', 'Sky', 'Jay', 'Bea', 'Cole', 'Mira', 'Ash',
  'Pip', 'Suki', 'Ren', 'Wren', 'Dex', 'Juno', 'Rio', 'Tess',
];

const WALK_SPEED = 1.45;      // sits in the walk gait, so locomotion reads right
const ARRIVE = 1.1;           // metres from target that counts as "there"
const TURN_RATE = 8;          // yaw easing toward travel direction

/** NPCs wade like the player does (stepPlayer slows the player to 0.55x). */
function wadeFactor(world, a) {
  const w = world.waterAt && world.waterAt(a.pos.x, a.pos.z);
  return w != null && a.pos.y < w + 0.05 ? 0.55 : 1;
}

export class NpcCrowd {
  /**
   * @param {World} world
   * @param {Array}  manifest  character manifest (id, glb, name)
   * @param {object} opts      { base, min, max }
   */
  constructor(world, manifest, opts = {}) {
    this.world = world;
    this.manifest = manifest;
    this.base = opts.base ?? 6;      // solo-park target
    this.min = opts.min ?? 0;
    this.max = opts.max ?? (opts.base ?? 6);
    this.npcs = [];
    this._protos = [];
    this._adjustTimer = 0;
    this._nameBag = shuffle([...NAMES]);
  }

  async preload(ids) {
    // Load a varied handful sized to the crowd — enough variety without pulling
    // 8 character GLBs (~3 MB) onto a Chromebook for a park of 3. preloadCharacter
    // caches, so the player's own character (already loaded) is reused for free.
    const pick = ids || this.manifest.slice(0, Math.min(this.base + 1, 8)).map((m) => m.id);
    this._protos = [];
    for (const id of pick) {
      const m = this.manifest.find((x) => x.id === id);
      if (!m) continue;
      try {
        const proto = await preloadCharacter(m.id, characterUrl(m));
        this._protos.push(proto);
      } catch (e) { /* skip a model that failed to load */ }
    }
  }

  _nextName() {
    if (!this._nameBag.length) this._nameBag = shuffle([...NAMES]);
    return this._nameBag.pop();
  }

  /** Nearest dynamic ball within `maxD`, or null. */
  _nearestBall(pos, maxD) {
    const dyn = this.world.dynamics;
    if (!dyn) return null;
    let best = null, bestD = maxD;
    for (const it of dyn.items) {
      if (it.kind !== 'ball') continue;
      const d = pos.distanceTo(it.pos);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  /**
   * A random open point. If `from` is given, the point is at least MIN_TRAVEL
   * away, so an NPC walks a real distance and settles into the walk gait rather
   * than shuffling to a spot two steps away.
   */
  _randomPoint(from) {
    const MIN_TRAVEL = 7;
    const b = this.world.collision.bounds;
    let fallback = null;
    for (let tries = 0; tries < 16; tries++) {
      const x = THREE.MathUtils.lerp(b.minX + 3, b.maxX - 3, Math.random());
      const z = THREE.MathUtils.lerp(b.minZ + 3, b.maxZ - 3, Math.random());
      // reject points that start inside a solid box
      const solved = this.world.collision.resolve(x, z, 0.4, 0.3, 1.2);
      if (Math.hypot(solved.x - x, solved.z - z) >= 0.05) continue;
      fallback = { x, z };
      if (!from || Math.hypot(x - from.x, z - from.z) >= MIN_TRAVEL) return { x, z };
    }
    return fallback || { x: 0, z: 8 };
  }

  _spawnOne() {
    if (!this._protos.length) return;
    const proto = this._protos[(Math.random() * this._protos.length) | 0];
    const avatar = new Avatar(proto, { name: this._nextName(), networked: false });
    const p = this._randomPoint();
    avatar.pos.set(p.x, 0, p.z);
    avatar.yaw = Math.random() * Math.PI * 2;
    this.world.scene.add(avatar.group);
    const npc = {
      avatar,
      state: 'walk',
      target: this._randomPoint({ x: p.x, z: p.z }),
      timer: 2 + Math.random() * 4,
      emoteCooldown: 6 + Math.random() * 10,
      wavedAt: 0,
    };
    this.npcs.push(npc);
    return npc;
  }

  _retireFarthest(fromPos) {
    let idx = -1, far = -1;
    for (let i = 0; i < this.npcs.length; i++) {
      if (this.npcs[i].controlled) continue;   // never retire a kid mid-game
      const d = this.npcs[i].avatar.pos.distanceToSquared(fromPos);
      if (d > far) { far = d; idx = i; }
    }
    if (idx < 0) return;
    const [npc] = this.npcs.splice(idx, 1);
    npc.avatar.dispose();
  }

  /**
   * @param {Avatar}  player      the local player (pos + rig, for emote-backs)
   * @param {number} realPlayers count of REAL remote players (never includes NPCs)
   */
  update(dt, camera, player, realPlayers) {
    const playerPos = player.pos ? player.pos : player;   // accepts Avatar or Vector3
    // --- population control (throttled) ---
    this._adjustTimer -= dt;
    if (this._adjustTimer <= 0) {
      this._adjustTimer = 2.5;
      const desired = THREE.MathUtils.clamp(this.base - realPlayers, this.min, this.max);
      if (this.npcs.length < desired) this._spawnOne();
      else if (this.npcs.length > desired) this._retireFarthest(playerPos);
    }

    // --- per-NPC wander ---
    for (const npc of this.npcs) {
      // Conscripted by a park game (freeze tag drives them itself, including
      // their avatar.update) — the crowd leaves them completely alone.
      if (npc.controlled) continue;
      const a = npc.avatar;
      npc.timer -= dt;
      npc.emoteCooldown -= dt;

      if (npc.state === 'ball') {
        // Kid chases the ball; the shared kicker system boots it the moment
        // they overlap, so "chase" + "kick" is just walking at it repeatedly.
        const ball = npc.ball;
        const gone = !ball || a.pos.distanceTo(ball.pos) > 18;
        if (gone || npc.ballKicks <= 0 || npc.timer <= 0) {
          npc.state = 'idle'; npc.ball = null; npc.timer = 2 + Math.random() * 3;
        } else {
          const dx = ball.pos.x - a.pos.x, dz = ball.pos.z - a.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.55) npc.ballKicks--;      // overlapping: dynamics kicks it
          const ux = dx / (dist || 1), uz = dz / (dist || 1);
          const wantYaw = Math.atan2(ux, uz);
          let dy = (wantYaw - a.yaw) % (Math.PI * 2);
          if (dy > Math.PI) dy -= Math.PI * 2;
          if (dy < -Math.PI) dy += Math.PI * 2;
          a.yaw += dy * Math.min(1, TURN_RATE * dt);
          a.speed += (WALK_SPEED * 1.25 * wadeFactor(this.world, a) - a.speed) * Math.min(1, 8 * dt);
          const nx = a.pos.x + ux * a.speed * dt, nz = a.pos.z + uz * a.speed * dt;
          const c = this.world.collision.clampToBounds(nx, nz, 1.2);
          const solved = this.world.collision.resolve(c.x, c.z, a.pos.y, 0.28, 1.4);
          a.pos.x = solved.x; a.pos.z = solved.z;
        }
      } else if (npc.state === 'idle') {
        a.speed += (0 - a.speed) * Math.min(1, 10 * dt);
        if (npc.timer <= 0) {
          // sometimes the nearby ball is more interesting than wandering
          const ball = this._nearestBall(a.pos, 12);
          if (ball && Math.random() < 0.4) {
            npc.state = 'ball'; npc.ball = ball; npc.ballKicks = 2 + ((Math.random() * 2) | 0);
            npc.timer = 14;   // give up eventually no matter what
          } else {
            npc.state = 'walk'; npc.target = this._randomPoint(a.pos); npc.timer = 6 + Math.random() * 6;
          }
        }
      } else {
        // seek target
        const dx = npc.target.x - a.pos.x, dz = npc.target.z - a.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < ARRIVE || npc.timer <= 0) {
          // arrive → idle a moment, or immediately pick a new spot
          if (Math.random() < 0.6) { npc.state = 'idle'; npc.timer = 1.5 + Math.random() * 3.5; }
          else { npc.target = this._randomPoint(a.pos); npc.timer = 6 + Math.random() * 6; }
          a.speed += (0 - a.speed) * Math.min(1, 10 * dt);
        } else {
          const ux = dx / dist, uz = dz / dist;
          // ease yaw toward travel direction
          const wantYaw = Math.atan2(ux, uz);
          let d = (wantYaw - a.yaw) % (Math.PI * 2);
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          a.yaw += d * Math.min(1, TURN_RATE * dt);

          a.speed += (WALK_SPEED * wadeFactor(this.world, a) - a.speed) * Math.min(1, 8 * dt);
          const nx = a.pos.x + ux * a.speed * dt;
          const nz = a.pos.z + uz * a.speed * dt;
          const c = this.world.collision.clampToBounds(nx, nz, 1.2);
          const solved = this.world.collision.resolve(c.x, c.z, a.pos.y, 0.28, 1.4);
          a.pos.x = solved.x;
          a.pos.z = solved.z;
          // if we bumped something, pick a fresh target so we don't grind a wall
          if (solved.hit && Math.hypot(solved.x - nx, solved.z - nz) > 0.02) {
            npc.timer = Math.min(npc.timer, 0.3);
          }
        }
      }

      // ground follow (same hip-deep wading cap as stepPlayer — the pond bed
      // is real terrain now and would otherwise swallow a kid whole)
      let g = this.world.collision.groundAt(a.pos.x, a.pos.z, a.pos.y + 0.3);
      const wtr = this.world.waterAt && this.world.waterAt(a.pos.x, a.pos.z);
      if (wtr != null) g = Math.max(g, wtr - 0.55);
      a.pos.y = g;

      // a friendly wave when a player walks past (once per pass), or an
      // occasional idle emote so the park has little bursts of life
      if (playerPos) {
        const near = a.pos.distanceTo(playerPos);
        if (near < 3.2 && !a.rig.emoting && performance.now() - npc.wavedAt > 12000) {
          a.playEmote('wave');
          npc.wavedAt = performance.now();
        }
        // Emote-back: you emote near a kid, they answer after a beat — the
        // difference between scenery and company.
        if (player.rig && near < 4.5) {
          if (player.rig.emoting && !npc.emoteBackT && performance.now() - (npc.emoteBackAt || 0) > 9000) {
            npc.emoteBackT = 0.5 + Math.random() * 0.8;
          }
        }
        if (npc.emoteBackT) {
          npc.emoteBackT -= dt;
          if (npc.emoteBackT <= 0) {
            if (a.rig.emoting) {
              npc.emoteBackT = 0.35;   // mid-gesture: try again shortly, don't eat the reply
            } else {
              npc.emoteBackT = 0;
              npc.emoteBackAt = performance.now();
              const pool = ['wave', 'clap', 'thumbsup', 'cheer', 'heart'];
              a.playEmote(pool[(Math.random() * pool.length) | 0]);
            }
          }
        }
      }
      if (npc.emoteCooldown <= 0 && npc.state === 'idle' && !a.rig.emoting) {
        a.playEmote(IDLE_EMOTES[(Math.random() * IDLE_EMOTES.length) | 0]);
        npc.emoteCooldown = 12 + Math.random() * 18;
      }

      a.update(dt, camera);
    }
  }

  get count() { return this.npcs.length; }

  dispose() {
    for (const n of this.npcs) n.avatar.dispose();
    this.npcs = [];
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

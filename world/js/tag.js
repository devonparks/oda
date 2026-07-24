/**
 * AMG World — Freeze Tag.
 *
 * The Recess GDD in miniature: one "It" hunts, tagged kids freeze in place, and
 * teammates thaw them by touch — the rescue is the heart. Solo-vs-AI on the
 * park's own NPC kids (the GDD's "anti-death floor": always playable with zero
 * other people online). The player is always a RUNNER: the fantasy is "don't
 * get caught", and the It is a little faster than an NPC but slower than a
 * sprinting kid — you can escape, your AI friends mostly can't, so you end up
 * doing the risky rescues. That tension IS the game.
 *
 * Round shape: 3s countdown → 60s round → celebrate → crowd released. NPCs are
 * conscripted from the wandering crowd (npc.controlled = true) and given back
 * afterwards; nothing is spawned or destroyed.
 */
import * as THREE from 'three';

const ROUND_LEN = 60;
const COUNTDOWN = 3;
const IT_SPEED = 2.9;         // faster than NPC runners (2.4), slower than sprint (3.4)
const RUNNER_SPEED = 2.4;
const TAG_R = 0.62;
const RESCUE_R = 0.75;
const IMMUNE_T = 1.6;         // after a thaw, It ignores both kids briefly
const FLEE_R = 6;             // runners bolt when It is this close

const _v = new THREE.Vector3();

/** Shared steering: ease yaw toward (tx,tz), accelerate, slide along collision. */
function steer(world, a, tx, tz, speed, dt) {
  const dx = tx - a.pos.x, dz = tz - a.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) { a.speed += (0 - a.speed) * Math.min(1, 10 * dt); return dist; }
  const wantYaw = Math.atan2(dx / dist, dz / dist);
  let d = (wantYaw - a.yaw) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  a.yaw += d * Math.min(1, 9 * dt);
  a.speed += (speed - a.speed) * Math.min(1, 8 * dt);
  const nx = a.pos.x + Math.sin(a.yaw) * a.speed * dt;
  const nz = a.pos.z + Math.cos(a.yaw) * a.speed * dt;
  const c = world.collision.clampToBounds(nx, nz, 1.2);
  const s = world.collision.resolve(c.x, c.z, a.pos.y, 0.28, 1.4);
  a.pos.x = s.x; a.pos.z = s.z;
  a.pos.y = world.collision.groundAt(a.pos.x, a.pos.z, a.pos.y + 0.3);
  return dist;
}

function ringMesh(color) {
  const geo = new THREE.RingGeometry(0.5, 0.62, 24);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.renderOrder = 6;
  mesh.visible = false;
  return mesh;
}

export class TagGame {
  /**
   * @param {World} world
   * @param {object} hooks { onWin(), onLose(), toast(msg, cls), sfx(freq,dur,type,vol) }
   */
  constructor(world, hooks = {}) {
    this.world = world;
    this.hooks = hooks;
    this.state = 'idle';        // idle | countdown | running | over
    this.t = 0;
    this.it = null;             // conscripted NPC entry acting as It
    this.runners = [];          // conscripted NPC entries (runner role)
    this.playerFrozen = false;
    this._playerImmune = 0;
    this._itCool = 0;
    this._lastSecond = -1;
    this._lock = null;           // the It's committed chase target

    this.itRing = ringMesh(0xff5252);
    world.scene.add(this.itRing);
    this.freezeRings = [];      // one per conscript + one for the player
    this.hud = null;
  }

  /**
   * Busy for the WHOLE lifecycle including the 4s 'over' celebration. This
   * gate excluded 'over' once, and mashing E right after a round ended started
   * a new round mid-celebration — orphaning the old conscripts (controlled
   * stays true forever, the crowd skips and never retires them) and leaving a
   * stale _lock whose avatar isn't in the new roster, which made _freeze(...)
   * dereference undefined. Found by the audit sweep; kids WILL mash E.
   */
  get active() { return this.state !== 'idle'; }

  /** @param {NpcCrowd} crowd  @param {Avatar} player */
  start(crowd, player) {
    if (this.active || !crowd || crowd.npcs.length < 3) return false;
    // nearest NPCs play; farthest keep wandering as scenery
    const sorted = [...crowd.npcs].sort((a, b) =>
      a.avatar.pos.distanceToSquared(player.pos) - b.avatar.pos.distanceToSquared(player.pos));
    const picked = sorted.slice(0, Math.min(5, sorted.length));
    for (const n of picked) { n.controlled = true; n.tag = { frozen: false, immune: 0 }; }
    this._player = player;   // so release can unstick a frozen player's hold pose
    this.it = picked[0];
    this.runners = picked.slice(1);
    this.playerFrozen = false;
    this._playerImmune = 0;
    this._itCool = 0;
    this._lock = null;           // never inherit a chase from a previous round
    this.state = 'countdown';
    this.t = COUNTDOWN;
    this._lastSecond = -1;

    while (this.freezeRings.length < picked.length + 1) {
      const m = ringMesh(0x7fd8ff);
      this.world.scene.add(m);
      this.freezeRings.push(m);
    }
    this.it.avatar.playEmote('beatchest');
    this._ensureHud();
    this.hooks.toast && this.hooks.toast(`${this.it.avatar.name} is IT! Don't get caught!`);
    return true;
  }

  _ensureHud() {
    if (this.hud) { this.hud.style.display = 'block'; return; }
    const d = document.createElement('div');
    d.id = 'tagHud';
    d.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);' +
      'background:rgba(10,14,32,0.82);border:1px solid rgba(255,255,255,0.2);border-radius:14px;' +
      'padding:7px 16px;color:#eafcff;font:700 15px "Baloo 2",system-ui;z-index:40;pointer-events:none;';
    document.body.appendChild(d);
    this.hud = d;
  }

  _hud(text) { if (this.hud) this.hud.textContent = text; }

  _freeze(entry) {
    entry.tag.frozen = true;
    entry.avatar.speed = 0;
    entry.avatar.playEmote('armsfolded');       // a hold pose = frozen stiff
    this.hooks.sfx && this.hooks.sfx(220, 0.12, 'sine', 0.06);
  }

  _thaw(entry, rescuer) {
    entry.tag.frozen = false;
    entry.tag.immune = IMMUNE_T;
    entry.avatar.rig.stopEmote?.();
    entry.avatar.playEmote('thanks');
    if (rescuer && rescuer.playEmote) rescuer.playEmote('thumbsup');
    this.hooks.sfx && this.hooks.sfx(660, 0.08, 'sine', 0.05);
    this.world.fx.spawn(entry.avatar.pos.x, entry.avatar.pos.y + 0.05, entry.avatar.pos.z,
      { color: 0x9fe8ff, from: 0.3, to: 1.2, dur: 0.5, alpha: 0.6 });
  }

  _thawPlayer(player) {
    this.playerFrozen = false;
    this._playerImmune = IMMUNE_T;
    player.rig.stopEmote?.();
    player.playEmote('cheer');
    this.hooks.sfx && this.hooks.sfx(660, 0.08, 'sine', 0.05);
    this.hooks.toast && this.hooks.toast('Thawed! RUN!');
  }

  /** All conscripted entries incl. It. */
  _all() { return [this.it, ...this.runners]; }

  _release() {
    // A round that ends while the player is frozen leaves them looping the
    // armsfolded HOLD pose forever unless it's explicitly stopped.
    if (this.playerFrozen && this._player) this._player.rig.stopEmote?.();
    this._player = null;
    for (const n of this._all()) {
      if (!n) continue;
      n.controlled = false;
      n.tag = null;
      n.state = 'idle';
      n.timer = 1 + Math.random() * 2;
      n.avatar.rig.stopEmote?.();   // no lingering frozen poses on the kids either
    }
    this.itRing.visible = false;
    for (const m of this.freezeRings) m.visible = false;
    if (this.hud) this.hud.style.display = 'none';
    this.it = null;
    this.runners = [];
    this.playerFrozen = false;
    this._lock = null;
  }

  end(playerWon, reason) {
    if (this.state !== 'running' && this.state !== 'countdown') return;
    this.state = 'over';
    this.t = 4;
    this._lock = null;
    // A player tagged near the bell must not spend their own victory screen
    // frozen: end() clears the flag (main.js gates input on it every frame).
    if (this.playerFrozen && playerWon) {
      this.playerFrozen = false;
      this._player?.rig.stopEmote?.();
      this._player?.playEmote('cheer');
    }
    if (playerWon) {
      for (const n of this.runners) { n.tag.frozen = false; n.avatar.rig.stopEmote?.(); n.avatar.playEmote(Math.random() < 0.5 ? 'cheer' : 'fistpump'); }
      this.it.avatar.playEmote('shrug');
      this.hooks.onWin && this.hooks.onWin(reason);
    } else {
      this.it.avatar.playEmote('confident');
      this.hooks.onLose && this.hooks.onLose(reason);
    }
    this._hud(playerWon ? '🎉 RUNNERS WIN!' : '🥶 The It got everyone!');
  }

  /** @param {Avatar} player  called from the main loop when not paused */
  update(dt, player) {
    if (this.state === 'idle') return;

    if (this.state === 'over') {
      this.t -= dt;
      for (const n of this._all()) if (n) n.avatar.update(dt, this.world.camera);
      if (this.t <= 0) { this.state = 'idle'; this._release(); }
      return;
    }

    // countdown
    if (this.state === 'countdown') {
      this.t -= dt;
      const s = Math.ceil(this.t);
      if (s !== this._lastSecond) {
        this._lastSecond = s;
        this._hud(s > 0 ? `Freeze tag starts in ${s}…` : 'GO!');
        this.hooks.sfx && this.hooks.sfx(s > 0 ? 440 : 880, 0.09, 'square', 0.05);
      }
      for (const n of this._all()) if (n) n.avatar.update(dt, this.world.camera);
      this._syncRings(player);
      if (this.t <= 0) { this.state = 'running'; this.t = ROUND_LEN; this._lastSecond = -1; }
      return;
    }

    // ── running ──
    this.t -= dt;
    this._itCool -= dt;
    this._playerImmune -= dt;
    for (const n of this.runners) n.tag.immune -= dt;

    const frozenCount = this.runners.filter((n) => n.tag.frozen).length + (this.playerFrozen ? 1 : 0);
    const sec = Math.ceil(this.t);
    if (sec !== this._lastSecond) {
      this._lastSecond = sec;
      this._hud(`🏃 0:${String(Math.max(sec, 0)).padStart(2, '0')} · ${frozenCount} frozen · ${this.playerFrozen ? 'wait for rescue!' : "don't get caught!"}`);
      if (sec === 10) this.hooks.sfx && this.hooks.sfx(520, 0.1, 'square', 0.05);
    }

    const itA = this.it.avatar;

    // ---- It: pick a target and COMMIT ----
    // Pure nearest-target retargets every frame, and with runners fleeing in
    // all directions the It ping-pongs forever and never catches anyone — a
    // player standing perfectly still won a whole round untouched. So: the
    // player's distance is biased (x0.75, the It "wants" the real kid), and the
    // current chase is kept until the target is frozen or something else is
    // clearly (4 m) closer. The It is faster than NPC runners, so a committed
    // chase always ends in a tag.
    let target = null, targetD = Infinity, targetIsPlayer = false;
    if (!this.playerFrozen && this._playerImmune <= 0) {
      targetD = itA.pos.distanceTo(player.pos) * 0.75; target = player; targetIsPlayer = true;
    }
    for (const n of this.runners) {
      if (n.tag.frozen || n.tag.immune > 0) continue;
      const d = itA.pos.distanceTo(n.avatar.pos);
      if (d < targetD) { targetD = d; target = n.avatar; targetIsPlayer = false; }
    }
    const lock = this._lock;
    const lockValid = lock && (lock.avatar === player
      ? !this.playerFrozen && this._playerImmune <= 0
      : lock.entry && !lock.entry.tag.frozen && lock.entry.tag.immune <= 0);
    if (lockValid && target !== lock.avatar) {
      const lockD = itA.pos.distanceTo(lock.avatar.pos);
      if (lockD < targetD + 4) {   // stick with the chase unless clearly beaten
        target = lock.avatar;
        targetIsPlayer = lock.avatar === player;
      }
    }
    // only rebuild the lock when the target actually changes — this runs every
    // frame for the whole round, and the codebase keeps its rAF loop allocation-free
    if (!target) this._lock = null;
    else if (!this._lock || this._lock.avatar !== target) {
      this._lock = { avatar: target, entry: targetIsPlayer ? null : this.runners.find((n) => n.avatar === target) };
    }
    if (target) {
      const d = steer(this.world, itA, target.pos.x, target.pos.z, IT_SPEED, dt);
      if (d < TAG_R && this._itCool <= 0) {
        this._itCool = 1.2;
        this._lock = null;         // tag landed: pick a fresh chase
        if (targetIsPlayer) {
          this.playerFrozen = true;
          player.playEmote('armsfolded');
          this.hooks.sfx && this.hooks.sfx(220, 0.14, 'sine', 0.07);
          this.hooks.toast && this.hooks.toast('FROZEN! A friend is coming…');
        } else {
          this._freeze(this.runners.find((n) => n.avatar === target));
        }
      }
    } else {
      itA.speed += (0 - itA.speed) * Math.min(1, 8 * dt);   // everyone frozen/immune
    }

    // ---- runners: flee / rescue / drift ----
    for (const n of this.runners) {
      const a = n.avatar;
      if (n.tag.frozen) { a.speed = 0; a.update(dt, this.world.camera); continue; }
      const itD = a.pos.distanceTo(itA.pos);
      if (itD < FLEE_R) {
        // run directly away, biased a little sideways so kids fan out
        const ax = a.pos.x - itA.pos.x, az = a.pos.z - itA.pos.z;
        const l = Math.hypot(ax, az) || 1;
        const side = (n.tag.side || (n.tag.side = Math.random() < 0.5 ? 1 : -1)) * 0.35;
        steer(this.world, a, a.pos.x + (ax / l + -az / l * side) * 4, a.pos.z + (az / l + ax / l * side) * 4, RUNNER_SPEED, dt);
      } else {
        // safe: rescue the nearest frozen kid (or the player), else hover nearby
        let goal = null, gd = Infinity, goalEntry = null, goalIsPlayer = false;
        for (const m of this.runners) {
          if (!m.tag.frozen) continue;
          const d = a.pos.distanceTo(m.avatar.pos);
          if (d < gd) { gd = d; goal = m.avatar; goalEntry = m; }
        }
        if (this.playerFrozen) {
          const d = a.pos.distanceTo(player.pos);
          if (d < gd) { gd = d; goal = player; goalEntry = null; goalIsPlayer = true; }
        }
        if (goal) {
          const d = steer(this.world, a, goal.pos.x, goal.pos.z, RUNNER_SPEED, dt);
          if (d < RESCUE_R) {
            if (goalIsPlayer) this._thawPlayer(player);
            else this._thaw(goalEntry, a);
          }
        } else {
          // nobody to save: drift loosely around the player so the round stays close
          if (!n.tag.roam || a.pos.distanceTo(n.tag.roam) < 1.2) {
            n.tag.roam = new THREE.Vector3(
              player.pos.x + (Math.random() - 0.5) * 14, 0,
              player.pos.z + (Math.random() - 0.5) * 14);
          }
          steer(this.world, a, n.tag.roam.x, n.tag.roam.z, RUNNER_SPEED * 0.7, dt);
        }
      }
      a.update(dt, this.world.camera);
    }
    itA.update(dt, this.world.camera);

    // ---- player rescue by touch ----
    if (!this.playerFrozen) {
      for (const n of this.runners) {
        if (n.tag.frozen && player.pos.distanceTo(n.avatar.pos) < RESCUE_R) this._thaw(n, player);
      }
    }

    this._syncRings(player);

    // ---- win / lose ----
    const allFrozen = this.playerFrozen && this.runners.every((n) => n.tag.frozen);
    if (allFrozen) this.end(false, 'all frozen');
    else if (this.t <= 0) this.end(true, 'bell');
  }

  _syncRings(player) {
    const itA = this.it.avatar;
    this.itRing.visible = true;
    this.itRing.position.set(itA.pos.x, itA.pos.y + 0.04, itA.pos.z);
    let i = 0;
    for (const n of this.runners) {
      const m = this.freezeRings[i++];
      m.visible = n.tag.frozen;
      if (n.tag.frozen) m.position.set(n.avatar.pos.x, n.avatar.pos.y + 0.04, n.avatar.pos.z);
    }
    const pm = this.freezeRings[i];
    if (pm) {
      pm.visible = this.playerFrozen;
      if (this.playerFrozen) pm.position.set(player.pos.x, player.pos.y + 0.04, player.pos.z);
    }
  }
}

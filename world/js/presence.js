/**
 * AMG World — multiplayer presence.
 *
 * Transport is Firebase **Realtime Database**, not Firestore. Firestore bills
 * per document write, and even a polite 2 Hz position feed is ~2.4k writes per
 * player per 20-minute session — one class would burn the daily free quota
 * before lunch. RTDB is priced on bandwidth, holds one socket open, and gives
 * us onDisconnect() so a kid who closes the lid actually disappears.
 *
 * If no RTDB instance is provisioned the world still runs; it just runs solo
 * and says so. That is deliberate: a missing backend must never be a black
 * screen for a classroom.
 *
 * Shape:
 *   /world/{room}/{playerId} = { n:name, c:charId, x, y, z, r:yaw, s:speed,
 *                                e:emoteId, m:messageIndex, t:serverTimestamp }
 *
 * Safety: `m` is an INDEX into the fixed phrase book (see chat.js), never free
 * text. Nothing a kid types is ever transmitted or rendered for another kid.
 */

const SEND_HZ = 5;                 // upper bound; most frames send nothing
const MOVE_EPS = 0.35;             // metres of movement before a resend
const YAW_EPS = 0.25;              // radians
const HEARTBEAT_MS = 12000;        // idle keepalive so we don't look stale
const STALE_MS = 30000;            // drop players we haven't heard from
const MAX_RENDERED = 24;           // cap avatars on screen for Chromebooks

export class Presence {
  constructor(opts = {}) {
    this.room = opts.room || 'park';
    this.playerId = opts.playerId;
    this.name = opts.name || 'Player';
    this.charId = opts.charId || 'kid_hoodie';
    this.enabled = false;
    this.status = 'connecting';
    this.players = new Map();      // id -> latest packet
    this.onJoin = opts.onJoin || (() => {});
    this.onLeave = opts.onLeave || (() => {});
    this.onUpdate = opts.onUpdate || (() => {});
    this.onStatus = opts.onStatus || (() => {});

    this._last = { x: 1e9, y: 0, z: 1e9, r: 0 };
    this._lastSend = 0;
    this._lastBeat = 0;
    this._db = null;
    this._ref = null;
    this._selfRef = null;
  }

  async connect() {
    try {
      const cfg = window.ODA_CONFIG?.firebase;
      if (!cfg) throw new Error('no firebase config');
      const v = window.ODA_CONFIG.firebaseVersion || '11.8.1';
      const base = `https://www.gstatic.com/firebasejs/${v}`;
      const [{ initializeApp, getApps, getApp }, rtdb] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-database.js`),
      ]);
      const dbUrl = cfg.databaseURL ||
        `https://${cfg.projectId}-default-rtdb.firebaseio.com`;
      const app = getApps().length ? getApp() : initializeApp(cfg);

      // An anonymous session already exists for every kid (amgEnsureAnonAuth).
      if (window.amgEnsureAnonAuth) { try { await window.amgEnsureAnonAuth(); } catch (e) {} }

      this._rtdb = rtdb;
      this._db = rtdb.getDatabase(app, dbUrl);
      this._ref = rtdb.ref(this._db, `world/${this.room}`);
      this._selfRef = rtdb.ref(this._db, `world/${this.room}/${this.playerId}`);

      // Prove the instance actually exists before claiming multiplayer works.
      await Promise.race([
        rtdb.get(rtdb.query(this._ref, rtdb.limitToFirst(1))),
        new Promise((_, rej) => setTimeout(() => rej(new Error('rtdb timeout')), 6000)),
      ]);

      rtdb.onDisconnect(this._selfRef).remove();
      this._subscribe();
      this.enabled = true;
      this._setStatus('online');
    } catch (err) {
      console.warn('[world] multiplayer unavailable, running solo:', err.message);
      this.enabled = false;
      this._setStatus('solo');
    }
    return this.enabled;
  }

  _setStatus(s) {
    this.status = s;
    this.onStatus(s);
  }

  _subscribe() {
    const { onChildAdded, onChildChanged, onChildRemoved } = this._rtdb;
    const upsert = (snap) => {
      const id = snap.key;
      if (id === this.playerId) return;
      const val = snap.val();
      if (!val) return;
      const known = this.players.has(id);
      this.players.set(id, val);
      known ? this.onUpdate(id, val) : this.onJoin(id, val);
    };
    onChildAdded(this._ref, upsert);
    onChildChanged(this._ref, upsert);
    onChildRemoved(this._ref, (snap) => {
      const id = snap.key;
      if (this.players.delete(id)) this.onLeave(id);
    });

    // Sweep anyone whose client died without firing onDisconnect.
    this._sweep = setInterval(() => {
      const now = Date.now();
      for (const [id, p] of this.players) {
        if (p.t && now - p.t > STALE_MS) { this.players.delete(id); this.onLeave(id); }
      }
    }, 8000);
  }

  /**
   * Push the local player's transform, but only when it is actually news.
   * Called every frame; sends at most SEND_HZ and only past a movement
   * threshold, so a kid standing still costs one write every 12 seconds.
   */
  send(x, y, z, yaw, speed, extra = {}) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this._lastSend < 1000 / SEND_HZ) return;

    const moved = Math.hypot(x - this._last.x, z - this._last.z) > MOVE_EPS
      || Math.abs(yaw - this._last.r) > YAW_EPS;
    const beat = Date.now() - this._lastBeat > HEARTBEAT_MS;
    if (!moved && !beat && !extra.force) return;

    this._lastSend = now;
    this._lastBeat = Date.now();
    this._last = { x, y, z, r: yaw };
    const packet = {
      n: this.name, c: this.charId,
      x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2),
      r: +yaw.toFixed(3), s: +speed.toFixed(2),
      t: this._rtdb.serverTimestamp(),
    };
    if (extra.emote) packet.e = extra.emote;
    if (extra.message != null) packet.m = extra.message;
    this._rtdb.set(this._selfRef, packet).catch(() => {});
  }

  /** Broadcast a one-shot emote / canned phrase immediately. */
  broadcast(extra) {
    if (!this.enabled) return;
    this._lastSend = 0;
    this.send(this._last.x, this._last.y, this._last.z, this._last.r, 0,
      { ...extra, force: true });
  }

  /** The nearest MAX_RENDERED peers — everything else is out of sight anyway. */
  visible(fromX, fromZ) {
    const list = [...this.players.entries()];
    if (list.length <= MAX_RENDERED) return list;
    return list
      .map(([id, p]) => [id, p, (p.x - fromX) ** 2 + (p.z - fromZ) ** 2])
      .sort((a, b) => a[2] - b[2])
      .slice(0, MAX_RENDERED)
      .map(([id, p]) => [id, p]);
  }

  get count() { return this.players.size + 1; }

  async disconnect() {
    clearInterval(this._sweep);
    if (this.enabled && this._selfRef) {
      try { await this._rtdb.remove(this._selfRef); } catch (e) {}
    }
    this.enabled = false;
  }
}

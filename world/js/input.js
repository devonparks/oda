/**
 * AMG World — input.
 *
 * Three schemes feeding one intent object, because the same world runs on a
 * school Chromebook (keyboard), a tablet (touch stick), and a phone:
 *   - WASD / arrows + Shift to run + Space to hop
 *   - a floating virtual stick that spawns wherever the left half is touched
 *   - tap-to-move: tap the ground and the player walks there
 *
 * Camera orbit is right-drag on desktop and a one-finger drag on the right half
 * of the screen on touch, so the stick and the camera never fight each other.
 */
export class Input {
  constructor(dom) {
    this.dom = dom;
    /** movement intent in camera space, -1..1 */
    this.move = { x: 0, y: 0 };
    this.run = false;
    this.jumpQueued = false;
    /** accumulated camera orbit since last read */
    this.look = { x: 0, y: 0 };
    this.zoom = 0;
    /** world-space destination set by tap-to-move, or null */
    this.moveTarget = null;
    this.keys = new Set();
    this._stick = null;
    this._orbit = null;
    this._tapStart = null;
    /** true while the mouse is captured and moving it looks around */
    this.pointerLocked = false;
    /** called when lock state changes, so the HUD can update its hint */
    this.onLockChange = null;

    this._bindKeyboard();
    this._bindPointer();
    this._bindPointerLock();
  }

  /**
   * Desktop free-look. Holding a button to look is a modelling-tool convention,
   * not a game one — click once and the mouse looks around, Esc gives the cursor
   * back. Touch is untouched: it keeps the stick + right-half drag, since there
   * is no pointer to lock.
   */
  _bindPointerLock() {
    const el = this.dom;
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === el;
      // drop any half-finished drag so the camera doesn't jump on release
      this._orbit = null;
      this._tapStart = null;
      this.onLockChange && this.onLockChange(this.pointerLocked);
    });
    // Some browsers reject the request (not focused, iframe); just stay unlocked
    // and the drag-to-orbit fallback below still works.
    document.addEventListener('pointerlockerror', () => { this.pointerLocked = false; });
  }

  /** Give the cursor back — used when a panel that needs clicking opens. */
  releaseMouse() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _bindKeyboard() {
    const down = (e) => {
      // never swallow typing in the chat/name fields
      if (e.target.matches('input, textarea, select')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    const up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindPointer() {
    const el = this.dom;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      if (e.target !== el) return;
      const touchLike = e.pointerType !== 'mouse';
      const leftHalf = e.clientX < window.innerWidth * 0.45;

      // Mouse, not yet captured: the first click grabs the pointer and from then
      // on looking around needs no button at all. No orbit/tap is started for
      // that click, so it doesn't also fire a tap-to-move.
      if (!touchLike && !this.pointerLocked && e.button === 0) {
        el.requestPointerLock && el.requestPointerLock();
        return;
      }
      if (this.pointerLocked) return;   // look is driven by movementX/Y below

      el.setPointerCapture(e.pointerId);

      if (touchLike && leftHalf && !this._stick) {
        this._stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        this._emitStick();
      } else if (e.button === 2 || touchLike || e.button === 0) {
        this._orbit = { id: e.pointerId, lx: e.clientX, ly: e.clientY, moved: 0 };
        this._tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
      }
    });

    el.addEventListener('pointermove', (e) => {
      // Captured mouse: raw deltas steer the camera, no button needed.
      if (this.pointerLocked) {
        this.look.x += e.movementX || 0;
        this.look.y += e.movementY || 0;
        return;
      }
      if (this._stick && e.pointerId === this._stick.id) {
        const R = 56;
        let dx = e.clientX - this._stick.ox;
        let dy = e.clientY - this._stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        this._stick.x = dx / R;
        this._stick.y = dy / R;
        this._emitStick();
        return;
      }
      if (this._orbit && e.pointerId === this._orbit.id) {
        const dx = e.clientX - this._orbit.lx;
        const dy = e.clientY - this._orbit.ly;
        this._orbit.lx = e.clientX; this._orbit.ly = e.clientY;
        this._orbit.moved += Math.abs(dx) + Math.abs(dy);
        this.look.x += dx;
        this.look.y += dy;
      }
    });

    const end = (e) => {
      if (this._stick && e.pointerId === this._stick.id) {
        this._stick = null;
        this._hideStick();
      }
      if (this._orbit && e.pointerId === this._orbit.id) {
        // a short, still press is a tap-to-move, not an orbit
        const t = this._tapStart;
        if (t && t.button !== 2 && this._orbit.moved < 8 && performance.now() - t.t < 400) {
          this.onTap && this.onTap(t.x, t.y);
        }
        this._orbit = null;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { this.zoom += e.deltaY * 0.0016; e.preventDefault(); }, { passive: false });
  }

  _emitStick() {
    let base = document.getElementById('stickBase');
    if (!base) {
      base = document.createElement('div'); base.id = 'stickBase'; base.className = 'stick-base';
      const knob = document.createElement('div'); knob.className = 'stick-knob'; knob.id = 'stickKnob';
      base.appendChild(knob);
      document.body.appendChild(base);
    }
    base.style.display = 'block';
    base.style.left = this._stick.ox + 'px';
    base.style.top = this._stick.oy + 'px';
    document.getElementById('stickKnob').style.transform =
      `translate(calc(-50% + ${this._stick.x * 56}px), calc(-50% + ${this._stick.y * 56}px))`;
  }

  _hideStick() {
    const base = document.getElementById('stickBase');
    if (base) base.style.display = 'none';
  }

  /** Fold every scheme into this frame's intent. Call once per frame. */
  sample() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (this._stick) { x += this._stick.x; y += this._stick.y; }

    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    this.move.x = x; this.move.y = y;
    // Push-the-stick-far-to-run is a TOUCH affordance. Applying it to `d` meant
    // any keyboard key gave d === 1 > 0.85, so WASD was permanently running and
    // holding Shift changed nothing — which reads as "Shift stopped working".
    const stickMag = this._stick ? Math.hypot(this._stick.x, this._stick.y) : 0;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight') || stickMag > 0.85;
    if (d > 0.05) this.moveTarget = null;   // manual input cancels tap-to-move

    const look = { x: this.look.x, y: this.look.y };
    this.look.x = 0; this.look.y = 0;
    const zoom = this.zoom; this.zoom = 0;
    const jump = this.jumpQueued; this.jumpQueued = false;
    return { move: this.move, run: this.run, jump, look, zoom };
  }
}

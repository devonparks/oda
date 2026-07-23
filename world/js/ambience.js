/**
 * AMG World — park ambience.
 *
 * A quiet, generative soundscape so the park has a pulse instead of dead
 * silence: a soft wind bed, the odd bird, a faint distant-playground shimmer.
 * All synthesized with the Web Audio API — zero files, same as odaSfx — so it
 * adds nothing to the Chromebook download.
 *
 * It is deliberately understated (a classroom is a shared space) and obeys the
 * shared `odaSoundEnabled` toggle, so muting the hub mutes the park too. Nothing
 * starts until a user gesture, per the browser autoplay policy.
 */
export class Ambience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = localStorage.getItem('odaSoundEnabled') !== 'false';
    this.birdTimer = null;
    this._started = false;
  }

  /** Begin on the next user gesture (required for AudioContext to run). */
  arm() {
    if (this._started) return;
    const start = () => { this._start(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
      window.addEventListener(ev, start, { once: true, passive: true }));
  }

  _start() {
    if (this._started || !this.enabled) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    this._started = true;

    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    // fade the bed in over a couple of seconds so entry isn't abrupt
    this.master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);

    this._buildWind();
    this._scheduleBird();
  }

  /**
   * Wind bed: pink-ish noise through a gently wandering low-pass, very quiet.
   * The moving filter keeps it from sounding like static.
   */
  _buildWind() {
    const ctx = this.ctx;
    const secs = 4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;   // cheap low-pass → pink-ish
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.6;

    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();

    // wander the cutoff so the wind breathes
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency); lfo.start();

    this._wind = { src, lfo };
  }

  /** One little two-note bird call, pitched and panned at random. */
  _bird() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    const out = ctx.createGain(); out.gain.value = 0.0;
    out.gain.setTargetAtTime(0.05, t0, 0.01);
    out.gain.setTargetAtTime(0.0001, t0 + 0.12, 0.05);
    (pan ? (out.connect(pan), pan) : out).connect(this.master);

    const base = 1600 + Math.random() * 1400;
    for (let n = 0; n < 2; n++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const t = t0 + n * 0.09;
      osc.frequency.setValueAtTime(base * (n ? 1.18 : 1), t);
      osc.frequency.exponentialRampToValueAtTime(base * (n ? 1.02 : 1.14), t + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + 0.1);
    }
  }

  _scheduleBird() {
    const next = 3000 + Math.random() * 9000;   // a chirp every few seconds
    this.birdTimer = setTimeout(() => {
      if (Math.random() < 0.7) this._bird();
      this._scheduleBird();
    }, next);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.ctx) { if (on) this._start(); return; }
    this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.4);
  }

  dispose() {
    clearTimeout(this.birdTimer);
    try { this._wind?.src.stop(); this._wind?.lfo.stop(); } catch (e) {}
    try { this.ctx?.close(); } catch (e) {}
  }
}

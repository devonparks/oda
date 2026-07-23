/**
 * AMG World — hidden star hunt.
 *
 * Five glowing stars tucked around the park — behind trees, in far corners,
 * by the pond. Finding all five earns the Star Hunter badge. This is the
 * Poptropica / Club Penguin discovery loop: a reason to explore every corner
 * rather than just farm the coin path, and a one-time goal that stays found
 * across visits.
 *
 * Distinct from coins on purpose — coins respawn and reward routine laps; stars
 * are a single treasure hunt. Spots are hand-placed to pull a player past every
 * zone at least once.
 */
import * as THREE from 'three';

/** Hand-picked hideaways, spread so the hunt walks you across the whole park. */
export const STAR_SPOTS = [
  [-13.5, 7.5],   // far left, by the soapbox corner
  [-9.5, -4.0],   // tucked by the pond
  [0.5, -6.5],    // behind the playground
  [2.0, 26.5],    // deep in the skate park
  [20.0, 21.0],   // out past the sports field
];

const COLLECT_RADIUS = 1.6;

export class StarHunt {
  constructor(world, progress) {
    this.world = world;
    this.progress = progress;
    this.total = STAR_SPOTS.length;
    this.stars = [];
    this._build();
  }

  _starTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.translate(64, 64);
    // glow
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    g.addColorStop(0, 'rgba(255,240,160,0.95)');
    g.addColorStop(0.4, 'rgba(255,205,70,0.55)');
    g.addColorStop(1, 'rgba(255,205,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();
    // five-point star
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 40 : 17;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff3b0';
    ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 12;
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _build() {
    const tex = this._starTexture();
    const found = new Set(this.progress ? this.progress.starsFound() : []);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true });
    for (let i = 0; i < STAR_SPOTS.length; i++) {
      const [x, z] = STAR_SPOTS[i];
      const y = this.world.collision.groundAt(x, z, 3) + 1.1;
      const sprite = new THREE.Sprite(mat.clone());
      sprite.scale.set(0.9, 0.9, 1);
      sprite.position.set(x, y, z);
      sprite.visible = !found.has(i);
      sprite.renderOrder = 5;
      this.world.scene.add(sprite);
      this.stars.push({ index: i, sprite, baseY: y, x, z, taken: found.has(i) });
    }
  }

  /** @returns null, or { count, done } when a star is collected this frame */
  update(dt, t, playerPos) {
    let hit = null;
    for (const s of this.stars) {
      if (s.taken) continue;
      s.sprite.position.y = s.baseY + Math.sin(t * 2 + s.index) * 0.12;
      s.sprite.material.rotation = t * 0.8;
      const d = Math.hypot(playerPos.x - s.x, playerPos.z - s.z);
      if (d < COLLECT_RADIUS && Math.abs(playerPos.y + 0.6 - s.sprite.position.y) < 2.2) {
        s.taken = true;
        s.sprite.visible = false;
        const res = this.progress ? this.progress.foundStar(s.index, this.total) : { count: 0, done: false };
        hit = res || { count: 0, done: false };
      }
    }
    return hit;
  }

  dispose() {
    for (const s of this.stars) {
      s.sprite.removeFromParent();
      s.sprite.material.map?.dispose();
      s.sprite.material.dispose();
    }
  }
}

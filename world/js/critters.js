/**
 * AMG World — butterflies.
 *
 * A handful of code-drawn butterflies looping lazy figure-eights near the
 * greenery. They cost two triangles a wing, flap by hinging those wings, and
 * dart away when a kid runs at them — which is exactly what every kid tries.
 * Motion is closed-form (sines over t), so there is no per-frame allocation
 * and no state to go wrong; the flee impulse is the only integrated bit.
 */
import * as THREE from 'three';

const COLORS = [0xffa8d0, 0x9fd8ff, 0xfff099, 0xc9a8ff, 0xa8ffc9, 0xffb680];
/** Anchor spots along the park's greenery/paths (x, z, base height). */
const SPOTS = [
  [6, -4, 1.1], [14, 6, 1.2], [-4, 2, 1.0], [2, 22, 1.15], [18, 16, 1.05], [26, 5, 1.2],
];

function wingGeo(sign) {
  // one wing: two triangles making a rounded-ish quad, hinged at x=0
  const g = new THREE.BufferGeometry();
  const s = sign;
  const v = new Float32Array([
    0, 0, -0.02,   s * 0.16, 0.05, -0.1,   s * 0.19, 0.02, 0.05,
    0, 0, -0.02,   s * 0.19, 0.02, 0.05,   s * 0.12, -0.02, 0.12,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export class Butterflies {
  /** @param {THREE.Scene} scene  @param {number} count */
  constructor(scene, count = 5) {
    this.flock = [];
    for (let i = 0; i < count; i++) {
      const spot = SPOTS[i % SPOTS.length];
      const mat = new THREE.MeshBasicMaterial({ color: COLORS[i % COLORS.length], side: THREE.DoubleSide });
      const group = new THREE.Group();
      const L = new THREE.Mesh(wingGeo(-1), mat);
      const R = new THREE.Mesh(wingGeo(1), mat);
      group.add(L, R);
      group.position.set(spot[0], spot[2], spot[1]);
      scene.add(group);
      this.flock.push({
        group, L, R,
        ax: spot[0], az: spot[1], ay: spot[2],
        seed: i * 1.7 + 0.9,
        fleeX: 0, fleeZ: 0,      // decaying dart impulse
        px: spot[0], pz: spot[1],
      });
    }
  }

  /** @param {number} t  clock seconds  @param {THREE.Vector3} playerPos */
  update(dt, t, playerPos) {
    for (const b of this.flock) {
      const s = b.seed;
      // lazy figure-eight around the anchor + slow bob
      let x = b.ax + Math.sin(t * 0.31 + s) * 2.2 + Math.sin(t * 0.83 + s * 2) * 0.7;
      let z = b.az + Math.sin(t * 0.23 + s * 3) * 2.0 + Math.cos(t * 0.61 + s) * 0.8;
      const y = b.ay + Math.sin(t * 0.9 + s) * 0.25 + Math.sin(t * 2.3 + s) * 0.08;

      // dart away from a kid who gets close
      if (playerPos) {
        const dx = x - playerPos.x, dz = z - playerPos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 2.6 * 2.6 && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          b.fleeX += (dx / d) * 6 * dt;
          b.fleeZ += (dz / d) * 6 * dt;
        }
      }
      const decay = Math.exp(-0.8 * dt);
      b.fleeX *= decay; b.fleeZ *= decay;
      x += b.fleeX; z += b.fleeZ;

      b.group.position.set(x, y + Math.hypot(b.fleeX, b.fleeZ) * 0.35, z);
      // face travel direction
      b.group.rotation.y = Math.atan2(x - b.px, z - b.pz);
      b.px = x; b.pz = z;

      // flap — faster when fleeing
      const rate = 11 + Math.hypot(b.fleeX, b.fleeZ) * 8;
      const flap = 0.25 + Math.abs(Math.sin(t * rate + s)) * 1.0;
      b.L.rotation.z = flap;
      b.R.rotation.z = -flap;
    }
  }
}

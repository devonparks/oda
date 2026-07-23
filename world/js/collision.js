/**
 * AMG World — collision.
 *
 * The park ships ~700 axis-aligned boxes (exported straight from the Synty
 * demo scene's renderer bounds). Testing all of them per frame is wasteful, so
 * they go into a flat uniform grid keyed by cell; a moving player only ever
 * looks at the handful of boxes in its own cell neighbourhood.
 *
 * The player is treated as a vertical cylinder. Resolution is "push out along
 * the shallowest axis", which for a park full of boxy props reads as sliding
 * along walls rather than sticking to them. Boxes shorter than STEP_HEIGHT are
 * stepped onto instead of blocked, so kerbs and playground edges don't trap
 * anyone.
 */
const CELL = 4;             // metres per grid cell
const STEP_HEIGHT = 0.42;   // anything this low is climbed, not blocked

export class CollisionWorld {
  constructor(boxes = []) {
    this.boxes = [];
    this.grid = new Map();
    this.bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
    for (const b of boxes) this.add(b);
  }

  static key(cx, cz) { return cx * 100000 + cz; }

  add(b) {
    const box = {
      minX: b.c[0] - b.e[0], maxX: b.c[0] + b.e[0],
      minY: b.c[1] - b.e[1], maxY: b.c[1] + b.e[1],
      minZ: b.c[2] - b.e[2], maxZ: b.c[2] + b.e[2],
      name: b.n || '',
    };
    const i = this.boxes.push(box) - 1;
    const x0 = Math.floor(box.minX / CELL), x1 = Math.floor(box.maxX / CELL);
    const z0 = Math.floor(box.minZ / CELL), z1 = Math.floor(box.maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = CollisionWorld.key(cx, cz);
        let cell = this.grid.get(k);
        if (!cell) this.grid.set(k, (cell = []));
        cell.push(i);
      }
    }
  }

  /** Every box index whose cell overlaps the circle (x, z, r). */
  near(x, z, r) {
    const out = new Set();
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.grid.get(CollisionWorld.key(cx, cz));
        if (cell) for (const i of cell) out.add(i);
      }
    }
    return out;
  }

  /**
   * Highest surface the player can stand on at (x, z), given they are currently
   * at feet height `fromY`. Only counts tops at or below fromY + STEP_HEIGHT so
   * you can't teleport onto a roof you happen to be standing under.
   */
  groundAt(x, z, fromY, radius = 0.28) {
    let best = 0;
    for (const i of this.near(x, z, radius)) {
      const b = this.boxes[i];
      if (x + radius < b.minX || x - radius > b.maxX) continue;
      if (z + radius < b.minZ || z - radius > b.maxZ) continue;
      if (b.maxY <= fromY + STEP_HEIGHT && b.maxY > best) best = b.maxY;
    }
    return best;
  }

  /**
   * Slide a cylinder from its current position to (x, z).
   * @returns {{x:number, z:number, hit:boolean}}
   */
  resolve(x, z, y, radius = 0.28, height = 1.4) {
    const footY = y, headY = y + height;
    let hit = false;
    // A couple of passes settles corners where two boxes push in turn.
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const i of this.near(x, z, radius)) {
        const b = this.boxes[i];
        // vertical overlap? a box entirely below the step height is walkable
        if (b.maxY <= footY + STEP_HEIGHT) continue;
        if (b.minY >= headY) continue;

        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        const dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;

        hit = true; moved = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          x += (dx / d) * push;
          z += (dz / d) * push;
        } else {
          // dead centre inside the box: eject along the shallowest face
          const toMinX = x - b.minX, toMaxX = b.maxX - x;
          const toMinZ = z - b.minZ, toMaxZ = b.maxZ - z;
          const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
          if (m === toMinX) x = b.minX - radius;
          else if (m === toMaxX) x = b.maxX + radius;
          else if (m === toMinZ) z = b.minZ - radius;
          else z = b.maxZ + radius;
        }
      }
      if (!moved) break;
    }
    return { x, z, hit };
  }

  clampToBounds(x, z, pad = 1) {
    const b = this.bounds;
    return {
      x: Math.max(b.minX + pad, Math.min(b.maxX - pad, x)),
      z: Math.max(b.minZ + pad, Math.min(b.maxZ - pad, z)),
    };
  }
}

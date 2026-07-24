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
/** Anything this low is climbed, not blocked. Raised from 0.42 because a row of
 *  props (pond rocks at 0.46, kerbs, ramp lips) sat just above the old value and
 *  read as invisible shin-high walls. */
const STEP_HEIGHT = 0.55;

/**
 * The park's boxes are world-space RENDERER bounds straight out of the Synty
 * demo scene. That's fine for a crate and catastrophic for a tree: the AABB of
 * SM_Env_Tree_Large_01 is 10.95 x 12.28 m spanning y -0.15..8.91, because it
 * wraps the whole canopy DOWN TO THE GROUND — so you hit an invisible wall five
 * metres from the trunk. Measured over the shipped data, 145 boxes could block a
 * walking kid and their footprints covered ~36% of the park.
 *
 * So every box is refined by what the prop actually is before it enters the grid:
 *   'trunk' — keep the height, shrink the footprint to a trunk you can bump into
 *             while walking under the canopy (trees: 361 m2, half the problem)
 *   'none'  — no collision at all: soft foliage, loose clutter, pickups, water
 *   'solid' — unchanged (buildings, play structures, fountain base, ramps)
 *
 * Order matters — first match wins. Tune here rather than re-exporting the JSON,
 * so the raw Unity bounds stay intact as the source of truth.
 */
const TRUNK_RADIUS = 0.45;
const COLLISION_RULES = [
  [/Fountain_Water|Pond_Water|_Water|Pool/i, 'none'],   // water is for wading, not walls
  [/Tree/i, 'trunk'],                                    // canopy AABB -> trunk
  [/Bush|Hedge|Flower|Grass|Plant/i, 'none'],            // soft foliage, walk through it
  [/Coin|Gem|Star/i, 'none'],                            // pickups must never block
  [/Rocker_Top|_Top_|Canopy|Awning|Umbrella/i, 'none'],  // roofs/tops, same canopy trap
  [/Plush|Toy|Stick|Pogo|Bike|Trike|Pram|Jumping|Soapbox|Ball/i, 'none'], // kid clutter
];

/** @returns {'solid'|'trunk'|'none'} */
export function collisionRuleFor(name) {
  for (const [re, rule] of COLLISION_RULES) if (re.test(name)) return rule;
  return 'solid';
}

export class CollisionWorld {
  constructor(boxes = []) {
    this.boxes = [];
    this.grid = new Map();
    this.bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
    this.skipped = 0;               // boxes dropped by a 'none' rule, for __world.stats()
    this._nearShared = new Set();   // reused by the per-frame hot paths, see nearShared()
    for (const b of boxes) this.add(b);
  }

  static key(cx, cz) { return cx * 100000 + cz; }

  add(b) {
    const name = b.n || '';
    const rule = collisionRuleFor(name);
    if (rule === 'none') { this.skipped++; return; }
    // A trunk keeps the prop's height (you can't walk through the bole) but
    // gives up the canopy's footprint (you can walk under the branches).
    const ex = rule === 'trunk' ? Math.min(b.e[0], TRUNK_RADIUS) : b.e[0];
    const ez = rule === 'trunk' ? Math.min(b.e[2], TRUNK_RADIUS) : b.e[2];
    const box = {
      minX: b.c[0] - ex, maxX: b.c[0] + ex,
      minY: b.c[1] - b.e[1], maxY: b.c[1] + b.e[1],
      minZ: b.c[2] - ez, maxZ: b.c[2] + ez,
      name,
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

  /** Every box index whose cell overlaps the circle (x, z, r). Allocates a Set;
   *  use for one-off / external calls (e.g. the camera boom). */
  near(x, z, r) {
    return this._collectNear(x, z, r, new Set());
  }

  /**
   * Same query, but into a REUSED Set to avoid per-frame allocation. The result
   * is only valid until the next nearShared() call, so the caller MUST fully
   * consume it before calling any collision method that also uses it. All
   * current per-frame callers (groundAt, resolve, run sequentially per entity)
   * satisfy that; don't hold the result or nest calls.
   */
  nearShared(x, z, r) {
    this._nearShared.clear();
    return this._collectNear(x, z, r, this._nearShared);
  }

  _collectNear(x, z, r, out) {
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
    for (const i of this.nearShared(x, z, radius)) {
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
      for (const i of this.nearShared(x, z, radius)) {
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

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
  // The pond's rock RING: its AABB fills the disc inside the ring, putting a
  // phantom 0.3 m floor over the whole pond — which held everyone above the
  // waterline so wading never triggered. The individual rock clusters are the
  // Rocks_02/03/04 boxes; the ring AABB adds nothing but that phantom floor.
  [/Pond_Rocks_01/i, 'none'],
  // The pond box itself: its top IS the water surface, so as a solid it's an
  // invisible floor at the waterline — kids stood ON the water. The
  // heightfield's dish + the hip-deep clamp in stepPlayer own the pond now.
  [/Park_Pond(?!_Rocks)/i, 'none'],
  [/Tree/i, 'trunk'],                                    // canopy AABB -> trunk
  [/Bush|Hedge|Flower|Grass|Plant/i, 'none'],            // soft foliage, walk through it
  [/Coin|Gem|Star/i, 'none'],                            // pickups must never block
  [/Rocker_Top|_Top_|Canopy|Awning|Umbrella/i, 'none'],  // roofs/tops, same canopy trap
  [/Plush|Toy|Stick|Pogo|Bike|Trike|Pram|Jumping|Soapbox|Ball/i, 'none'], // kid clutter
  // The skate park is CARVED INTO the terrain (bowl floor y≈-1). Its renderer
  // bounds put a phantom lid at rim height over every depression — you floated
  // across the bowl instead of walking down into it. The heightfield is the
  // truth for all carved/sloped skate surfaces; only the low walls and grind
  // boxes stay solid (they really do block you, and you can jump onto them).
  [/SkatePark_(?!Wall|Rail_Box)/i, 'none'],
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
    this.hf = null;                 // ground heightfield, see setHeightfield()
    for (const b of boxes) this.add(b);
  }

  /**
   * Ground heightfield: real terrain height per texel (GPU-baked from the park
   * shell at load, see World._bakeGroundHeightfield). Replaces the old flat
   * y=0 ground plane so carved terrain — the skate bowl, ramps, the pond dish —
   * actually exists underfoot. Boxes still provide walls and prop tops.
   * @param {{data:Float32Array, w:number, h:number, minX:number, minZ:number,
   *          stepX:number, stepZ:number}} hf
   */
  setHeightfield(hf) { this.hf = hf; }

  /** Raw bilinear terrain height (no step gating). 0 without a heightfield. */
  heightAt(x, z) {
    const hf = this.hf;
    if (!hf) return 0;
    let u = (x - hf.minX) / hf.stepX;
    let v = (z - hf.minZ) / hf.stepZ;
    u = Math.max(0, Math.min(hf.w - 1.001, u));
    v = Math.max(0, Math.min(hf.h - 1.001, v));
    const x0 = u | 0, z0 = v | 0, fx = u - x0, fz = v - z0;
    const d = hf.data, i = z0 * hf.w + x0;
    const h00 = d[i], h10 = d[i + 1], h01 = d[i + hf.w], h11 = d[i + hf.w + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }

  /**
   * Terrain height for someone standing at fromY, cliff-safe. Bilinear blends
   * across height cliffs (a grind box top beside the bowl floor) smear high
   * values into neighbouring texels; naive sampling would levitate a player
   * standing next to one. So corners above the step gate are dropped: all four
   * pass → smooth bilinear (slopes, stairs); some pass → the lowest passing
   * corner (conservative, never lifts); none pass → fromY (inside geometry,
   * resolves as you fall or walk out).
   */
  _hfGroundAt(x, z, fromY) {
    const hf = this.hf;
    if (!hf) return 0;
    const gate = fromY + STEP_HEIGHT;
    let u = (x - hf.minX) / hf.stepX;
    let v = (z - hf.minZ) / hf.stepZ;
    u = Math.max(0, Math.min(hf.w - 1.001, u));
    v = Math.max(0, Math.min(hf.h - 1.001, v));
    const x0 = u | 0, z0 = v | 0, fx = u - x0, fz = v - z0;
    const d = hf.data, i = z0 * hf.w + x0;
    const h00 = d[i], h10 = d[i + 1], h01 = d[i + hf.w], h11 = d[i + hf.w + 1];
    if (h00 <= gate && h10 <= gate && h01 <= gate && h11 <= gate) {
      return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
    }
    let best = Infinity;
    if (h00 <= gate && h00 < best) best = h00;
    if (h10 <= gate && h10 < best) best = h10;
    if (h01 <= gate && h01 < best) best = h01;
    if (h11 <= gate && h11 < best) best = h11;
    return best === Infinity ? fromY : best;
  }

  static key(cx, cz) { return cx * 100000 + cz; }

  add(b) {
    const name = b.n || '';
    // A gazebo is a roof on posts — one solid AABB walls off a shelter you're
    // supposed to stand inside. Swap it for four corner posts plus a low plinth
    // you step onto; the roof is above head height so it needs no box at all.
    if (/Gazebo/i.test(name)) {
      const inset = 0.32, post = 0.16;
      const x0 = b.c[0] - b.e[0] + inset, x1 = b.c[0] + b.e[0] - inset;
      const z0 = b.c[2] - b.e[2] + inset, z1 = b.c[2] + b.e[2] - inset;
      // child names must NOT contain 'Gazebo' or this branch would recurse
      for (const [px, pz] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) {
        this.add({ c: [px, b.c[1], pz], e: [post, b.e[1], post], n: '_shelter_post' });
      }
      const floorY = b.c[1] - b.e[1];
      this.add({ c: [b.c[0], floorY + 0.15, b.c[2]], e: [b.e[0], 0.15, b.e[2]], n: '_shelter_plinth' });
      return;
    }
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
    let best = this.hf ? this._hfGroundAt(x, z, fromY) : 0;
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

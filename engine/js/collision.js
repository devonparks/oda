/**
 * AMG World Engine — static collision, from the REAL geometry.
 *
 * This is the single biggest thing Havok buys, and it closes Devon's
 * longest-standing complaint about the three.js park: *one AABB per prop*. A
 * box around a staircase is a ramp you cannot climb; a box around the tunnel
 * is a wall; a box around the treehouse is a solid cube you cannot get inside.
 * The three.js park eventually grew a `_deriveCollision` pass that voxel-audited
 * props and carved better boxes, plus a GPU ground heightfield, plus hand-curated
 * exceptions in `park_collision.json` — roughly 1500 lines of machinery to
 * approximate what a mesh collider does for free.
 *
 * Here the collider IS the mesh. One `PhysicsShapeMesh` per prototype, one
 * STATIC instanced `PhysicsBody` carrying every placement of it, so the whole
 * park costs 275 shapes and no per-instance geometry. Stairs are stairs.
 *
 * WHAT COLLIDES. Only the `terrain` layer — the ground, paths, walls, fences,
 * the playground structure, the gazebo, fountain, pond and treehouse. The
 * `clutter` layer (balls, prams, plush toys, kites, the loose Synty tat) is
 * drawn but has no collision at all: a football should not be a kerb you trip
 * on, and 600-odd extra mesh shapes buy nothing. Props that SHOULD be solid
 * without being terrain get handled by the prop database in M4, which knows
 * what each one is.
 */
import {
  PhysicsShapeMesh, PhysicsBody, PhysicsMotionType,
  PhysicsAggregate, PhysicsShapeType, MeshBuilder,
} from 'babylon';

/**
 * Prototypes that are drawn but never collide, beyond the clutter rule.
 *
 * Grass tufts and flowers are terrain-layer scenery you must be able to walk
 * through — 133 grass tiles alone. Water is handled by the swim/wade rules
 * rather than by being solid. Leaves let you walk under a tree instead of
 * bumping into its canopy.
 */
/**
 * MATCH THE TUFT, NOT THE LAWN. The first version of this pattern was just
 * `/Grass|Flower|…/`, which also matched `SM_Env_Ground_Round_Grass_01` and
 * `SM_Env_Ground_Tile_Grass` — the actual FLOOR of the park. The kid walked
 * three metres and sank to y = −1.11 because most of the ground had no
 * collider. Exactly the over-matching this project keeps paying for: the
 * backdrop's `^SM_Env_Tree` once caught `SM_Env_Tree_Large_01_Treehouse` and
 * scattered little cabins across the skyline.
 *
 * So `GROUND` is checked FIRST and always wins.
 */
const GROUND = /^SM_Env_(Ground|Path)|_Ground_|_Path_/i;
const NO_COLLIDE = /Grass_Tuft|Flower|Weed|Mushroom|Leaf|Leaves|Cloud|Smoke|Decal|Shadow|_Water|Water_/i;

/**
 * Prototypes whose collision must be a mesh even though they are small.
 * (Kept explicit so the size cutoff below can stay aggressive.)
 */
const ALWAYS = /Stair|Step|Ramp|Slide|Deck|Platform|Bridge|Tunnel|Treehouse|Tree_House|Ship|Gazebo|Fence|Wall|Bench|Table|Kerb|Curb/i;

/** Below this longest-axis size a terrain prop is not worth a mesh shape. */
const MIN_SIZE = 0.35;

/**
 * Build static collision for the park.
 *
 * @param {Scene} scene
 * @param {{protos:Map<string,Mesh>, items:Array}} park
 * @returns {{bodies:PhysicsBody[], shapes:number, instances:number, skipped:string[]}}
 */
export function buildCollision(scene, park) {
  const bodies = [];
  const skipped = [];
  let shapes = 0;
  let instances = 0;
  let triangles = 0;

  // Which prototypes actually have placements, and how many.
  const counts = new Map();
  for (const it of park.items) counts.set(it.proto, (counts.get(it.proto) || 0) + 1);

  for (const [proto, mesh] of park.protos) {
    const n = counts.get(proto) || 0;
    if (!n) continue;
    const isGround = GROUND.test(proto);
    if (!isGround) {
      if (mesh.metadata?.layer !== 'terrain') continue;
      if (NO_COLLIDE.test(proto)) { skipped.push(proto); continue; }
      const ext = mesh.getBoundingInfo().boundingBox.extendSize;
      const size = Math.max(ext.x, ext.y, ext.z) * 2;
      if (size < MIN_SIZE && !ALWAYS.test(proto)) { skipped.push(proto); continue; }
    }

    /**
     * PhysicsShapeMesh reads the mesh's CURRENT vertex data, which is exactly
     * why park.js bakes the prototype's node transform into the geometry — a
     * shape built from un-baked vertices would collide with the park lying on
     * its side while the visuals stood upright. The two are the same array.
     */
    const shape = new PhysicsShapeMesh(mesh, scene);
    const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
    body.shape = shape;
    // The mesh carries thin instances, so this is ONE body with N instances;
    // Havok reads the same matrix buffer the renderer uses.
    body.updateBodyInstances();

    bodies.push(body);
    shapes++;
    instances += n;
    triangles += mesh.getTotalIndices() / 3;
  }

  /**
   * THE CATCH FLOOR.
   *
   * The park's ground is a mosaic of flat tiles — 129 grass, 29 path, 51 path
   * edging and so on — and a mesh collider built from zero-thickness geometry
   * has seams. Measured on a 48-point grid, a kid dropped from 3 m landed on
   * the park at 41 points and fell through at 7, all of them within a metre of
   * a tile that definitely has a collider. A capsule arriving at ~7.7 m/s can
   * pass between coplanar tiles at their join.
   *
   * A wide static floor a metre below grade catches those, which is what the
   * three.js park did too (its backdrop plane sat at −1.25, below the skate
   * bowl's carved floor at −1.14). It turns "fall out of the world forever"
   * into "step down and walk back up".
   *
   * It is NOT a fix for the seams and must not be allowed to hide them:
   * probe_character.mjs reports how many grid points land on the park versus
   * on this floor, so the seam count stays a visible number.
   */
  const FLOOR_Y = -2.6;
  const floor = MeshBuilder.CreateGround('_catch_floor', { width: 140, height: 140 }, scene);
  floor.position.set(6, FLOOR_Y, 11);              // centred on the park
  floor.isVisible = false;                          // collision only; the backdrop is separate work
  floor.isPickable = false;
  new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);
  bodies.push(floor.physicsBody);

  console.log(`[collision] ${shapes} mesh shapes, ${instances} static instances, `
    + `${(triangles / 1000).toFixed(0)}k collider triangles, ${skipped.length} prototypes skipped, `
    + `catch floor at y=${FLOOR_Y}`);

  return { bodies, shapes, instances, skipped, triangles, floorY: FLOOR_Y };
}

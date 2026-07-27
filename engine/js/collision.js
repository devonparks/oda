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
  PhysicsShapeMesh, PhysicsShapeConvexHull, PhysicsBody, PhysicsMotionType,
  PhysicsAggregate, PhysicsShapeType, MeshBuilder, Mesh, VertexData,
  TransformNode, Vector3, Quaternion, Matrix,
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
 * STAIRCASES COLLIDE AS THEIR CONVEX HULL — which for a staircase is exactly
 * the enclosing wedge ramp. The exact tread-and-riser mesh collider is
 * correct geometry and the capsule still wedged DEAD at tread corners on
 * ~half of all climbs (identical position for seconds, a different tread
 * each run) — a genuine solver equilibrium, reproduced with maxStepHeight
 * 0.30 and 0.45, with and without a downward weld bias, and with an unstick
 * hop. This is why every engine ships ramp colliders under stairs, and the
 * three.js park's heightfield was effectively one too. The visual treads
 * stay; a kid mid-flight floats above/below a tread edge by half a riser at
 * worst.
 */
const RAMPIFY = /Stairs/i;

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
  _shapeCache.clear();               // shapes belong to the scene being built

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
     *
     * (An intermediate version thickened flat ground tiles into solid hull
     * "slabs" to close what looked like seams between tiles. Do not bring
     * that back: the convex hull of anything DISHED — the sunken sand pits
     * measure 22 cm of dish — is that dish with an invisible flat LID on
     * top, and kids landing in the pit punched through the lid and wedged
     * INSIDE the hull, freezing the walk to the stairs one run in three.
     * The "seams" the slabs were invented for were really the scale bug
     * below; with that fixed, plus the terminal fall velocity in
     * character.js, the bare tile meshes pass a 48/48 drop grid and ten
     * straight stair runs.)
     *
     * SCALED PLACEMENTS GET THEIR OWN BODIES — this was the REAL cause of
     * "7 of 48 grid points fall through the ground", which two sessions
     * called "seams between coplanar tiles". It never was: physics raycasts
     * showed NO collider at all under every failing point, and each of those
     * points sat on a placement with a NON-UNIFORM SCALE (the skate bowl is
     * squashed to y×0.72, the round grass patches are stretched to taste,
     * one grass tile in ten is resized). A Havok shape cannot be scaled per
     * instance, so the instanced static body simply has nothing there.
     *
     * So physics no longer rides the render buffer directly: unit-scale
     * placements share one instanced body on a hidden physics-only mesh, and
     * every scaled placement gets its own static body whose shape has the
     * scale BAKED INTO the points (shapes cached per prototype + scale).
     */
    const rows = park.items.filter((it) => it.proto === proto);
    const unit = [];
    const scaled = [];
    for (const r of rows) {
      const [sx, sy, sz] = r.scale;
      (Math.abs(sx - 1) < 1e-3 && Math.abs(sy - 1) < 1e-3 && Math.abs(sz - 1) < 1e-3
        ? unit : scaled).push(r);
    }

    if (unit.length) {
      // a bare mesh sharing the prototype's geometry, carrying ONLY the
      // unit-scale matrices — invisible, unpickable, physics-only.
      // (Composed here from the layout rows: the object layer's cached
      // matrices do not exist yet when collision builds.)
      const phys = new Mesh(proto + '_phys', scene);
      mesh.geometry.applyToMesh(phys);
      phys.isVisible = false;
      phys.isPickable = false;
      const buf = new Float32Array(unit.length * 16);
      for (let i = 0; i < unit.length; i++) {
        const r = unit[i];
        Matrix.ComposeToRef(
          _one, _q.set(r.quat[0], r.quat[1], r.quat[2], r.quat[3]),
          _p.set(r.pos[0], r.pos[1], r.pos[2]), _m);
        _m.copyToArray(buf, i * 16);
      }
      phys.thinInstanceSetBuffer('matrix', buf, 16, true);
      const body = new PhysicsBody(phys, PhysicsMotionType.STATIC, false, scene);
      body.shape = RAMPIFY.test(proto)
        ? convexShape(mesh, scene, [1, 1, 1])
        : new PhysicsShapeMesh(mesh, scene);
      body.updateBodyInstances();
      bodies.push(body);
      shapes++;
    }

    for (const r of scaled) {
      const node = new TransformNode(r.name + '_phys', scene);
      node.position.set(r.pos[0], r.pos[1], r.pos[2]);
      node.rotationQuaternion = new Quaternion(r.quat[0], r.quat[1], r.quat[2], r.quat[3]);
      node.computeWorldMatrix(true);
      const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, scene);
      body.shape = RAMPIFY.test(proto)
        ? convexShape(mesh, scene, r.scale)
        : scaledMeshShape(mesh, scene, r.scale);
      bodies.push(body);
      shapes++;
    }

    instances += n;
    triangles += mesh.getTotalIndices() / 3;
  }

  /**
   * THE CATCH FLOOR — kept as a last line of defence, not as a fix.
   *
   * It caught the "7 of 48 points fall through the ground" problem for two
   * sessions while that problem was misdiagnosed as seams between coplanar
   * tiles. The real cause was scaled placements having no collider at all
   * (see the scaled-placement block above). With that fixed the floor should
   * catch nothing, and probe_character.mjs still reports how many grid
   * points land on it every run, so a regression shows up as a number.
   */
  const FLOOR_Y = -2.6;
  const floor = MeshBuilder.CreateGround('_catch_floor', { width: 140, height: 140 }, scene);
  floor.position.set(6, FLOOR_Y, 11);              // centred on the park
  floor.isVisible = false;                          // collision only; the backdrop is separate work
  floor.isPickable = false;
  new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);
  bodies.push(floor.physicsBody);

  console.log(`[collision] ${shapes} shape groups, ${instances} static instances, `
    + `${(triangles / 1000).toFixed(0)}k collider triangles, ${skipped.length} prototypes skipped, `
    + `catch floor at y=${FLOOR_Y}`);

  return { bodies, shapes, instances, skipped, triangles, floorY: FLOOR_Y };
}

// scratch for composing instance matrices at build time
const _one = new Vector3(1, 1, 1);
const _p = new Vector3();
const _q = new Quaternion();
const _m = new Matrix();

/** Shapes are cached per prototype + scale so ten same-sized round grass
 *  patches share one hull. */
const _shapeCache = new Map();
const cacheKey = (mesh, kind, s) =>
  `${kind}:${mesh.name}:${s[0].toFixed(4)},${s[1].toFixed(4)},${s[2].toFixed(4)}`;

/** The prototype's mesh shape with a placement's scale baked into a copy of
 *  its geometry — Havok cannot scale a shape per instance, which is why
 *  scaled placements come through here at all. */
function scaledMeshShape(mesh, scene, scale) {
  const key = cacheKey(mesh, 'mesh', scale);
  let shape = _shapeCache.get(key);
  if (shape) return shape;
  const src = mesh.getVerticesData('position');
  const pts = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    pts[i] = src[i] * scale[0];
    pts[i + 1] = src[i + 1] * scale[1];
    pts[i + 2] = src[i + 2] * scale[2];
  }
  const tmp = new Mesh('_scaled_tmp', scene);
  const vd = new VertexData();
  vd.positions = pts;
  vd.indices = mesh.getIndices().slice();
  vd.applyToMesh(tmp);
  shape = new PhysicsShapeMesh(tmp, scene);
  tmp.dispose();
  _shapeCache.set(key, shape);
  return shape;
}

/**
 * The convex hull of the (scaled) prototype — the ramp under a staircase.
 * (Rooting the hull 40 cm below grade was tried and made the sand-pit
 * approach WORSE — it turned the ramp's leading edge into a 34 cm wall
 * rising from the sunken pit floor. Measured: un-rooted 10/10 climbs,
 * rooted 2/12.)
 */
function convexShape(mesh, scene, scale) {
  const key = cacheKey(mesh, 'hull', scale);
  let shape = _shapeCache.get(key);
  if (shape) return shape;
  const src = mesh.getVerticesData('position');
  const pts = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    pts[i] = src[i] * scale[0];
    pts[i + 1] = src[i + 1] * scale[1];
    pts[i + 2] = src[i + 2] * scale[2];
  }
  shape = hullFromPoints(pts, scene);
  _shapeCache.set(key, shape);
  return shape;
}

function hullFromPoints(pts, scene) {
  const tmp = new Mesh('_hull_tmp', scene);
  const vd = new VertexData();
  vd.positions = pts;
  vd.indices = [];                       // a hull is built from the point cloud
  vd.applyToMesh(tmp);
  const shape = new PhysicsShapeConvexHull(tmp, scene);
  tmp.dispose();
  return shape;
}

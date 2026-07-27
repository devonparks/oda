/**
 * AMG World Engine — the world AROUND the park.
 *
 * Devon, of the version without this: *"it's just a plane floating in the
 * middle of nowhere."* So: the countryside the park sits in — land, low
 * hills, and belts of REAL trees — plus the distance fog that turns those
 * hills into atmosphere instead of pale spikes on a blue wall.
 *
 * PORTED FROM world/js/world.js `_buildBackdrop`, including both rules that
 * version paid for:
 *
 *   1. **The land sits BELOW everything you can walk on.** A plane at −0.6
 *      sat above the skate bowl's carved floor (−1.14) and filled it in —
 *      *"it looks like it has a green pool inside of it, you can't see the
 *      bottom of the skate park anymore."* A ring clear of the park instead
 *      left a blue moat of sky between the park edge and the ring. A plane
 *      under the lowest carved surface has neither problem, and the 1.25 m
 *      drop past the fence just reads as the park sitting on a low rise.
 *   2. **The trees are REAL.** They were code-drawn cones once and Devon
 *      clocked it instantly: *"you can tell that background is made by
 *      Claude because of the tree models."* These are the park's own tree
 *      and bush prototypes — same geometry, same vertex colours, same
 *      material — so the horizon belongs to the same world.
 *
 * WHAT IS DIFFERENT HERE, and it is the engine paying for itself again: the
 * three.js version had to MERGE ~250 tree clones into one giant buffer to
 * hold its draw-call budget. Thin instances give the same budget without
 * merging — one draw call per tree prototype, geometry shared with the park
 * copies, no extra vertex memory at all.
 *
 * VISUAL ONLY. Nothing here gets a physics body: the ground plane is not a
 * floor (the catch floor at −2.6 remains the one fallback, and the ground
 * grid probe still measures against it), the trees are not obstacles, and
 * none of it is pickable, so the object layer never selects scenery.
 */
import { MeshBuilder, Mesh, Matrix, Vector3, Quaternion, Color3, Color4, StandardMaterial, Scene } from 'babylon';

/** Where the land sits. Below the skate bowl's carved floor at −1.14. */
const GROUND_Y = -1.25;

/**
 * WHOLE trees only. `SM_Env_Tree_Large_01`'s siblings in the export are
 * `_Treehouse`, `_Bucket_Rope` and `_Tyre_Swing` — a loose prefix match once
 * scattered little cabins and hanging tyres across the skyline, which is the
 * over-matching trap this project keeps paying for.
 */
const TREE = /^SM_(Generic_Tree_\d+|Env_Tree_(01|Large_01))(#\d+)?$/;
const BUSH = /^SM_Env_Bush_01(#\d+)?$/;

/**
 * Build the countryside.
 *
 * @param {Scene} scene
 * @param {{protos:Map<string,Mesh>, items:Array, material:StandardMaterial}} park
 * @returns {{meshes:Mesh[], trees:number, innerRadius:number, groundY:number}}
 */
export function buildBackdrop(scene, park) {
  // Deterministic — a seeded LCG, never Math.random, so the skyline is
  // identical every visit and a screenshot diff means something.
  let seed = 20260726;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // The park's own extent, from the placements themselves.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const it of park.items) {
    if (it.pos[0] < minX) minX = it.pos[0];
    if (it.pos[0] > maxX) maxX = it.pos[0];
    if (it.pos[2] < minZ) minZ = it.pos[2];
    if (it.pos[2] > maxZ) maxZ = it.pos[2];
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  // clear of the park itself: half its diagonal, plus a margin for the fence
  const inner = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 6;

  const meshes = [];

  /**
   * THE COUNTRYSIDE IS PAINTED THE WAY THE PARK IS PAINTED — in VERTEX
   * COLOURS, on the park's own material. This is not a style choice, it is
   * the only way to get the same colour out.
   *
   * The first version set the same green as a flat `diffuseColor` and the
   * whole horizon rendered cream-white, while the hills (the same colour ×
   * 0.85) came out correctly green. Measured: the grass tile's vertex
   * colour is (0.361, 0.447, 0.216), the backdrop material's diffuse was
   * the identical triple, and the lawn rendered rgb(109,129,70) while the
   * countryside saturated at rgb(255,255,180).
   *
   * The reason is where each one sits in Babylon's StandardMaterial shader:
   *
   *     colour = clamp(lighting × diffuseColor + …, 0, 1) × vertexColor
   *
   * The park's light rig is deliberately bright (hemi 1.5 + a 2.2 sun — the
   * live park's own numbers), so `lighting` alone already exceeds 1. A
   * colour in `diffuseColor` is multiplied BEFORE that clamp and clips to
   * white; the same colour in the VERTEX buffer is multiplied after, and
   * survives. That is why every piece of Synty art in this park is
   * vertex-coloured and none of it blows out.
   *
   * So: the land and the hills get a COLOR_0 attribute filled from
   * `SM_Env_Ground_Tile_Grass`'s own vertex colour (post park.js's
   * linear→sRGB pass) and wear the park's material. The countryside is then
   * shaded by exactly the same maths as the lawn it continues — and if the
   * art is ever re-exported, it follows along for free.
   */
  const grassOf = (re, fallback) => {
    for (const [name, mesh] of park.protos) {
      if (!re.test(name)) continue;
      const c = mesh.getVerticesData('color');
      if (!c || !c.length) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < c.length; i += 4) { r += c[i]; g += c[i + 1]; b += c[i + 2]; n++; }
      return new Color3(r / n, g / n, b / n);
    }
    return Color3.FromHexString(fallback);
  };
  const grass = grassOf(/^SM_Env_Ground_Tile_Grass/, '#6ba43f');
  // Hills read as further away: the same green, a touch darker and cooler.
  const hillColour = new Color3(grass.r * 0.82, grass.g * 0.86, grass.b * 0.92);

  /** Paint every vertex of a mesh one colour, the way the park's art is painted. */
  const paint = (mesh, colour) => {
    const n = mesh.getTotalVertices();
    const c = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      c[i * 4] = colour.r; c[i * 4 + 1] = colour.g; c[i * 4 + 2] = colour.b; c[i * 4 + 3] = 1;
    }
    mesh.setVerticesData('color', c, false);
    mesh.material = park.material;      // the park's own frozen vertex-colour material
  };

  /**
   * ── the land ────────────────────────────────────────────────────────
   *
   * SUBDIVIDED, and that is not cosmetic. Babylon computes the fog distance
   * per VERTEX and interpolates it across the triangle, so a 900 m plane
   * built as `CreateGround` normally does — four corners, two triangles —
   * takes its fog from vertices 450 m away no matter where you stand on it.
   * The first run rendered every blade of countryside the same cream white
   * while the trees standing ON it fogged correctly with distance. 48
   * subdivisions puts a vertex every ~19 m, which is finer than the fog
   * gradient, and the field goes green again.
   */
  const ground = MeshBuilder.CreateGround('bd_ground', { width: 900, height: 900, subdivisions: 48 }, scene);
  ground.position.set(cx, GROUND_Y, cz);
  paint(ground, grass);
  ground.isPickable = false;
  ground.receiveShadows = false;       // nothing casts this far out
  ground.alwaysSelectAsActiveMesh = true;   // it wraps the camera; culling flickers
  ground.freezeWorldMatrix();
  meshes.push(ground);

  // ── low hills, well beyond the tree line ──────────────────────────────
  // One low-poly sphere, thin-instanced 26 times with per-hill scale. The
  // three.js version merged 26 sphere geometries; this is one draw call and
  // one geometry.
  const hill = MeshBuilder.CreateSphere('bd_hills', { diameter: 1, segments: 7 }, scene);
  paint(hill, hillColour);
  hill.isPickable = false;
  hill.alwaysSelectAsActiveMesh = true;
  {
    const buf = new Float32Array(26 * 16);
    const m = new Matrix();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.22;
      const d = inner + 55 + rnd() * 140;
      const r = 22 + rnd() * 40;
      const h = 8 + rnd() * 26;
      Matrix.ComposeToRef(
        new Vector3(r * 2, h * 2, r * 2),          // unit sphere is diameter 1
        Quaternion.Identity(),
        new Vector3(cx + Math.cos(a) * d, GROUND_Y - 1 - rnd() * 3, cz + Math.sin(a) * d),
        m,
      );
      m.copyToArray(buf, i * 16);
    }
    hill.thinInstanceSetBuffer('matrix', buf, 16, true);
  }
  meshes.push(hill);

  // ── REAL trees: the park's own prototypes, instanced around it ────────
  const treeProtos = [], bushProtos = [];
  for (const [name, mesh] of park.protos) {
    if (TREE.test(name)) treeProtos.push(mesh);
    else if (BUSH.test(name)) bushProtos.push(mesh);
  }

  /**
   * A belt of instances at a distance band. Each prototype gets ONE backdrop
   * mesh sharing the park copy's geometry — never the park mesh itself,
   * whose instance buffer the object layer indexes by position.
   */
  const belts = new Map();          // proto mesh -> matrices
  const belt = (pool, count, dMin, dSpan, sMin, sSpan) => {
    if (!pool.length) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.55;
      const d = dMin + rnd() * dSpan;
      const proto = pool[(rnd() * pool.length) | 0];
      const s = sMin + rnd() * sSpan;
      const m = new Matrix();
      Matrix.ComposeToRef(
        new Vector3(s, s, s),
        Quaternion.FromEulerAngles(0, rnd() * Math.PI * 2, 0),
        new Vector3(cx + Math.cos(a) * d, GROUND_Y, cz + Math.sin(a) * d),
        m,
      );
      let list = belts.get(proto);
      if (!list) belts.set(proto, (list = []));
      list.push(m);
    }
  };
  belt(bushProtos, 90, inner + 1, 10, 1.0, 0.8);    // scrub along the fence
  belt(treeProtos, 70, inner + 3, 16, 0.9, 0.5);    // the line just past it
  belt(treeProtos, 90, inner + 22, 60, 1.1, 0.9);   // the skyline behind

  let trees = 0;
  for (const [proto, list] of belts) {
    const m = new Mesh('bd_' + proto.name, scene);
    proto.geometry.applyToMesh(m);          // SHARED geometry, no copy
    m.material = park.material;             // the park's own vertex-colour material
    m.isPickable = false;
    m.receiveShadows = false;
    m.alwaysSelectAsActiveMesh = true;
    const buf = new Float32Array(list.length * 16);
    for (let i = 0; i < list.length; i++) list[i].copyToArray(buf, i * 16);
    m.thinInstanceSetBuffer('matrix', buf, 16, true);
    m.freezeWorldMatrix();
    meshes.push(m);
    trees += list.length;
  }

  /**
   * FOG, and it is doing real work. Short fog was how the three.js park hid
   * the void past the fence; with a world out there, fog at 95 m swallowed
   * the horizon and left the hills as pale spikes. Long fog turns the same
   * haze into atmospheric perspective — near trees crisp, hills soft, the
   * far skyline fading into the sky it stands against. So the fog colour is
   * exactly the clear colour: the horizon has no seam.
   */
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 85;
  scene.fogEnd = 340;    // hills live at 93–233 m; 240 dissolved them to ghosts
  const c = scene.clearColor;
  scene.fogColor = new Color3(c.r, c.g, c.b);

  console.log(`[backdrop] land at y=${GROUND_Y}, tree line from ${inner.toFixed(0)}m, `
    + `${trees} tree instances in ${belts.size} draw calls, 26 hills, fog ${scene.fogStart}–${scene.fogEnd}m`);

  return { meshes, trees, innerRadius: inner, groundY: GROUND_Y, centre: [cx, cz] };
}

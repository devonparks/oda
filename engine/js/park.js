/**
 * AMG World Engine — the park loader.
 *
 * Turns the engine-agnostic export (tools/world/unity/AMGParkExporter.cs) into
 * a Babylon scene:
 *
 *   park_protos.glb    275 prototypes, LOCAL space, Synty atlas baked to
 *                      vertex colours, Draco-compressed, no textures at all
 *   park_layout.json   {protos:[names], items:[{m,n,g,p,q,s}]} — 1103 rows
 *
 * ONE THIN-INSTANCE BUFFER PER PROTOTYPE. Every row that shares a prototype
 * becomes one 4x4 matrix in that prototype's instance buffer, so the whole
 * park is 275 draw calls no matter how many things stand in it — the 133 grass
 * tiles cost exactly as much as one. That is the property the three.js park
 * could not have: it merged geometry to hit the same draw-call budget, and
 * merging destroys identity, so hiding a single bench meant collapsing a slice
 * of a shared vertex buffer by hand. Here identity survives the batch, which
 * is what makes the object layer (js/objects.js) a few lines instead of
 * triangle surgery.
 *
 * ── THE HANDEDNESS DECISION, WHICH EVERYTHING DEPENDS ON ──────────────────
 * The Unity exporter already converts to the RIGHT-handed glTF/three.js
 * convention: it negates X on positions, vertices and box centres, and writes
 * quaternions as (x, -y, -z, w). Babylon is left-handed by default, and its
 * glTF loader compensates by giving `__root__` a (1, 1, -1) scale.
 *
 * So boot.js sets `scene.useRightHandedSystem = true`. With that flag the
 * loader leaves `__root__` at identity (verified in the loader source), the
 * layout's numbers apply verbatim, and — the part that actually matters —
 * every measurement the three.js park paid for in blood transfers unchanged:
 * the curated collision boxes, the seat and saddle positions, the water mask,
 * the zone coordinates. Flip this flag and all of that silently mirrors.
 */
import { Vector3, Quaternion, Matrix, Color3, StandardMaterial, SceneLoader } from 'babylon';

/** Where the park's assets live. Shared with the three.js park, byte for byte. */
export const ASSET_BASE = '../world/assets/';

/**
 * TERRAIN or CLUTTER — inherited from the three.js park, and NOT the scene's
 * own Environment/Props folders.
 *
 * The split is about what may become ground: TERRAIN is everything you can
 * stand on (paths, the playground structure with its stairs and decks, the
 * gazebo, the fountain, the treehouse, the swing frame), CLUTTER is the loose
 * toys (balls, prams, trikes, the slides' chutes). A toy truck must not be a
 * 20 cm step. Getting this split wrong the first time cost the roof decks.
 *
 * Note `Plaground` elsewhere in the data — Synty misspells the swing set
 * (`SM_Prop_Plaground_Swings_01`, one `y` missing), which is why this is a
 * pattern about the `Playground_` prefix rather than a tidy list of names.
 */
const CLUTTER = /^SM_Prop_(?!Playground_)|^SM_Veh_|^SM_Wep_|Playground_Slide|^SM_Env_Park_Seat_01/;

/** Water reads as water, not as a grey plane: it is the one special material. */
const WATER = /Fountain_Water|Pond_Water|_Water_/i;

/**
 * Load the park and thin-instance every placement.
 *
 * @param {Scene} scene
 * @param {(frac:number, msg:string)=>void} [onProgress]
 * @returns {Promise<{protos:Map<string,Mesh>, items:Array, stats:object}>}
 */
export async function loadPark(scene, onProgress = () => {}) {
  onProgress(0.05, 'Reading the park layout…');
  const layout = await (await fetch(ASSET_BASE + 'park_layout.json')).json();

  onProgress(0.15, 'Unpacking 275 prototypes…');
  const container = await SceneLoader.LoadAssetContainerAsync(ASSET_BASE, 'park_protos.glb', scene);

  /**
   * BAKE THE NODE TRANSFORM INTO THE GEOMETRY. Do not skip this, and do not
   * "simplify" it to resetting the transform — that is the bug this cost a
   * rebuild to find.
   *
   * The prototypes make an OBJ → Blender → glTF trip (tools/world/protos_to_glb.py).
   * The OBJ is already in glTF space, so it is imported on Blender's default
   * axes and `export_yup=True` converts back on the way out — and that
   * conversion lands as a −90° X rotation on every exported NODE, not in the
   * vertex data. Reset those nodes to identity and the whole park lies on its
   * side: measured, the fountain came back 2.91 x 2.91 x 1.21 where
   * park_collision.json says 2.91 x 1.21 x 2.91. Y and Z swapped, on all 275.
   *
   * So each prototype's world matrix is baked into its vertices once, and the
   * node then sits at identity — which is what thin instancing needs, since
   * instance matrices are relative to the mesh's own world matrix and any
   * leftover node transform would compound into all 1103 placements.
   *
   * The `baked` guard is on the GEOMETRY, not the mesh: if a future export
   * ever has two nodes sharing one geometry, baking twice would square the
   * rotation.
   */
  const byName = new Map();
  const baked = new Set();
  for (const m of container.meshes) {
    if (!m.getTotalVertices || !m.getTotalVertices()) continue; // __root__ and empties
    const world = m.computeWorldMatrix(true).clone();
    m.parent = null;
    m.position.setAll(0);
    m.rotationQuaternion = null;
    m.rotation.setAll(0);
    m.scaling.setAll(1);
    const geo = m.geometry?.uniqueId ?? m.uniqueId;
    if (!baked.has(geo)) {
      m.bakeTransformIntoVertices(world);
      toGammaSpace(m);
      baked.add(geo);
    }
    m.setEnabled(true);
    byName.set(m.name, m);
  }
  container.removeAllFromScene();
  for (const m of byName.values()) scene.addMesh(m); // put back only the prototypes

  onProgress(0.55, 'Placing 1103 objects…');

  // ── materials ───────────────────────────────────────────────────────────
  // The art is untextured: one flat material, and the Synty atlas colours ride
  // in on the vertex colour attribute. StandardMaterial is both cheaper than
  // the PBR one the glTF loader builds and closer to the Synty look. Freezing
  // it matters — 275 meshes share it, so it is bound 275 times a frame.
  const lit = new StandardMaterial('amg_park', scene);
  lit.diffuseColor = new Color3(1, 1, 1);
  lit.specularColor = new Color3(0.05, 0.05, 0.05);
  lit.specularPower = 64;
  lit.backFaceCulling = false;             // the export is doubleSided
  lit.freeze();

  const water = new StandardMaterial('amg_water', scene);
  water.diffuseColor = new Color3(0.29, 0.56, 0.68);
  water.specularColor = new Color3(0.35, 0.42, 0.45);
  water.specularPower = 96;
  water.alpha = 0.86;
  water.backFaceCulling = false;
  water.freeze();

  // ── group the placements by prototype ───────────────────────────────────
  const groups = new Map();                      // proto name -> item rows
  const items = [];                              // the flat registry, in file order
  const missing = new Set();
  const q = new Quaternion();
  const t = new Vector3();
  const s = new Vector3();

  for (let i = 0; i < layout.items.length; i++) {
    const row = layout.items[i];
    const proto = layout.protos[row.m];
    if (!byName.has(proto)) { missing.add(proto); continue; }

    const it = {
      id: items.length,
      name: row.n,                               // the Unity object name, e.g. "SM_Env_Bench_01 (3)"
      proto,                                     // the prototype/mesh it draws
      group: row.g,                              // the Unity folder — Environment / Props
      layer: CLUTTER.test(proto) ? 'clutter' : 'terrain',
      pos: row.p, quat: row.q, scale: row.s,
      mesh: null, index: -1,                     // filled in below: which thin instance is it
    };
    items.push(it);
    let g = groups.get(proto);
    if (!g) groups.set(proto, (g = []));
    g.push(it);
  }

  // ── build one matrix buffer per prototype ───────────────────────────────
  let instances = 0;
  for (const [proto, rows] of groups) {
    const mesh = byName.get(proto);
    const buf = new Float32Array(rows.length * 16);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      t.set(r.pos[0], r.pos[1], r.pos[2]);
      q.set(r.quat[0], r.quat[1], r.quat[2], r.quat[3]);
      s.set(r.scale[0], r.scale[1], r.scale[2]);
      Matrix.ComposeToRef(s, q, t, _m);
      _m.copyToArray(buf, i * 16);
      r.mesh = mesh;
      r.index = i;
    }
    // staticBuffer=false: the object layer rewrites single matrices to hide
    // things, and a GPU-only buffer cannot be partially updated.
    mesh.thinInstanceSetBuffer('matrix', buf, 16, false);
    mesh.material = WATER.test(proto) ? water : lit;
    mesh.isPickable = true;
    mesh.thinInstanceEnablePicking = true;       // per-instance picking, native here
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.doNotSyncBoundingInfo = false;
    mesh.thinInstanceRefreshBoundingInfo(false); // one bbox covering every instance
    mesh.freezeWorldMatrix();                    // prototypes never move; instances do
    mesh.metadata = { proto, layer: CLUTTER.test(proto) ? 'clutter' : 'terrain' };
    instances += rows.length;
  }

  if (missing.size) {
    // The 63-character trap: Blender truncates object names on OBJ import, and
    // a prototype whose key overflowed once made the zip line silently vanish.
    // Keys are `<mesh>#<n>` now (longest 39), but if a future export reintroduces
    // it, this is where it shows up instead of as a hole in the world.
    console.warn('[park] prototypes referenced by the layout but absent from the GLB:', [...missing]);
  }

  onProgress(0.85, 'Park placed.');
  const stats = {
    prototypes: groups.size,
    placements: instances,
    skipped: layout.items.length - instances,
    drawCalls: groups.size,
    triangles: [...groups.keys()].reduce((n, p) => n + byName.get(p).getTotalIndices() / 3, 0),
  };
  console.log(`[park] ${stats.prototypes} prototypes, ${stats.placements} placements, `
    + `${(stats.triangles / 1000).toFixed(0)}k unique triangles`);

  return { protos: byName, items, stats, material: lit, waterMaterial: water };
}

const _m = new Matrix();

/**
 * Convert a mesh's COLOR_0 attribute from linear to sRGB, in place.
 *
 * THIS IS WHY THE PARK LOOKED DARK. The whole art style is vertex colours —
 * the Synty atlas is baked into them and no texture ships at all — and glTF
 * declares COLOR_0 to be LINEAR. three.js honours that and applies a
 * linear→sRGB transfer to the final pixel (`outputColorSpace = SRGBColorSpace`,
 * read off the live renderer), which lifts a 0.36 stone to 0.63. Babylon's
 * StandardMaterial path writes what it is given, so the same park came out
 * markedly darker — dark olive grass against the live park's vivid green.
 *
 * Two wrong turns before this, both worth recording: enabling Babylon's ACES
 * tone mapping to "match three.js" made it WORSE, because ACES compresses
 * midtones and the gamma step in that block never applied to this material;
 * and raising the light intensities only blew out the reds while the shadows
 * stayed crushed. Neither was the problem. The transfer was.
 *
 * Doing it once on the CPU at load — rather than fighting the render pipeline
 * — is exact, costs nothing per frame, and leaves the material a plain frozen
 * StandardMaterial. It is applied pre-lighting rather than post, which is not
 * mathematically identical to three.js's post-transfer, but the art is flat
 * diffuse and the target was always "reads like the live park", not a proof.
 *
 * Uses the real sRGB piecewise transfer, not the 1/2.2 approximation in
 * Babylon's `Color3.toGammaSpace()`, because three.js uses the real one.
 */
function toGammaSpace(mesh) {
  const c = mesh.getVerticesData('color');
  if (!c) return;
  for (let i = 0; i < c.length; i += 4) {          // stride 4: rgba, alpha untouched
    for (let k = 0; k < 3; k++) {
      const v = c[i + k];
      c[i + k] = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    }
  }
  mesh.setVerticesData('color', c, false);
}

/**
 * AMG World — scene, terrain, player controller and camera.
 *
 * Draw-call budget is the whole design constraint here. Target hardware is a
 * school Chromebook (Intel UHD / Mali), which starts dropping frames somewhere
 * north of ~200 draw calls. So:
 *   - the park's 930 static renderers arrive pre-merged as ONE mesh (1 call)
 *   - the 187 prop placements get merged too, except the dozen that animate
 *   - coins are a single InstancedMesh
 *   - avatars are the only per-player cost, and presence.js caps them at 24
 * That lands a full park with a class in it at roughly 40 draw calls.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { CollisionWorld } from './collision.js';
import { ZONES, ACTIVITIES, COIN_SPOTS, SPAWN } from './zones.js';
import { DynamicProps, GroundFX } from './physics.js';

/** Props that must stay separate objects because they move. */
const ANIMATED = ['Swings', 'Seesaw', 'Rocker', 'Coin_Ride', 'Track_Ride', 'Kite'];
const _tiltQ = new THREE.Quaternion();   // scratch for the seesaw/rocker tilts
/** Props adopted by the physics layer instead of being baked/wobbled:
 *  balls get kicked around, the duck floats in the pond. */
const DYNAMIC = [
  { match: 'Ball_0', kind: 'ball' },
  { match: 'Toy_Duck', kind: 'floater' },
];

export const QUALITY = {
  low:    { pixelRatio: 1,    shadows: false, shadowSize: 0,    fogNear: 26, fogFar: 62,  antialias: false },
  medium: { pixelRatio: 1.5,  shadows: true,  shadowSize: 1024, fogNear: 40, fogFar: 95,  antialias: true },
  high:   { pixelRatio: 2,    shadows: true,  shadowSize: 2048, fogNear: 55, fogFar: 130, antialias: true },
};

/**
 * Structures pulled out of the merged park shell and given REAL collision.
 * Their raw export boxes are dropped by 'none' rules in collision.js.
 */
const SHELL_STRUCTURES = [
  { match: /Treehouse|Tree_House/i, name: '_treehouse' },
  { match: /Env_Fountain_01/i, name: '_fountain' },
  {
    match: /Swings_01/i, name: '_swingframe',
    // rides.js carves the baked seats + chains out of the shell at runtime and
    // rebuilds them dynamic; freeze their triangles into collision here and the
    // park gets invisible seats hanging in the air. Same box rides.js carves.
    exclude: () => new THREE.Box3(
      new THREE.Vector3(27.5 - 1.05, 0.18, 25.0 - 0.8),
      new THREE.Vector3(27.5 + 1.05, 2.06, 25.0 + 0.8)),
  },
];

/**
 * Greedy rectangle decomposition of a set of occupied "ix,iz" cells.
 *
 * Turns a band of voxel columns into as few boxes as possible: grow a run along
 * X, then extend that whole run along Z while every cell of it is occupied.
 * A treehouse floor collapses to one box; a wall ring to four. Without this a
 * single structure would emit hundreds of 25 cm cubes into the collision grid.
 */
function greedyRects(set) {
  const cells = new Set(set);
  const keys = [...cells].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const rects = [];
  for (const [ix, iz] of keys) {
    if (!cells.has(ix + ',' + iz)) continue;
    let x1 = ix;
    while (cells.has((x1 + 1) + ',' + iz)) x1++;
    let z1 = iz;
    for (;;) {
      let full = true;
      for (let x = ix; x <= x1; x++) if (!cells.has(x + ',' + (z1 + 1))) { full = false; break; }
      if (!full) break;
      z1++;
    }
    for (let z = iz; z <= z1; z++) for (let x = ix; x <= x1; x++) cells.delete(x + ',' + z);
    rects.push({ x0: ix, x1, z0: iz, z1 });
  }
  return rects;
}

export class World {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.quality = QUALITY[opts.quality] || QUALITY.medium;
    this.qualityName = opts.quality || 'medium';

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: this.quality.antialias, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    if (this.quality.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd0f5);
    this.scene.fog = new THREE.Fog(0xbfe4fb, this.quality.fogNear, this.quality.fogFar);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 240);
    this.camYaw = SPAWN.yaw;
    this.camPitch = 0.30;
    this.camDist = 7.0;
    this.camPos = new THREE.Vector3();

    this._buildLights();
    this._buildSky();

    this.collision = new CollisionWorld();
    this.animatedProps = [];
    this.coins = null;
    this.coinState = [];
    this.zoneMarkers = [];
    this.clock = new THREE.Clock();

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x5d7a4a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.position.set(28, 42, 18);
    if (this.quality.shadows) {
      sun.castShadow = true;
      const s = this.quality.shadowSize;
      sun.shadow.mapSize.set(s, s);
      // A tight ortho box around the player keeps texel density usable; the box
      // is re-centred every frame in update().
      const R = 18;
      Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 110 });
      sun.shadow.bias = -0.0012;
      sun.shadow.normalBias = 0.03;
    }
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  /** Big inverted sphere with a vertical gradient — cheaper than a cubemap. */
  _buildSky() {
    const geo = new THREE.SphereGeometry(180, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x3f9fe8) },
        mid: { value: new THREE.Color(0x9ed8f7) },
        bot: { value: new THREE.Color(0xdff1ff) },
      },
      vertexShader: `varying vec3 vPos;
        void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){
          float h = normalize(vPos).y;
          vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.65)) : mix(mid, bot, pow(-h, 0.5));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);

    // A few soft clouds so the sky isn't a flat wall.
    const cloudTex = makeCloudTexture();
    const cloudMat = new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.62, depthWrite: false, fog: false,
    });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(cloudMat);
      const a = (i / 14) * Math.PI * 2 + Math.random();
      const r = 70 + Math.random() * 60;
      s.position.set(Math.cos(a) * r, 34 + Math.random() * 22, Math.sin(a) * r);
      const sc = 26 + Math.random() * 30;
      s.scale.set(sc, sc * 0.5, 1);
      this.scene.add(s);
    }
  }

  /** Load the park. Reports 0..1 progress through onProgress. */
  async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
    loader.setDRACOLoader(draco);

    onProgress(0.05, 'Loading the park…');
    const [staticGltf, propsGltf, layout, collision] = await Promise.all([
      loader.loadAsync('assets/park_static.glb'),
      loader.loadAsync('assets/park_props.glb'),
      fetch('assets/park_props_layout.json').then((r) => r.json()),
      fetch('assets/park_collision.json').then((r) => r.json()),
    ]);
    onProgress(0.55, 'Building the world…');

    // ---- static shell ----
    const shell = staticGltf.scene;
    shell.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = this.quality.shadows;
      o.castShadow = false;                 // the shell shadowing itself is noise
      o.material = parkMaterial(o.material);
    });
    this.scene.add(shell);
    this.shell = shell;

    // ---- collision (before props: dynamic props settle against it) ----
    for (const box of collision) this.collision.add(box);
    const xs = collision.map((b) => b.c[0]), zs = collision.map((b) => b.c[2]);
    this.collision.bounds = {
      minX: Math.min(...xs) - 3, maxX: Math.max(...xs) + 3,
      minZ: Math.min(...zs) - 3, maxZ: Math.max(...zs) + 3,
    };

    // ---- water ----
    // The pond box (HALF-extents 13.7!) is the AABB of the whole pond AREA:
    // water + dirt shore + the rock ring (~8.4). The actual WATER disc is much
    // smaller — anchored by the props floating on it (toy boat d=3.3, floaties
    // d≤2.5) and the visible edge in playtests: r≈5.2. Deriving r from the box
    // (0.58×e ≈ 8) painted "water" over the whole dirt path: wading slowdown
    // and hip-deep sinking on dry land (Devon's report). Surface = box top.
    const pond = collision.find((b) => /Park_Pond_01/.test(b.n || ''));
    this.water = pond
      ? { x: pond.c[0], z: pond.c[2], r: 5.2, y: pond.c[1] + pond.e[1] }
      : null;

    // ---- ground heightfield (before physics: props settle against it) ----
    onProgress(0.62, 'Reading the ground…');
    this._bakeGroundHeightfield(collision);

    // ---- structures whose ONE export box was a lie ----
    // Ranked by measuring, for every solid box, how much of its volume the real
    // mesh actually fills. The worst offenders by empty-but-blocking volume:
    //   Fountain  81.9 m3 at 32% fill — 56 m3 of invisible wall, the single
    //             biggest lie in the park, parked in the middle of it
    //   Swing set 12.5 m3 at 34% — you couldn't walk between the A-frame legs
    //   Treehouse trunk-ruled down to a 0.9 m post you walked straight through
    // Everything below them in the ranking is a tree, and trees are already
    // refined to trunks on purpose. Derived from the merged park shell, clipped
    // to each structure's own export box.
    let shellMesh = null;
    this.shell.traverse((o) => { if (o.isMesh && !shellMesh) shellMesh = o; });
    if (shellMesh) {
      shellMesh.updateWorldMatrix(true, false);
      const pad = 0.15;
      const boxOf = (b, p) => new THREE.Box3(
        new THREE.Vector3(b.c[0] - b.e[0] - p, b.c[1] - b.e[1] - p, b.c[2] - b.e[2] - p),
        new THREE.Vector3(b.c[0] + b.e[0] + p, b.c[1] + b.e[1] + p, b.c[2] + b.e[2] + p));
      for (const d of SHELL_STRUCTURES) {
        const raw = collision.find((b) => d.match.test(b.n || ''));
        if (!raw) continue;
        this._addStructureCollision(shellMesh.geometry, shellMesh.matrixWorld, d.name, {
          clip: boxOf(raw, pad),
          exclude: d.exclude ? d.exclude() : null,
        });
      }
    }

    // ---- the fountain comes alive: jet, falling drops, basin ripples ----
    const fnt = collision.find((b) => /Env_Fountain_01/.test(b.n || ''));
    if (fnt) this._buildFountain(fnt);

    // ---- physics + ground FX ----
    this.fx = new GroundFX(this.scene);
    this.dynamics = new DynamicProps(this);

    // ---- props ----
    // Every prototype node in park_props.glb carries a +90° X rotation (the
    // geometry is authored Z-up; the NODE corrects it to Y-up). All placement
    // paths use raw geometry + the layout transform only, so bake the node's
    // world matrix into the vertices once — otherwise every prop renders
    // tipped on its back (flat lightpoles, inverted slides, nose-up ducks).
    const protos = new Map();
    propsGltf.scene.updateMatrixWorld(true);
    const baked = new Set();
    propsGltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!baked.has(o.geometry)) { o.geometry.applyMatrix4(o.matrixWorld); baked.add(o.geometry); }
      protos.set(o.name, o);
    });
    this._placeProps(protos, layout);
    onProgress(0.78, 'Setting out the toys…');

    this._buildCoins();
    this._buildZoneMarkers();
    onProgress(1, 'Ready');
    draco.dispose();
    return this;
  }

  /**
   * Bake the walkable-ground heightfield on the GPU: one orthographic top-down
   * render of the park SHELL (terrain + fixed structures, no props/avatars)
   * through a height-encoding shader, read back once. First-hit-from-above is
   * exactly "the surface you'd stand on" for terrain, the carved skate bowl,
   * ramps and stairs — the shapes AABBs fundamentally can't represent.
   *
   * Overhangs (tree canopies, the gazebo roof, the swing frame's top bar)
   * would poison their footprints, so those regions — identified by the
   * collision export's NAMED boxes — are masked out and inpainted from the
   * surrounding terrain. A needle pass then flattens any leftover thin
   * verticals (the perimeter fence has no collision box to mask by).
   *
   * Runs once at load (~10 ms). No asset file: it can never drift out of sync
   * with the real geometry.
   * @param {Array<{c:number[], e:number[], n:string}>} rawBoxes  the raw
   *        collision export, BEFORE rules — used only for overhang masks.
   */
  _bakeGroundHeightfield(rawBoxes) {
    const t0 = performance.now();
    const b = this.collision.bounds;
    const W = 512, H = 512;
    const spanX = b.maxX - b.minX, spanZ = b.maxZ - b.minZ;
    const stepX = spanX / (W - 1), stepZ = spanZ / (H - 1);

    // Height → 16-bit fixed point over R,G. y ∈ [-5, 20], ~0.4 mm resolution.
    const mat = new THREE.ShaderMaterial({
      vertexShader:
        'varying float vY;\n' +
        'void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vY = wp.y;\n' +
        '  gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader:
        'varying float vY;\n' +
        'void main() { float n = clamp((vY + 5.0) / 25.0, 0.0, 1.0);\n' +
        '  float v = floor(n * 65535.0 + 0.5); float hi = floor(v / 256.0);\n' +
        '  gl_FragColor = vec4(hi / 255.0, (v - hi * 256.0) / 255.0, 0.0, 1.0); }',
      side: THREE.DoubleSide,
    });

    // Straight down, up = -Z: image columns run minX→maxX, rows run maxZ→minZ
    // (flipped back during decode below).
    const cam = new THREE.OrthographicCamera(-spanX / 2, spanX / 2, spanZ / 2, -spanZ / 2, 0.5, 60);
    cam.position.set((b.minX + b.maxX) / 2, 40, (b.minZ + b.maxZ) / 2);
    cam.up.set(0, 0, -1);
    cam.lookAt(cam.position.x, 0, cam.position.z);
    cam.updateMatrixWorld(true);

    const rt = new THREE.WebGLRenderTarget(W, H);
    const tmp = new THREE.Scene();
    tmp.overrideMaterial = mat;
    tmp.add(this.shell);                      // reparents out of this.scene
    const prevTarget = this.renderer.getRenderTarget();
    const prevColor = this.renderer.getClearColor(new THREE.Color());
    const prevAlpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0x000000, 1); // no-hit decodes to -5 (out of world)
    this.renderer.setRenderTarget(rt);
    this.renderer.render(tmp, cam);
    const px = new Uint8Array(W * H * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevColor, prevAlpha);
    this.scene.add(this.shell);               // put the park back
    rt.dispose();
    mat.dispose();

    // Decode. readPixels row 0 is the image BOTTOM = NDC -1 = world maxZ, so
    // flip rows to make data[row][col] run minZ→maxZ like heightAt expects.
    const data = new Float32Array(W * H);
    for (let r = 0; r < H; r++) {
      const src = r * W, dst = (H - 1 - r) * W;
      for (let c = 0; c < W; c++) {
        const j = (src + c) * 4;
        data[dst + c] = ((px[j] * 256 + px[j + 1]) / 65535) * 25 - 5;
      }
    }

    // ── holes to inpaint: no-hit texels (outside the terrain skirt — left as
    //    -5 they'd poison every later min() against a neighbour) + overhang
    //    footprints (canopies/roofs would put their tops underfoot) ──
    for (let i = 0; i < W * H; i++) if (data[i] < -4.5) data[i] = NaN;
    const MASK = /Tree|Bush|Gazebo|Swings|Playground_Cover|Playground_Roof|Track_Ride|Kite|Umbrella|Tent|Fountain_Water/i;
    const PAD = 0.35;
    for (const box of rawBoxes) {
      if (!MASK.test(box.n || '')) continue;
      const x0 = Math.max(0, Math.floor((box.c[0] - box.e[0] - PAD - b.minX) / stepX));
      const x1 = Math.min(W - 1, Math.ceil((box.c[0] + box.e[0] + PAD - b.minX) / stepX));
      const z0 = Math.max(0, Math.floor((box.c[2] - box.e[2] - PAD - b.minZ) / stepZ));
      const z1 = Math.min(H - 1, Math.ceil((box.c[2] + box.e[2] + PAD - b.minZ) / stepZ));
      for (let r = z0; r <= z1; r++) for (let c = x0; c <= x1; c++) data[r * W + c] = NaN;
    }
    // Diffusion inpaint: masked texels take the average of known neighbours,
    // growing inward one texel per pass. Terrain under a canopy is smooth lawn,
    // so this is the right reconstruction, not just a cheap one.
    let holes = [];
    for (let i = 0; i < W * H; i++) if (Number.isNaN(data[i])) holes.push(i);
    for (let pass = 0; pass < 80 && holes.length; pass++) {
      const next = [];
      for (const i of holes) {
        let sum = 0, n = 0;
        const l = data[i - 1], rr = data[i + 1], u = data[i - W], dn = data[i + W];
        if (l === l) { sum += l; n++; }
        if (rr === rr) { sum += rr; n++; }
        if (u === u) { sum += u; n++; }
        if (dn === dn) { sum += dn; n++; }
        if (n) data[i] = sum / n; else next.push(i);
      }
      holes = next;
    }
    for (const i of holes) data[i] = 0;        // fully sealed region: flat ground

    // ── needle pass: flatten thin verticals with no mask (fence lines) ──
    // Anything a big step above ALL its neighbours is a wall texel, not
    // ground. MUST compare against a read-only snapshot: writing in place
    // while scanning lets one low texel cascade across the whole row (the -5
    // border once flooded the entire map to -5 exactly this way).
    for (let pass = 0; pass < 2; pass++) {
      const snap = data.slice();
      for (let r = 1; r < H - 1; r++) {
        for (let c = 1; c < W - 1; c++) {
          const i = r * W + c;
          const m = Math.min(snap[i - 1], snap[i + 1], snap[i - W], snap[i + W]);
          if (snap[i] - m > 2.0) data[i] = m;
        }
      }
    }

    // ── pond dish: the capture sees the water SURFACE; carve a wading depth
    //    so kids sink hip-deep (stepPlayer clamps standing depth to match) ──
    if (this.water) {
      const w = this.water, rr = w.r + 0.3, bed = w.y - 0.62;
      const x0 = Math.max(0, Math.floor((w.x - rr - b.minX) / stepX));
      const x1 = Math.min(W - 1, Math.ceil((w.x + rr - b.minX) / stepX));
      const z0 = Math.max(0, Math.floor((w.z - rr - b.minZ) / stepZ));
      const z1 = Math.min(H - 1, Math.ceil((w.z + rr - b.minZ) / stepZ));
      for (let r = z0; r <= z1; r++) {
        for (let c = x0; c <= x1; c++) {
          const px2 = b.minX + c * stepX, pz2 = b.minZ + r * stepZ;
          if (Math.hypot(px2 - w.x, pz2 - w.z) <= rr) {
            const i = r * W + c;
            if (data[i] > bed) data[i] = bed;
          }
        }
      }
    }

    this.collision.setHeightfield({ data, w: W, h: H, minX: b.minX, minZ: b.minZ, stepX, stepZ });
    console.log(`[world] heightfield ${W}x${H} baked in ${(performance.now() - t0).toFixed(1)}ms`,
      'probes:', 'spawn', this.collision.heightAt(4, 14).toFixed(2),
      'bowl', this.collision.heightAt(14.4, 25).toFixed(2),
      'pond', this.collision.heightAt(21, 0).toFixed(2));
  }

  _placeProps(protos, layout) {
    const merge = [];      // geometries for the static-prop batch
    const dummy = new THREE.Object3D();
    this.seats = [];       // sittable spots, harvested from bench layout entries
    this.slideData = [];   // slide top/exit points, harvested for rides.js
    this.kartParts = [];   // soapbox racer parts diverted to rides.js (drivable)
    for (const p of layout) {
      const proto = protos.get(p.mesh);
      if (!proto) continue;
      dummy.position.fromArray(p.p);
      dummy.quaternion.fromArray(p.q);
      dummy.scale.fromArray(p.s);
      dummy.updateMatrix();

      if (p.mesh === 'SM_Env_Park_Seat_01') this._addBenchSeats(proto, dummy);
      if (/Playground_Slide/.test(p.mesh)) this._addSlideData(proto, dummy);
      if (/Playground_Ship/.test(p.mesh)) this._addStructureCollision(proto.geometry, dummy.matrix, '_ship');
      // A tent is a thing you go INSIDE; its box was 3.9 m2 of solid at 58%
      // fill, so the doorway didn't exist.
      if (/Prop_Tent_/.test(p.mesh)) this._addStructureCollision(proto.geometry, dummy.matrix, '_tent');

      // The soapbox racer becomes DRIVABLE: divert its parts (frame, steering
      // wheel, four wheels — each its own layout entry) out of the static
      // batch; rides.js reassembles them into a rigid dynamic group.
      if (p.mesh.startsWith('SM_Veh_Soapbox_Racer_03')) {
        this.kartParts.push({ proto, matrix: dummy.matrix.clone(), mesh: p.mesh });
        continue;
      }

      const dyn = DYNAMIC.find((d) => p.mesh.includes(d.match));
      if (dyn) {
        // Ducks belong ON the water (Devon's call): the layout scattered its 14
        // toy ducks around the fountain, so re-seat every floater onto the pond
        // in a golden-angle spread — even fill, no clumps, all inside the rock
        // ring (water r≈8, spread stays under 6.4). NOTE: `p` is a const loop
        // binding — build a separate entry rather than reassigning it.
        let entry = p;
        if (dyn.kind === 'floater' && this.water) {
          const k = this._floaterCount = (this._floaterCount || 0) + 1;
          // spread scales with the ACTUAL water radius — the old 6.4m max
          // beached half the flock on the dirt shore
          const r = 0.9 + (this.water.r - 1.4) * Math.sqrt(k / 14);
          const a = k * 2.39996 + 0.7;
          entry = { ...p, p: [this.water.x + Math.cos(a) * r, this.water.y, this.water.z + Math.sin(a) * r] };
        }
        this.dynamics.add(proto, entry, { kind: dyn.kind });
        continue;
      }
      if (ANIMATED.some((k) => p.mesh.includes(k))) {
        const m = new THREE.Mesh(proto.geometry, parkMaterial(proto.material));
        m.applyMatrix4(dummy.matrix);
        m.castShadow = this.quality.shadows;
        m.receiveShadow = this.quality.shadows;
        m.userData.kind = p.mesh;
        m.userData.rest = m.rotation.clone();
        m.userData.restQuat = dummy.quaternion.clone();
        m.userData.phase = Math.random() * Math.PI * 2;
        // Tilt axis for seesaw planks / rocker animals, in the GEOMETRY's own
        // frame: ends (or nose/tail) go up-down = rotation about the horizontal
        // axis PERPENDICULAR to the long axis. Poking Euler .x/.z on a yaw'd
        // mesh span the wrong axes — Devon's playtest: "the seesaw just twists
        // left and right", spring riders "straight up broken".
        if (/Seesaw|Rocker/.test(p.mesh)) {
          if (!proto.geometry.boundingBox) proto.geometry.computeBoundingBox();
          const bb = proto.geometry.boundingBox;
          const alongX = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z);
          m.userData.tiltAxis = alongX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
          m.userData.angle = 0;
        }
        this.scene.add(m);
        this.animatedProps.push(m);
      } else {
        merge.push(proto.geometry.clone().applyMatrix4(dummy.matrix));
      }
    }
    if (merge.length) {
      const geo = BufferGeometryUtils.mergeGeometries(merge, false);
      const mesh = new THREE.Mesh(geo, parkMaterial(null));
      mesh.castShadow = this.quality.shadows;
      mesh.receiveShadow = this.quality.shadows;
      this.scene.add(mesh);
      this.propBatch = mesh;
      merge.forEach((g) => g.dispose());
    }
  }

  /**
   * The fountain was a dry statue (Devon's playtest note). A pulsing
   * translucent jet above the spout, eight drops falling in a widening ring,
   * and occasional basin ripples — all shared-material, ~9 tiny meshes.
   */
  _buildFountain(box) {
    const x = box.c[0], z = box.c[2];
    const topY = box.c[1] + box.e[1];
    const mat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.55, depthWrite: false });
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.55, 8, 1, true), mat);
    jet.position.set(x, topY + 0.18, z);
    this.scene.add(jet);
    const drops = [];
    const dropGeo = new THREE.SphereGeometry(0.035, 6, 5);
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(dropGeo, mat);
      d.userData = { a: (i / 8) * Math.PI * 2, k: Math.random() };
      this.scene.add(d);
      drops.push(d);
    }
    this.fountain = { x, z, topY, jet, drops };
  }

  /**
   * Two sittable spots per park bench, derived from the layout transform.
   * Which local axis runs along the bench and which side holds the backrest
   * are read from the geometry itself (the tall backrest vertices), so no
   * hand-tuned signs — main.js turns these into "Sit down" prompts.
   */
  _addBenchSeats(proto, dummy) {
    const geo = proto.geometry;
    if (!proto.userData._benchInfo) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const alongX = (bb.max.x - bb.min.x) >= (bb.max.z - bb.min.z);
      const pos = geo.attributes.position;
      let acc = 0, n = 0, seatTop = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y > 0.55) { acc += alongX ? pos.getZ(i) : pos.getX(i); n++; }
        // Seat plane = the highest vertex BELOW the backrest band. Now that a
        // kid actually sits (rather than freezing a squat with their feet on the
        // ground at the bench's front edge), the pose needs to know where the
        // plank is — read from the mesh, not typed in.
        else if (y > 0.12 && y > seatTop) seatTop = y;
      }
      proto.userData._benchInfo = {
        alongX, backSign: n && acc / n > 0 ? 1 : -1,
        seatTop: seatTop > -Infinity ? seatTop : 0.42,
      };
    }
    const { alongX, backSign, seatTop } = proto.userData._benchInfo;
    const along = alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const face = alongX ? new THREE.Vector3(0, 0, -backSign) : new THREE.Vector3(-backSign, 0, 0);
    along.applyQuaternion(dummy.quaternion);
    face.applyQuaternion(dummy.quaternion);
    const yaw = Math.atan2(face.x, face.z);
    for (const s of [-0.55, 0.55]) {
      const x = dummy.position.x + along.x * s + face.x * 0.1;
      const z = dummy.position.z + along.z * s + face.z * 0.1;
      this.seats.push({
        id: `seat${this.seats.length}`, seat: true,
        icon: '\u{1FA91}', name: 'Park Bench', prompt: 'Sit down',
        pos: [x, z], radius: 1.0, x, z, yaw,
        seatY: dummy.position.y + seatTop * dummy.scale.y,
      });
    }
  }

  /**
   * REAL collision from REAL geometry.
   *
   * The park ships one axis-aligned box per prop, straight out of the Synty
   * demo scene's renderer bounds. For a crate that is fine. For anything a kid
   * is supposed to get INTO or ONTO it is the whole problem — Devon's playtest:
   * "it's just one big invisible block on the object, so you can't actually fit
   * where you're supposed to." One box cannot express a deck you stand on, a
   * doorway you walk through, or a floor you don't fall through.
   *
   * So for the structures that matter, collision is derived from the mesh:
   * rasterise the triangles into 25 cm columns, band them by height, greedy-
   * merge each band's occupied cells into rectangles, and emit one thin box per
   * rectangle. What comes out is the actual shape — the ship's deck and hull,
   * the treehouse's floor and its walls WITH the gap between them — at a couple
   * of dozen boxes per structure instead of one lie.
   *
   * Thin bands matter: `resolve` skips any box whose bottom is above your head,
   * so a floor emitted as a 25 cm slab lets a kid walk underneath it, while a
   * floor-to-ground slab would wall off the space below.
   *
   * @param {THREE.BufferGeometry} geo   source geometry
   * @param {THREE.Matrix4} matrix       geometry → world
   * @param {string} name                collision box name (debug/rules)
   * @param {{clip?:THREE.Box3, exclude?:THREE.Box3, cell?:number, band?:number}} [opts]
   *        clip — only take triangles whose centroid is inside (for pulling one
   *        structure out of the merged park shell).
   *        exclude — and skip the ones inside THIS box. The swing set needs it:
   *        rides.js degenerates the baked seats and chains out of the shell and
   *        rebuilds them as dynamic meshes, but that happens after load, so
   *        without the exclusion their triangles would be frozen into collision
   *        boxes hanging in mid-air where the seats used to rest.
   * @returns {number} boxes emitted
   */
  _deriveCollision(geo, matrix, name, opts = {}) {
    const CELL = opts.cell || 0.25;      // horizontal resolution
    const BAND = opts.band || 0.25;      // vertical resolution
    const clip = opts.clip || null;
    const exclude = opts.exclude || null;
    const pos = geo.attributes.position;
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const q = new THREE.Vector3();

    // ── 1. rasterise triangle SURFACES into (band, cell) occupancy ──
    // Vertices alone are not enough: Synty floors are often two triangles
    // spanning three metres, which would mark four columns and miss the floor.
    const cells = new Map();             // bandIndex -> Set("ix,iz")
    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const mark = (p) => {
      const bi = Math.floor(p.y / BAND);
      let set = cells.get(bi);
      if (!set) cells.set(bi, (set = new Set()));
      set.add(Math.floor(p.x / CELL) + ',' + Math.floor(p.z / CELL));
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    };
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
      b.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
      c.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
      if (clip || exclude) {
        q.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        if (clip && !clip.containsPoint(q)) continue;
        if (exclude && exclude.containsPoint(q)) continue;
      }
      // subdivide by the longest edge so no cell is stepped over
      const step = Math.min(CELL, BAND) * 0.6;
      const n = Math.min(64, Math.max(1, Math.ceil(
        Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / step)));
      for (let i = 0; i <= n; i++) {
        for (let j = 0; i + j <= n; j++) {
          const u = i / n, v = j / n, w = 1 - u - v;
          q.set(a.x * w + b.x * u + c.x * v, a.y * w + b.y * u + c.y * v, a.z * w + b.z * u + c.z * v);
          mark(q);
        }
      }
    }
    if (!cells.size) return 0;

    // ── 2. greedy-merge each band's cells into rectangles ──
    let emitted = 0;
    for (const [bi, set] of cells) {
      const rects = greedyRects(set);
      const y0 = bi * BAND, y1 = y0 + BAND;
      for (const r of rects) {
        const x0 = r.x0 * CELL, x1 = (r.x1 + 1) * CELL;
        const z0 = r.z0 * CELL, z1 = (r.z1 + 1) * CELL;
        this.collision.add({
          c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
          e: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2],
          n: name, derived: true,
        });
        emitted++;
      }
    }
    return emitted;
  }

  /**
   * The pirate ship and the treehouse: the two structures whose export box was
   * a flat lie. The ship's ran from the ground to the MAST TIP (3.3 m of solid,
   * so you bounced off it at every height); the treehouse inherits the name of
   * the tree it hangs in, so the tree's 'trunk' rule shrank a 3.6 x 3.4 m house
   * into a 0.9 m post you walked straight through. Both are dropped by 'none'
   * rules in collision.js and rebuilt here from their real geometry.
   */
  _addStructureCollision(geo, matrix, name, opts) {
    const t0 = performance.now();
    const n = this._deriveCollision(geo, matrix, name, opts);
    console.log(`[world] ${name}: ${n} collision boxes from real geometry (${(performance.now() - t0).toFixed(0)}ms)`);
    return n;
  }

  /**
   * Slide geometry analysis for rides.js: where the chute starts (top) and
   * where it spits you out (exit), in world space, read from the vertices —
   * the top band's centroid, and the low band's centroid EXCLUDING anything
   * directly under the top (ladders and platform legs live there).
   */
  _addSlideData(proto, dummy) {
    const posA = proto.geometry.attributes.position;
    const v = new THREE.Vector3();
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < posA.count; i++) {
      v.fromBufferAttribute(posA, i).applyMatrix4(dummy.matrix);
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    let tx = 0, ty = 0, tz = 0, tn = 0;
    for (let i = 0; i < posA.count; i++) {
      v.fromBufferAttribute(posA, i).applyMatrix4(dummy.matrix);
      if (v.y > maxY - 0.3) { tx += v.x; ty += v.y; tz += v.z; tn++; }
    }
    if (!tn) return;
    tx /= tn; ty /= tn; tz /= tn;
    let bx = 0, by = 0, bz = 0, bn = 0;
    for (let i = 0; i < posA.count; i++) {
      v.fromBufferAttribute(posA, i).applyMatrix4(dummy.matrix);
      if (v.y < minY + 0.3 && Math.hypot(v.x - tx, v.z - tz) > 0.7) { bx += v.x; by += v.y; bz += v.z; bn++; }
    }
    if (!bn) return;
    this.slideData.push({
      top: { x: tx, y: ty, z: tz },
      exit: { x: bx / bn, y: by / bn, z: bz / bn },
    });
  }

  _buildCoins() {
    const geo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd54a, emissive: 0xffae00, emissiveIntensity: 0.45,
      roughness: 0.35, metalness: 0.4,
    });
    const inst = new THREE.InstancedMesh(geo, mat, COIN_SPOTS.length);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.castShadow = false;
    inst.frustumCulled = false;
    this.scene.add(inst);
    this.coins = inst;
    // Ground under a coin never moves, so resolve it ONCE here instead of
    // calling groundAt() per coin every frame (~1800 grid lookups/sec saved).
    this.coinState = COIN_SPOTS.map(([x, z]) => ({
      x, z, hx: x, hz: z,   // hx/hz = home; magnetism drifts x/z, respawn resets
      y: 0, taken: false, respawnAt: 0, phase: Math.random() * Math.PI * 2,
      groundY: this.collision.groundAt(x, z, 2),
    }));
  }

  _buildZoneMarkers() {
    for (const z of [...ZONES, ...ACTIVITIES]) {
      const group = new THREE.Group();
      const color = z.color ?? 0x7dd3fc;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry((z.radius || 3) * 0.72, (z.radius || 3) * 0.86, 40),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.42,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      group.add(ring);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry((z.radius || 3) * 0.72, (z.radius || 3) * 0.72, 6, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.09,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      beam.position.y = 3;
      group.add(beam);

      const sign = makeZoneSign(z);
      sign.position.y = 3.6;
      group.add(sign);

      group.position.set(z.pos[0], 0, z.pos[1]);
      group.userData.zone = z;
      group.userData.sign = sign;
      group.userData.ring = ring;
      this.scene.add(group);
      this.zoneMarkers.push(group);
    }
  }

  // ---- player -------------------------------------------------------------

  /** Move the local player for one frame. Returns useful per-frame facts. */
  stepPlayer(avatar, intent, dt) {
    // Kid-scale speeds. These are deliberately slower than a typical 3rd-person
    // game: the avatars are 1.2 m tall and the Synty locomotion clips were
    // authored for adults, so anything faster makes the legs whirl. Keep in
    // sync with GAIT in clips.js.
    const WALK = 1.6, RUN = 3.4, ACCEL = 18, GRAVITY = -19, JUMP = 5.4;

    // Camera-relative desired direction.
    //
    // (fx, fz) is the BOOM direction: updateCamera puts the camera at
    // focus + dir*dist with dir = (sin camYaw, cos camYaw), i.e. it points from
    // the player OUT TO the camera. So the way you're looking is MINUS that.
    // W (move.y = -1, screen-up) therefore has to move along -(fx, fz); using
    // +(fx, fz) walked the kid straight back into the camera, which is why W and
    // S felt swapped. The strafe terms are unchanged — (fz, -fx) is already
    // screen-right for this yaw convention.
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    let dx = intent.move.x * fz + intent.move.y * fx;
    let dz = -intent.move.x * fx + intent.move.y * fz;

    // tap-to-move steers toward a world point until it is reached
    if (intent.target && Math.hypot(intent.move.x, intent.move.y) < 0.05) {
      const tx = intent.target.x - avatar.pos.x, tz = intent.target.z - avatar.pos.z;
      const d = Math.hypot(tx, tz);
      if (d < 0.45) intent.clearTarget && intent.clearTarget();
      else { dx = tx / d; dz = tz / d; }
    }

    // Wading: water is walkable but slow — legs push against it, and main.js
    // spawns ripples/splashes off the flag this sets.
    const water = this.waterAt(avatar.pos.x, avatar.pos.z);
    avatar.wading = water != null && avatar.pos.y < water + 0.05;

    const wish = Math.hypot(dx, dz);
    // speedScale: vehicles (rides.js kart) go faster than legs allow
    const maxSpeed = (intent.run ? RUN : WALK) * (intent.speedScale || 1) * (avatar.wading ? 0.55 : 1);
    const target = wish > 0.01 ? maxSpeed : 0;
    avatar.speed += THREE.MathUtils.clamp(target - avatar.speed, -ACCEL * dt, ACCEL * dt);
    if (avatar.speed < 0.02) avatar.speed = 0;

    if (wish > 0.01) {
      avatar.targetYaw = Math.atan2(dx, dz);
      // turn toward travel direction rather than snapping — reads as momentum
      let d = (avatar.targetYaw - avatar.yaw) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      avatar.yaw += d * Math.min(1, 14 * dt);
    }

    let nx = avatar.pos.x, nz = avatar.pos.z;
    if (avatar.speed > 0 && wish > 0.01) {
      nx += (dx / wish) * avatar.speed * dt;
      nz += (dz / wish) * avatar.speed * dt;
    }

    const clamped = this.collision.clampToBounds(nx, nz, 1.2);
    const solved = this.collision.resolve(clamped.x, clamped.z, avatar.pos.y);
    avatar.pos.x = solved.x;
    avatar.pos.z = solved.z;

    // vertical. The pond bed is real terrain now (heightfield dish) — cap how
    // deep a kid stands so water reads hip-deep, never over-the-head.
    let ground = this.collision.groundAt(avatar.pos.x, avatar.pos.z, avatar.pos.y);
    if (water != null) ground = Math.max(ground, water - 0.55);
    if (intent.jump && avatar.grounded) { avatar.vel.y = JUMP; avatar.grounded = false; }
    avatar.vel.y += GRAVITY * dt;
    avatar.pos.y += avatar.vel.y * dt;
    if (avatar.pos.y <= ground) {
      avatar.pos.y = ground;
      avatar.vel.y = 0;
      if (!avatar.grounded) avatar.landedThisFrame = true;
      avatar.grounded = true;
      avatar.airTime = 0;
    } else {
      avatar.grounded = false;
      avatar.airTime += dt;
    }

    return { moving: avatar.speed > 0.05, ground };
  }

  updateCamera(avatar, look, zoom, dt) {
    this.camYaw -= look.x * 0.0045;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y * 0.0035, -0.12, 1.15);
    this.camDist = THREE.MathUtils.clamp(this.camDist + zoom * 3.2, 3.2, 14);

    // Reuse scratch vectors — updateCamera runs every frame, so allocating here
    // is 200+ short-lived Vector3s/sec of GC pressure on a Chromebook.
    const focus = (this._camFocus || (this._camFocus = new THREE.Vector3()))
      .set(avatar.pos.x, avatar.pos.y + 1.25, avatar.pos.z);
    const dir = (this._camDir || (this._camDir = new THREE.Vector3())).set(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch),
    );
    let dist = this.camDist;
    // keep the camera out of scenery: shorten the boom if a box is in the way
    const hitDist = this._boomBlocked(focus, dir, dist);
    if (hitDist != null) dist = Math.max(1.6, hitDist - 0.35);

    const want = (this._camWant || (this._camWant = new THREE.Vector3()))
      .copy(focus).addScaledVector(dir, dist);
    want.y = Math.max(want.y, this.collision.groundAt(want.x, want.z, 0) + 0.7);
    // critically-damped-ish follow: snappy but never jittery. First frame snaps
    // into place instead of swooping in from the world origin (camPos starts 0).
    if (!this._camReady) { this.camPos.copy(want); this._camReady = true; }
    else this.camPos.lerp(want, 1 - Math.exp(-13 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(focus);
  }

  /** Cheapest useful boom check: sample along the boom against collision boxes. */
  _boomBlocked(from, dir, dist) {
    const steps = 8;
    for (let i = 2; i <= steps; i++) {
      const t = (i / steps) * dist;
      const x = from.x + dir.x * t, y = from.y + dir.y * t, z = from.z + dir.z * t;
      // nearShared, not near: this ran 7 times a frame and `near()` allocates a
      // fresh Set each call (~420/sec of garbage). Safe here because each result
      // is fully drained inside this loop body before the next collision call.
      for (const idx of this.collision.nearShared(x, z, 0.3)) {
        const b = this.collision.boxes[idx];
        if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y > b.minY && y < b.maxY) {
          return t;
        }
      }
    }
    return null;
  }

  /** @returns indices of coins collected this frame */
  collectCoins(x, z, y, dt = 0.016) {
    const got = [];
    const now = performance.now();
    for (let i = 0; i < this.coinState.length; i++) {
      const c = this.coinState[i];
      if (c.taken) {
        if (now > c.respawnAt) { c.taken = false; c.x = c.hx; c.z = c.hz; }
        continue;
      }
      // magnetism: within arm's reach-and-a-bit the coin flies to the player —
      // pickup feels generous instead of pixel-hunty. Respawn resets to home.
      const dxm = x - c.x, dzm = z - c.z;
      const dm = Math.hypot(dxm, dzm);
      if (dm < 2.4 && dm > 1e-3 && Math.abs(c.y + 0.7 - y) < 2.2) {
        const pull = Math.min(1, (10 * dt) * (1.2 - dm / 2.4 + 0.3));
        c.x += dxm * pull;
        c.z += dzm * pull;
      }
      if (Math.abs(c.x - x) < 0.9 && Math.abs(c.z - z) < 0.9 && Math.abs(c.y + 0.7 - y) < 2.0) {
        c.taken = true;
        c.respawnAt = now + 90000;   // come back in 90s so the park isn't farmable
        got.push(i);
      }
    }
    return got;
  }

  /** Water surface height at (x, z), or null when not over water. */
  waterAt(x, z) {
    const w = this.water;
    if (!w) return null;
    const dx = x - w.x, dz = z - w.z;
    return dx * dx + dz * dz < w.r * w.r ? w.y : null;
  }

  update(dt, t, playerPos) {
    this.fx?.update(dt);
    // Swings/seesaws/rockers drift so the park never reads as a still photo —
    // and walking into one gives it a real PUSH that rings down over ~4s. (The
    // swings themselves turned out to be baked into the static shell; the
    // rockers and seesaw are the play equipment that actually animates.)
    for (const p of this.animatedProps) {
      const ph = p.userData.phase;
      const k = p.userData.kind;
      // Only parts that read as INDEPENDENT may wiggle. Multi-part assemblies
      // (coin-ride car + steering wheel + rider, rocker springs + animals)
      // each got their own random phase, which was invisible while the props
      // rendered tipped over — upright, the parts visibly drift apart. Now:
      // rocker/seesaw TOPS move (their bases hold still), kites flutter, and
      // the coin rides stand still until someone pays for a ride.
      const isTop = k.includes('_Top');
      let push = 0;
      if (isTop && (k.includes('Rocker') || k.includes('Seesaw'))) {
        push = p.userData.push || 0;
        if (playerPos) {
          const d = Math.hypot(playerPos.x - p.position.x, playerPos.z - p.position.z);
          if (d < 1.4) push = 1;
        }
        push = Math.max(0, push - dt * 0.25);
        p.userData.push = push;
      }
      if (k.includes('Seesaw') && isTop) {
        const ang = Math.sin(t * (0.9 + push) + ph) * (0.18 + push * 0.30);
        p.userData.angle = ang;
        p.quaternion.copy(p.userData.restQuat)
          .multiply(_tiltQ.setFromAxisAngle(p.userData.tiltAxis, ang));
      } else if (k.includes('Rocker') && isTop) {
        const ang = Math.sin(t * (1.6 + push * 1.2) + ph) * (0.12 + push * 0.38);
        p.userData.angle = ang;
        p.quaternion.copy(p.userData.restQuat)
          .multiply(_tiltQ.setFromAxisAngle(p.userData.tiltAxis, ang));
      } else if (k.includes('Kite')) p.rotation.z = p.userData.rest.z + Math.sin(t * 2.0 + ph) * 0.22;
    }

    // fountain: pulsing jet, drops arcing outward, occasional basin ripples
    if (this.fountain) {
      const f = this.fountain;
      f.jet.scale.set(1, 0.85 + Math.sin(t * 7) * 0.18, 1);
      f.jet.rotation.y = t * 2;
      for (const d of f.drops) {
        const u = d.userData;
        u.k += dt * 0.9;
        if (u.k >= 1) {
          u.k = 0; u.a = Math.random() * Math.PI * 2;
          if (Math.random() < 0.35) {
            this.fx.spawn(f.x + Math.cos(u.a) * 0.9, 0.52, f.z + Math.sin(u.a) * 0.9,
              { from: 0.08, to: 0.5, dur: 0.6, alpha: 0.35 });
          }
        }
        const r = 0.55 + u.k * 0.35;
        d.position.set(
          f.x + Math.cos(u.a) * r,
          (f.topY - 0.1) - u.k * u.k * (f.topY - 0.75),
          f.z + Math.sin(u.a) * r);
      }
    }

    // coins bob and spin; taken ones are scaled to zero rather than removed.
    // Reuse one dummy (hoisted) and the cached ground — no per-frame allocation
    // and no per-coin grid lookup.
    const dummy = this._coinDummy || (this._coinDummy = new THREE.Object3D());
    let coinsDirty = false;
    for (let i = 0; i < this.coinState.length; i++) {
      const c = this.coinState[i];
      const y = c.groundY + 0.75 + Math.sin(t * 2 + c.phase) * 0.12;
      c.y = y - 0.75;
      dummy.position.set(c.x, y, c.z);
      dummy.rotation.set(0, t * 2.2 + c.phase, 0);
      dummy.scale.setScalar(c.taken ? 0 : 1);
      dummy.updateMatrix();
      this.coins.setMatrixAt(i, dummy.matrix);
      coinsDirty = true;
    }
    if (coinsDirty) this.coins.instanceMatrix.needsUpdate = true;

    // Zone signs face the camera and float. They intentionally draw THROUGH
    // scenery (depthTest off) so a kid can see where to go from anywhere — but
    // that only works if far ones get out of the way, so they shrink and fade
    // with distance and drop out entirely past SIGN_FAR.
    const SIGN_NEAR = 10, SIGN_FAR = 34;
    for (const g of this.zoneMarkers) {
      const sign = g.userData.sign;
      sign.quaternion.copy(this.camera.quaternion);
      const d = Math.hypot(playerPos.x - g.position.x, playerPos.z - g.position.z);
      const near = THREE.MathUtils.clamp(1 - (d - 4) / 10, 0.25, 1);
      g.userData.ring.material.opacity = 0.22 + near * 0.35 + Math.sin(t * 2) * 0.04;
      sign.position.y = 3.6 + Math.sin(t * 1.4 + g.position.x) * 0.12;

      const fade = THREE.MathUtils.clamp((SIGN_FAR - d) / (SIGN_FAR - SIGN_NEAR), 0, 1);
      sign.visible = fade > 0.02;
      sign.material.opacity = 0.35 + fade * 0.65;
      // keep signs a roughly constant on-screen size instead of ballooning up close
      const camD = Math.max(this.camera.position.distanceTo(g.position), 2);
      const s = THREE.MathUtils.clamp(camD * 0.09, 0.9, 3.6);
      sign.scale.set(s * 2.4, s, 1);
    }

    if (this.quality.shadows && this.sun) {
      this.sun.position.set(playerPos.x + 28, 42, playerPos.z + 18);
      this.sun.target.position.set(playerPos.x, 0, playerPos.z);
      this.sun.target.updateMatrixWorld();
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

/**
 * Everything in the park shares one material. The GLBs are vertex-coloured with
 * no textures, so this is deliberately plain: flat-ish, matte, fog-aware.
 */
let _parkMat = null;
function parkMaterial() {
  if (!_parkMat) {
    _parkMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  }
  return _parkMat;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    const x = 40 + Math.random() * 176;
    const y = 60 + Math.random() * 30;
    const r = 22 + Math.random() * 26;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeZoneSign(zone) {
  const w = 384, h = 160, dpr = 2;
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const hex = '#' + (zone.color ?? 0x7dd3fc).toString(16).padStart(6, '0');
  ctx.font = '64px system-ui, "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(zone.icon || '⭐', w / 2, 46);

  ctx.font = '700 30px "Baloo 2", system-ui, sans-serif';
  const tw = ctx.measureText(zone.name).width + 40;
  const x = (w - tw) / 2;
  ctx.fillStyle = 'rgba(10,16,34,0.78)';
  ctx.beginPath();
  const r = 18, y = 90, bh = 44;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + tw, y, x + tw, y + bh, r);
  ctx.arcTo(x + tw, y + bh, x, y + bh, r);
  ctx.arcTo(x, y + bh, x, y, r);
  ctx.arcTo(x, y, x + tw, y, r);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hex; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#f2fbff';
  ctx.fillText(zone.name, w / 2, y + bh / 2 + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false,
  }));
  sprite.scale.set(3.6, 1.5, 1);
  sprite.renderOrder = 20;
  return sprite;
}

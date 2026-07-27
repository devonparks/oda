/**
 * AMG World Engine — boot.
 *
 * Milestone 1 of docs/AMG_WORLD_ENGINE_BRIEF.md: bring up Babylon and Havok,
 * thin-instance the park, put the Inspector on a key. The three.js park stays
 * live and untouched at /world — this is a parallel build, not a migration in
 * place, and nothing here writes to world/.
 *
 * Everything hangs off `window.__engine` so the puppeteer probes in
 * tools/engine/ can read the real thing. The in-app browser pane freezes
 * requestAnimationFrame, so every check in this project runs through real
 * Chrome instead; see tools/engine/probe_lib.mjs.
 */
import {
  Engine, Scene, Vector3, Color3, Color4,
  HemisphericLight, DirectionalLight, ShadowGenerator,
  UniversalCamera, HavokPlugin, DracoDecoder, ImageProcessingConfiguration, HAS_INSPECTOR,
} from 'babylon';
import { loadPark } from './park.js';
import { buildCollision } from './collision.js';
import { Character } from './character.js';
import { WorldObjects } from './objects.js';
import { Props } from './props.js';
import { Library } from './library.js';
import { buildBackdrop } from './backdrop.js';
import { Npcs } from './npc.js';

const canvas = document.getElementById('stage');
const bootEl = document.getElementById('boot');
const fillEl = document.getElementById('bootFill');
const msgEl = document.getElementById('bootMsg');
const hudEl = document.getElementById('hud');
const statsEl = document.getElementById('stats');

const progress = (frac, msg) => {
  fillEl.style.width = Math.round(frac * 100) + '%';
  if (msg) msgEl.textContent = msg;
};

function fatal(err) {
  console.error('[engine] fatal', err);
  document.getElementById('fatalMsg').textContent = (err && err.stack) || String(err);
  document.getElementById('fatal').classList.remove('hidden');
  bootEl.classList.add('hidden');
}

async function main() {
  // ── Draco, served from our own origin ─────────────────────────────────
  // park_protos.glb lists KHR_draco_mesh_compression as REQUIRED and Babylon
  // would otherwise fetch the decoder from cdn.babylonjs.com. A school
  // Chromebook behind a filter that blocks that host would get a park with no
  // geometry at all, so the decoder ships in vendor/draco/.
  const base = new URL('../vendor/draco/', import.meta.url).href;
  DracoDecoder.DefaultConfiguration = {
    wasmUrl: base + 'draco_wasm_wrapper_gltf.js',
    wasmBinaryUrl: base + 'draco_decoder_gltf.wasm',
    fallbackUrl: base + 'draco_decoder_gltf.js',
  };

  progress(0.02, 'Starting the engine…');
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,     // probes screenshot the canvas
    stencil: true,
    antialias: true,
    powerPreference: 'high-performance',
  }, true);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene(engine);

  /**
   * RIGHT-HANDED. This single line is why every measurement from the three.js
   * park still applies — see the long comment in park.js. The Unity exporter
   * writes glTF/three.js convention; with this flag Babylon's glTF loader
   * leaves `__root__` at identity instead of mirroring Z, so the layout, the
   * curated collision boxes and every seat coordinate mean what they say.
   */
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0.53, 0.76, 0.92, 1);
  scene.ambientColor = new Color3(0.35, 0.37, 0.42);
  scene.collisionsEnabled = false;   // Havok owns collision, not the legacy system

  /**
   * COLOUR PARITY WITH THE LIVE PARK — measured, not guessed.
   *
   * The first render came back noticeably darker than /world. The cause is not
   * the lighting: glTF COLOR_0 is LINEAR, and three.js applies a linear→sRGB
   * transfer plus ACES tone mapping on output, which Babylon's StandardMaterial
   * path does not do by default. Read straight off the live park's renderer:
   *
   *     outputColorSpace   = SRGBColorSpace
   *     toneMapping        = ACESFilmicToneMapping
   *     toneMappingExposure = 1.15
   *
   * Reproducing that with Babylon's image-processing block was tried and made
   * it WORSE — ACES crushes the midtones and its gamma step never reached this
   * material. The transfer is applied to the vertex colours at load instead
   * (see `toGammaSpace` in park.js, which has the full account). Tone mapping
   * stays OFF so it cannot double-darken. The lights below are the live park's
   * numbers.
   */
  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = false;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.0;

  // ── Havok ─────────────────────────────────────────────────────────────
  progress(0.06, 'Loading Havok…');
  const { default: HavokPhysics } = await import('../vendor/havok.js');
  const havok = await HavokPhysics({
    locateFile: (f) => new URL('../vendor/' + f, import.meta.url).href,
  });
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  console.log('[engine] Havok up');

  // ── lights: the live park's rig, number for number ────────────────────
  // Synty art is flat-shaded and vertex-coloured; it wants a soft sky fill plus
  // one clear key, not a physically-correct setup. These are world.js's own
  // values (HemisphereLight 0xcfe9ff/0x5d7a4a at 1.5, DirectionalLight
  // 0xfff4e0 at 2.2) so the two engines can be compared side by side.
  const sky = new HemisphericLight('sky', new Vector3(0.2, 1, 0.15), scene);
  sky.intensity = 1.5;
  sky.diffuse = Color3.FromHexString('#cfe9ff');
  sky.groundColor = Color3.FromHexString('#5d7a4a');

  const sun = new DirectionalLight('sun', new Vector3(-0.45, -1, -0.35), scene);
  sun.position = new Vector3(40, 60, 40);
  sun.intensity = 2.2;
  sun.diffuse = Color3.FromHexString('#fff4e0');

  // ── camera: a fly camera until the character lands in M2 ──────────────
  const cam = new UniversalCamera('fly', new Vector3(26, 14, 34), scene);
  cam.setTarget(new Vector3(0, 1.5, 4));
  cam.attachControl(canvas, true);
  cam.speed = 0.9;
  cam.inertia = 0.82;
  cam.angularSensibility = 900;
  cam.minZ = 0.1;
  cam.maxZ = 400;
  cam.keysUp = [87]; cam.keysDown = [83]; cam.keysLeft = [65]; cam.keysRight = [68];
  cam.keysUpward = [69]; cam.keysDownward = [81];   // E / Q
  scene.activeCamera = cam;

  // ── the park ──────────────────────────────────────────────────────────
  const park = await loadPark(scene, progress);

  progress(0.7, 'Building the countryside…');
  const backdrop = buildBackdrop(scene, park);

  progress(0.75, 'Building collision…');
  const collision = buildCollision(scene, park);

  const objects = new WorldObjects(scene, park);
  const restored = objects.applyRemoved();
  if (restored) console.log(`[objects] ${restored} saved removals applied`);

  progress(0.8, 'Waking up a kid…');
  const player = await new Character(scene, { spawn: new Vector3(2, 3, 20) }).load();
  // The fly camera stays in the scene for the probes to borrow, but it must
  // stop listening or its WASD fights the character's.
  cam.detachControl();
  player.attachCamera(canvas);
  player.bindKeys();

  // The prop database: every mountable prop's seat, clip, pins and motion,
  // measured into engine/assets/prop_db.json. E mounts, Space hops off.
  const props = await Props.load(scene, park, player);
  const library = new Library(scene, park, player, props.db);
  const promptEl = document.getElementById('prompt');
  setInterval(() => {
    const text = props.hudText();
    promptEl.classList.toggle('hidden', !text);
    if (text) promptEl.textContent = text;
  }, 180);

  /**
   * SHADOWS, and the frustum is HAND-DRIVEN because the automatic one does
   * not work in a right-handed scene.
   *
   * The symptom was "the kid casts nothing, anywhere". Everything looked
   * wired: the generator existed, the kid's four meshes were in the render
   * list, the receiving material carried SHADOW1/SHADOWPCF1/SHADOWS. The
   * shadow map read back empty. Projecting the kid through the generator's
   * own transform matrix gave the answer in one number:
   *
   *     clip = (-0.03, 0.21, -0.63)      ← x,y centred; DEPTH NEGATIVE
   *
   * With `autoUpdateExtends` on, Babylon derives the light's depth range
   * from the ACTIVE CAMERA's near/far when `shadowMinZ`/`shadowMaxZ` are
   * unset, and in a right-handed scene that lands the caster at negative
   * depth — clipped out of the map entirely, so nothing is ever drawn into
   * it. Measured against three alternatives, an explicit ortho box with an
   * explicit depth range is the only one that puts the kid inside [0,1].
   *
   * Driving it by hand is better anyway: the box follows the player, so all
   * 1024² texels are spent on the few metres around them instead of on the
   * whole park.
   */
  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  // Small biases: the frustum below is ~20 m deep, not the camera's 400, so
  // the old 0.008 was metres of offset and pushed the shadow off the world.
  shadows.bias = 0.0008;
  shadows.normalBias = 0.01;

  const SHADOW_R = 9;              // half-width of the lit box, metres
  const SHADOW_BACK = 55;          // how far back along the sun the light sits
  const sunDir = sun.direction.normalizeToNew();
  sun.autoUpdateExtends = false;
  sun.orthoLeft = -SHADOW_R; sun.orthoRight = SHADOW_R;
  sun.orthoBottom = -SHADOW_R; sun.orthoTop = SHADOW_R;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = SHADOW_BACK + 40;
  for (const m of park.protos.values()) m.receiveShadows = true;
  // The kid casts; the park only receives. Putting 275 thin-instance meshes in
  // the caster list would re-render the whole park into the shadow map every
  // frame for scenery whose shadows are already in the vertex colours.
  for (const m of player.model.getChildMeshes()) shadows.addShadowCaster(m);

  progress(0.95, 'Compiling shaders…');
  await scene.whenReadyAsync();

  /**
   * FREEZE THE PARK MATERIALS NOW, not at load — see the long note in
   * park.js. The shadow-sampling code is a compile-time define, so a
   * material frozen before the ShadowGenerator existed could never receive
   * a shadow. Freezing here, after the shadow rig is built and every shader
   * is compiled, keeps the per-frame win (275 meshes share this material)
   * without costing the shadows.
   */
  park.material.freeze();
  park.waterMaterial.freeze();

  // ── run ───────────────────────────────────────────────────────────────
  // The character steps BEFORE the render, off the same clock Havok uses.
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;
    player.update(dt);
    if (window.__engine && window.__engine.npcs) window.__engine.npcs.update(Math.min(dt, 1 / 20));
    // Keep the shadow box centred on the kid (see the note where it is set
    // up): the light sits back along its own direction, so the kid lands in
    // the middle of the ortho box and inside the depth range.
    const p = player.model.position;
    sun.position.set(
      p.x - sunDir.x * SHADOW_BACK,
      p.y - sunDir.y * SHADOW_BACK,
      p.z - sunDir.z * SHADOW_BACK,
    );
  });
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());

  bootEl.classList.add('hidden');
  hudEl.classList.remove('hidden');

  // ── HUD stats ─────────────────────────────────────────────────────────
  let showStats = true;
  setInterval(() => {
    if (!showStats) return;
    statsEl.textContent =
      `${engine.getFps().toFixed(0)} fps · ${scene.getActiveMeshes().length} active · `
      + `${park.stats.drawCalls} protos · ${park.stats.placements} objects · `
      + `${(park.stats.triangles / 1000).toFixed(0)}k tris`;
  }, 250);

  // ── keys ──────────────────────────────────────────────────────────────
  addEventListener('keydown', async (e) => {
    if (e.code === 'Backquote') {                       // ~ toggles the Inspector
      e.preventDefault();
      const { toggleInspector } = await import('./devtools.js');
      toggleInspector(scene);
    } else if (e.code === 'KeyF') {
      showStats = !showStats;
      statsEl.style.visibility = showStats ? '' : 'hidden';
    } else if (e.code === 'KeyE' || (e.code === 'KeyX' && props.active)) {
      // E mounts the nearest prop / hops off; X always hops off (the seesaw
      // uses Space for pushing, so it needs a dedicated exit).
      // mount() fetches the clip bin on first use — a lost fetch must stay a
      // console line, not become "The engine stopped" via unhandledrejection.
      if (props.active) props.dismount();
      else props.mount().catch((err) => console.warn('[props] mount failed:', err));
    } else if (e.code === 'KeyP') {                     // P browses the prop library
      const open = library.toggle();
      if (!open) scene.activeCamera = player.camera;
    } else if (e.code === 'Escape' && library.open) {
      library.toggle();
      scene.activeCamera = player.camera;
    } else if (e.code === 'KeyO') {                     // O toggles edit mode
      objects.enabled = !objects.enabled;
      document.exitPointerLock?.();
      console.log('[objects] edit mode', objects.enabled ? 'ON — click an object, Delete removes it' : 'off');
    } else if (objects.enabled && (e.code === 'Delete' || e.code === 'Backspace')) {
      const gone = objects.remove();
      if (gone) console.log('[objects] removed', gone.name);
    } else if (objects.enabled && e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
      const back = objects.undo();
      if (back) console.log('[objects] restored', back.name);
    }
  });

  // Click to select, but only in edit mode — otherwise a click is "look around".
  canvas.addEventListener('pointerdown', (e) => {
    if (!objects.enabled) return;
    const it = objects.select(objects.pick(e.clientX, e.clientY));
    console.log(it ? `[objects] ${it.name}  (${it.proto}) at ${it.pos.map((n) => n.toFixed(1))}` : '[objects] nothing there');
  });

  // ── the probe surface ─────────────────────────────────────────────────
  window.__engine = {
    engine, scene, camera: cam, park, havok: plugin, shadows, collision, player, objects, props, library, backdrop,
    ready: true,
    hasInspector: HAS_INSPECTOR,
    /**
     * Move a free camera somewhere and aim it — used by every probe.
     * Detaches the player camera, since the player owns its own each frame.
     */
    look(from, at) {
      scene.activeCamera = cam;
      cam.position.set(from[0], from[1], from[2]);
      cam.setTarget(new Vector3(at[0], at[1], at[2]));
    },
    /** Give the camera back to the kid. */
    follow() { scene.activeCamera = player.camera; },
    /** Teleport the kid and let them settle. */
    tp(x, z, y) { player.tp(x, z, y); },
    /** Grading knobs, so a probe can A/B them without a reload. */
    grade(o = {}) {
      const c = scene.imageProcessingConfiguration;
      if ('tone' in o) c.toneMappingEnabled = o.tone;
      if ('exposure' in o) c.exposure = o.exposure;
      if ('contrast' in o) c.contrast = o.contrast;
      if ('sky' in o) sky.intensity = o.sky;
      if ('sun' in o) sun.intensity = o.sun;
      return { tone: c.toneMappingEnabled, exposure: c.exposure, contrast: c.contrast, sky: sky.intensity, sun: sun.intensity };
    },
    /** Average colour of a screen region — for measuring, not eyeballing. */
    sample(x, y, w, h) {
      const gl = engine._gl, px = new Uint8Array(w * h * 4);
      gl.readPixels(x, engine.getRenderHeight() - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      const n = px.length / 4;
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    },
    /** Every placement of a prototype, by name substring. */
    find(pattern) {
      const re = new RegExp(pattern, 'i');
      return park.items.filter((it) => re.test(it.proto) || re.test(it.name));
    },
  };
  console.log('[engine] ready —', park.stats.placements, 'objects,',
    park.stats.drawCalls, 'prototypes, right-handed:', scene.useRightHandedSystem);

  /**
   * THE OTHER KIDS COME AFTER THE WORLD IS PLAYABLE. Each costume is its
   * own ~350 KB GLB, which is the single biggest thing this engine adds to
   * a Chromebook's download, so they are fetched once `ready` is already
   * true: the park is walkable while they arrive, and `?npc=0` skips them.
   */
  const npcCount = /[?&]npc=0\b/.test(location.search) ? 0 : 4;
  if (npcCount) {
    Npcs.load(scene, park, props, npcCount)
      .then((n) => {
        window.__engine.npcs = n;
        for (const k of n.kids) for (const m of k.model.getChildMeshes()) shadows.addShadowCaster(m);
      })
      .catch((e) => console.warn('[npc] load failed:', e.message));
  }
}

main().catch(fatal);
/**
 * Unhandled rejections are fatal ONLY until the engine is up. During boot a
 * rejection means the world genuinely cannot start; after that, killing a
 * running park over a stray async error (a lost fetch for an emote bin, a
 * transient asset hiccup mid-deploy) replaces a playable world with "The
 * engine stopped" — which a student then reports as a crash. Log it, keep
 * running.
 */
addEventListener('unhandledrejection', (e) => {
  if (window.__engine && window.__engine.ready) {
    console.error('[engine] unhandled rejection (non-fatal):', e.reason);
    e.preventDefault();
  } else {
    fatal(e.reason);
  }
});

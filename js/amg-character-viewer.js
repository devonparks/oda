/**
 * AMG Character Viewer — a tiny reusable three.js stage for POLYGON Kids GLBs.
 * Used by the landing hero and the character picker. Chromebook-safe:
 * one low-poly model, capped pixel ratio, pauses when off-screen.
 *
 * Usage (ES module):
 *   import { createCharacterViewer } from './js/amg-character-viewer.js';
 *   const v = createCharacterViewer(canvas, { autoSpin: true });
 *   await v.load('assets/characters/kid_hoodie.glb');
 *   v.dispose();  // when done
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

export function createCharacterViewer(canvas, opts = {}) {
  const autoSpin = opts.autoSpin !== false;
  const spinSpeed = opts.spinSpeed || 0.01;
  const allowDrag = opts.allowDrag !== false;
  const height = opts.height || 0;   // 0 = use canvas client height

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  scene.add(new THREE.HemisphereLight(0xdde7ff, 0x445066, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x66ffd0, 0.9);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const pivot = new THREE.Group();
  scene.add(pivot);

  const fitPad = opts.fitPad || 1.18;   // >1 = more breathing room around the character
  const yBias = opts.yBias ?? 0.0;      // shift framing vertically (0 = centered on bbox)

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const h = height || canvas.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (model) frame();   // re-fit whenever the stage aspect changes so nothing clips
  }
  window.addEventListener('resize', resize);
  resize();

  const loader = new GLTFLoader();
  let model = null;

  // Fit the whole model in view accounting for BOTH height and width vs the
  // current aspect ratio, with padding — prevents heads/feet/shoulders clipping.
  function frame() {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);   // recentre on origin

    const fov = camera.fov * Math.PI / 180;
    const distForHeight = (size.y / 2) / Math.tan(fov / 2);
    const distForWidth = (size.x / 2) / (Math.tan(fov / 2) * camera.aspect);
    let dist = Math.max(distForHeight, distForWidth) * fitPad;

    camera.position.set(0, size.y * yBias, dist);
    camera.lookAt(0, 0, 0);
    camera.near = Math.max(dist / 100, 0.01);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
  }

  async function load(url) {
    const gltf = await loader.loadAsync(url);
    if (model) { pivot.remove(model); disposeObject(model); }
    model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if ((m.name || '').includes('AMG_Face')) {
            m.transparent = true; m.depthWrite = false; m.alphaTest = 0.01;
          }
          m.vertexColors = false;   // Synty COLOR_0 renders black in three.js
          m.roughness = Math.max(m.roughness ?? 0.85, 0.6);
          m.needsUpdate = true;
        });
      }
    });
    pivot.add(model);
    frame();
    return model;
  }

  // drag to rotate
  let dragging = false, lastX = 0, curSpin = autoSpin ? spinSpeed : 0;
  if (allowDrag) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; curSpin = 0; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    canvas.addEventListener('pointermove', (e) => { if (dragging) { pivot.rotation.y += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
    canvas.addEventListener('pointerup', () => { dragging = false; if (autoSpin) curSpin = spinSpeed; });
  }

  // pause when off-screen (Chromebook battery)
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((ents) => { visible = ents[0].isIntersecting; }, { threshold: 0.01 })
      .observe(canvas);
  }

  let raf = 0, alive = true;
  (function loop() {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (visible) {
      if (!dragging && curSpin) pivot.rotation.y += curSpin;
      renderer.render(scene, camera);
    }
  })();

  function disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  return {
    load,
    setSpin(v) { curSpin = v; },
    scene, camera, pivot,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (model) disposeObject(model);
      renderer.dispose();
    }
  };
}

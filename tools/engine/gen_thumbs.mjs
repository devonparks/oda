/**
 * Render a thumbnail for every prototype in the park — the picture half of
 * Devon's "every item from the Synty POLYGON packs in one library the engine
 * can browse, with thumbnails."
 *
 * Each prototype is cloned (geometry only, no thin instances) onto a stage
 * 60 m below the park — nothing else exists down there, so no hiding or
 * restoring of the real scene — framed from a three-quarter angle scaled to
 * its bounds, and clipped straight to a 256 px PNG.
 *
 * Output: engine/assets/thumbs/<name>.png  (a '#' in a prototype name would
 * break URLs, so it becomes '~' — engine/js/library.js applies the same
 * mapping when it builds <img> tags.)
 *
 *   node tools/engine/gen_thumbs.mjs            # all 275
 *   node tools/engine/gen_thumbs.mjs Bench      # only matching prototypes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot, peek, settle } from './probe_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'engine/assets/thumbs');
const FILTER = process.argv[2] || '';
fs.mkdirSync(OUT, { recursive: true });

const { browser, page } = await boot({ headless: true, log: false });

const names = await peek(page, (f) => {
  const list = [...window.__engine.park.protos.keys()];
  return f ? list.filter((n) => new RegExp(f, 'i').test(n)) : list;
}, FILTER);
console.log(`${names.length} prototypes to photograph`);

// one reusable stage mesh + camera, rebuilt per prototype
await peek(page, () => {
  const e = window.__engine;
  e.scene.activeCamera = e.camera;
  e.camera.detachControl();
  window.__thumb = { mesh: null };
});

let done = 0;
for (const name of names) {
  await peek(page, async (n) => {
    const e = window.__engine;
    const mod = await import('babylon');
    const t = window.__thumb;
    if (t.mesh) { t.mesh.dispose(); t.mesh = null; }

    const src = e.park.protos.get(n);
    const mesh = new mod.Mesh('_thumb', e.scene);
    src.geometry.applyToMesh(mesh);
    mesh.material = src.material;
    mesh.isPickable = false;
    t.mesh = mesh;

    // centre the geometry on the stage (tree-mounted props live far from
    // their own origin — the bounds are the truth, not the pivot)
    const pos = mesh.getVerticesData('position');
    const min = { x: 1e9, y: 1e9, z: 1e9 }, max = { x: -1e9, y: -1e9, z: -1e9 };
    for (let i = 0; i < pos.length; i += 3) {
      min.x = Math.min(min.x, pos[i]); max.x = Math.max(max.x, pos[i]);
      min.y = Math.min(min.y, pos[i + 1]); max.y = Math.max(max.y, pos[i + 1]);
      min.z = Math.min(min.z, pos[i + 2]); max.z = Math.max(max.z, pos[i + 2]);
    }
    const c = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
    const STAGE = { x: 0, y: -60, z: 0 };
    mesh.position.set(STAGE.x - c.x, STAGE.y - c.y, STAGE.z - c.z);

    const d = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
    const r = Math.max(0.5, d) * 1.45;   // 1.15 clipped the dragon's tail
    e.look([STAGE.x + r, STAGE.y + r * 0.72, STAGE.z + r], [STAGE.x, STAGE.y, STAGE.z]);
  }, name);
  await settle(page, 60, 2);
  const safe = name.replace(/#/g, '~');
  await page.screenshot({
    path: path.join(OUT, safe + '.png'),
    clip: { x: 640 - 200, y: 400 - 200, width: 400, height: 400 },
  });
  if (++done % 40 === 0) console.log(`  ${done}/${names.length}`);
}

await peek(page, () => { if (window.__thumb.mesh) window.__thumb.mesh.dispose(); });
await browser.close();
console.log(`wrote ${done} thumbnails → ${path.relative(ROOT, OUT)}`);

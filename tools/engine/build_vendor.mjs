/**
 * Build the vendored Babylon + Havok bundles for engine/vendor/.
 *
 * The output is COMMITTED. amghub.org is a static push-to-deploy site with no
 * build step, so the bundle has to be in the repo, not produced at deploy time.
 * Run this only when the Babylon version in package.json changes.
 *
 *   cd tools/engine && npm install && npm run vendor
 *   node tools/engine/check_payload.mjs      # what a student actually downloads
 *
 * ── WHY TWO BUNDLES ──────────────────────────────────────────────────────
 * The Inspector is one of the four reasons this project moved to Babylon, but
 * it costs ~900 KB gzipped and imports Babylon's full barrel. It cannot be the
 * CDN UMD build either: that installs its OWN copy of Babylon on
 * `window.BABYLON`, and a second set of classes fails every `instanceof`
 * against the vendored ones, so the scene explorer comes up empty.
 *
 * esbuild code splitting solves the sharing, but Babylon 9 `import()`s its
 * extensions internally, so splitting emitted **1242 chunk files** — all of
 * which would be committed. Not worth it for a dev tool.
 *
 * So: two self-contained bundles, and the page picks ONE with an import map.
 * Within a session only one is ever loaded, so there is no duplicate-class
 * problem. Students get `babylon.js`; `?dev` gets `babylon.dev.js` with the
 * Inspector already inside it. Devon develops on a 4090, not a Chromebook.
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../engine/vendor');
fs.mkdirSync(out, { recursive: true });
fs.rmSync(path.join(out, 'chunks'), { recursive: true, force: true }); // from the abandoned split build

const banner = { js: '/* Babylon.js — vendored, tree-shaken. Do not edit. Built by tools/engine/build_vendor.mjs */' };
const common = {
  bundle: true, format: 'esm', target: 'es2020',
  minify: true, sourcemap: false, treeShaking: true,
  legalComments: 'none', banner, metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.ttf': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
};

// 1. The student bundle — vendor_entry.js decides exactly what ships.
const r = await esbuild.build({
  ...common,
  entryPoints: [path.join(here, 'vendor_entry.js')],
  outfile: path.join(out, 'babylon.js'),
});

// 2. The dev bundle — the same surface plus the Inspector. Same module
//    specifier, so engine code is identical either way.
await esbuild.build({
  ...common,
  entryPoints: [path.join(here, 'vendor_dev_entry.js')],
  outfile: path.join(out, 'babylon.dev.js'),
});

// 3. Havok's WASM loader. Shipped as-is — already one self-contained file,
//    and its .wasm sits next to it (the loader resolves it relatively).
const hav = path.join(here, 'node_modules/@babylonjs/havok/lib/esm');
fs.copyFileSync(path.join(hav, 'HavokPhysics_es.js'), path.join(out, 'havok.js'));
fs.copyFileSync(path.join(hav, 'HavokPhysics.wasm'), path.join(out, 'HavokPhysics.wasm'));

// 4. The Draco decoder. park_protos.glb lists KHR_draco_mesh_compression as
//    REQUIRED, and Babylon's default config fetches the decoder from
//    cdn.babylonjs.com at load time. A school Chromebook behind a filter that
//    blocks that host would get a park with no geometry, so it ships with us.
//    engine/js/boot.js points DracoDecoder.DefaultConfiguration here.
const draco = path.join(out, 'draco');
fs.mkdirSync(draco, { recursive: true });
for (const f of ['draco_wasm_wrapper_gltf.js', 'draco_decoder_gltf.wasm', 'draco_decoder_gltf.js']) {
  const dst = path.join(draco, f);
  if (fs.existsSync(dst)) continue;                       // cached; it never changes
  const res = await fetch('https://cdn.babylonjs.com/' + f);
  if (!res.ok) throw new Error(`draco fetch ${f}: ${res.status}`);
  fs.writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
}

const kb = (p) => (fs.statSync(path.join(out, p)).size / 1024).toFixed(0).padStart(6) + ' KB';
console.log('engine/vendor/');
for (const f of ['babylon.js', 'babylon.dev.js', 'havok.js', 'HavokPhysics.wasm',
  'draco/draco_wasm_wrapper_gltf.js', 'draco/draco_decoder_gltf.wasm', 'draco/draco_decoder_gltf.js']) {
  console.log('  ' + kb(f) + '  ' + f);
}

// What actually made it into the student bundle, biggest first — the check on
// a careless import in vendor_entry.js.
const key = Object.keys(r.metafile.outputs).find((k) => k.endsWith('babylon.js'));
const inputs = Object.entries(r.metafile.outputs[key].inputs);
console.log('\n  student bundle, top modules by bundled bytes:');
inputs.sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput).slice(0, 10)
  .forEach(([k, v]) => console.log('   ' + String((v.bytesInOutput / 1024).toFixed(0)).padStart(5) + ' KB  ' + k.replace(/^node_modules\//, '')));
console.log('\n  now run: node tools/engine/check_payload.mjs');

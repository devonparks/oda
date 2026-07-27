/**
 * What does a student's browser ACTUALLY download?
 *
 * The Inspector entry imports Babylon's full barrel, so the split build emits
 * a chunk for every glTF extension in the package. Those are only fetched if
 * something imports them — but "only" is a claim, and this repo's rule is that
 * claims get measured. This walks the static import graph from each entry and
 * reports the real transfer size, so a careless import in vendor_entry.js that
 * drags the Inspector's world onto the student path shows up as a number.
 *
 *   node tools/engine/check_payload.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const vendor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../engine/vendor');

/** Every file reachable by static import from `entry`. */
function closure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    const abs = path.join(vendor, f);
    if (!fs.existsSync(abs)) continue;
    seen.add(f);
    const src = fs.readFileSync(abs, 'utf8');
    const dir = path.dirname(f);
    for (const m of src.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
      if (m[1].startsWith('.')) queue.push(path.posix.normalize(path.posix.join(dir, m[1])));
    }
  }
  return [...seen];
}

const report = (label, files, extra = []) => {
  const all = [...files, ...extra];
  const raw = all.reduce((n, f) => n + fs.statSync(path.join(vendor, f)).size, 0);
  const gz = all.reduce((n, f) => n + zlib.gzipSync(fs.readFileSync(path.join(vendor, f)), { level: 9 }).length, 0);
  console.log(`${label.padEnd(34)} ${String(all.length).padStart(4)} files  ${(raw / 1048576).toFixed(2).padStart(6)} MB raw  ${(gz / 1024).toFixed(0).padStart(5)} KB gz`);
  return gz;
};

const core = closure('babylon.js');
const insp = closure('inspector.js');
const runtime = ['havok.js', 'HavokPhysics.wasm', 'draco/draco_wasm_wrapper_gltf.js', 'draco/draco_decoder_gltf.wasm'];

console.log('\nAMG World Engine — vendor payload\n');
report('engine only (babylon.js)', core);
const vendorGz = report('+ havok wasm + draco', core, runtime);
report('inspector (dev, lazy)', insp.filter((f) => !core.includes(f)));

// `chunks/` only exists for a split build; the current bundle is one file.
const chunkDir = path.join(vendor, 'chunks');
if (fs.existsSync(chunkDir)) {
  const onDisk = fs.readdirSync(chunkDir).length;
  console.log(`\nchunks on disk ${onDisk}, of which ${core.filter((f) => f.startsWith('chunks/')).length} are on the student path.`);
}
console.log('draco_decoder_gltf.js (501 KB) is the no-WASM fallback and is not counted — it is fetched only if WebAssembly is unavailable.');

/**
 * THE ASSETS, which is where the weight actually is now.
 *
 * The vendor bundle stopped being the interesting number once the engine
 * grew a park, a rig, a clip library and other kids. GLBs are already
 * compressed, so gzip barely touches them — raw size is what a Chromebook
 * pays. Reported in the three groups that matter: what every visitor MUST
 * fetch to walk around, what arrives afterwards for the NPCs, and what is
 * only fetched on demand.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NPC_COSTUMES = ['kid_footballer', 'kid_princess', 'kid_tracksuit', 'kid_dino'];
const group = (label, files, note = '') => {
  let raw = 0, n = 0;
  for (const f of files) {
    const abs = path.join(root, f);
    if (!fs.existsSync(abs)) continue;
    raw += fs.statSync(abs).size; n++;
  }
  console.log(`${label.padEnd(34)} ${String(n).padStart(4)} files  ${(raw / 1048576).toFixed(2).padStart(6)} MB raw${note ? '   ' + note : ''}`);
  return raw;
};

console.log('\nAMG World Engine — asset payload\n');
const boot = group('world (park + collision + rig)', [
  'world/assets/park_protos.glb', 'world/assets/park_layout.json',
  'world/assets/locomotion_v2.json', 'world/assets/locomotion_v2.bin',
  'assets/characters/emotes/manifest.json', 'assets/characters/emotes/actions.bin',
  'assets/characters/v2/kid_hoodie.glb', 'engine/assets/prop_db.json',
]);
const npcs = group('+ the other kids (after ready)', NPC_COSTUMES.map((c) => `assets/characters/v2/${c}.glb`));
const thumbs = fs.existsSync(path.join(root, 'engine/assets/thumbs'))
  ? group('prop library thumbnails (on P)',
    fs.readdirSync(path.join(root, 'engine/assets/thumbs')).map((f) => `engine/assets/thumbs/${f}`))
  : 0;

console.log(`\nfirst playable  ≈ ${((vendorGz + boot) / 1048576).toFixed(2)} MB  (vendor gzipped + world assets raw)`);
console.log(`fully populated ≈ ${((vendorGz + boot + npcs) / 1048576).toFixed(2)} MB  (+ four NPC costumes; ?npc=0 skips them)`);
console.log(`library thumbs    ${(thumbs / 1048576).toFixed(2)} MB, lazy — only the cards you scroll to.\n`);

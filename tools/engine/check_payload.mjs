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
report('+ havok wasm + draco', core, runtime);
report('inspector (dev, lazy)', insp.filter((f) => !core.includes(f)));
const onDisk = fs.readdirSync(path.join(vendor, 'chunks')).length;
console.log(`\nchunks on disk ${onDisk}, of which ${core.filter((f) => f.startsWith('chunks/')).length} are on the student path.`);
console.log('draco_decoder_gltf.js (501 KB) is the no-WASM fallback and is not counted — it is fetched only if WebAssembly is unavailable.\n');

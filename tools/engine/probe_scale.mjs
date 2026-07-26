/**
 * Diagnostic: the first overview shot came back with the park hugely out of
 * scale. Measure the prototypes against park_collision.json, which holds the
 * TRUE world-space half-extents straight out of Unity, and against the
 * layout's own placement spread.
 *
 *   node tools/engine/probe_scale.mjs
 */
import { boot, peek } from './probe_lib.mjs';
import fs from 'node:fs';

const collision = JSON.parse(fs.readFileSync('world/assets/park_collision.json', 'utf8'));
const layout = JSON.parse(fs.readFileSync('world/assets/park_layout.json', 'utf8'));

// Truth from the exporter: the park's extent in Unity world space.
const xs = layout.items.map((i) => i.p[0]), ys = layout.items.map((i) => i.p[1]), zs = layout.items.map((i) => i.p[2]);
const span = (a) => [Math.min(...a).toFixed(1), Math.max(...a).toFixed(1)];
console.log('layout placement spread   x', span(xs), ' y', span(ys), ' z', span(zs));

const byName = new Map();
for (const b of collision) if (!byName.has(b.n)) byName.set(b.n, b);
const sample = ['SM_Env_Bench_01', 'SM_Env_Fountain_01', 'SM_Prop_Playground_Ship_01', 'SM_Env_Gazebo_01', 'SM_Prop_Ball_01'];

const { browser, page } = await boot();

const got = await peek(page, (names) => {
  const e = window.__engine;
  const out = {};
  // whole-scene extent, from the thin-instance bounding boxes
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const m of e.scene.meshes) {
    if (!m.thinInstanceCount) continue;
    const bb = m.getBoundingInfo().boundingBox;
    for (let a = 0; a < 3; a++) {
      mn[a] = Math.min(mn[a], bb.minimumWorld.asArray()[a]);
      mx[a] = Math.max(mx[a], bb.maximumWorld.asArray()[a]);
    }
  }
  out._scene = { min: mn.map((v) => +v.toFixed(1)), max: mx.map((v) => +v.toFixed(1)) };

  for (const n of names) {
    const m = e.scene.meshes.find((q) => q.name === n);
    if (!m) { out[n] = 'MISSING'; continue; }
    // The prototype's own local geometry extent — instance matrices aside.
    const bb = m.getBoundingInfo().boundingBox;
    out[n] = {
      localHalf: bb.extendSize.asArray().map((v) => +v.toFixed(3)),
      verts: m.getTotalVertices(),
      instances: m.thinInstanceCount,
      meshScale: m.scaling.asArray(),
      parent: m.parent ? m.parent.name : null,
    };
  }
  return out;
}, sample);

console.log('\nscene extent (all thin-instance bboxes):', JSON.stringify(got._scene));
console.log('\nprototype                        engine local half-extent      collision.json half-extent (world)');
for (const n of sample) {
  const g = got[n];
  const c = byName.get(n);
  if (typeof g === 'string') { console.log(n.padEnd(32), g); continue; }
  console.log(n.padEnd(32), JSON.stringify(g.localHalf).padEnd(28), c ? JSON.stringify(c.e) : '(no box)');
}
console.log('\nfirst prototype detail:', JSON.stringify(got[sample[0]], null, 1));
await browser.close();

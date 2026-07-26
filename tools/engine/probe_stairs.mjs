/**
 * Diagnostic: the kid walks straight THROUGH `SM_Prop_Playground_Stairs_01`.
 * It passes every filter in collision.js, so either it got no body, or its
 * body is not where the mesh is.
 *
 *   node tools/engine/probe_stairs.mjs
 */
import { boot, peek } from './probe_lib.mjs';

const { browser, page } = await boot();

const out = await peek(page, () => {
  const e = window.__engine;
  const name = 'SM_Prop_Playground_Stairs_01';
  const mesh = e.park.protos.get(name);
  const placements = e.park.items.filter((i) => i.proto === name);
  const bb = mesh?.getBoundingInfo().boundingBox;
  return {
    meshExists: !!mesh,
    layer: mesh?.metadata?.layer,
    hasBody: !!mesh?.physicsBody,
    bodyInstances: mesh?.physicsBody?.numInstances ?? 0,
    thinInstances: mesh?.thinInstanceCount ?? 0,
    placements: placements.length,
    localExtent: bb ? bb.extendSize.asArray().map((v) => +v.toFixed(3)) : null,
    localCentre: bb ? bb.center.asArray().map((v) => +v.toFixed(3)) : null,
    worldMatrixFrozen: !!mesh?._isWorldMatrixFrozen,
    positions: placements.map((p) => p.pos.map((v) => +v.toFixed(2))),
    // How many prototypes in total have bodies, for context
    totalWithBodies: e.scene.meshes.filter((m) => m.physicsBody).length,
  };
});
console.log('\nstairs:', JSON.stringify(out, null, 1));

// Which terrain prototypes were SKIPPED, and is anything structural in there?
const skipped = await peek(page, () => window.__engine.collision.skipped);
console.log('\nskipped prototypes:', JSON.stringify(skipped));

// Walk the kid slowly at the stairs and log height each 200 ms.
const trace = await peek(page, async () => {
  const e = window.__engine;
  e.tp(3.5, 4.0, 1.2);
  await new Promise((r) => setTimeout(r, 1200));
  e.player.camYaw = 0;                       // forward = -Z
  const out = [];
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
  for (let i = 0; i < 14; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const p = e.player.position;
    out.push([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]);
  }
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
  return out;
});
console.log('\nwalk toward the stairs (x, y, z) every 200 ms:');
for (const t of trace) console.log('  ', JSON.stringify(t));

await browser.close();

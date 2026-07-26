/**
 * Diagnostic: 7 of 48 grid points have no floor, yet the layout puts a ground
 * tile within a metre of nearly all of them. Either those tiles got no
 * collider, or their collider is not where the mesh is.
 *
 * Raycast the PHYSICS world straight down at a good point and a bad one and
 * compare. A visual hit with no physics hit isolates it to collision.
 *
 *   node tools/engine/probe_hole.mjs
 */
import { boot, peek } from './probe_lib.mjs';

const GOOD = [2, 20];
const BAD = [22, 12];

const { browser, page } = await boot();

const out = await peek(page, (good, bad) => {
  const e = window.__engine;
  const hk = e.scene.getPhysicsEngine();
  const V = e.player.cc.getPosition().constructor;      // Vector3, without importing

  const probe = ([x, z]) => {
    const from = new V(x, 8, z);
    const to = new V(x, -8, z);
    // physics ray
    const pr = hk.raycastToRef ? (() => {
      const r = {};
      hk.raycast(from, to, r);
      return r;
    })() : hk.raycast(from, to);
    // visual ray, for comparison
    const dir = new V(0, -1, 0);
    const vis = e.scene.pickWithRay(new (e.scene.createPickingRay(0, 0, null, e.camera).constructor)(from, dir, 40),
      (m) => m.thinInstanceCount > 0);
    return {
      physicsHit: !!(pr && pr.hasHit),
      physicsY: pr && pr.hasHit ? +pr.hitPointWorld.y.toFixed(3) : null,
      physicsBody: pr && pr.hasHit ? (pr.body?.transformNode?.name ?? null) : null,
      visualHit: !!(vis && vis.hit),
      visualY: vis && vis.hit ? +vis.pickedPoint.y.toFixed(3) : null,
      visualMesh: vis && vis.hit ? vis.pickedMesh.name : null,
    };
  };

  // Which ground prototypes exist near the bad point, and do they have bodies?
  const nearby = [];
  for (const it of e.park.items) {
    if (Math.hypot(it.pos[0] - bad[0], it.pos[2] - bad[1]) > 4) continue;
    if (!/Ground|Path/i.test(it.proto)) continue;
    nearby.push({
      proto: it.proto,
      at: it.pos.map((v) => +v.toFixed(1)),
      hasBody: !!it.mesh?.physicsBody,
      instances: it.mesh?.physicsBody?.numInstances ?? 0,
      thin: it.mesh?.thinInstanceCount ?? 0,
    });
  }

  return { good: probe(good), bad: probe(bad), nearby };
}, GOOD, BAD);

console.log('\nGOOD point', JSON.stringify(GOOD), '->', JSON.stringify(out.good));
console.log('BAD  point', JSON.stringify(BAD), '->', JSON.stringify(out.bad));
console.log('\nground placements within 4 m of the bad point:');
for (const n of out.nearby) console.log('  ', JSON.stringify(n));

await browser.close();

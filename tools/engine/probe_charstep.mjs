/**
 * Diagnostic: the kid does not fall and does not walk. The capsule sits at
 * exactly its spawn height with zero velocity, which means either update() is
 * not running or integrate() is not moving the body.
 *
 * Sample the controller's internals over consecutive frames rather than
 * reasoning about them.
 *
 *   node tools/engine/probe_charstep.mjs
 */
import { boot, peek, settle } from './probe_lib.mjs';

const { browser, page } = await boot();

// Is update() even running, and with what dt?
await peek(page, () => {
  const e = window.__engine;
  e._trace = [];
  const p = e.player;
  const orig = p.update.bind(p);
  p.update = (dt) => {
    const beforeY = p.cc.getPosition().y;
    const vyBefore = p.cc.getVelocity().y;
    orig(dt);
    if (e._trace.length < 12) {
      e._trace.push({
        dt: +dt.toFixed(4),
        yBefore: +beforeY.toFixed(3),
        yAfter: +p.cc.getPosition().y.toFixed(3),
        vyBefore: +vyBefore.toFixed(3),
        vyAfter: +p.cc.getVelocity().y.toFixed(3),
        grounded: p.grounded,
      });
    }
  };
  e.tp(2, 20, 5);
});

await settle(page, 700);
const trace = await peek(page, () => window.__engine._trace);
console.log('\nper-frame trace after teleporting to y=5:');
for (const t of trace) console.log('  ', JSON.stringify(t));

const world = await peek(page, () => {
  const e = window.__engine;
  const bodies = e.scene.meshes.filter((m) => m.physicsBody);
  return {
    bodyMeshes: bodies.length,
    totalInstances: bodies.reduce((n, m) => n + (m.physicsBody.numInstances || 0), 0),
    collisionShapes: e.collision ? e.collision.shapes : 'MISSING',
    gravity: e.scene.getPhysicsEngine().gravity.asArray(),
    ccPos: e.player.cc.getPosition().asArray().map((v) => +v.toFixed(2)),
    ccVel: e.player.cc.getVelocity().asArray().map((v) => +v.toFixed(2)),
    maxStep: e.player.cc.maxStepHeight,
    footOffset: e.player.cc.footOffset,
    physicsPlugin: e.scene.getPhysicsEngine().getPhysicsPluginName(),
  };
});
console.log('\nphysics world:', JSON.stringify(world, null, 1));

await browser.close();

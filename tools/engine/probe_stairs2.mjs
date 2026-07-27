/**
 * LOOK at the stairs before touching code. Renders the Havok collider of
 * SM_Prop_Playground_Stairs_01 with PhysicsViewer (dev bundle) against the
 * visual mesh, dumps all 7 placements with their yaw, and photographs the
 * exact approach line the failing test walks.
 *
 *   node tools/engine/probe_stairs2.mjs
 */
import { boot, shoot, peek, settle } from './probe_lib.mjs';

const { browser, page } = await boot({ headless: true, dev: true, log: false });

// the 7 placements, with yaw from the quaternion
const placements = await peek(page, () => {
  const e = window.__engine;
  return e.park.items.filter((i) => i.proto === 'SM_Prop_Playground_Stairs_01')
    .map((i) => {
      const [x, y, z, w] = i.quat;
      const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x));
      return { pos: i.pos.map((v) => +v.toFixed(2)), yawDeg: +(yaw * 180 / Math.PI).toFixed(1), index: i.index };
    });
});
console.log('\nplacements of SM_Prop_Playground_Stairs_01:');
for (const p of placements) console.log('  ', JSON.stringify(p));

// prototype local shape: where do the treads rise, in local space?
const local = await peek(page, () => {
  const mesh = window.__engine.park.protos.get('SM_Prop_Playground_Stairs_01');
  const pos = mesh.getVerticesData('position');
  const min = { x: 1e9, y: 1e9, z: 1e9 }, max = { x: -1e9, y: -1e9, z: -1e9 };
  for (let i = 0; i < pos.length; i += 3) {
    min.x = Math.min(min.x, pos[i]); max.x = Math.max(max.x, pos[i]);
    min.y = Math.min(min.y, pos[i + 1]); max.y = Math.max(max.y, pos[i + 1]);
    min.z = Math.min(min.z, pos[i + 2]); max.z = Math.max(max.z, pos[i + 2]);
  }
  // top-surface direction: highest vertices cluster at the top of the flight —
  // centroid of the top 20% minus centroid of the bottom 20% says which way it climbs
  let tn = 0, tx = 0, tz = 0, bn = 0, bx = 0, bz = 0;
  const h = max.y - min.y;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 1] > max.y - h * 0.2) { tn++; tx += pos[i]; tz += pos[i + 2]; }
    if (pos[i + 1] < min.y + h * 0.2) { bn++; bx += pos[i]; bz += pos[i + 2]; }
  }
  return {
    min: [min.x, min.y, min.z].map((v) => +v.toFixed(2)),
    max: [max.x, max.y, max.z].map((v) => +v.toFixed(2)),
    climbsToward: [+((tx / tn) - (bx / bn)).toFixed(2), +((tz / tn) - (bz / bn)).toFixed(2)],
  };
});
console.log('\nlocal shape:', JSON.stringify(local));

// show the collider through the physics viewer and photograph it
await peek(page, async () => {
  const e = window.__engine;
  const mod = await import('babylon');
  const viewer = new mod.PhysicsViewer(e.scene);
  const mesh = e.park.protos.get('SM_Prop_Playground_Stairs_01');
  if (mesh.physicsBody) viewer.showBody(mesh.physicsBody);
  window.__viewer = viewer;
});
await settle(page, 600);

await shoot(page, 'stairs2_01_top', { from: [3.5, 9, 0.75], at: [3.5, 0, 0.75] });
await shoot(page, 'stairs2_02_approach', { from: [3.5, 1.4, 5.5], at: [3.5, 0.6, 0.75] });
await shoot(page, 'stairs2_03_side', { from: [7.5, 1.6, 0.75], at: [3.5, 0.8, 0.75] });
await shoot(page, 'stairs2_04_wide', { from: [8, 6, 8], at: [3.5, 0.5, 0.75] });

await browser.close();

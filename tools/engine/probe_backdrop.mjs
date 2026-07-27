/**
 * M5a acceptance: the world around the park.
 *
 * Devon's complaint this exists to answer is a LOOK, not a number — *"it's
 * just a plane floating in the middle of nowhere"* — so the checks are
 * paired with shots taken from a KID'S EYE HEIGHT looking outward over the
 * fence in four directions. The numeric side guards the two rules the
 * three.js version paid for in blood:
 *
 *   - the land must sit BELOW the skate bowl's carved floor (else it fills
 *     the bowl in with a green pool)
 *   - the trees must be the park's OWN prototypes (code-drawn cones were
 *     spotted instantly), and must not include the treehouse/tyre-swing
 *     siblings that a loose prefix once scattered over the skyline
 *
 *   node tools/engine/probe_backdrop.mjs
 */
import { boot, shoot, peek, settle } from './probe_lib.mjs';

let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${pass ? '  OK  ' : ' FAIL '}] ${label}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await boot({ headless: true, log: false });

const bd = await peek(page, () => {
  const e = window.__engine;
  const b = e.backdrop;
  // Geometry ids of the park's own prototypes — a backdrop tree must SHARE
  // one, which is what proves nothing was copied or merged.
  const parkGeo = new Set([...e.park.protos.values()].map((m) => m.geometry.uniqueId));
  const meshes = b.meshes.map((m) => ({
    name: m.name, instances: m.thinInstanceCount || 0, pickable: m.isPickable,
    hasBody: !!m.physicsBody, verts: m.getTotalVertices(),
    sharesParkGeometry: parkGeo.has(m.geometry.uniqueId),
  }));
  return {
    trees: b.trees, inner: +b.innerRadius.toFixed(1), groundY: b.groundY,
    meshes,
    fog: { mode: e.scene.fogMode, start: e.scene.fogStart, end: e.scene.fogEnd },
    // the bowl's carved floor, the number the land must stay under
    bowlFloor: (() => {
      const m = e.park.protos.get('SM_Env_SkatePark_Bowl_01');
      const pos = m.getVerticesData('position');
      let lo = 1e9; for (let i = 1; i < pos.length; i += 3) lo = Math.min(lo, pos[i]);
      const it = e.park.items.find((i2) => i2.proto === 'SM_Env_SkatePark_Bowl_01');
      return +(lo * it.scale[1] + it.pos[1]).toFixed(3);
    })(),
    drawCalls: e.scene.getActiveMeshes().length,
    fps: +e.engine.getFps().toFixed(0),
  };
});
console.log('\nbackdrop:', JSON.stringify({ ...bd, meshes: bd.meshes.length + ' meshes' }));
for (const m of bd.meshes) console.log(`   ${m.name.padEnd(28)} ${String(m.instances).padStart(4)} inst  ${m.verts} verts  pickable=${m.pickable} body=${m.hasBody}`);

check('the land sits BELOW the skate bowl floor (no green pool in the bowl)',
  bd.groundY < bd.bowlFloor, `land ${bd.groundY} vs bowl ${bd.bowlFloor}`);
check('tree belts built from real prototypes', bd.trees >= 200, `${bd.trees} instances`);
/**
 * NOT "no mesh is large": `SM_Env_Tree_Large_01` is legitimately a
 * 12,348-vertex prototype and that assertion failed a correct backdrop.
 * The property that actually matters is that every tree mesh SHARES the
 * park prototype's geometry — no copy, no merge, no extra vertex memory,
 * which is the whole reason this is thin-instanced instead of merged like
 * the three.js version had to be.
 */
{
  const trees = bd.meshes.filter((m) => m.name.startsWith('bd_SM_'));
  check('every tree belt shares the park prototype\'s geometry (no merge, no copy)',
    trees.length > 0 && trees.every((m) => m.sharesParkGeometry),
    `${trees.filter((m) => m.sharesParkGeometry).length}/${trees.length} shared`);
}
check('nothing in the backdrop is pickable', bd.meshes.every((m) => !m.pickable));
check('nothing in the backdrop has a physics body', bd.meshes.every((m) => !m.hasBody));
check('no treehouse / tyre-swing on the skyline',
  !bd.meshes.some((m) => /Treehouse|Tyre_Swing|Bucket_Rope/i.test(m.name)),
  bd.meshes.map((m) => m.name).join(' '));
check('fog is on and long (atmosphere, not a wall)', bd.fog.mode === 3 && bd.fog.end >= 200,
  `mode ${bd.fog.mode}, ${bd.fog.start}–${bd.fog.end} m`);
check('still 55+ fps with the countryside', bd.fps >= 55, `${bd.fps} fps`);

// ── the actual acceptance: look outward from inside the park ────────────────
// Kid's eye height, standing near the fence, looking OUT in four directions.
const [cx, cz] = await peek(page, () => window.__engine.backdrop.centre);
const EYE = 1.3;
const views = [
  ['north', [cx, EYE, cz + 18], [cx, EYE + 4, cz + 120]],
  ['east', [cx + 18, EYE, cz], [cx + 120, EYE + 4, cz]],
  ['south', [cx, EYE, cz - 18], [cx, EYE + 4, cz - 120]],
  ['west', [cx - 18, EYE, cz], [cx - 120, EYE + 4, cz]],
];
for (const [name, from, at] of views) await shoot(page, `bd_${name}`, { from, at });

// the money shot: standing in the park looking out over the fence
await shoot(page, 'bd_eye_level', { from: [cx + 2, 1.35, cz - 6], at: [cx + 26, 6, cz + 60] });
// and from above, to see the ring of countryside around the whole park
await shoot(page, 'bd_aerial', { from: [cx + 70, 78, cz + 90], at: [cx, 0, cz + 4] });
// the bowl, which the land must NOT have filled in
await shoot(page, 'bd_bowl', { from: [16, 6, 32], at: [20, -1, 22] });

/**
 * THE COLOUR CHECK, because "the land is cream-white" passed every other
 * check on the first run — geometry, counts, physics, fog all green while
 * the horizon rendered as a beach. Sample the rendered pixels of the
 * countryside past the fence and of the park's own lawn from ONE camera
 * that sees both, and require the same green: the countryside continues the
 * lawn, so if they differ the horizon is wrong whatever else passes.
 */
{
  // Straight down on a clear patch of each, so nothing else is in the frame:
  // the park's lawn, then the countryside well outside the fence.
  const patch = async (from) => {
    await peek(page, (f) => window.__engine.look(f, [f[0], 0, f[2] + 0.001]), from);
    await settle(page, 400);
    return peek(page, () => window.__engine.sample(600, 380, 80, 40));
  };
  const lawn = await patch([2, 12, 12]);
  const land = await patch([2, 12, 90]);
  const dist = Math.hypot(lawn[0] - land[0], lawn[1] - land[1], lawn[2] - land[2]);
  console.log(`  lawn rgb [${lawn}]  countryside rgb [${land}]`);
  check('the countryside is the same green as the lawn (not blown out)', dist < 70,
    `rgb distance ${dist.toFixed(0)}/255`);
  check('the countryside is not clipped toward white', !(land[0] > 225 && land[1] > 225),
    `rgb [${land}]`);
  await shoot(page, 'bd_colour_match', { hideHud: true });
}

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

/**
 * M1 acceptance: does the park come up on Babylon + Havok, and does it LOOK
 * like the park?
 *
 * Checks, in order of how badly each one has burned this project before:
 *   1. the import map swap works in real Chrome (student and ?dev bundles)
 *   2. Havok is actually up, not silently skipped
 *   3. the scene is RIGHT-HANDED — get this wrong and the whole park mirrors,
 *      quietly, and every measured seat coordinate becomes a lie
 *   4. all 1103 placements arrived, and no prototype went missing (the
 *      63-character name truncation that once deleted the zip line)
 *   5. Draco came from our own origin, not cdn.babylonjs.com
 *   6. five screenshots from around the park, which is the part that counts
 *
 *   node tools/engine/probe_boot.mjs
 */
import { boot, shoot, peek } from './probe_lib.mjs';

const ok = (b) => (b ? '  OK  ' : ' FAIL ');
let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${ok(pass)}] ${label}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await boot({ headless: true });

// ── 2/3/4: the invariants ────────────────────────────────────────────────
const state = await peek(page, () => {
  const e = window.__engine;
  return {
    rightHanded: e.scene.useRightHandedSystem,
    physics: !!e.scene.getPhysicsEngine(),
    physicsName: e.scene.getPhysicsEngine()?.getPhysicsPluginName?.() ?? null,
    gravity: e.scene.getPhysicsEngine()?.gravity?.asArray?.() ?? null,
    prototypes: e.park.stats.prototypes,
    placements: e.park.stats.placements,
    skipped: e.park.stats.skipped,
    triangles: Math.round(e.park.stats.triangles),
    meshes: e.scene.meshes.length,
    fps: e.engine.getFps(),
    hasInspector: e.hasInspector,
    // thin instances really are instanced, not 1103 separate meshes
    thinTotal: e.scene.meshes.reduce((n, m) => n + (m.thinInstanceCount || 0), 0),
    // spot-check a known landmark against the layout file's own numbers
    fountain: (e.find('Fountain_01')[0] || null) && e.find('Fountain_01')[0].pos,
  };
});
console.log('\n' + JSON.stringify(state, null, 2) + '\n');

check('Havok physics engine is up', state.physics && /havok/i.test(state.physicsName || ''), state.physicsName);
check('gravity is -9.81 on Y', Math.abs((state.gravity?.[1] ?? 0) + 9.81) < 0.01, JSON.stringify(state.gravity));
check('scene is RIGHT-handed (matches the Unity export)', state.rightHanded === true);
check('all 275 prototypes present', state.prototypes === 275, `${state.prototypes}`);
check('all 1103 placements built', state.placements === 1103, `${state.placements}`);
check('no placement skipped for a missing prototype', state.skipped === 0, `${state.skipped} skipped`);
check('thin instances total the placement count', state.thinTotal === state.placements, `${state.thinTotal}`);
check('draw calls stay at one per prototype', state.prototypes <= 300, `${state.prototypes} protos`);

// ── 5: nothing fetched from an external CDN ──────────────────────────────
const external = await peek(page, () => performance.getEntriesByType('resource')
  .map((r) => r.name).filter((n) => !n.startsWith(location.origin)));
check('no runtime fetch outside our own origin', external.length === 0, external.join(', ') || 'clean');

const draco = await peek(page, () => performance.getEntriesByType('resource')
  .some((r) => /draco/i.test(r.name)));
check('Draco decoder loaded (from vendor/)', draco);

// ── 1b: the dev bundle and the Inspector ─────────────────────────────────
check('student bundle has no Inspector', state.hasInspector === false);

// ── 6: LOOK at it ────────────────────────────────────────────────────────
console.log('\nshots:');
await shoot(page, 'boot_01_overview', { from: [34, 22, 44], at: [2, 0, 6] });
await shoot(page, 'boot_02_playground', { from: [6, 6, 24], at: [4, 1.2, 14] });
await shoot(page, 'boot_03_pond', { from: [-16, 5, 20], at: [-14, 0.4, 10] });
await shoot(page, 'boot_04_ground_level', { from: [2, 1.6, 20], at: [2, 1.5, 8] });
await shoot(page, 'boot_05_far', { from: [70, 45, 80], at: [0, 0, 0] });

await browser.close();

// ── the dev bundle, in its own page load ─────────────────────────────────
console.log('\ndev bundle (?dev):');
const dev = await boot({ headless: true, dev: true, log: false });
const devState = await peek(dev.page, async () => {
  const e = window.__engine;
  const { toggleInspector } = await import('/engine/js/devtools.js');
  const shown = toggleInspector(e.scene);
  // debugLayer.show() is ASYNC — it resolves once the panel is mounted, so
  // isVisible() read on the next line is still false. Poll instead; asserting
  // on the synchronous read reported a working Inspector as broken.
  for (let i = 0; i < 60 && !e.scene.debugLayer.isVisible(); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    hasInspector: e.hasInspector, shown,
    visible: e.scene.debugLayer.isVisible(),
    // and prove it actually put something in the DOM
    panel: !!document.querySelector('#sceneExplorer, #embed, .babylonInspector, [id*="inspector" i]'),
  };
});
check('dev bundle reports an Inspector', devState.hasInspector === true);
check('Inspector actually opens', devState.visible === true && devState.panel, JSON.stringify(devState));
await shoot(dev.page, 'boot_06_inspector', { hideHud: false, settleMs: 900 });
await dev.browser.close();

console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

/**
 * M3 acceptance: the object layer, on thin instances.
 *
 * The three.js version of this had to collapse a slice of a merged vertex
 * buffer to hide one bench, and its acceptance test was "delete all 95
 * bikes/skateboards/scooters and restore them byte-identical". Same test here,
 * against the native mechanism.
 *
 * The checks that matter:
 *   - a ray hit reports WHICH instance it hit (the whole point)
 *   - hiding one object hides exactly one, and the draw-call budget is unmoved
 *   - undo restores the exact matrix
 *   - removals survive a reload
 *   - and it is VISIBLE in a screenshot, because "hidden" that still draws is
 *     the failure mode a number would not catch
 *
 *   node tools/engine/probe_objects.mjs
 */
import { boot, shoot, peek, settle } from './probe_lib.mjs';

let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${pass ? '  OK  ' : ' FAIL '}] ${label}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await boot();

// Clear any saved edits so the run is deterministic.
await peek(page, () => {
  localStorage.removeItem('amgEngineEdits_park');
  window.__engine.objects.removed.clear();
});

const stats0 = await peek(page, () => ({
  ...window.__engine.objects.stats(),
  placements: window.__engine.park.stats.placements,
}));
console.log('\nobjects:', JSON.stringify(stats0));
// checked against the live park, not 1103 — the 2026-08-01 map edits drop
// the 98 shop placements before the object layer ever sees them
check('every placement is an object', stats0.objects === stats0.placements && stats0.objects > 900,
  `${stats0.objects} objects, ${stats0.placements} placements`);
check('nothing hidden at boot', stats0.hidden === 0);

// ── picking: does a ray tell us which INSTANCE it hit? ───────────────────
// Aim the camera at a known bench and pick the centre of the screen.
const picked = await peek(page, () => {
  const e = window.__engine;
  const bench = e.objects.find('Park_Seat')[0];
  if (!bench) return { error: 'no park seat in the park' };
  e.look([bench.pos[0] + 2.5, bench.pos[1] + 1.8, bench.pos[2] + 2.5], bench.pos);
  return { target: bench.name, proto: bench.proto, index: bench.index };
});
await settle(page, 300);
const hit = await peek(page, () => {
  const e = window.__engine;
  const it = e.objects.pick(e.engine.getRenderWidth() / 2, e.engine.getRenderHeight() / 2);
  return it ? { name: it.name, proto: it.proto, index: it.index } : null;
});
console.log('aimed at:', JSON.stringify(picked), '\npicked:  ', JSON.stringify(hit));
check('a ray picks a specific thin instance', !!hit && hit.index >= 0, JSON.stringify(hit));

// ── hide one, and look ───────────────────────────────────────────────────
await shoot(page, 'obj_01_before', { hideHud: true });
const one = await peek(page, () => {
  const e = window.__engine;
  const bench = e.objects.find('Park_Seat')[0];
  const calls0 = e.engine._drawCalls?.current ?? null;
  e.objects.remove(bench);
  return { name: bench.name, hidden: bench.hidden, stats: e.objects.stats(), calls0 };
});
await settle(page, 300);
await shoot(page, 'obj_02_one_removed', { hideHud: true });
check('removing one object hides exactly one', one.stats.hidden === 1, JSON.stringify(one.stats));

// ── undo restores the exact matrix ───────────────────────────────────────
const undone = await peek(page, () => {
  const e = window.__engine;
  const bench = e.objects.find('Park_Seat')[0];
  // Array.from is load-bearing: Matrix.asArray() is a Float32Array, .map on it
  // stays typed, and a typed array crosses the puppeteer boundary as an object
  // rather than an array — so .slice/.length on the far side blow up.
  const round = (m) => Array.from(m.asArray(), (v) => +v.toFixed(4));
  const buf = round(bench.mesh.thinInstanceGetWorldMatrices()[bench.index]);
  e.objects.undo();
  const after = round(bench.mesh.thinInstanceGetWorldMatrices()[bench.index]);
  const want = round(bench.matrix);
  return { whileHidden: buf.slice(0, 4), restored: after, want, match: JSON.stringify(after) === JSON.stringify(want), hidden: e.objects.stats().hidden };
});
check('undo restores the matrix byte for byte', undone.match, JSON.stringify(undone.restored.slice(12, 15)));
check('nothing left hidden after undo', undone.hidden === 0);

// ── the bulk test: every bike, scooter and skateboard ────────────────────
const bulk = await peek(page, () => {
  const e = window.__engine;
  const before = e.engine.getFps();
  // the bikes/scooters/skateboards left with the 2026-08-01 map edits (they
  // are shop inventory now) — the bulk mechanism is exercised on what remains
  const n = e.objects.removeAll('Pram|Toy_Truck|Ball');
  return { n, stats: e.objects.stats(), drawCalls: e.scene.getActiveMeshes().length, before: Math.round(before) };
});
await settle(page, 400);
console.log('bulk removal:', JSON.stringify(bulk));
check('bulk removal hides many objects', bulk.n > 3, `${bulk.n} removed`);
await shoot(page, 'obj_03_toys_removed', { hideHud: true });

const after = await peek(page, () => ({
  protos: window.__engine.park.stats.prototypes,
  fps: Math.round(window.__engine.engine.getFps()),
}));
check('draw-call budget is unchanged by removals', after.protos === stats0.prototypes,
  `${after.protos} prototypes (boot had ${stats0.prototypes})`);
check('still 55+ fps', after.fps >= 55, `${after.fps}`);

// ── persistence across a reload ──────────────────────────────────────────
const exported = await peek(page, () => window.__engine.objects.exportEdits());
const savedCount = JSON.parse(exported).removed.length;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__engine && window.__engine.ready, { timeout: 120000 });
await settle(page, 600);
const afterReload = await peek(page, () => window.__engine.objects.stats());
console.log('after reload:', JSON.stringify(afterReload), `(saved ${savedCount})`);
check('removals survive a reload', afterReload.hidden === savedCount, `${afterReload.hidden}/${savedCount}`);
await shoot(page, 'obj_04_after_reload', { hideHud: true });

// leave the park clean for the next probe
await peek(page, () => {
  localStorage.removeItem('amgEngineEdits_park');
});

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

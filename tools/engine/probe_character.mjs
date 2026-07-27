/**
 * M2 acceptance: a Synty kid on a Havok character controller.
 *
 * The numbers this checks are the ones that have lied before, so each is paired
 * with a picture:
 *   - the rig binds all 22 bones (a partial bind animates a corpse)
 *   - the kid LANDS on the ground instead of falling through it or hovering
 *   - walking actually moves them, in the direction the camera faces
 *     (camYaw is the boom direction — forward is the OPPOSITE, and getting
 *     that backwards read as "walking is broken" twice in the three.js park)
 *   - the playground STAIRS are climbable, which is the whole point of mesh
 *     colliders over one-AABB-per-prop
 *   - an action clip plays and visibly changes the pose
 *
 *   node tools/engine/probe_character.mjs
 */
import { boot, shoot, peek, settle, sleep } from './probe_lib.mjs';

let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${pass ? '  OK  ' : ' FAIL '}] ${label}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await boot({ headless: true });

/** Hold keys for `ms`, stepping the real render loop. */
async function walk(page, codes, ms) {
  await page.evaluate((cs) => {
    for (const c of cs) document.body.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
  }, codes);
  await sleep(ms);
  await page.evaluate((cs) => {
    for (const c of cs) document.body.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
  }, codes);
  await settle(page, 200);
}

const pos = () => peek(page, () => {
  const e = window.__engine;
  return {
    p: e.player.position.asArray().map((v) => +v.toFixed(2)),
    grounded: e.player.grounded,
    speed: +Math.hypot(e.player.cc.getVelocity().x, e.player.cc.getVelocity().z).toFixed(2),
  };
});

// ── the rig ──────────────────────────────────────────────────────────────
const rig = await peek(page, () => {
  const r = window.__engine.player.rig;
  return {
    ok: r.ok,
    bound: r.bones.filter(Boolean).length,
    total: r.nb,
    hips: !!r.hips,
    missing: r.loco.bones.filter((n, i) => !r.bones[i]),
    clips: Object.keys(r.loco.clips),
    actions: r.actions.ids().length,
  };
});
console.log('\nrig:', JSON.stringify(rig), '\n');
check('all 22 bones bound to transform nodes', rig.bound === 22, `${rig.bound}/${rig.total} ${rig.missing.join(',') || ''}`);
check('hips node found (hip offset needs it)', rig.hips);
check('7 locomotion clips', rig.clips.length === 7, rig.clips.join(','));
check('action library has 81 clips', rig.actions >= 80, `${rig.actions}`);

// ── does the kid land? ───────────────────────────────────────────────────
await peek(page, () => window.__engine.tp(2, 20, 4));
await settle(page, 1400);
const landed = await pos();
console.log('after spawn+settle:', JSON.stringify(landed));
check('kid is grounded, not falling', landed.grounded, JSON.stringify(landed));
check('kid did not fall through the world', landed.p[1] > -1, `y=${landed.p[1]}`);
check('kid is not hovering', landed.p[1] < 1.2, `y=${landed.p[1]}`);
await shoot(page, 'char_01_idle', { hideHud: true });

// ── does walking move them, and the right way? ───────────────────────────
// Face the camera along -Z so "forward" is unambiguous, then walk.
await peek(page, () => { window.__engine.player.camYaw = Math.PI; });
await settle(page, 200);
const before = await pos();
await walk(page, ['KeyW'], 1200);
const after = await pos();
const moved = Math.hypot(after.p[0] - before.p[0], after.p[2] - before.p[2]);
console.log('walk W:', JSON.stringify(before.p), '->', JSON.stringify(after.p), `moved ${moved.toFixed(2)} m`);
check('walking moves the kid', moved > 1.0, `${moved.toFixed(2)} m in 1.2 s`);
/**
 * The camera sits at `player + (sin(camYaw), _, cos(camYaw)) * dist`, so at
 * camYaw = PI it is at −Z and forward — away from it — is +Z. The first
 * version of this assertion expected −Z and failed a correct implementation;
 * derive the sign from the camera placement, do not assume it.
 */
check('W walks AWAY from the camera (+Z at camYaw=PI)', after.p[2] > before.p[2] + 0.5,
  `dz=${(after.p[2] - before.p[2]).toFixed(2)}`);
/**
 * NOT "the height must not change" — that assertion failed a WORKING engine.
 * Walking north from the spawn takes the kid down into the skate bowl, whose
 * carved floor is at −1.14, and the screenshot showed them standing on a ramp
 * exactly as they should. Descending into real geometry is the feature; the
 * three.js park needed a GPU heightfield to manage it. The invariant is that
 * the kid is still ON something.
 */
check('the kid is still standing on something after walking', after.grounded,
  `y ${before.p[1]} -> ${after.p[1]}, grounded=${after.grounded}`);
await shoot(page, 'char_02_walked', { hideHud: true });

// ── running ──────────────────────────────────────────────────────────────
const b2 = await pos();
await walk(page, ['KeyW', 'ShiftLeft'], 1000);
const a2 = await pos();
const ran = Math.hypot(a2.p[0] - b2.p[0], a2.p[2] - b2.p[2]);
check('running is faster than walking', ran / 1.0 > moved / 1.2, `${ran.toFixed(2)} m in 1.0 s`);

/**
 * THE STAIRS — the headline claim for mesh colliders over one-AABB-per-prop.
 * Devon on the three.js park: *"you can't climb up the stairs, and that's the
 * whole point of it."*
 *
 * THE SECOND VERSION OF THIS TEST WAS ALSO WRONG — the fourth wrong assertion
 * this project has caught, so write down what the geometry actually is:
 * `SM_Prop_Playground_Stairs_01` is a CORNER-pivoted unit cube (local
 * 0..1 on every axis) whose flight climbs along LOCAL +X. The placement at
 * (3.5, 0, 0.75) carries yaw 180°, so it occupies x 2.5..3.5, z −0.25..0.75
 * and climbs toward world −X onto the deck at y≈1. The old test walked −Z
 * down the line x=3.5 — exactly along the staircase's eastern FLANK — grazed
 * the stringer (the recorded x-drift 3.51→3.98 was the capsule sliding along
 * that wall) and strolled past on flat ground. PhysicsViewer showed the
 * collider hugging every tread (tools/engine/probe_stairs2.mjs).
 *
 * The real approach: stand EAST of the flight's foot and walk WEST up it.
 */
await peek(page, () => window.__engine.tp(4.6, 0.25, 1.2));
await settle(page, 1400);
const footOfStairs = await pos();
// forward = (-sin(camYaw), 0, -cos(camYaw)); camYaw = PI/2 gives -X, up the flight
// 3.8 s: the capsule climbs treads at ~0.25 m/s of height, and the test
// should top out onto the deck (y≈1), not scrape past its own threshold
await peek(page, () => { window.__engine.player.camYaw = Math.PI / 2; });
await walk(page, ['KeyW'], 3800);
const topOfStairs = await pos();
const climbed = topOfStairs.p[1] - footOfStairs.p[1];
console.log('stairs:', JSON.stringify(footOfStairs.p), '->', JSON.stringify(topOfStairs.p), `climbed ${climbed.toFixed(2)} m`);
check('the kid CLIMBS the playground stairs', climbed > 0.5,
  `gained ${climbed.toFixed(2)} m, ended at y=${topOfStairs.p[1]}`);
await shoot(page, 'char_03_stairs', {
  from: [topOfStairs.p[0] + 2.4, topOfStairs.p[1] + 1.6, topOfStairs.p[2] + 2.4],
  at: [topOfStairs.p[0], topOfStairs.p[1] + 0.6, topOfStairs.p[2]],
  hideHud: true,
});

// ── an action clip ───────────────────────────────────────────────────────
const acted = await peek(page, async () => {
  const r = window.__engine.player.rig;
  const before = r.bones[5].rotationQuaternion.asArray().map((v) => +v.toFixed(3)); // Head
  const ok = await r.play('sit');
  await new Promise((res) => setTimeout(res, 700));
  const after = r.bones[5].rotationQuaternion.asArray().map((v) => +v.toFixed(3));
  return { ok, before, after, playing: r.playing, weight: +r.actionW.toFixed(2) };
});
console.log('action:', JSON.stringify(acted));
check('an action clip loads and plays', acted.ok && acted.playing === 'sit');
check('the action visibly changes the pose', JSON.stringify(acted.before) !== JSON.stringify(acted.after),
  `${JSON.stringify(acted.before)} -> ${JSON.stringify(acted.after)}`);
await shoot(page, 'char_04_sit', { hideHud: true });

// A close-up of the kid, third person, for the actual look-at-it check.
await peek(page, () => {
  const e = window.__engine;
  e.player.rig.stop();
  const p = e.player.position;
  e.look([p.x + 2.2, p.y + 1.5, p.z + 2.6], [p.x, p.y + 0.75, p.z]);
});
await settle(page, 400);
await shoot(page, 'char_05_closeup', { hideHud: true });

const fps = await peek(page, () => +window.__engine.engine.getFps().toFixed(0));
check('still 55+ fps with mesh collision', fps >= 55, `${fps} fps`);

// `collision` holds PhysicsBody objects, which do not survive structured
// cloning — read only the scalars, or puppeteer hands back undefined.
const coll = await peek(page, () => {
  const c = window.__engine.collision;
  return { shapes: c.shapes, instances: c.instances, tris: Math.round(c.triangles), skipped: c.skipped.length };
});
console.log('\ncollision:', JSON.stringify(coll));

/**
 * COLLISION COVERAGE. The kid sinking through the lawn was one over-matching
 * regex away, and a single walk test only samples one line across the park.
 * Drop the kid on a grid and see where the floor is missing.
 */
const floorY = await peek(page, () => window.__engine.collision.floorY);
const grid = [];
for (let x = -14; x <= 28; x += 6) for (let z = -6; z <= 28; z += 6) grid.push([x, z]);
const lost = [];      // never landed at all
const seams = [];     // fell through the park and landed on the catch floor
for (const [x, z] of grid) {
  // Drop from 3 m and give it a full second. The first version dropped from
  // 6 m and waited 260 ms, so the kid was still in mid-air at every single
  // point and the probe reported 47/48 "holes" in a floor that was fine.
  await peek(page, (gx, gz) => window.__engine.tp(gx, gz, 3), x, z);
  // 1.6 s, not 1.0: a kid that slips through a seam falls 3 -> -2.6 m, which
  // takes ~1.07 s on its own. At 1 s three of them were still in mid-air and
  // got counted as "never landed" — a probe-timing artefact, twice over now.
  await settle(page, 1600);
  let s = await pos();
  /**
   * A kid dropped onto the shade sail perches there UNSUPPORTED — the sail
   * is steeper than the walkable slope, so `grounded` stays false while the
   * kid demonstrably rests on solid geometry. (It used to read grounded
   * because the sail had NO collider at all — it is a scaled placement —
   * and the kid fell straight through it to the lawn.) Stable height above
   * the catch floor counts as standing on something; that is what the check
   * is actually about.
   */
  if (!s.grounded) {
    for (let t = 0; t < 5 && !s.grounded && !s.resting; t++) {
      const yPrev = s.p[1];
      await settle(page, 600);
      s = await pos();
      if (Math.abs(s.p[1] - yPrev) < 0.03 && s.p[1] > floorY + 1.2) s.resting = true;
    }
  }
  if (!s.grounded && !s.resting) lost.push({ at: [x, z], y: s.p[1] });
  else if (s.p[1] < floorY + 1.2) seams.push({ at: [x, z], y: s.p[1] });
}
console.log(`ground coverage: ${grid.length - lost.length - seams.length}/${grid.length} landed on the park, `
  + `${seams.length} fell through a seam to the catch floor, ${lost.length} never landed`);
if (seams.length) console.log('  seams at:', JSON.stringify(seams.map((s) => s.at)));
check('the kid always ends up standing on something', lost.length === 0,
  `${lost.length}/${grid.length} never landed`);
/**
 * The seam count is reported, not hidden. The catch floor stops a seam being
 * a fall out of the world, but a seam is still a seam and this is the number
 * that says how many there are.
 */
check('few enough seams in the tiled ground', seams.length <= 8,
  `${seams.length}/${grid.length} points fell through to the catch floor`);

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

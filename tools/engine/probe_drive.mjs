/**
 * M5b acceptance: the wheeled props actually go somewhere.
 *
 * For every prop whose database entry carries `motion.drive`: mount it,
 * hold W, and check that the PROP moved, the RIDER moved with it (a kart
 * that drives out from under its driver is worse than one that never
 * moves), that steering turns it, that it stops at the fence instead of
 * driving into the countryside, and that it stays parked where it was left
 * after the rider hops off.
 *
 *   node tools/engine/probe_drive.mjs
 */
import { boot, shoot, peek, settle, sleep } from './probe_lib.mjs';

let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${pass ? '  OK  ' : ' FAIL '}] ${label}${detail ? '  — ' + detail : ''}`);
};

// edits:false — the wheeled props are shop inventory now; they only exist on
// the full map, and this probe is what keeps their drive data honest
const { browser, page } = await boot({ headless: true, log: false, edits: false });

const drivers = await peek(page, () => {
  const seen = new Set(), out = [];
  for (const s of window.__engine.props.spots) {
    if (!s.entry.motion || s.entry.motion.type !== 'drive') continue;
    if (seen.has(s.item.proto)) continue;
    seen.add(s.item.proto);
    out.push({ id: s.id, proto: s.item.proto, kind: s.entry.kind, pos: s.pos });
  }
  return out;
});
console.log(`\n${drivers.length} driveable prototypes\n`);

/** Hold keys for `ms` while the real render loop runs. */
async function hold(codes, ms) {
  await page.evaluate((cs) => {
    for (const c of cs) document.body.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
  }, codes);
  await sleep(ms);
  await page.evaluate((cs) => {
    for (const c of cs) document.body.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
  }, codes);
  await settle(page, 150);
}

const mountAt = (id) => peek(page, async (i) => {
  const e = window.__engine;
  const spot = e.props.spots[i];
  e.tp(spot.pos[0] + 0.9, spot.pos[2] + 0.9, Math.max(spot.pos[1] + 1.2, 1.2));
  await new Promise((r) => setTimeout(r, 350));
  return e.props.mount(spot);
}, id);

/** Where the prop's seat and the rider are, in world space. */
const state = () => peek(page, () => {
  const e = window.__engine, a = e.props.active;
  if (!a) return null;
  const M = e.player.model.getWorldMatrix().clone();
  e.props._spotMatrix(a.spot, M);
  const s = a.spot.entry.seat.pos;
  const m = M.m;
  const seat = [
    s[0] * m[0] + s[1] * m[4] + s[2] * m[8] + m[12],
    s[0] * m[1] + s[1] * m[5] + s[2] * m[9] + m[13],
    s[0] * m[2] + s[1] * m[6] + s[2] * m[10] + m[14],
  ];
  const p = e.player.model.position;
  return {
    seat: seat.map((v) => +v.toFixed(2)),
    rider: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
    // the motion sim lives on the SPOT now (each prop animates itself, so
    // more than one rider can be mid-motion) — not on the single mount
    speed: +((a.spot.sim && a.spot.sim.speed) || 0).toFixed(2),
    yaw: +((a.spot.sim && a.spot.sim.yaw) || 0).toFixed(3),
  };
});

const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

for (const d of drivers) {
  const ok = await mountAt(d.id);
  if (!ok) { check(`${d.proto} mounts`, false); continue; }
  await settle(page, 500);

  const before = await state();
  await peek(page, () => { window.__engine.player.camYaw = Math.PI; });
  await hold(['KeyW'], 2200);
  const after = await state();
  const travelled = dist(before.seat, after.seat);
  const riderMoved = dist(before.rider, after.rider);
  console.log(`  ${d.proto}: seat ${JSON.stringify(before.seat)} -> ${JSON.stringify(after.seat)}  (${travelled.toFixed(2)} m)`);

  check(`${d.proto} [${d.kind}] drives forward`, travelled > 1.2, `${travelled.toFixed(2)} m in 2.2 s`);
  check(`${d.proto} carries its rider`, Math.abs(riderMoved - travelled) < 0.45,
    `rider ${riderMoved.toFixed(2)} m vs prop ${travelled.toFixed(2)} m`);

  // steering: hold W+A and the heading must change
  const y0 = (await state()).yaw;
  await hold(['KeyW', 'KeyA'], 1200);
  const y1 = (await state()).yaw;
  check(`${d.proto} steers`, Math.abs(y1 - y0) > 0.15, `Δyaw ${(y1 - y0).toFixed(2)} rad`);

  const shotName = 'drive_' + d.proto.replace(/^SM_(Prop|Env|Veh)_/, '').toLowerCase();
  await peek(page, () => {
    const p = window.__engine.player.model.position;
    window.__engine.look([p.x + 3.4, p.y + 2.4, p.z + 3.4], [p.x, p.y + 0.5, p.z]);
  });
  await settle(page, 300);
  await shoot(page, shotName, { hideHud: true });

  // park it: the prop must STAY where it was driven to
  const parkedAt = (await state()).seat;
  await peek(page, () => window.__engine.props.dismount());
  await settle(page, 700);
  const stillThere = await peek(page, (i) => {
    const e = window.__engine, spot = e.props.spots[i];
    const M = e.player.model.getWorldMatrix().clone();
    e.props._spotMatrix(spot, M);
    const s = spot.entry.seat.pos, m = M.m;
    return [
      s[0] * m[0] + s[1] * m[4] + s[2] * m[8] + m[12],
      s[0] * m[1] + s[1] * m[5] + s[2] * m[9] + m[13],
      s[0] * m[2] + s[1] * m[6] + s[2] * m[10] + m[14],
    ].map((v) => +v.toFixed(2));
  }, d.id);
  check(`${d.proto} stays parked where it was left`, dist(parkedAt, stillThere) < 0.3,
    `moved ${dist(parkedAt, stillThere).toFixed(2)} m on dismount`);
  await settle(page, 200);
}

/**
 * THE FENCE. Drive at it for long enough to cross the park and the kart
 * must still be inside — a vehicle with no physics body would sail out into
 * the countryside, which is exactly what the forward ray exists to stop.
 */
{
  const kart = drivers.find((d) => d.kind === 'kart');
  if (kart) {
    await mountAt(kart.id);
    await settle(page, 400);
    const inner = await peek(page, () => window.__engine.backdrop.innerRadius);
    const centre = await peek(page, () => window.__engine.backdrop.centre);
    await peek(page, () => { window.__engine.player.camYaw = Math.PI; });
    await hold(['KeyW'], 9000);
    const s = await state();
    const fromCentre = Math.hypot(s.seat[0] - centre[0], s.seat[2] - centre[1]);
    check('a kart driven flat-out stays inside the park', fromCentre < inner,
      `${fromCentre.toFixed(1)} m from centre, fence ring at ${inner.toFixed(1)} m`);
    await peek(page, () => {
      const p = window.__engine.player.model.position;
      window.__engine.look([p.x + 4, p.y + 3, p.z + 4], [p.x, p.y + 0.5, p.z]);
    });
    await settle(page, 300);
    await shoot(page, 'drive_fence', { hideHud: true });
    await peek(page, () => window.__engine.props.dismount());
  }
}

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

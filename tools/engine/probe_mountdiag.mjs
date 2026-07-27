/**
 * Diagnostic: why does the FIRST mount of a session pose correctly while
 * later mounts leave the kid standing on the seat?
 *
 *   node tools/engine/probe_mountdiag.mjs
 */
import { boot, peek, settle, shoot } from './probe_lib.mjs';

const { browser, page } = await boot({ headless: true, log: false });

const snap = () => peek(page, () => {
  const e = window.__engine;
  const r = e.player.rig;
  const a = r.action;
  const leg = r.bones[14];   // UpperLeg_L
  return {
    playing: r.playing,
    actionW: +r.actionW.toFixed(3),
    legW: r.legW,
    t: a ? +a.t.toFixed(2) : null,
    loop: a ? a.loop : null,
    driven: a ? a.driven : null,
    frames: a ? a.info.frames : null,
    hasBin: a ? !!a.bin : null,
    hipDelta: +(r.hips.position.y - r.hipsRest.y).toFixed(3),
    legQ: leg.rotationQuaternion.asArray().map((v) => +v.toFixed(3)),
    mounted: !!e.player.mounted,
    active: e.props.active ? e.props.active.spot.item.proto : null,
  };
});

const mount = (pattern) => peek(page, async (p) => {
  const e = window.__engine;
  const spot = e.props.find(p)[0];
  e.tp(spot.pos[0] + 0.8, spot.pos[2] + 0.8, Math.max(spot.pos[1] + 1.2, 1.2));
  await new Promise((res) => setTimeout(res, 300));
  return await e.props.mount(spot);
}, pattern);

const dismount = () => peek(page, () => window.__engine.props.dismount());

console.log('\n— mount #1: the BENCH first this time —');
console.log('mounted:', await mount('Park_Seat'));
await settle(page, 1400);
console.log('bench t+1.4s:', JSON.stringify(await snap()));
await shoot(page, 'diag_bench_first', { hideHud: false });

await dismount();
await settle(page, 500);

console.log('\n— mount #2: the 4x4 second —');
console.log('mounted:', await mount('SM_Veh_4x4'));
await settle(page, 1400);
console.log('4x4 t+1.4s:', JSON.stringify(await snap()));
await shoot(page, 'diag_4x4_second', { hideHud: false });

await dismount();
await settle(page, 500);

console.log('\n— mount #3: bench again —');
console.log('mounted:', await mount('Park_Seat'));
for (let i = 0; i < 5; i++) {
  await settle(page, 300);
  console.log(`bench t+${(i + 1) * 0.3}s:`, JSON.stringify(await snap()));
}
await shoot(page, 'diag_bench_again', { hideHud: false });

await browser.close();

/**
 * M5c acceptance: there are other kids in the park.
 *
 * The numbers to trust here are about BEHAVIOUR over time, so this probe
 * watches for a while rather than sampling once: every kid must bind its
 * rig, actually walk somewhere, and at least one must end up sitting on a
 * real prop out of the database — which is the point of the whole exercise,
 * because it means the seat data works for someone other than the player.
 *
 * And a picture, because "kids in a park" is a look: a wide shot of the
 * park with everyone in it, plus a close-up of whoever is sitting.
 *
 *   node tools/engine/probe_npc.mjs
 */
import { boot, shoot, peek, settle, sleep } from './probe_lib.mjs';

let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${pass ? '  OK  ' : ' FAIL '}] ${label}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await boot({ headless: true, log: false, npc: true });

// they load AFTER ready, so wait for them
await page.waitForFunction(() => window.__engine.npcs && window.__engine.npcs.kids.length >= 4,
  { timeout: 90000 }).catch(() => {});
await settle(page, 800);

const first = await peek(page, () => window.__engine.npcs.stats());
console.log('\nkids:', JSON.stringify(first, null, 1));

check('four kids loaded', first.length === 4, `${first.length}`);
check('every kid bound its rig', first.every((k) => k.rigOk),
  first.map((k) => `${k.costume}:${k.rigOk}`).join(' '));
check('they wear different costumes', new Set(first.map((k) => k.costume)).size === first.length);
check('nobody spawned under the world', first.every((k) => k.pos[1] > -1.5),
  first.map((k) => k.pos[1]).join(', '));

// ── watch them for a while ────────────────────────────────────────────────
const seen = { walk: 0, sit: 0, idle: 0, emote: 0 };
const emotesSeen = new Set();
const moved = first.map(() => 0);
let prev = first;
for (let t = 0; t < 24; t++) {
  await sleep(1000);
  const now = await peek(page, () => window.__engine.npcs.stats());
  now.forEach((k, i) => {
    seen[k.state] = (seen[k.state] || 0) + 1;
    if (k.emote) emotesSeen.add(k.emote);
    moved[i] += Math.hypot(k.pos[0] - prev[i].pos[0], k.pos[2] - prev[i].pos[2]);
  });
  prev = now;
}
console.log('\nstates seen:', JSON.stringify(seen));
console.log('distance walked per kid:', moved.map((m) => m.toFixed(1) + ' m').join(', '));

check('the kids actually walk', moved.every((m) => m > 2),
  moved.map((m) => m.toFixed(1)).join(', '));
check('at least one kid sat on a prop during the watch', seen.sit > 0, `${seen.sit} sit-seconds`);
check('the kids emote while standing about', emotesSeen.size > 0,
  emotesSeen.size ? [...emotesSeen].join(', ') : 'nobody emoted in 24 s');
check('nobody drifted below the world', prev.every((k) => k.pos[1] > -1.5),
  prev.map((k) => k.pos[1]).join(', '));

const sitting = prev.filter((k) => k.seat);
console.log('sitting right now:', JSON.stringify(sitting.map((k) => `${k.costume} on ${k.seat}`)));

const fps = await peek(page, () => +window.__engine.engine.getFps().toFixed(0));
check('still 50+ fps with four more kids', fps >= 50, `${fps} fps`);

/**
 * A seat can hold ONE kid. If an NPC is on a bench the player must not be
 * able to mount it on top of them — the database is shared, so the
 * occupancy has to be shared too.
 */
const clash = await peek(page, async () => {
  const e = window.__engine;
  const taken = e.props.spots.find((s) => s.taken);
  if (!taken) return { skipped: true };
  const ok = await e.props.mount(taken);
  if (ok) e.props.dismount();
  return { skipped: false, mounted: ok, proto: taken.item.proto };
});
if (clash.skipped) console.log('[ note ] nobody was seated at the moment of the clash test');
else check('the player cannot sit on an occupied seat', clash.mounted === false, clash.proto);

/**
 * A KID ON A SWING, which is what the per-spot motion refactor bought.
 * Forced rather than waited for, because "eventually one of them picks a
 * swing" is not a test. The prop must actually swing, and the rider must be
 * carried BY it — a rider whose height does not track the arc is sitting in
 * mid-air next to a moving seat, which is exactly the failure this replaces.
 */
{
  const forced = await peek(page, async () => {
    const n = window.__engine.npcs;
    const swing = n.seats.find((s) => s.moving && s.spot.entry.motion.type === 'swing');
    if (!swing) return null;
    const kid = n.kids[0];
    if (kid.seat) n._standUp(kid);
    kid.model.position.set(swing.world[0], swing.world[1], swing.world[2]);
    kid.spot = swing;
    swing.taken = true;
    n._sitDown(kid);
    await new Promise((r) => setTimeout(r, 2000));
    const track = [];
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 200));
      track.push([+swing.spot.sim.angle.toFixed(3), +kid.model.position.y.toFixed(3)]);
    }
    return { proto: swing.spot.item.proto, track };
  });
  if (!forced) {
    console.log('[ note ] no swing seat offered to NPCs');
  } else {
    const angles = forced.track.map((t) => t[0]);
    const ys = forced.track.map((t) => t[1]);
    const swingRange = Math.max(...angles) - Math.min(...angles);
    const riderRange = Math.max(...ys) - Math.min(...ys);
    console.log(`\nswing ${forced.proto}: angle range ${swingRange.toFixed(2)} rad, rider Y range ${riderRange.toFixed(2)} m`);
    check('an NPC can ride a MOVING prop', swingRange > 0.2, `${swingRange.toFixed(2)} rad of arc`);
    check('…and the swing carries them (height tracks the arc)', riderRange > 0.05,
      `rider moved ${riderRange.toFixed(2)} m vertically`);
    await peek(page, () => {
      const k = window.__engine.npcs.kids.find((x) => x.seat && x.seat.moving);
      if (!k) return;
      const p = k.model.position;
      window.__engine.look([p.x + 2.8, p.y + 1.6, p.z + 2.8], [p.x, p.y + 0.6, p.z]);
    });
    await settle(page, 350);
    await shoot(page, 'npc_swinging', { hideHud: true });
  }
}

// ── the pictures ──────────────────────────────────────────────────────────
const centre = await peek(page, () => window.__engine.backdrop.centre);
await shoot(page, 'npc_park', { from: [centre[0] + 16, 12, centre[1] + 26], at: [centre[0], 0, centre[1] + 6] });

const who = await peek(page, () => {
  const n = window.__engine.npcs.kids.find((k) => k.state === 'sit') || window.__engine.npcs.kids[0];
  const p = n.model.position;
  window.__engine.look([p.x + 2.6, p.y + 1.9, p.z + 2.6], [p.x, p.y + 0.7, p.z]);
  return { costume: n.costume, state: n.state };
});
await settle(page, 400);
await shoot(page, 'npc_closeup', { hideHud: true });
console.log('close-up:', JSON.stringify(who));

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

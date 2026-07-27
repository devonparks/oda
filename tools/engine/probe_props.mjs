/**
 * M4 acceptance: the prop gallery.
 *
 * For EVERY mountable spot in the database: walk the kid up (teleport — this
 * probe is about the mounts, not the walk), mount it, let the pose settle,
 * photograph it from a three-quarter angle, and MEASURE the fit:
 *
 *   - butt-to-seat: the rig's pelvis, minus the butt offset, against the seat
 *     surface transformed to world. This is the number behind "the character
 *     isn't sitting on the seat."
 *   - hand-to-pin / foot-to-pin where the database pins them.
 *
 * The numbers gate the exit code; the PICTURES are the actual acceptance —
 * tools/engine/_shots/props/index.html is a contact sheet of every mount for
 * eyes, because numbers here have lied before ("on the chain" while the shot
 * showed a hand holding air).
 *
 *   node tools/engine/probe_props.mjs                # all spots
 *   node tools/engine/probe_props.mjs swing          # only matching spots
 */
import fs from 'node:fs';
import path from 'node:path';
import { boot, shoot, peek, settle, SHOT_DIR } from './probe_lib.mjs';

const FILTER = process.argv[2] || '';
const OUT = path.join(SHOT_DIR, 'props');
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${pass ? '  OK  ' : ' FAIL '}] ${label}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await boot({ headless: true, log: false });

// one spot per PROTOTYPE (the db is per-prototype; photographing ten
// identical benches would just pad the sheet) — plus every distinct kind
const spots = await peek(page, (filter) => {
  const props = window.__engine.props;
  const seen = new Set();
  const out = [];
  for (const s of props.spots) {
    if (filter && !new RegExp(filter, 'i').test(s.item.proto + ' ' + s.entry.kind)) continue;
    if (seen.has(s.item.proto)) continue;
    seen.add(s.item.proto);
    out.push({
      id: s.id, proto: s.item.proto, kind: s.entry.kind, pos: s.pos,
      clip: s.entry.clip, clipStatus: s.entry.clipStatus, wantClip: s.entry.wantClip || null,
      mode: s.entry.mode, dims: s.entry.dims,
      hasHands: !!s.entry.hands, hasFeet: !!s.entry.feet,
      pinTolerance: s.entry.pinTolerance || 0,
      seatStatus: s.entry.seatStatus || 'measured',
    });
  }
  return out;
}, FILTER);

console.log(`\n${spots.length} prototypes to ride\n`);
const rows = [];

for (const s of spots) {
  // stand the kid near the seat, then mount that exact spot
  const r = await peek(page, async (id) => {
    const e = window.__engine;
    const spot = e.props.spots[id];
    // put the kid beside the prop so mount() picks the intended spot
    e.tp(spot.pos[0] + 0.8, spot.pos[2] + 0.8, Math.max(spot.pos[1] + 1.2, 1.2));
    await new Promise((res) => setTimeout(res, 350));
    const ok = await e.props.mount(spot);
    if (!ok) return { ok: false };
    // let the pose blend in and the motion envelope open — but catch a slide
    // MID-CHUTE (it dismounts itself at the bottom after ~1.2 s)
    const isSlide = spot.entry.motion && spot.entry.motion.type === 'slide';
    await new Promise((res) => setTimeout(res, isSlide ? 500 : 1300));

    const a = e.props.active;
    if (!a) return { ok: true, dismounted: true };   // slides ride through and hop off
    const M = e.props._spotMatrix(spot, e.player.model.getWorldMatrix().clone());
    const seatW = (function (p) {
      const v = { x: 0, y: 0, z: 0 };
      v.x = p[0] * M.m[0] + p[1] * M.m[4] + p[2] * M.m[8] + M.m[12];
      v.y = p[0] * M.m[1] + p[1] * M.m[5] + p[2] * M.m[9] + M.m[13];
      v.z = p[0] * M.m[2] + p[1] * M.m[6] + p[2] * M.m[10] + M.m[14];
      return v;
    })(a.seat.pos);

    const rig = e.player.rig;
    const model = e.player.model;
    // pelvis world = hips node's absolute position
    rig.hips.computeWorldMatrix(true);
    const pelvis = rig.hips.getAbsolutePosition();
    const up = { x: 0, y: 1, z: 0 };   // butt offset is along the model's up
    const mrot = model.rotationQuaternion;
    // rotate (0, -0.105, 0) by the model's quaternion for the butt contact
    const bb = (function (q, v) {
      const { x, y, z, w } = q;
      const ux = y * v.z - z * v.y, uy = z * v.x - x * v.z, uz = x * v.y - y * v.x;
      const uux = y * uz - z * uy, uuy = z * ux - x * uz, uuz = x * uy - y * ux;
      return { x: v.x + 2 * (w * ux + uux), y: v.y + 2 * (w * uy + uuy), z: v.z + 2 * (w * uz + uuz) };
    })(mrot, { x: 0, y: -0.105, z: 0 });
    const butt = { x: pelvis.x + bb.x, y: pelvis.y + bb.y, z: pelvis.z + bb.z };

    // hand / foot pins vs their bones
    const pins = [];
    const entry = spot.entry;
    const boneW = (name) => {
      const i = rig.loco.bones.indexOf(name);
      const n = rig.bones[i];
      if (!n) return null;
      n.computeWorldMatrix(true);
      const p = n.getAbsolutePosition();
      return { x: p.x, y: p.y, z: p.z };
    };
    const toW = (p) => ({
      x: p[0] * M.m[0] + p[1] * M.m[4] + p[2] * M.m[8] + M.m[12],
      y: p[0] * M.m[1] + p[1] * M.m[5] + p[2] * M.m[9] + M.m[13],
      z: p[0] * M.m[2] + p[1] * M.m[6] + p[2] * M.m[10] + M.m[14],
    });
    const dist = (a2, b2) => Math.hypot(a2.x - b2.x, a2.y - b2.y, a2.z - b2.z);
    // the runtime carries pins along to span seats (seesaw ends, bench spots) —
    // measure against the same shifted targets it actually solves for
    const sdx = a.seat.pos[0] - entry.seat.pos[0];
    const sdy = a.seat.pos[1] - entry.seat.pos[1];
    const sdz = a.seat.pos[2] - entry.seat.pos[2];
    const shift = (p) => [p[0] + sdx, p[1] + sdy, p[2] + sdz];
    // the runtime assigns each target to the nearer limb — measure the same
    // pairing, not a hard-wired order
    const pair = (what, boneA, boneB, targets) => {
      const A = boneW(boneA), B = boneW(boneB);
      if (!A || !B) return;
      const t0 = toW(shift(targets[0])), t1 = toW(shift(targets[1]));
      const straight = dist(A, t0) + dist(B, t1);
      const crossed = dist(A, t1) + dist(B, t0);
      if (straight <= crossed) {
        pins.push({ what: what + '_L', d: +dist(A, t0).toFixed(3) });
        pins.push({ what: what + '_R', d: +dist(B, t1).toFixed(3) });
      } else {
        pins.push({ what: what + '_L', d: +dist(A, t1).toFixed(3) });
        pins.push({ what: what + '_R', d: +dist(B, t0).toFixed(3) });
      }
    };
    if (entry.hands) pair('hand', 'Hand_L', 'Hand_R', entry.hands);
    if (entry.feet) pair('foot', 'Ankle_L', 'Ankle_R', entry.feet);

    return {
      ok: true,
      playing: rig.playing,
      actionW: +rig.actionW.toFixed(3),
      hipDelta: +(rig.hipApplied || 0).toFixed(3),
      grounded: e.player._grounded,
      stillMounted: !!e.player.mounted,
      buttGap: +(butt.y - seatW.y).toFixed(3),
      horizGap: +Math.hypot(butt.x - seatW.x, butt.z - seatW.z).toFixed(3),
      seatW: [+seatW.x.toFixed(2), +seatW.y.toFixed(2), +seatW.z.toFixed(2)],
      model: [+model.position.x.toFixed(2), +model.position.y.toFixed(2), +model.position.z.toFixed(2)],
      pins,
    };
  }, s.id);

  const name = s.proto.replace(/^SM_(Prop|Env|Veh)_/, '').toLowerCase();
  let shot = null;
  if (r.ok && !r.dismounted) {
    // camera: three-quarter view framed on the prop, scaled to its size
    const d = Math.max(2.6, Math.max(...s.dims) * 1.35);
    shot = path.join('props', name + '.png');
    await peek(page, (sp, dd) => {
      const e = window.__engine;
      const p = e.player.model.position;
      e.look([p.x + dd * 0.72, p.y + dd * 0.55, p.z + dd * 0.72], [p.x, p.y + 0.55, p.z]);
    }, s.pos, d);
    await settle(page, 350);
    await page.screenshot({ path: path.join(SHOT_DIR, shot) });
  }

  if (r.ok && !r.dismounted) {
    const mode = s.mode;
    // sit: the butt should rest ON the plank (a few cm of clip tolerance);
    // stand/hang: the model origin was placed directly, so the gap is design
    const gapOK = mode !== 'sit' || (r.buttGap > -0.08 && r.buttGap < 0.12 && r.horizGap < 0.25);
    const tol = s.pinTolerance || 0.11;
    const pinsBad = (r.pins || []).filter((p2) => p2.d > tol);
    check(`${s.proto} [${s.kind}] sits on its seat`, gapOK,
      `butt↕ ${r.buttGap} m, drift ${r.horizGap} m, clip=${r.playing}`
      + ` aW=${r.actionW} hip=${r.hipDelta} mounted=${r.stillMounted}`);
    if (r.pins && r.pins.length) {
      check(`${s.proto} pins reach`, pinsBad.length === 0,
        r.pins.map((p2) => `${p2.what}:${p2.d}`).join(' '));
    }
    rows.push({ ...s, ...r, shot, gapOK, pinsBad: pinsBad.length });
  } else if (r.dismounted) {
    console.log(`[ note ] ${s.proto} rode through and dismounted (slide) — rerideable, shot skipped`);
    rows.push({ ...s, ...r, shot: null, gapOK: true, pinsBad: 0 });
  } else {
    check(`${s.proto} mounts at all`, false, 'mount() returned false');
    rows.push({ ...s, shot: null, gapOK: false, pinsBad: 0 });
  }

  await peek(page, () => { window.__engine.props.dismount(); });
  await settle(page, 200);
}

// ── the honesty ledger ──────────────────────────────────────────────────────
const bespoke = rows.filter((r) => r.clipStatus === 'bespoke').length;
const placeholder = rows.filter((r) => r.clipStatus === 'placeholder');
console.log(`\nclips: ${bespoke}/${rows.length} bespoke, ${placeholder.length} placeholders:`);
for (const p of placeholder) console.log(`   ${p.proto}: has ${p.clip}, wants ${p.wantClip || '?'}`);

// ── contact sheet ───────────────────────────────────────────────────────────
const cells = rows.map((r) => `
  <figure class="${r.gapOK && !r.pinsBad ? 'ok' : 'bad'}">
    ${r.shot ? `<img src="../${r.shot.replace(/\\/g, '/')}" loading="lazy">` : '<div class="none">no shot</div>'}
    <figcaption><b>${r.proto}</b><br>${r.kind} · ${r.mode} · ${r.clip}
      <span class="${r.clipStatus}">${r.clipStatus}</span><br>
      ${r.buttGap !== undefined ? `butt↕ ${r.buttGap} m · drift ${r.horizGap} m` : ''}
      ${(r.pins || []).map((p) => `<br>${p.what} ${p.d} m`).join('')}
    </figcaption>
  </figure>`).join('\n');
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8">
<title>prop gallery</title>
<style>
 body{background:#10161a;color:#dfe9ee;font:14px system-ui;margin:16px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
 figure{margin:0;background:#1a2229;border-radius:10px;overflow:hidden;border:2px solid #22303a}
 figure.bad{border-color:#c0392b}
 img{width:100%;display:block}
 figcaption{padding:8px 10px;font-size:12px;line-height:1.5}
 .placeholder{color:#e8b447}.bespoke{color:#58c9a0}
 .none{height:160px;display:grid;place-items:center;color:#557}
</style>
<h2>prop gallery — ${rows.length} mounts</h2><div class="grid">${cells}</div>`);
console.log(`\ncontact sheet → ${path.relative(process.cwd(), path.join(OUT, 'index.html'))}`);

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

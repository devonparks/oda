/**
 * THE TOUR — the whole park, played like a kid would play it, in one run.
 *
 * The other probes each prove one system. This one is for eyes: it walks
 * through the experience end to end and writes a captioned contact sheet to
 * `tools/engine/_shots/tour/index.html`, so a person can judge in thirty
 * seconds whether the world is any good — which is a question no assertion
 * has ever answered.
 *
 * It is also the broadest regression there is: every scene below touches a
 * different subsystem, and a scene that throws takes its own caption down
 * with it rather than the run.
 *
 *   node tools/engine/probe_tour.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { boot, peek, settle, sleep, SHOT_DIR } from './probe_lib.mjs';

const OUT = path.join(SHOT_DIR, 'tour');
fs.mkdirSync(OUT, { recursive: true });

const { browser, page } = await boot({ headless: true, log: false, npc: true });
await page.waitForFunction(() => window.__engine.npcs && window.__engine.npcs.kids.length >= 4,
  { timeout: 90000 }).catch(() => {});
await settle(page, 600);

const scenes = [];
let n = 0;

/** Run one scene: do something, frame it, shoot it, caption it. */
async function scene(title, caption, fn) {
  const file = `${String(++n).padStart(2, '0')}_${title.replace(/\W+/g, '_').toLowerCase()}.png`;
  try {
    await fn();
    await settle(page, 350);
    await page.screenshot({ path: path.join(OUT, file) });
    scenes.push({ file, title, caption, ok: true });
    console.log(`[  OK  ] ${title}`);
  } catch (e) {
    scenes.push({ file: null, title, caption, ok: false, err: String(e.message || e).slice(0, 160) });
    console.log(`[ FAIL ] ${title} — ${String(e.message || e).slice(0, 120)}`);
  }
}

const centre = await peek(page, () => window.__engine.backdrop.centre);
const look = (from, at) => peek(page, (f, a) => window.__engine.look(f, a), from, at);
const hideHud = () => peek(page, () => document.getElementById('hud')?.classList.add('hidden'));
await hideHud();

/** Put the player on a prop by prototype name and settle. */
const ride = (pattern, holdMs = 1500, keys = []) => peek(page, async (p, ms, ks) => {
  const e = window.__engine;
  if (e.props.active) e.props.dismount();
  const spot = e.props.find(p)[0];
  if (!spot) throw new Error('no spot for ' + p);
  spot.taken = false;
  e.tp(spot.pos[0] + 0.9, spot.pos[2] + 0.9, Math.max(spot.pos[1] + 1.2, 1.2));
  await new Promise((r) => setTimeout(r, 350));
  const ok = await e.props.mount(spot);
  if (!ok) throw new Error('mount refused: ' + p);
  for (const k of ks) document.body.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
  await new Promise((r) => setTimeout(r, ms));
  for (const k of ks) document.body.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
  const q = e.player.model.position;
  e.look([q.x + 3.0, q.y + 2.0, q.z + 3.0], [q.x, q.y + 0.6, q.z]);
}, pattern, holdMs, keys);

// ─────────────────────────────────────────────────────────────────────────
await scene('The park', 'The whole park from above — countryside, hills and tree belts all round it, which is what stopped it being "a plane floating in the middle of nowhere".',
  () => look([centre[0] + 62, 52, centre[1] + 74], [centre[0], 0, centre[1] + 4]));

await scene('Over the fence', 'Standing inside the fence at a kid\'s eye height, looking out. The land past the fence is the park\'s own grass colour — measured to 2/255 of the lawn, because a flat colour in diffuseColor clips to cream under this light rig.',
  () => look([centre[0] + 2, 1.35, centre[1] - 6], [centre[0] + 26, 6, centre[1] + 60]));

await scene('Other kids', 'Four kids in different costumes walk the paths and sit on the benches. They pick their seats out of the same prop database the player mounts from.',
  async () => {
    const p = await peek(page, () => {
      const k = window.__engine.npcs.kids[1];
      return [k.model.position.x, k.model.position.y, k.model.position.z];
    });
    await look([p[0] + 3.4, p[1] + 2.2, p[2] + 3.4], [p[0], p[1] + 0.7, p[2]]);
  });

await scene('On the swings', 'Riding a swing: the seat and the rider are carried by one world delta, so the kid pumps in time with the arc instead of near it. Hands are pinned to the chains by IK.',
  () => ride('Swings_01_Swing_1', 2200, ['KeyW']));

// The vehicles are gone from these scenes on purpose: 2026-08-01 made every
// rideable a SHOP item (engine/assets/catalogue.json) and the park ships
// empty of them. probe_drive still rides all nine through ?edits=0.
await scene('On the seesaw', 'A lone rider sinks their own end and the plank remembers its tilt after they hop off — the lever sim renders with a sign measured off the real geometry, not assumed.',
  () => ride('Seesaw_01_Top', 1800));

await scene('The roundabout', 'The tyre carousel: hold W and it spins up, the rider faces the hub, and the seat carries them round in the prop\'s own frame.',
  async () => {
    await ride('Rocker_Top_01', 2600, ['KeyW']);
    // frame the RIDER from the park side — the carousel stands at the fence
    // (and its placement origin is up the pole, so s.pos aims at sky)
    await peek(page, () => {
      const e = window.__engine;
      const s = e.props.find('Rocker_Top_01')[0];
      const c = e.backdrop.centre;
      const p = e.player.model.position;
      let dx = c[0] - s.pos[0], dz = c[1] - s.pos[2];
      const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      e.look([p.x + dx * 4.6, p.y + 2.6, p.z + dz * 4.6], [p.x, p.y + 0.6, p.z]);
    });
  });

await scene('The coin-ride dragon', 'Its own bespoke clip — sit_dragon, baked in Unity for this prop — with both hands measured onto the dragon\'s neck to 2 mm.',
  () => ride('Coin_Ride_Dragon', 1400));

await scene('At the picnic table', 'sit_table: forearms on the tabletop, legs tucked under. The table\'s two benches are separate seats found by splitting one height band.',
  () => ride('Park_Table', 1200));

await scene('Monkey bars', 'A hang, not a sit: the model origin goes on the bar line and the hands are pinned overhead.',
  () => ride('Monkey_Bars', 1400));

await scene('The spiral slide', 'Slide_05 is a 640° corkscrew, and the rider now follows its measured centreline — tube ring centres traced from the vertex data — leaning ~28° into the turn and standing back up for the run-out. Shot dropping through the mouth; once inside the tube only glimpses of head and hands crest it, which is what an enclosed spiral looks like ridden.',
  async () => {
    await ride('Slide_05', 350);
    // the mouth drop is the one reliably visible beat of an enclosed tube —
    // camera radially OUT from the tower, looking down at the rider
    await peek(page, () => {
      const e = window.__engine;
      const s = e.props.find('Slide_05')[0];
      const p = e.player.model.position;
      let dx = p.x - s.pos[0], dz = p.z - s.pos[2];
      const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      e.look([p.x + dx * 2.8, p.y + 1.6, p.z + dz * 2.8], [p.x, p.y, p.z]);
    });
  });

await scene('Up the stairs', 'The playground stairs, climbed. Staircases collide as their convex hull — the ramp under them — because the exact tread mesh wedges the capsule about half the time.',
  async () => {
    await peek(page, async () => {
      const e = window.__engine;
      if (e.props.active) e.props.dismount();
      e.tp(4.6, 0.25, 1.2);
      await new Promise((r) => setTimeout(r, 1200));
      e.player.camYaw = Math.PI / 2;
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
      await new Promise((r) => setTimeout(r, 3600));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
      // back and high: at 3 m the playground's own railings fill the frame
      const p = e.player.model.position;
      e.look([p.x + 7.5, p.y + 5.0, p.z + 7.0], [p.x, p.y + 0.4, p.z]);
    });
  });

await scene('Wading in the pond', 'The pond bed is real geometry, so walking in just works — chest-deep, no swim code.',
  async () => {
    await peek(page, async () => {
      const e = window.__engine;
      const w = e.park.items.find((i) => /Pond_Water/.test(i.proto));
      e.tp(w.pos[0], w.pos[2], 3);
      await new Promise((r) => setTimeout(r, 1800));
      const p = e.player.model.position;
      e.look([p.x + 3.6, p.y + 2.2, p.z + 3.6], [p.x, p.y + 0.4, p.z]);
    });
  });

await scene('The prop library', 'P opens every prototype in the park with a thumbnail, searchable. Green badges are bespoke clips; an amber one would mark a placeholder — there are none left.',
  async () => {
    await peek(page, () => {
      if (window.__engine.props.active) window.__engine.props.dismount();
      window.__engine.library.toggle();
      const el = document.getElementById('library').querySelector('input');
      el.value = 'ride';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(700);
  });

await peek(page, () => { if (window.__engine.library.open) window.__engine.library.toggle(); });

// ── the contact sheet ────────────────────────────────────────────────────
const cards = scenes.map((s, i) => `
  <figure${s.ok ? '' : ' class="bad"'}>
    ${s.file ? `<img src="${s.file}" loading="lazy">` : `<div class="none">${s.err || 'no shot'}</div>`}
    <figcaption><b>${i + 1}. ${s.title}</b><p>${s.caption}</p></figcaption>
  </figure>`).join('\n');

fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8">
<title>AMG World Engine — the tour</title>
<style>
 body{background:#0e1418;color:#e6eef2;font:15px/1.6 system-ui;margin:0;padding:28px}
 h1{font-size:24px;margin:0 0 4px}
 .sub{opacity:.6;margin:0 0 24px;font-size:14px}
 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:18px}
 figure{margin:0;background:#151d23;border:1px solid #24313a;border-radius:12px;overflow:hidden}
 figure.bad{border-color:#c0392b}
 img{width:100%;display:block}
 figcaption{padding:12px 16px 16px}
 figcaption b{color:#8fe3c2}
 figcaption p{margin:6px 0 0;opacity:.78;font-size:13.5px}
 .none{padding:60px 16px;text-align:center;color:#c0392b;font-size:13px}
</style>
<h1>AMG World Engine — the tour</h1>
<p class="sub">${scenes.filter((s) => s.ok).length}/${scenes.length} scenes · every picture taken by driving the real engine in real Chrome</p>
<div class="grid">${cards}</div>`);

const failed = scenes.filter((s) => !s.ok).length;
console.log(`\ncontact sheet → ${path.relative(process.cwd(), path.join(OUT, 'index.html'))}`);
await browser.close();
console.log(failed ? `\n${failed} SCENE(S) FAILED\n` : '\nall scenes shot\n');
process.exit(failed ? 1 : 0);

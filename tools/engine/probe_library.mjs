/**
 * M4d acceptance: the prop library (P).
 *
 *   - opens, lists every prototype in the database, with thumbnails that
 *     actually load (a broken thumb URL renders as a grey square and a
 *     count would never notice)
 *   - search filters the grid
 *   - clicking a card flies the camera to a real placement
 *   - the search box does not drive the kid around
 *
 *   node tools/engine/probe_library.mjs
 */
import { boot, shoot, peek, settle } from './probe_lib.mjs';

let failures = 0;
const check = (label, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`[${pass ? '  OK  ' : ' FAIL '}] ${label}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await boot({ headless: true, log: false });

// open it
await peek(page, () => window.__engine.library.toggle());
await settle(page, 800);

const state = await peek(page, async () => {
  const el = document.getElementById('library');
  const cards = [...el.querySelectorAll('.lib-card')];
  // wait for the lazy images in the first screenful to arrive
  await new Promise((r) => setTimeout(r, 1200));
  const imgs = cards.slice(0, 24).map((c) => c.querySelector('img'));
  // what the WORLD says a card count should be: db prototypes that still
  // have a placement (the shop inventory drops at load and must not browse)
  const placed = new Set(window.__engine.park.items.map((i) => i.proto));
  const expected = Object.entries(window.__engine.props.db)
    .filter(([k, v]) => k !== '_meta' && v && v.dims && placed.has(k)).length;
  return {
    open: !el.classList.contains('hidden'),
    cards: cards.length,
    expected,
    mounts: el.querySelectorAll('.lib-clip').length,
    placeholders: el.querySelectorAll('.lib-clip.placeholder').length,
    // what the DATABASE says, so the UI is checked against truth rather
    // than against a number that was true on the day this was written
    dbPlaceholders: Object.values(window.__engine.props.db)
      .filter((e) => e && e.clipStatus === 'placeholder').length,
    imgsLoaded: imgs.filter((i) => i.complete && i.naturalWidth > 10).length,
    imgsChecked: imgs.length,
  };
});
console.log('\nlibrary:', JSON.stringify(state));
check('library opens on toggle', state.open);
// checked against the live park, not a constant — the 2026-08-01 map edits
// drop the shop inventory, so "every prototype" means "every PLACED one"
check('every placed db prototype has a card', state.cards === state.expected && state.cards > 0,
  `${state.cards} cards, ${state.expected} placed db prototypes`);
check('mountable props show their clip badge', state.mounts >= 14, `${state.mounts}`);
/**
 * The badge count must MATCH the database, not clear some fixed bar. This
 * check originally demanded ≥8 placeholders and started failing the moment
 * the clip gap was closed — a passing engine failed by an assertion that had
 * quietly become a description of the past.
 */
check('placeholder badges match the database exactly',
  state.placeholders === state.dbPlaceholders,
  `${state.placeholders} shown, ${state.dbPlaceholders} in the db`);
check('thumbnails actually load', state.imgsLoaded === state.imgsChecked,
  `${state.imgsLoaded}/${state.imgsChecked}`);
await shoot(page, 'library_01_open', { hideHud: false });

// search filters
const search = await peek(page, () => {
  const el = document.getElementById('library');
  const input = el.querySelector('input');
  input.value = 'swing';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const vis = [...el.querySelectorAll('.lib-card')].filter((c) => c.style.display !== 'none');
  return { visible: vis.length, names: vis.map((c) => c.dataset.proto) };
});
check('search narrows the grid', search.visible > 0 && search.visible < 20, `${search.visible} for "swing"`);
check('search finds the swings', search.names.some((n) => /Swing/i.test(n)));
await shoot(page, 'library_02_search', { hideHud: false });

// typing in search must not move the kid
const moved = await peek(page, async () => {
  const el = document.getElementById('library');
  const input = el.querySelector('input');
  const p0 = window.__engine.player.position.asArray().slice();
  for (const code of ['KeyW', 'KeyW', 'KeyA']) {
    input.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 700));
  for (const code of ['KeyW', 'KeyA']) {
    input.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  }
  const p1 = window.__engine.player.position.asArray();
  return Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
});
check('typing in the search box does not walk the kid', moved < 0.05, `${moved.toFixed(3)} m`);

// click a card → camera flies to the prop
const flew = await peek(page, async () => {
  const el = document.getElementById('library');
  const input = el.querySelector('input');
  input.value = 'seesaw';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const card = [...el.querySelectorAll('.lib-card')].find((c) => c.style.display !== 'none' && /Seesaw_01_Top/.test(c.dataset.proto));
  card.click();
  await new Promise((r) => setTimeout(r, 400));
  const cam = window.__engine.scene.activeCamera;
  const seesaw = window.__engine.park.items.find((i) => /Seesaw_01_Top/.test(i.proto));
  return {
    closed: document.getElementById('library').classList.contains('hidden'),
    camDist: Math.hypot(cam.position.x - seesaw.pos[0], cam.position.z - seesaw.pos[2]),
  };
});
check('clicking a card closes the panel', flew.closed);
check('…and flies the camera to the prop', flew.camDist < 8, `${flew.camDist.toFixed(1)} m away`);
await shoot(page, 'library_03_flyto', { hideHud: true });

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);

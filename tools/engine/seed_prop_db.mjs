/**
 * Seed engine/assets/prop_db.json by MEASURING the real geometry.
 *
 * Devon's recurring complaint is "the character isn't sitting on the seat",
 * and the root cause was always the same: seat positions guessed from
 * bounding boxes. A bounding-box top is a dragon's horns, a car's steering
 * wheel, a bench's backrest. So this tool boots the real engine in real
 * Chrome and measures each prototype's LOCAL geometry — the same baked
 * vertex data the renderer and Havok use — so the database starts from
 * truth instead of from guesses.
 *
 * Measurements per prototype:
 *
 *   1. COLUMNS — the top surface rasterised into 10 cm cells (highest vertex
 *      per cell). This is the three.js park's proven `_saddleOf` scan, ported
 *      to prototype-local space: a saddle is the DIP along a ride-on toy's
 *      spine, between the dragon's head and its tail.
 *   2. LEVELS — horizontal planes with real area (bench planks, table
 *      benches), found by banding column tops into 2 cm bands and splitting
 *      bands that are two separate planks (a picnic table's two benches land
 *      in ONE height band; the split is what tells them apart).
 *   3. REGIONS — top / bottom surface centroids for slides, and the centroid
 *      of the tall geometry for bench-backrest facing.
 *   4. PARTS — sibling prototypes (SM_Veh_4x4_SteeringW, .._Pedal_L) give
 *      exact hand/foot anchors for free; their placements are clustered to
 *      the nearest main placement, the three.js park's clusterParts rule.
 *
 * Then per-kind rules assign clip / motion / mode, and the database is
 * written. Entries hand-marked `"authored": true` are NEVER overwritten —
 * measurement seeds the file, it does not own it.
 *
 *   node tools/engine/seed_prop_db.mjs            # writes engine/assets/prop_db.json
 *   node tools/engine/seed_prop_db.mjs --dry      # prints mounts, writes nothing
 *
 * Raw measurements land in tools/engine/_seed/measurements.json so a bad
 * seat can be debugged without re-running Chrome.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot, peek } from './probe_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DB_PATH = path.join(ROOT, 'engine/assets/prop_db.json');
const SEED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '_seed');
const DRY = process.argv.includes('--dry');

// ─── which prototypes are mountable, and how ────────────────────────────────
/**
 * Pattern → kind rules, first match wins. Patterns are ANCHORED because loose
 * patterns are the trap this project keeps paying for (/Grass/ once matched
 * the lawn).
 *
 * `clip` is an id in assets/characters/emotes/manifest.json (actions bin).
 * `status` is the honesty field: 'bespoke' when the clip was made for exactly
 * this kind of prop, 'placeholder' when a near-neighbour stands in until one
 * is baked — the gap is a number, not a vibe. `want` names the missing clip.
 * `mode`: sit (butt on seat), stand (feet on seat), hang (feet origin at
 * seat, hands pinned overhead).
 */
const RULES = [
  { re: /^SM_Env_Park_Seat_01$/, kind: 'bench', clip: 'sit', status: 'bespoke' },
  { re: /^SM_Env_Park_Table_01$/, kind: 'table', clip: 'sit_table', status: 'bespoke' },
  {
    // the hanging-tyre carousel: base + pole + crown-with-tyres. Measured
    // 3.2 x 2.2 x 3.2 with its seats on a RING 1.5 m out — a spinner, not a
    // rocker, and the generic Rocker_Top pattern below must not catch it.
    re: /^SM_Prop_Rocker_Top_01$/, kind: 'spinner', clip: 'spin_ride', status: 'bespoke',
    motion: { type: 'spin' },
  },
  {
    re: /^SM_Prop_Coin_Ride_Car$/, kind: 'coinride', clip: 'sit_coin_car', status: 'bespoke', motion: { type: 'rock', axis: 'x', amp: 0.14, hz: 0.55 },
  },
  {
    re: /^SM_Prop_Coin_Ride_Dragon$/, kind: 'coinride', clip: 'sit_dragon', status: 'bespoke', motion: { type: 'rock', axis: 'x', amp: 0.14, hz: 0.5 },
  },
  {
    re: /^SM_Prop_Coin_Ride_Rocket$/, kind: 'coinride', clip: 'sit_rocket', status: 'bespoke', motion: { type: 'rock', axis: 'x', amp: 0.12, hz: 0.6 },
  },
  {
    re: /^SM_Prop_(Playground_)?Rocker_(\d+_)?Top(_\d+)?$/, kind: 'rocker', clip: 'sit_rocker', status: 'bespoke',
    motion: { type: 'rock', axis: 'x', amp: 0.30, hz: 0.65 },
  },
  {
    re: /^SM_Prop_Playground_Seesaw_01_Top$/, kind: 'seesaw', clip: 'sit_seesaw', status: 'bespoke',
    motion: { type: 'seesaw', max: 0.34 },
  },
  {
    re: /^SM_Prop_Plaground_Swings_01_Swing_\d$/, kind: 'swing', clip: 'sit_swing', status: 'bespoke',
    motion: { type: 'swing' },   // pivot + pendulum length measured below
  },
  {
    re: /^SM_Env_Tree_Large_01_Tyre_Swing$/, kind: 'swing', clip: 'sit_tyre_swing', status: 'bespoke', motion: { type: 'swing' },
  },
  {
    re: /^SM_Prop_Playground_Slide_0\d$/, kind: 'slide', clip: 'slide_ride', status: 'bespoke',
    motion: { type: 'slide', time: 1.15 },
  },
  {
    re: /^SM_Prop_Playground_Monkey_Bars_01$/, kind: 'monkey', clip: 'monkey', status: 'bespoke',
    mode: 'hang', motion: { type: 'traverse' },
  },
  {
    re: /^SM_Prop_Playground_Track_Ride_01$/, kind: 'zip', clip: 'zip_hang', status: 'bespoke', mode: 'hang', motion: { type: 'zip' },
  },
  /**
   * WHEELED THINGS DRIVE. `motion.drive` gives the mount runtime a throttle,
   * a steering rate and a top speed; the prop and its rider are carried by
   * the same world delta every other motion type uses, so the kart moves
   * through the same thin-instance write that rocks a spring rider.
   */
  { re: /^SM_Veh_4x4$/, kind: 'kart', clip: 'sit_kart', status: 'bespoke', motion: { type: 'drive', maxSpeed: 4.6, accel: 3.6, turn: 1.7 } },
  { re: /^SM_Veh_Soapbox_Racer_03$/, kind: 'kart', clip: 'sit_kart', status: 'bespoke', motion: { type: 'drive', maxSpeed: 4.2, accel: 3.2, turn: 1.7 } },
  { re: /^SM_Veh_Bike_0\d$/, kind: 'bike', clip: 'bike_pedal', status: 'bespoke', motion: { type: 'drive', maxSpeed: 4.2, accel: 3.0, turn: 1.9, pedal: true } },
  { re: /^SM_Veh_Trike_01$/, kind: 'bike', clip: 'sit_trike', status: 'bespoke', motion: { type: 'drive', maxSpeed: 3.0, accel: 2.6, turn: 2.1, pedal: true } },
  { re: /^SM_Veh_Scooter_0\d$/, kind: 'scooter', clip: 'scoot_stand', status: 'bespoke', mode: 'stand', motion: { type: 'drive', maxSpeed: 3.8, accel: 3.0, turn: 2.0 } },
  { re: /^SM_Veh_Pogo_Stick_01$/, kind: 'pogo', clip: 'pogo', status: 'bespoke', mode: 'stand' },
  { re: /^SM_Prop_Skateboard_0\d$/, kind: 'board', clip: 'board_stand', status: 'bespoke', mode: 'stand', motion: { type: 'drive', maxSpeed: 4.4, accel: 2.6, turn: 2.2 } },
  { re: /^SM_Prop_Sled_01$/, kind: 'sit_on', clip: 'sit_sled', status: 'bespoke' },
  { re: /^SM_Prop_Red_Wagon_01$/, kind: 'sit_on', clip: 'sit_wagon', status: 'bespoke' },
  { re: /^SM_Prop_Pool_Float_0\d$/, kind: 'sit_on', clip: 'sit_float', status: 'bespoke' },
];

/** Sibling parts cluster onto this main prototype (strip the part suffix). */
const PART_MAINS = /^(SM_(?:Prop_Coin_Ride_(?:Car|Dragon|Rocket)|Veh_(?:4x4|Bike_0\d|Trike_01|Scooter_0\d|Soapbox_Racer_03)|Prop_(?:Skateboard_0\d|Red_Wagon_01|Playground_Track_Ride_01)))_(.+)$/;
const partOf = (proto) => {
  const m = proto.match(PART_MAINS);
  return m ? m[1] : null;
};

// ─── boot and measure ────────────────────────────────────────────────────────
console.log('booting the engine to measure prototypes…');
// edits:false — a reseed must measure EVERY prototype, including the shop
// inventory that map_edits.json drops from the shipping park
const { browser, page } = await boot({ headless: true, log: false, edits: false });

/**
 * All measuring happens IN the page: vertex data never crosses the puppeteer
 * boundary (typed arrays would not survive it anyway) — only compact results.
 */
const measured = await peek(page, () => {
  const CELL = 0.1;
  const out = {};
  const park = window.__engine.park;

  for (const [name, mesh] of park.protos) {
    const pos = mesh.getVerticesData('position');
    if (!pos) continue;
    /**
     * Bounds from the VERTEX DATA, not getBoundingInfo(): park.js calls
     * thinInstanceRefreshBoundingInfo, so a prototype's bounding box covers
     * every placement IN WORLD SPACE — the bench "measured" 43 m long on the
     * first run of this tool. The vertices are the local truth.
     */
    const min = { x: 1e9, y: 1e9, z: 1e9 }, max = { x: -1e9, y: -1e9, z: -1e9 };
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i] < min.x) min.x = pos[i];
      if (pos[i] > max.x) max.x = pos[i];
      if (pos[i + 1] < min.y) min.y = pos[i + 1];
      if (pos[i + 1] > max.y) max.y = pos[i + 1];
      if (pos[i + 2] < min.z) min.z = pos[i + 2];
      if (pos[i + 2] > max.z) max.z = pos[i + 2];
    }
    const dims = [max.x - min.x, max.y - min.y, max.z - min.z].map((v) => +v.toFixed(3));
    const h = dims[1];

    // 1. columns: highest vertex per 10 cm XZ cell
    const cols = new Map();
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      const k = Math.round(x / CELL) * 4096 + Math.round(z / CELL);
      const e = cols.get(k);
      if (!e) cols.set(k, { x, y, z });
      else if (y > e.y) { e.y = y; e.x = x; e.z = z; }
    }
    const columns = [...cols.values()];

    // 2. the saddle: the lowest column-top near the spine, ignoring cells that
    // only see the base plate. Ported from world/js/rides.js _saddleOf.
    const alongX = dims[0] >= dims[2];
    const cx = (min.x + max.x) / 2, cz = (min.z + max.z) / 2;
    const lateral = Math.max(0.12, Math.min(dims[0], dims[2]) * 0.22);
    const floorY = min.y + Math.max(0.12, h * 0.18);
    let saddle = null;
    for (const c of columns) {
      const off = alongX ? Math.abs(c.z - cz) : Math.abs(c.x - cx);
      if (off > lateral) continue;
      if (c.y < floorY) continue;
      if (!saddle || c.y < saddle.y) saddle = c;
    }

    // Which end is the FRONT: ride-on toys are taller at the head/nose end.
    let frontSign = 1;
    {
      let hiPos = -1e9, hiNeg = -1e9;
      for (const c of columns) {
        const a = alongX ? c.x - cx : c.z - cz;
        if (a > 0.05) hiPos = Math.max(hiPos, c.y);
        else if (a < -0.05) hiNeg = Math.max(hiNeg, c.y);
      }
      frontSign = hiPos >= hiNeg ? 1 : -1;
    }

    // 3. levels: band column tops into 2 cm bands, then split any band whose
    // cells form two lateral clusters (a picnic table's two benches share one
    // height). Keep bands with real area.
    const bands = new Map();
    for (const c of columns) {
      const b = Math.round(c.y / 0.02);
      let list = bands.get(b);
      if (!list) bands.set(b, (list = []));
      list.push(c);
    }
    const levels = [];
    for (const list of bands.values()) {
      if (list.length < 5) continue;
      // split along the minor axis on any gap >= 2 cells
      const minor = alongX ? 'z' : 'x';
      list.sort((a, b) => a[minor] - b[minor]);
      const clusters = [[list[0]]];
      for (let i = 1; i < list.length; i++) {
        if (list[i][minor] - list[i - 1][minor] > 0.22) clusters.push([]);
        clusters[clusters.length - 1].push(list[i]);
      }
      for (const cl of clusters) {
        if (cl.length < 5) continue;
        let sy = 0, sx = 0, sz = 0, mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
        for (const c of cl) {
          sy += c.y; sx += c.x; sz += c.z;
          mnx = Math.min(mnx, c.x); mxx = Math.max(mxx, c.x);
          mnz = Math.min(mnz, c.z); mxz = Math.max(mxz, c.z);
        }
        levels.push({
          y: +(sy / cl.length).toFixed(3), area: +(cl.length * CELL * CELL).toFixed(3),
          c: [+(sx / cl.length).toFixed(3), +(sz / cl.length).toFixed(3)],
          ext: [+(mxx - mnx).toFixed(3), +(mxz - mnz).toFixed(3)],
        });
      }
    }
    levels.sort((a, b) => b.area - a.area);
    levels.length = Math.min(levels.length, 8);

    // 4. regions: top/bottom centroids (slides), tall-geometry centroid (backrests)
    const region = (pred) => {
      let n = 0, sx = 0, sy = 0, sz = 0;
      for (const c of columns) if (pred(c)) { n++; sx += c.x; sy += c.y; sz += c.z; }
      return n ? [+(sx / n).toFixed(3), +(sy / n).toFixed(3), +(sz / n).toFixed(3)] : null;
    };
    const topC = region((c) => c.y > max.y - Math.max(0.25, h * 0.15));
    const lowC = region((c) => c.y < min.y + Math.max(0.25, h * 0.15));
    const hiC = region((c) => c.y > min.y + h * 0.62);

    out[name] = {
      dims,
      centre: [+((min.x + max.x) / 2).toFixed(3), +((min.y + max.y) / 2).toFixed(3), +((min.z + max.z) / 2).toFixed(3)],
      minY: +min.y.toFixed(3), maxY: +max.y.toFixed(3),
      saddle: saddle ? [+saddle.x.toFixed(3), +saddle.y.toFixed(3), +saddle.z.toFixed(3)] : null,
      alongX, frontSign, levels, topC, lowC, hiC,
      verts: pos.length / 3,
    };
  }
  return out;
});

// Placements (for clustering parts onto mains), read once.
const placements = await peek(page, () =>
  window.__engine.park.items.map((it) => ({ name: it.name, proto: it.proto, pos: it.pos, quat: it.quat })));

await browser.close();
console.log(`measured ${Object.keys(measured).length} prototypes`);

fs.mkdirSync(SEED_DIR, { recursive: true });
fs.writeFileSync(path.join(SEED_DIR, 'measurements.json'), JSON.stringify(measured, null, 1));

// ─── cluster sibling parts onto their mains ─────────────────────────────────
/** main proto -> [{proto, local}] — each part's offset in the MAIN's local frame. */
const partAnchors = new Map();
{
  const mains = placements.filter((p) => RULES.some((r) => r.re.test(p.proto)));
  for (const part of placements) {
    const mainProto = partOf(part.proto);
    if (!mainProto) continue;
    // 0.9 m, not the old 1.6: two bikes can park closer than 1.6 m apart,
    // and a pedal clustered onto the WRONG bike puts a foot target 60 cm
    // from any reachable pedal
    let best = null, bd = 0.9;
    for (const m of mains) {
      if (m.proto !== mainProto) continue;
      const d = Math.hypot(m.pos[0] - part.pos[0], m.pos[2] - part.pos[2]);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) continue;
    const [qx, qy, qz, qw] = best.quat;
    const d = [part.pos[0] - best.pos[0], part.pos[1] - best.pos[1], part.pos[2] - best.pos[2]];
    const local = qrot([-qx, -qy, -qz, qw], d).map((v) => +v.toFixed(3));
    // relative rotation main→part, so a point measured in the PART's local
    // space (a coin ride's seat lives on its _Top body) can be expressed in
    // the main's frame: p_main = anchor + qRel * p_part
    const qRel = qmul([-qx, -qy, -qz, qw], part.quat).map((v) => +v.toFixed(5));
    let list = partAnchors.get(mainProto);
    if (!list) partAnchors.set(mainProto, (list = []));
    if (!list.some((a) => a.proto === part.proto)) list.push({ proto: part.proto, local, qRel });
  }
}

/** v' = q v q* */
function qrot(q, v) {
  const [x, y, z] = v, [a, b, c, w] = q;
  const uvx = b * z - c * y, uvy = c * x - a * z, uvz = a * y - b * x;
  const uuvx = b * uvz - c * uvy, uuvy = c * uvx - a * uvz, uuvz = a * uvy - b * uvx;
  return [x + 2 * (w * uvx + uuvx), y + 2 * (w * uvy + uuvy), z + 2 * (w * uvz + uuvz)];
}
/** Hamilton product a·b, both [x,y,z,w]. */
function qmul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

// ─── build entries ───────────────────────────────────────────────────────────
const r3 = (v) => +v.toFixed(3);
const entries = {};
let mounts = 0;

for (const [proto, m] of Object.entries(measured)) {
  const rule = RULES.find((r) => r.re.test(proto));
  const entry = { kind: rule ? rule.kind : 'scenery', dims: m.dims, baseY: r3(m.minY), topY: r3(m.maxY) };
  entries[proto] = entry;
  if (!rule) continue;
  mounts++;

  const long = m.alongX ? [1, 0, 0] : [0, 0, 1];
  const yawOf = (fx, fz) => r3(Math.atan2(fx, fz));   // model forward is +Z at yaw 0
  const anchors = partAnchors.get(proto) || [];
  const anchorLike = (re) => anchors.find((a) => re.test(a.proto)) || null;
  /** Levels inside the kid-sitting band, biggest first. */
  const sitBand = (mm, lo = 0.25, hi = 0.8) =>
    mm.levels.filter((l) => l.y > mm.minY + mm.dims[1] * lo && l.y < mm.minY + mm.dims[1] * hi);

  let seat = null;
  let seatStatus = 'measured';

  switch (rule.kind) {
    case 'bench': {
      // the plank: biggest flat band at sitting height
      const lvl = m.levels.find((l) => l.y > 0.15 && l.y < 0.85);
      if (lvl) {
        // face AWAY from the backrest (the tall geometry)
        let yaw = 0;
        if (m.hiC) {
          const bx = lvl.c[0] - m.hiC[0], bz = lvl.c[1] - m.hiC[2];
          // project onto the minor axis so the facing is square to the plank
          yaw = m.alongX ? yawOf(0, Math.sign(bz) || 1) : yawOf(Math.sign(bx) || 1, 0);
        }
        seat = { pos: [lvl.c[0], lvl.y, lvl.c[1]], yaw };
        entry.seatSpan = { axis: m.alongX ? 'x' : 'z', half: r3(Math.max(0, Math.max(...lvl.ext) / 2 - 0.18)) };
      }
      break;
    }
    case 'table': {
      // two benches flank a higher top; the band split finds each plank
      const top = m.levels[0];
      const planks = m.levels.filter((l) => l !== top && l.y < top.y - 0.08 && l.y > 0.15 && l.area > 0.1);
      if (planks.length) {
        const p = planks[0];
        const latOff = m.alongX ? p.c[1] : p.c[0];
        seat = {
          pos: [p.c[0], p.y, p.c[1]],
          yaw: m.alongX ? yawOf(0, -Math.sign(latOff) || 1) : yawOf(-Math.sign(latOff) || 1, 0),
        };
        entry.seatSpan = { axis: m.alongX ? 'x' : 'z', half: r3(Math.max(0, Math.max(...p.ext) / 2 - 0.22)) };
        entry.tableSides = { axis: m.alongX ? 'z' : 'x', off: r3(latOff) };  // mirror across 0 for the other bench
      }
      break;
    }
    case 'swing': {
      // seat = the lowest level with real area (plank top / tyre top);
      // pivot = the bar the chains reach up to = the prototype's own top
      const low = m.levels.filter((l) => l.y < m.minY + m.dims[1] * 0.5)
        .sort((a, b) => a.y - b.y)[0];
      const sy = low ? low.y : m.minY + 0.04;
      const scx = low ? low.c[0] : m.centre[0];
      const scz = low ? low.c[1] : m.centre[2];
      seat = { pos: [scx, sy, scz], yaw: m.alongX ? 0 : Math.PI / 2 };  // face across the plank
      entry.motion = { type: 'swing', pivotY: r3(m.maxY), length: r3(m.maxY - sy) };
      break;
    }
    case 'slide': {
      // sit at the chute's top mouth, ride to the bottom mouth
      if (m.topC && m.lowC) {
        seat = { pos: [m.topC[0], m.topC[1], m.topC[2]], yaw: yawOf(m.lowC[0] - m.topC[0], m.lowC[2] - m.topC[2]) };
        entry.motion = {
          type: 'slide', time: rule.motion.time,
          to: [r3(m.lowC[0]), r3(m.lowC[1]), r3(m.lowC[2])],
          path: 'straight', pathStatus: 'approx',   // a spiral chute needs waypoints; be honest
        };
      }
      break;
    }
    case 'monkey': {
      // hang below the bar line: bars run along the long axis at the top
      const barY = m.maxY - 0.04;
      seat = { pos: [m.centre[0], r3(barY - 1.15), m.centre[2]], yaw: yawOf(long[0], long[2]) };
      entry.hands = [
        [r3(m.centre[0] - 0.14 * long[2] + 0.18 * long[0]), r3(barY), r3(m.centre[2] - 0.14 * long[0] + 0.18 * long[2])],
        [r3(m.centre[0] + 0.14 * long[2] + 0.18 * long[0]), r3(barY), r3(m.centre[2] + 0.14 * long[0] + 0.18 * long[2])],
      ];
      entry.motion = { type: 'traverse', axis: m.alongX ? 'x' : 'z', half: r3(m.dims[m.alongX ? 0 : 2] / 2 - 0.35), y: r3(barY) };
      break;
    }
    case 'zip': {
      // hang from the trolley handle; the handle is its own prototype
      const handle = anchorLike(/Handle/);
      const hy = handle ? handle.local[1] : m.maxY - 0.3;
      const hx = handle ? handle.local[0] : m.centre[0];
      const hz = handle ? handle.local[2] : m.centre[2];
      seat = { pos: [r3(hx), r3(hy - 1.15), r3(hz)], yaw: yawOf(long[0], long[2]) };
      entry.hands = [
        [r3(hx - 0.12 * long[2]), r3(hy - 0.05), r3(hz - 0.12 * long[0])],
        [r3(hx + 0.12 * long[2]), r3(hy - 0.05), r3(hz + 0.12 * long[0])],
      ];
      entry.motion = { type: 'zip', axis: m.alongX ? 'x' : 'z', half: r3(m.dims[m.alongX ? 0 : 2] / 2 - 0.4), y: r3(hy) };
      break;
    }
    case 'coinride': {
      /**
       * The main prototype is only the PEDESTAL — the rideable body (dragon,
       * car shell, rocket) is the `_Top` sibling, so the seat is measured on
       * the Top's geometry and expressed back in the main's frame through the
       * part anchor. Straddle bodies (dragon) keep the saddle dip; sit-in
       * bodies (car, rocket) take the sit-band level nearest the body centre,
       * because their saddle scan finds the FOOTWELL.
       */
      const topAnchor = anchorLike(/_Top$/);
      const tm = topAnchor ? measured[topAnchor.proto] : null;
      if (tm) {
        let sTop = null;
        const bandLo = tm.minY + tm.dims[1] * 0.25, bandHi = tm.minY + tm.dims[1] * 0.75;
        if (tm.saddle && tm.saddle[1] > bandLo && tm.saddle[1] < bandHi) {
          sTop = tm.saddle;
        } else {
          const inBand = tm.levels.filter((l) => l.y > bandLo && l.y < bandHi);
          inBand.sort((a, b) => Math.hypot(a.c[0], a.c[1]) - Math.hypot(b.c[0], b.c[1]));
          if (inBand[0]) sTop = [inBand[0].c[0], inBand[0].y, inBand[0].c[1]];
        }
        if (sTop) {
          const p = qrot(topAnchor.qRel, sTop);
          const pos = [r3(p[0] + topAnchor.local[0]), r3(p[1] + topAnchor.local[1]), r3(p[2] + topAnchor.local[2])];
          // face the steering wheel if there is one, else the Top's tall end
          const wheel = anchorLike(/SteeringW/);
          const yaw = wheel
            ? yawOf(wheel.local[0] - pos[0], wheel.local[2] - pos[2])
            : yawOf(long[0] * tm.frontSign, long[2] * tm.frontSign);
          seat = { pos, yaw };
        }
      }
      entry.motion = { ...rule.motion };
      // the body rocks about the joint where it meets the pedestal — the
      // Top part's own origin, which Unity put at the mount point
      if (topAnchor) entry.motion.pivot = topAnchor.local.map(r3);
      break;
    }
    case 'kart': {
      // sit-in vehicles: the saddle scan finds the footwell; the seat is the
      // HIGHEST sit-band level with real area (the bench pan)
      const pans = sitBand(m).filter((l) => l.area >= 0.1).sort((a, b) => b.y - a.y);
      if (pans[0]) {
        const wheel = anchorLike(/SteeringW/);
        const pos = [pans[0].c[0], pans[0].y, pans[0].c[1]];
        const yaw = wheel
          ? yawOf(wheel.local[0] - pos[0], wheel.local[2] - pos[2])
          : yawOf(long[0] * m.frontSign, long[2] * m.frontSign);
        seat = { pos, yaw };
      }
      break;
    }
    case 'bike': {
      // straddle the frame's own saddle, face the handlebars
      if (m.saddle) {
        const bars = anchorLike(/Handlebars/);
        const yaw = bars
          ? yawOf(bars.local[0] - m.saddle[0], bars.local[2] - m.saddle[2])
          : yawOf(long[0] * m.frontSign, long[2] * m.frontSign);
        seat = { pos: m.saddle.map(r3), yaw };
      }
      break;
    }
    case 'scooter': case 'board': {
      // stand on the deck: the biggest level IS the deck
      const deck = m.levels[0];
      if (deck) {
        const bars = anchorLike(/Handlebars/);
        const pos = [deck.c[0], deck.y, deck.c[1]];
        const yaw = bars
          ? yawOf(bars.local[0] - pos[0], bars.local[2] - pos[2])
          : yawOf(long[0] * m.frontSign, long[2] * m.frontSign);
        seat = { pos, yaw };
        // feet fore/aft along the deck
        const f = [Math.sin(yaw), 0, Math.cos(yaw)];
        entry.feet = [
          [r3(pos[0] + f[0] * 0.16), r3(pos[1]), r3(pos[2] + f[2] * 0.16)],
          [r3(pos[0] - f[0] * 0.16), r3(pos[1]), r3(pos[2] - f[2] * 0.16)],
        ];
      }
      break;
    }
    case 'pogo': {
      // stand on the pegs, hands on the T-bar at the top
      if (m.saddle) {
        seat = { pos: m.saddle.map(r3), yaw: yawOf(long[0], long[2]) };
        const gy = m.maxY - 0.03;
        entry.hands = m.alongX
          ? [[r3(m.centre[0] - 0.13), r3(gy), r3(m.centre[2])], [r3(m.centre[0] + 0.13), r3(gy), r3(m.centre[2])]]
          : [[r3(m.centre[0]), r3(gy), r3(m.centre[2] - 0.13)], [r3(m.centre[0]), r3(gy), r3(m.centre[2] + 0.13)]];
      }
      break;
    }
    case 'sit_on': {
      // sit IN the tray/float: the lowest level with real area
      const tray = m.levels.filter((l) => l.area >= 0.08).sort((a, b) => a.y - b.y)[0];
      if (tray) seat = { pos: [tray.c[0], tray.y, tray.c[1]], yaw: yawOf(long[0] * m.frontSign, long[2] * m.frontSign) };
      break;
    }
    case 'spinner': {
      /**
       * The tyre carousel: seats hang on a RING around the pole. The ring
       * radius/height come off the saddle scan (it lands on one tyre); the
       * per-seat angles need eyes, so this is marked for review rather than
       * pretending precision the scan does not have.
       */
      if (m.saddle) {
        const r = Math.hypot(m.saddle[0] - m.centre[0], m.saddle[2] - m.centre[2]);
        entry.ring = { centre: [r3(m.centre[0]), r3(m.centre[2])], r: r3(r), y: r3(m.saddle[1]), seats: 3 };
        seat = { pos: m.saddle.map(r3), yaw: 0 };   // per-seat yaw faces outward at runtime
        seatStatus = 'review';
      }
      entry.motion = { ...rule.motion };
      break;
    }
    case 'seesaw': {
      // the plank: riders sit at the two ends; seat here is the centre
      // reference at pad height, seatSpan gives the ends
      const padY = m.saddle ? m.saddle[1] : m.maxY - 0.05;
      seat = { pos: [r3(m.centre[0]), r3(padY), r3(m.centre[2])], yaw: 0 };  // per-end yaw at runtime
      entry.motion = { ...rule.motion };
      entry.seatSpan = { axis: m.alongX ? 'x' : 'z', half: r3(m.dims[m.alongX ? 0 : 2] * 0.39) };
      break;
    }
    default: {
      if (m.saddle) seat = { pos: m.saddle.map(r3), yaw: yawOf(long[0] * m.frontSign, long[2] * m.frontSign) };
      if (rule.motion) entry.motion = { ...rule.motion };
      break;
    }
  }

  if (!seat) {
    seat = { pos: [m.centre[0], m.maxY, m.centre[2]], yaw: 0 };
    seatStatus = 'unmeasured';
  }
  /**
   * Carry the rule's motion across for kinds whose case above did not build
   * one of its own. Only the `default` branch used to do this, so the four
   * WHEELED kinds — which have explicit cases for their seats — silently
   * shipped with no motion at all and nothing could be driven.
   */
  if (rule.motion && !entry.motion) entry.motion = { ...rule.motion };

  entry.mode = rule.mode || 'sit';
  entry.seat = { pos: seat.pos.map(r3), yaw: r3(seat.yaw) };
  if (seatStatus !== 'measured') entry.seatStatus = seatStatus;
  entry.clip = rule.clip;
  entry.clipStatus = rule.status;
  if (rule.want) entry.wantClip = rule.want;

  /**
   * Motion geometry the runtime should not have to guess: `pivot` (the point
   * the delta rotates about, mount-local) and `axisV` (the axis, mount-local).
   * The rocking axis is the rider's SIDE axis — a rocking horse pitches
   * forward/back — which falls out of the seat yaw rather than being authored
   * per prop.
   */
  if (entry.motion) {
    const side = [r3(Math.cos(entry.seat.yaw)), 0, r3(-Math.sin(entry.seat.yaw))];
    switch (entry.motion.type) {
      case 'rock':
        if (!entry.motion.pivot) entry.motion.pivot = [entry.seat.pos[0], r3(m.minY + 0.04), entry.seat.pos[2]];
        entry.motion.axisV = side;
        break;
      case 'swing':
        entry.motion.pivot = [entry.seat.pos[0], entry.motion.pivotY, entry.seat.pos[2]];
        entry.motion.axisV = side;
        break;
      case 'seesaw':
        entry.motion.pivot = [r3(m.centre[0]), r3((m.saddle ? m.saddle[1] : m.maxY) - 0.08), r3(m.centre[2])];
        entry.motion.axisV = entry.seatSpan && entry.seatSpan.axis === 'x' ? [0, 0, 1] : [1, 0, 0];
        break;
      case 'spin':
        entry.motion.pivot = [r3(m.centre[0]), 0, r3(m.centre[2])];
        entry.motion.axisV = [0, 1, 0];
        break;
      default: break;    // slide / zip / traverse carry their own path fields
    }
  }

  // ── parts: exact anchors where they exist ──
  if (anchors.length) {
    entry.parts = anchors.map((a) => a.proto);
    // moving group for rocking rides: everything except the coin stand
    if (rule.kind === 'coinride') entry.moving = anchors.map((a) => a.proto).filter((p) => !/CoinStand/.test(p));
    const wheel = anchorLike(/SteeringW|Handlebars/);
    if (wheel && !entry.hands) {
      const wm = measured[wheel.proto];
      const gripY = wheel.local[1] + (wm ? wm.maxY * 0.7 : 0.02);
      entry.hands = [
        [r3(wheel.local[0] - 0.14), r3(gripY), r3(wheel.local[2])],
        [r3(wheel.local[0] + 0.14), r3(gripY), r3(wheel.local[2])],
      ];
    }
    const pl = anchorLike(/Pedal_L/);
    const pr = anchorLike(/Pedal_R/);
    if (pl && pr && !entry.feet) entry.feet = [pl.local.map(r3), pr.local.map(r3)];
  }

  // ── kind-default hands where nothing measured them ──
  if (!entry.hands) {
    const [sx, sy, sz] = entry.seat.pos;
    const fwd = [Math.sin(entry.seat.yaw), 0, Math.cos(entry.seat.yaw)];
    const side = [fwd[2], 0, -fwd[0]];
    const at = (f, s, up) => [
      r3(sx + fwd[0] * f + side[0] * s), r3(sy + up), r3(sz + fwd[2] * f + side[2] * s)];
    switch (rule.kind) {
      case 'rocker': case 'coinride':
        entry.hands = [at(0.22, -0.10, 0.28), at(0.22, 0.10, 0.28)]; break;
      case 'swing':
        // chest height, out at the chains — +0.52 put the grips at ear level
        // and the gallery showed a kid clutching air beside their face
        entry.hands = [at(0, -0.26, 0.38), at(0, 0.26, 0.38)]; break;
      case 'seesaw':
        entry.hands = [at(0.24, -0.07, 0.16), at(0.24, 0.07, 0.16)]; break;
      default: break;                        // bench/table/etc: the clip's own pose
    }
  }
}

// ─── merge with the existing database ───────────────────────────────────────
let db = {};
if (fs.existsSync(DB_PATH)) db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
let kept = 0, written = 0;
for (const [proto, entry] of Object.entries(entries)) {
  const cur = db[proto];
  if (cur && cur.authored) { kept++; continue; }   // hand-tuned truth outranks the seeder
  db[proto] = entry;
  written++;
}
db._meta = {
  version: 1,
  seeded: new Date().toISOString().slice(0, 10),
  tool: 'tools/engine/seed_prop_db.mjs',
  note: 'entries with "authored": true are never overwritten by the seeder',
  space: 'prototype-local, right-handed, metres — transformed by the placement matrix at runtime',
};

const withSeat = Object.values(db).filter((e) => e && e.seat);
const bespoke = withSeat.filter((e) => e.clipStatus === 'bespoke').length;
const placeholder = withSeat.filter((e) => e.clipStatus === 'placeholder').length;
console.log(`\n${Object.keys(entries).length} prototypes → ${mounts} mountable`);
console.log(`clip coverage: ${bespoke} bespoke, ${placeholder} placeholder (the gap, as a number)`);
console.log(`merge: ${written} written, ${kept} kept (authored)`);

if (DRY) {
  console.log(JSON.stringify(Object.fromEntries(
    Object.entries(db).filter(([, v]) => v && v.seat)), null, 1));
} else {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 1));
  console.log('wrote', path.relative(ROOT, DB_PATH));
}

/**
 * Generate the committed map edits + the shop catalogue.
 *
 * Devon's call (2026-08-01): every rideable thing comes OFF the map and
 * becomes shop inventory — kids will earn coins doing schoolwork and buy a
 * bike or a jeep to ride where other kids can see it. The park ships EMPTY
 * of them so owning one means something. NOTHING here is deleted: the
 * prop_db entries, the drive motion and probe_drive all stay, because they
 * are inventory waiting for a shop.
 *
 * Emits two files, both committed:
 *
 *   engine/assets/map_edits.json   placements the engine drops at load, one
 *                                  row per placement, tagged with the
 *                                  catalogue item it belongs to — delete a
 *                                  row and that placement comes back
 *   engine/assets/catalogue.json   the 14 buyable items: prototype, display
 *                                  name, and the attached-part assembly
 *                                  (each part's transform RELATIVE to the
 *                                  vehicle) measured off the real map
 *                                  placements before they were removed —
 *                                  the data a shop spawner needs and the
 *                                  map would otherwise have carried
 *
 * The part list comes from the placement NAME PREFIX, not prop_db's `parts`
 * arrays — the map assembles Bike_02 with Bike_01's pedal/peg/badge
 * prototypes and Scooter_02 out of Scooter_01 parts, so the db lists
 * under-count what actually sits on a vehicle (measured: prefix rule finds
 * all 80 part placements, the db lists reach 65).
 *
 *   node tools/engine/gen_map_edits.mjs          # writes both files
 *   node tools/engine/gen_map_edits.mjs --dry    # prints, writes nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'world/assets/park_layout.json'), 'utf8'));
const DRY = process.argv.includes('--dry');

/** The 14 buyable items. Display names are shop placeholders — Devon names the shop. */
const CATALOGUE = [
  { id: 'jeep',            proto: 'SM_Veh_4x4',             name: 'Jeep' },
  { id: 'gokart',          proto: 'SM_Veh_Soapbox_Racer_03', name: 'Go-Kart' },
  { id: 'bike_pink',       proto: 'SM_Veh_Bike_01',          name: 'Pink Bike' },
  { id: 'bike_bmx',        proto: 'SM_Veh_Bike_02',          name: 'BMX Bike' },
  { id: 'trike',           proto: 'SM_Veh_Trike_01',         name: 'Trike' },
  { id: 'scooter',         proto: 'SM_Veh_Scooter_01',       name: 'Green Scooter' },
  { id: 'scooter_kick',    proto: 'SM_Veh_Scooter_02',       name: 'Kick Scooter' },
  { id: 'skateboard',      proto: 'SM_Prop_Skateboard_01',   name: 'Cruiser Skateboard' },
  { id: 'skateboard_street', proto: 'SM_Prop_Skateboard_02', name: 'Street Skateboard' },
  { id: 'pogo',            proto: 'SM_Veh_Pogo_Stick_01',    name: 'Pogo Stick' },
  { id: 'sled',            proto: 'SM_Prop_Sled_01',         name: 'Sled' },
  { id: 'wagon',           proto: 'SM_Prop_Red_Wagon_01',    name: 'Red Wagon' },
  { id: 'float_unicorn',   proto: 'SM_Prop_Pool_Float_01',   name: 'Unicorn Float' },
  { id: 'float_dragon',    proto: 'SM_Prop_Pool_Float_02',   name: 'Dragon Float' },
];

const items = layout.items.map((row) => ({ name: row.n, proto: layout.protos[row.m], pos: row.p, quat: row.q, scale: row.s }));
const tagOf = (it) => it.name + '@' + it.pos.map((n) => n.toFixed(2)).join(',');
const bases = CATALOGUE.map((c) => c.proto);
const byProto = (p) => CATALOGUE.find((c) => c.proto === p);

const vehicles = items.filter((it) => bases.includes(it.proto));
const parts = items.filter((it) => !bases.includes(it.proto) && bases.some((b) => it.proto.startsWith(b + '_')));

// every placement in play must be unit scale — relative transforms below assume it
for (const it of [...vehicles, ...parts]) {
  if (it.scale.some((s) => Math.abs(s - 1) > 1e-3)) throw new Error('non-unit scale on ' + it.name);
}

// ── cluster: each part joins its nearest vehicle (measured max is < 1.0 m) ──
const clusters = new Map(vehicles.map((v) => [v, []]));
for (const p of parts) {
  let best = null, bd = Infinity;
  for (const v of vehicles) {
    const d = Math.hypot(p.pos[0] - v.pos[0], p.pos[1] - v.pos[1], p.pos[2] - v.pos[2]);
    if (d < bd) { bd = d; best = v; }
  }
  if (bd > 1.5) throw new Error(`part ${p.name} is ${bd.toFixed(2)} m from any vehicle — clustering is wrong`);
  clusters.get(best).push(p);
}

// ── quaternion helpers (glTF [x,y,z,w], same convention as the layout) ──────
const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qRot = (q, v) => {
  const p = qMul(qMul(q, [v[0], v[1], v[2], 0]), qConj(q));
  return [p[0], p[1], p[2]];
};

// ── the removal list: one row per placement, labelled with its item ─────────
const removed = [];
for (const v of vehicles) {
  const item = byProto(v.proto).id;
  removed.push({ item, tag: tagOf(v) });
  for (const p of clusters.get(v)) removed.push({ item, tag: tagOf(p) });
}

// ── the catalogue: assembly measured off the FIRST placement of each item ───
const round = (n) => +n.toFixed(4);
const catalogueItems = CATALOGUE.map((c) => {
  const placed = vehicles.filter((v) => v.proto === c.proto);
  const v = placed[0];
  const assembly = clusters.get(v).map((p) => ({
    proto: p.proto,
    // part transform in the VEHICLE'S local frame, so a shop spawner can
    // place the vehicle anywhere and reassemble it exactly as the map did
    pos: qRot(qConj(v.quat), [p.pos[0] - v.pos[0], p.pos[1] - v.pos[1], p.pos[2] - v.pos[2]]).map(round),
    quat: qMul(qConj(v.quat), p.quat).map(round),
  })).sort((a, b) => a.proto.localeCompare(b.proto));
  // sanity: every placement of this prototype should carry the same part set
  for (const other of placed.slice(1)) {
    const a = clusters.get(other).map((p) => p.proto).sort().join();
    const b = assembly.map((p) => p.proto).join();
    if (a !== b) console.warn(`  WARN ${c.proto}: placements disagree on parts\n    ${b}\n    ${a}`);
  }
  return { ...c, placements: placed.length, parts: assembly };
});

const mapEdits = {
  map: 'park',
  why: 'rideables are shop inventory (engine/assets/catalogue.json) — the park ships empty of them so owning one means something. Delete a row to put that placement back.',
  generatedBy: 'tools/engine/gen_map_edits.mjs',
  removed,
};
const catalogue = {
  why: 'the 14 buyable rideables, with the attached-part assembly measured off the map placements that map_edits.json removes. Mount data (seat/clip/pins/motion) stays in prop_db.json under each proto key.',
  generatedBy: 'tools/engine/gen_map_edits.mjs',
  items: catalogueItems,
};

console.log(`${vehicles.length} vehicle placements + ${parts.length} part placements = ${removed.length} removals`);
console.log(`catalogue: ${catalogueItems.length} items`);
for (const c of catalogueItems) console.log(`  ${c.id.padEnd(18)} ${c.proto.padEnd(26)} x${c.placements}  ${c.parts.length} parts`);

if (removed.length !== 98) throw new Error(`expected 98 removals, got ${removed.length}`);

if (!DRY) {
  fs.writeFileSync(path.join(ROOT, 'engine/assets/map_edits.json'), JSON.stringify(mapEdits, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'engine/assets/catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n');
  console.log('\nwrote engine/assets/map_edits.json + engine/assets/catalogue.json');
}

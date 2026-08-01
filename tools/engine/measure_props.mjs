/**
 * Measure prop geometry for AUTHORING prop_db entries — the anti-guess tool.
 *
 * For each requested prototype: pulls the real baked vertex data of the main
 * mesh AND its part meshes, transforms everything into the MAIN prototype's
 * local frame (the frame seat/hands/pins are authored in), and prints the
 * numbers a human needs to place a butt and two hands: column rasters over a
 * region, part centroids/bounds, and — for the spiral slide — a per-height
 * angular sweep of the chute.
 *
 * Writes tools/engine/_seed/measure_<proto>.json and, with --shoot, mounts
 * the prop and saves close-up shots to _shots/fix/ for eyes.
 *
 *   node tools/engine/measure_props.mjs Coin_Ride_Car Red_Wagon --shoot
 *   node tools/engine/measure_props.mjs Slide_05 --slide     # helix sweep
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot, peek, settle, SHOT_DIR } from './probe_lib.mjs';

const SEED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '_seed');
const FIX_DIR = path.join(SHOT_DIR, 'fix');
fs.mkdirSync(SEED_DIR, { recursive: true });
fs.mkdirSync(FIX_DIR, { recursive: true });

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SHOOT = process.argv.includes('--shoot');
const SLIDE = process.argv.includes('--slide');
if (!args.length) { console.error('usage: measure_props.mjs <protoSubstring>… [--shoot] [--slide]'); process.exit(1); }

const { browser, page } = await boot({ headless: true, log: false, edits: false });

for (const pat of args) {
  const data = await peek(page, (pattern, slide) => {
    const e = window.__engine;
    // find the main placement via the prop database (a mountable spot)
    const spot = e.props.find(pattern)[0];
    if (!spot) return { error: 'no spot matches ' + pattern };
    const main = spot.item;
    const db = e.props.db[main.proto];

    // world→main-local
    const inv = main.matrix.clone();
    inv.invert();

    /** every vertex of a placement's prototype, transformed into main-local */
    const localVerts = (it) => {
      const src = it.mesh.getVerticesData('position');
      const M = it.matrix.multiply(inv);       // part-local → world → main-local
      const m = M.m;
      const out = [];
      for (let i = 0; i < src.length; i += 3) {
        const x = src[i], y = src[i + 1], z = src[i + 2];
        out.push([
          x * m[0] + y * m[4] + z * m[8] + m[12],
          x * m[1] + y * m[5] + z * m[9] + m[13],
          x * m[2] + y * m[6] + z * m[10] + m[14],
        ]);
      }
      return out;
    };

    const pieces = [{ name: main.proto, verts: localVerts(main) }];
    for (const p of spot.parts) pieces.push({ name: p.proto, verts: localVerts(p) });

    const summary = (verts) => {
      let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9], c = [0, 0, 0];
      for (const v of verts) for (let k = 0; k < 3; k++) {
        if (v[k] < min[k]) min[k] = v[k];
        if (v[k] > max[k]) max[k] = v[k];
        c[k] += v[k] / verts.length;
      }
      const r = (n) => +n.toFixed(3);
      return { min: min.map(r), max: max.map(r), centroid: c.map(r), count: verts.length };
    };

    const out = {
      proto: main.proto,
      entry: db,
      placement: { pos: main.pos, quat: main.quat },
      pieces: pieces.map((p) => ({ name: p.name, ...summary(p.verts) })),
    };

    // 10 cm column raster of ALL pieces combined (top surface heights)
    const all = pieces.flatMap((p) => p.verts);
    const cols = new Map();
    for (const [x, y, z] of all) {
      const k = Math.round(x * 10) + ',' + Math.round(z * 10);
      if (!cols.has(k) || cols.get(k) < y) cols.set(k, y);
    }
    out.columns = [...cols.entries()]
      .map(([k, y]) => ({ x: +(+k.split(',')[0] / 10).toFixed(1), z: +(+k.split(',')[1] / 10).toFixed(1), top: +y.toFixed(3) }))
      .sort((a, b) => a.z - b.z || a.x - b.x);

    if (slide) {
      /**
       * THE HELIX SWEEP. Horizontal bands of 10 cm; in each, cluster vertex
       * angles about the vertical axis through the tower pole and report the
       * dominant cluster's circular-mean angle, mean radius, and y-extent.
       * The pole is the (x,z) cell that appears across nearly every band.
       */
      const bands = new Map();
      for (const [x, y, z] of all) {
        const b = Math.floor(y / 0.1);
        if (!bands.has(b)) bands.set(b, []);
        bands.get(b).push([x, y, z]);
      }
      // pole: average of per-band centroids of small-radius verts — first pass
      // uses the overall centroid as a crude axis
      const c0 = summary(all).centroid;
      out.slide = [...bands.keys()].sort((a, b) => b - a).map((b) => {
        const vs = bands.get(b);
        // histogram angles in 10° bins about (c0.x, c0.z)
        const bins = new Map();
        for (const [x, , z] of vs) {
          const th = Math.atan2(x - c0[0], z - c0[2]);
          const bin = Math.round(th / (Math.PI / 18));
          bins.set(bin, (bins.get(bin) || 0) + 1);
        }
        const hist = [...bins.entries()].sort((p, q) => q[1] - p[1]);
        // dominant contiguous cluster: take bins within 3 of the top bin
        const top = hist[0][0];
        const near = (a, b2) => Math.min(Math.abs(a - b2), 36 - Math.abs(a - b2)) <= 3;
        let sx = 0, sy2 = 0, n = 0, rr = 0;
        for (const [x, , z] of vs) {
          const th = Math.atan2(x - c0[0], z - c0[2]);
          const bin = Math.round(th / (Math.PI / 18));
          if (!near(bin, top)) continue;
          sx += Math.sin(th); sy2 += Math.cos(th); n++;
          rr += Math.hypot(x - c0[0], z - c0[2]);
        }
        const meanTh = Math.atan2(sx / n, sy2 / n);
        return {
          y: +(b * 0.1 + 0.05).toFixed(2),
          verts: vs.length,
          clusterFrac: +(n / vs.length).toFixed(2),
          theta: +meanTh.toFixed(3),
          thetaDeg: +(meanTh * 180 / Math.PI).toFixed(0),
          radius: +(rr / n).toFixed(3),
        };
      });
      out.axisGuess = c0;
    }
    return out;
  }, pat, SLIDE);

  if (data.error) { console.log('!!', data.error); continue; }
  const file = path.join(SEED_DIR, 'measure_' + data.proto + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
  console.log(`\n=== ${data.proto} → ${path.relative(process.cwd(), file)}`);
  for (const p of data.pieces) {
    console.log(`  ${p.name.padEnd(40)} n=${String(p.count).padStart(5)}  min ${p.min}  max ${p.max}  c ${p.centroid}`);
  }
  if (data.slide) {
    console.log('  helix sweep (top→bottom):');
    for (const b of data.slide) console.log(`    y=${b.y}  θ=${String(b.thetaDeg).padStart(4)}°  r=${b.radius}  frac=${b.clusterFrac}  n=${b.verts}`);
  }

  if (SHOOT) {
    // mount it and take two close-ups: front three-quarter and side-on
    const pos = await peek(page, async (pattern) => {
      const e = window.__engine;
      if (e.props.active) e.props.dismount();
      const spot = e.props.find(pattern)[0];
      spot.taken = false;
      e.tp(spot.pos[0] + 0.8, spot.pos[2] + 0.8, Math.max(spot.pos[1] + 1.2, 1.2));
      await new Promise((r) => setTimeout(r, 350));
      await e.props.mount(spot);
      await new Promise((r) => setTimeout(r, 1200));
      const p = e.player.model.position;
      const yaw = e.player.model.rotationQuaternion ? Math.atan2(
        2 * (e.player.model.rotationQuaternion.x * e.player.model.rotationQuaternion.z + e.player.model.rotationQuaternion.w * e.player.model.rotationQuaternion.y),
        1 - 2 * (e.player.model.rotationQuaternion.x ** 2 + e.player.model.rotationQuaternion.y ** 2)) : 0;
      return [p.x, p.y, p.z, yaw];
    }, pat);
    const name = data.proto.replace(/^SM_(Prop|Env|Veh)_/, '').toLowerCase();
    // front three-quarter: from where the rider is FACING, slightly to the side
    await peek(page, (p) => window.__engine.look(
      [p[0] + Math.sin(p[3] + 0.6) * 2.2, p[1] + 1.1, p[2] + Math.cos(p[3] + 0.6) * 2.2],
      [p[0], p[1] + 0.55, p[2]]), pos);
    await settle(page, 350);
    await page.screenshot({ path: path.join(FIX_DIR, name + '_front.png') });
    // side-on
    await peek(page, (p) => window.__engine.look(
      [p[0] + Math.sin(p[3] + Math.PI / 2) * 2.4, p[1] + 0.75, p[2] + Math.cos(p[3] + Math.PI / 2) * 2.4],
      [p[0], p[1] + 0.5, p[2]]), pos);
    await settle(page, 350);
    await page.screenshot({ path: path.join(FIX_DIR, name + '_side.png') });
    await peek(page, () => window.__engine.props.dismount());
    console.log(`  shots → _shots/fix/${name}_front.png, _side.png`);
  }
}

await browser.close();

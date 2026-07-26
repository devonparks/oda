/**
 * Where do kids actually SIT on the remaining props? Measures the real
 * geometry of the coin rides, the spring riders and a picnic table so the
 * mounts and the clips can be authored against numbers instead of guesses.
 */
import { bootWorld } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });

const res = await page.evaluate(() => {
  const W = window.__world.world, T = window.__world.THREE, rides = window.__world.state.rides;
  const v = new T.Vector3();

  /** y-histogram of a whole object's world verts; returns bins + total. */
  const slabs = (root, bin = 0.08) => {
    const hist = new Map();
    let n = 0, cx = 0, cz = 0, minY = 9, maxY = -9;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        n++; cx += v.x; cz += v.z;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
        const k = Math.floor(v.y / bin);
        let e = hist.get(k);
        if (!e) hist.set(k, (e = { n: 0, sx: 0, sz: 0 }));
        e.n++; e.sx += v.x; e.sz += v.z;
      }
    });
    const bins = [...hist.entries()].sort((a, b) => b[0] - a[0]).map(([k, e]) => ({
      y: +((k + 1) * bin).toFixed(2), n: e.n,
      x: +(e.sx / e.n).toFixed(2), z: +(e.sz / e.n).toFixed(2),
    }));
    return { total: n, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), bins };
  };

  const out = { coinRides: [], rockers: [], table: null };

  for (const it of rides.coinRides) {
    const s = slabs(it.group);
    out.coinRides.push({
      pos: [+it.group.position.x.toFixed(1), +it.group.position.z.toFixed(1)],
      deckNow: +it.deck.toFixed(2),
      groundY: +W.collision.groundAt(it.group.position.x, it.group.position.z, it.group.position.y + 0.6).toFixed(2),
      spanY: [s.minY, s.maxY],
      // top-down: the first band from the top holding >=6% of the verts
      topBands: s.bins.slice(0, 14).map((b) => ({ ...b, pct: +(b.n / s.total * 100).toFixed(1) })),
    });
  }

  for (const m of rides.rockers) {
    const s = slabs(m);
    out.rockers.push({
      pos: [+m.position.x.toFixed(1), +m.position.z.toFixed(1)],
      mountNow: +(m.position.y + 0.5).toFixed(2),
      spanY: [s.minY, s.maxY],
      topBands: s.bins.slice(0, 10).map((b) => ({ ...b, pct: +(b.n / s.total * 100).toFixed(1) })),
    });
  }

  // ── picnic table: tabletop height, seat plank top, seat offsets ──
  {
    let mesh = null;
    W.shell.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    const seat = rides.zones.find((z) => z.ride === 'tableseat');
    const t = seat.spot;
    const pos = mesh.geometry.attributes.position;
    const m = mesh.matrixWorld;
    // everything within 1.6 m of the table centre
    let topY = -9, seatTop = -9, seatBandN = 0;
    const bandHist = new Map();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (Math.hypot(v.x - t.tx, v.z - t.tz) > 1.6) continue;
      if (v.y > topY) topY = v.y;
      const k = Math.round(v.y * 20) / 20;
      bandHist.set(k, (bandHist.get(k) || 0) + 1);
    }
    // the seat plank: highest surface at least 15 cm below the tabletop
    for (const [y, n] of bandHist) {
      if (y < topY - 0.15 && n > 20 && y > seatTop) { seatTop = y; seatBandN = n; }
    }
    out.table = {
      centre: [+t.tx.toFixed(2), +t.tz.toFixed(2)],
      tableTopY: +topY.toFixed(3),
      seatPlankTopY: +seatTop.toFixed(3), seatBandN,
      seatUsedNow: +t.y.toFixed(3),
      seatToTable: +(topY - seatTop).toFixed(3),
      seatOffsetFromCentre: +Math.hypot(t.x - t.tx, t.z - t.tz).toFixed(3),
      bands: [...bandHist.entries()].filter(([, n]) => n > 20).sort((a, b) => b[0] - a[0]).slice(0, 10),
    };
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();

/**
 * What IS each seam, actually? For every grid point that falls to the catch
 * floor: raycast straight down against the RENDER geometry and report which
 * prototype's surface is visually there, at what height, and what kind of
 * collider that prototype carries. Then drop the kid and photograph where
 * they end up.
 *
 *   node tools/engine/probe_seams.mjs
 */
import { boot, shoot, peek, settle } from './probe_lib.mjs';

const SEAMS = [[-14, 12], [-8, 12], [10, 24], [16, 24], [22, 12], [22, 24], [28, -6]];

const { browser, page } = await boot({ headless: true, log: false });

for (const [x, z] of SEAMS) {
  const info = await peek(page, async (gx, gz) => {
    const e = window.__engine;
    const mod = await import('babylon');
    const ray = new mod.Ray(new mod.Vector3(gx, 8, gz), new mod.Vector3(0, -1, 0), 30);
    const hits = e.scene.multiPickWithRay(ray, (m) => m.thinInstanceCount > 0 || m.name === '_catch_floor');
    const top = hits && hits.length ? hits.sort((a, b) => b.pickedPoint.y - a.pickedPoint.y)[0] : null;

    // drop the kid there and see where it lands
    e.tp(gx, gz, 3);
    await new Promise((res) => setTimeout(res, 1700));
    const p = e.player.position;

    return {
      at: [gx, gz],
      visual: top ? {
        proto: top.pickedMesh.name, y: +top.pickedPoint.y.toFixed(3),
        instance: top.thinInstanceIndex,
      } : 'NOTHING VISUAL',
      all: (hits || []).map((h) => `${h.pickedMesh.name}@${h.pickedPoint.y.toFixed(2)}`),
      kidLandedAt: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
    };
  }, x, z);
  console.log(JSON.stringify(info));
}

// photograph one of them from ground level for the record
await shoot(page, 'seam_16_24', { from: [16, 1.2, 21], at: [16, -0.5, 24] });
await shoot(page, 'seam_16_24_below', { from: [16, -1.8, 21.5], at: [16, -0.5, 24] });

await browser.close();

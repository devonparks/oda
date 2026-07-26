import { bootWorld, sleep } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });
const res = await page.evaluate(async () => {
  const W = window.__world.world, S = window.__world.state, player = S.player;
  const line = [];
  for (let z = -6; z <= 7; z += 0.5) {
    line.push({ z, wet: W.waterAt(21.19, z) != null, h: +W.collision.heightAt(21.19, z).toFixed(2) });
  }
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const at = async (x, z) => {
    window.__world.tp(x, z);
    await sleep2(1800);
    return {
      finalPos: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
      wading: !!player.wading,
      wetHere: W.waterAt(player.pos.x, player.pos.z) != null,
    };
  };
  return { line, mid: await at(21.2, 1.5), north: await at(20.5, 3), south: await at(21.19, -4) };
});
console.log(JSON.stringify(res));
await browser.close();

import { bootWorld, sleep, keyDown, keyUp } from './probe_lib.mjs';
const { browser, page } = await bootWorld({ headless: true, log: false });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/firebase|rtdb|AppCheck/i.test(m.text())) errs.push(m.text()); });
// walk around a bit
await keyDown(page, 'KeyW'); await sleep(1500); await keyUp(page, 'KeyW');
await keyDown(page, 'KeyX'); await sleep(600); await keyUp(page, 'KeyX');
const info = await page.evaluate(() => {
  const S = window.__world.state, r = S.rides;
  const kinds = {};
  for (const z of r.zones) kinds[z.ride || 'zone'] = (kinds[z.ride || 'zone'] || 0) + 1;
  return {
    zoneKinds: kinds,
    vehicles: r.vehicles ? r.vehicles.length : 'gone',
    hoops: r.hoops ? r.hoops.length : 'gone',
    coinRides: r.coinRides.length, spinners: r.spinners.length, rockers: r.rockers.length,
    benchSeats: window.__world.world.seats.length,
    tableSeats: window.__world.world.tableSeats.length,
    invItems: Object.keys(S.inv ? {} : {}).length,
    playerFinite: [S.player.pos.x, S.player.pos.y, S.player.pos.z].every(Number.isFinite),
    drawCalls: window.__world.stats().drawCalls,
  };
});
console.log(JSON.stringify(info, null, 1));
console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
await browser.close();

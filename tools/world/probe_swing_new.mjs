import { bootWorld, sleep } from './probe_lib.mjs';
const SC='C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page } = await bootWorld({ headless: true, log: false });
await page.evaluate(() => { document.getElementById('hud').style.display='none'; for (const g of window.__world.world.zoneMarkers) g.visible=false; });
const res = await page.evaluate(async () => {
  const S=window.__world.state, player=S.player, rides=S.rides;
  const sleep2=(ms)=>new Promise(r=>setTimeout(r,ms));
  const key=(t,c)=>document.body.dispatchEvent(new KeyboardEvent(t,{code:c,bubbles:true}));
  const z = rides.zones.find(x=>x.id==='swing');
  const seats = rides.swings.map(s=>({len:+s.len.toFixed(2), pivot:s.pivot.toArray().map(n=>+n.toFixed(2))}));
  player.pos.set(z.pos[0], 0.6, z.pos[1]);
  player.vel.y=0;
  rides.begin(z, player);
  await sleep2(400);
  const mounted={riding:rides.active?.kind==='swing', y:+player.pos.y.toFixed(2)};
  // pump and watch the seat mesh rotate + the kid track it
  key('keydown','KeyW');
  let minRot=9,maxRot=-9,maxGap=0;
  const t0=performance.now();
  while(performance.now()-t0<4000){
    const s=rides.active.seat;
    minRot=Math.min(minRot,s.group.rotation.x); maxRot=Math.max(maxRot,s.group.rotation.x);
    // seat world pos vs player: the kid's butt should stay on the plank
    const sp=new window.__world.THREE.Vector3(0,-s.len,0).applyAxisAngle(new window.__world.THREE.Vector3(1,0,0), s.group.rotation.x).add(s.pivot);
    maxGap=Math.max(maxGap, Math.hypot(player.pos.x-sp.x, player.pos.z-sp.z));
    await sleep2(40);
  }
  key('keyup','KeyW');
  return { seats, mounted, rotRange:[+minRot.toFixed(2),+maxRot.toFixed(2)], maxGap:+maxGap.toFixed(3),
           finite:[player.pos.x,player.pos.y,player.pos.z].every(Number.isFinite) };
});
console.log(JSON.stringify(res));
await page.evaluate(()=>{ const W=window.__world.state.world, p=window.__world.state.player; W.camYaw=p.yaw+1.9; W.camPitch=0.12; W.camDist=3.4; });
await sleep(600);
await page.screenshot({ path: SC+'/swing_real.png' });
await browser.close();

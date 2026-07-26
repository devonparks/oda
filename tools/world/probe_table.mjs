import { bootWorld, sleep } from './probe_lib.mjs';
const SC='C:/Users/devon/AppData/Local/Temp/claude/C--Users-devon-OneDrive-Desktop/01a3a5e3-9774-472a-aa9d-f3105e6865f7/scratchpad';
const { browser, page } = await bootWorld({ headless: true, log: false });
await page.evaluate(()=>{ document.getElementById('hud').style.display='none'; for(const g of window.__world.world.zoneMarkers) g.visible=false; });
const m = await page.evaluate(async () => {
  const S=window.__world.state, T=window.__world.THREE, player=S.player, rides=S.rides;
  const sleep2=(ms)=>new Promise(r=>setTimeout(r,ms));
  const z = rides.zones.find(x=>x.ride==='tableseat');
  player.pos.set(z.pos[0],1,z.pos[1]); player.vel.y=0;
  rides.begin(z, player);
  await sleep2(500);
  const t=z.spot;
  const bones={};
  for(const n of ['Hips','Ball_L','Ball_R','Hand_L','Hand_R','Head']) player.model.traverse(o=>{ if(o.name===n && !bones[n]) bones[n]=o.getWorldPosition(new T.Vector3()); });
  // the table's own geometry near this seat
  let mesh=null; window.__world.world.shell.traverse(o=>{ if(o.isMesh&&!mesh) mesh=o; });
  const pos=mesh.geometry.attributes.position, v=new T.Vector3();
  let topY=-9, plankTop=-9, plankPts=[];
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    if(Math.hypot(v.x-t.tx, v.z-t.tz)>1.7) continue;
    if(v.y>topY) topY=v.y;
  }
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    if(Math.hypot(v.x-t.tx, v.z-t.tz)>1.7) continue;
    if(v.y<topY-0.18 && v.y>topY-0.42){ if(v.y>plankTop) plankTop=v.y; plankPts.push([v.x,v.z,v.y]); }
  }
  // how far is the seat point from the NEAREST plank vertex?
  let near=1e9;
  for(const [x,z2] of plankPts) near=Math.min(near, Math.hypot(t.x-x, t.z-z2));
  return {
    seat:[+t.x.toFixed(2),+t.y.toFixed(3),+t.z.toFixed(2)], tableCentre:[+t.tx.toFixed(2),+t.tz.toFixed(2)],
    tableTopY:+topY.toFixed(3), plankTopY:+plankTop.toFixed(3),
    seatToNearestPlankVert:+near.toFixed(3),
    hips:bones.Hips.toArray().map(n=>+n.toFixed(2)),
    feetY:[+bones.Ball_L.y.toFixed(2),+bones.Ball_R.y.toFixed(2)],
    handsY:[+bones.Hand_L.y.toFixed(2),+bones.Hand_R.y.toFixed(2)],
    headY:+bones.Head.y.toFixed(2),
  };
});
console.log(JSON.stringify(m,null,1));
await page.evaluate(()=>{ const W=window.__world.state.world,p=window.__world.state.player; W.shell.visible=false; if(W.propBatch)W.propBatch.visible=false; W.camYaw=p.yaw+1.57; W.camPitch=0.30; W.camDist=2.4; });
await sleep(700);
await page.screenshot({path:SC+'/table_bare.png'});
await page.evaluate(()=>{ const W=window.__world.state.world; W.shell.visible=true; if(W.propBatch)W.propBatch.visible=true; });
await sleep(400);
await page.screenshot({path:SC+'/table_full.png'});
await browser.close();

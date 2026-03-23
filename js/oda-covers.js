/* ── ODA Game Cover Art (shared by student + teacher) ──────────── */
if(typeof coverCache==='undefined')var coverCache={};

/* ── helper: draw glowing text ─────────────────────────────────── */
function _glowText(ctx,txt,x,y,font,fill,glow,blur){
  ctx.save();ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';
  if(glow){ctx.shadowColor=glow;ctx.shadowBlur=blur||18;
    ctx.fillStyle=glow;ctx.fillText(txt,x,y);ctx.fillText(txt,x,y);}
  ctx.shadowBlur=0;ctx.shadowColor='transparent';
  // outline
  ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,0.7)';ctx.lineJoin='round';ctx.strokeText(txt,x,y);
  ctx.fillStyle=fill;ctx.fillText(txt,x,y);
  ctx.restore();
}

/* ── helper: draw sparkles / particles ─────────────────────────── */
function _sparkles(ctx,W,H,count,color){
  ctx.save();
  for(var i=0;i<(count||12);i++){
    var sx=Math.random()*W,sy=Math.random()*H,sr=0.5+Math.random()*1.8;
    ctx.globalAlpha=0.3+Math.random()*0.5;ctx.fillStyle=color||'#fff';
    ctx.beginPath();ctx.arc(sx,sy,sr,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.restore();
}

/* ── helper: radial vignette ───────────────────────────────────── */
function _vignette(ctx,W,H){
  var vg=ctx.createRadialGradient(W/2,H/2,W*0.25,W/2,H/2,W*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
}

/* ── main cover generator ──────────────────────────────────────── */
function generateCover(g,targetCanvas){
  if(!targetCanvas&&coverCache[g.id])return coverCache[g.id];
  var W,H,c,ctx;
  if(targetCanvas){W=targetCanvas.width;H=targetCanvas.height;c=targetCanvas;ctx=c.getContext('2d')}
  else{W=280;H=180;c=document.createElement('canvas');c.width=W;c.height=H;ctx=c.getContext('2d')}

  /* dark gradient background */
  var bg=_coverThemes[g.id]||{g1:'#0a0e1a',g2:'#1a1a2e'};
  var grad=ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,bg.g1);grad.addColorStop(1,bg.g2);
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);

  /* game-specific art */
  var draw=coverArt[g.id];
  if(draw)draw(ctx,W,H,g);

  /* vignette overlay */
  _vignette(ctx,W,H);

  /* subtle noise sparkles */
  _sparkles(ctx,W,H,10,'rgba(255,255,255,0.6)');

  /* large bold title */
  var tf=bg.titleFont||'bold 38px Fredoka,sans-serif';
  var tc=bg.titleColor||'#fff';
  var tg=bg.titleGlow||'rgba(255,255,255,0.4)';
  _glowText(ctx,g.title,W/2,H/2+30,tf,tc,tg,22);

  /* thin gradient fade at bottom edge */
  var btm=ctx.createLinearGradient(0,H-30,0,H);
  btm.addColorStop(0,'rgba(0,0,0,0)');btm.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=btm;ctx.fillRect(0,H-30,W,30);

  var url=c.toDataURL('image/jpeg',0.82);
  coverCache[g.id]=url;return url;
}

/* ── per-game theme colours & title style ──────────────────────── */
var _coverThemes={
  connect4:    {g1:'#0c1445',g2:'#1a0a2e',titleColor:'#fbbf24',titleGlow:'#ef4444',titleFont:'bold 34px Fredoka,sans-serif'},
  tictactoe:   {g1:'#0d1b2a',g2:'#1b0a28',titleColor:'#ef476f',titleGlow:'#118ab2',titleFont:'bold 32px Fredoka,sans-serif'},
  rps:         {g1:'#071a12',g2:'#1a1a06',titleColor:'#06d6a0',titleGlow:'#ffd166',titleFont:'bold 28px Fredoka,sans-serif'},
  chess:       {g1:'#0a0a14',g2:'#1a1510',titleColor:'#e2d5b7',titleGlow:'#c9a84c',titleFont:'bold 42px Fredoka,sans-serif'},
  checkers:    {g1:'#1a0505',g2:'#0a0a1e',titleColor:'#ef4444',titleGlow:'#dc2626',titleFont:'bold 34px Fredoka,sans-serif'},
  battleship:  {g1:'#05101e',g2:'#0a1a30',titleColor:'#22d3ee',titleGlow:'#0ea5e9',titleFont:'bold 32px Fredoka,sans-serif'},
  uno:         {g1:'#1a0505',g2:'#1a1005',titleColor:'#fbbf24',titleGlow:'#ef4444',titleFont:'bold 46px Fredoka,sans-serif'},
  dominoes:    {g1:'#0a0a14',g2:'#1a150a',titleColor:'#f5f0e8',titleGlow:'#c9a84c',titleFont:'bold 32px Fredoka,sans-serif'},
  penaltykick: {g1:'#051a0a',g2:'#0a1a0a',titleColor:'#4ade80',titleGlow:'#16a34a',titleFont:'bold 28px Fredoka,sans-serif'},
  pingpong:    {g1:'#060e18',g2:'#0a1e14',titleColor:'#06d6a0',titleGlow:'#34d399',titleFont:'bold 32px Fredoka,sans-serif'},
  snake:       {g1:'#020e08',g2:'#0a1a0a',titleColor:'#06d6a0',titleGlow:'#10b981',titleFont:'bold 42px Fredoka,sans-serif'},
  flappy:      {g1:'#0a1528',g2:'#1a1005',titleColor:'#fbbf24',titleGlow:'#f59e0b',titleFont:'bold 30px Fredoka,sans-serif'},
  fruitninja:  {g1:'#1a0508',g2:'#0a1a0a',titleColor:'#ef4444',titleGlow:'#f97316',titleFont:'bold 30px Fredoka,sans-serif'},
  brickbreaker:{g1:'#0a0514',g2:'#14050a',titleColor:'#f97316',titleGlow:'#ef4444',titleFont:'bold 28px Fredoka,sans-serif'},
  whackamole:  {g1:'#140a02',g2:'#0a1a08',titleColor:'#fbbf24',titleGlow:'#854d0e',titleFont:'bold 26px Fredoka,sans-serif'},
  aimtrainer:  {g1:'#1a0505',g2:'#0a0a14',titleColor:'#ef4444',titleGlow:'#dc2626',titleFont:'bold 30px Fredoka,sans-serif'},
  coinminer:   {g1:'#1a1005',g2:'#140520',titleColor:'#fbbf24',titleGlow:'#f59e0b',titleFont:'bold 30px Fredoka,sans-serif'},
  '2048':      {g1:'#1a0e02',g2:'#0a0a1e',titleColor:'#f59e0b',titleGlow:'#f97316',titleFont:'bold 52px Fredoka,sans-serif'},
  solitaire:   {g1:'#051a0a',g2:'#1a0505',titleColor:'#16a34a',titleGlow:'#4ade80',titleFont:'bold 32px Fredoka,sans-serif'},
  blockblast:  {g1:'#0a0520',g2:'#1a0520',titleColor:'#3b82f6',titleGlow:'#ec4899',titleFont:'bold 30px Fredoka,sans-serif'},
  suika:       {g1:'#051a0a',g2:'#1a0505',titleColor:'#4ade80',titleGlow:'#ef4444',titleFont:'bold 30px Fredoka,sans-serif'},
  simonsays:   {g1:'#0a0514',g2:'#140a05',titleColor:'#fbbf24',titleGlow:'#ef4444',titleFont:'bold 30px Fredoka,sans-serif'},
  memory:      {g1:'#100520',g2:'#051a14',titleColor:'#a78bfa',titleGlow:'#8b5cf6',titleFont:'bold 28px Fredoka,sans-serif'},
  wordle:      {g1:'#051a0a',g2:'#1a1005',titleColor:'#4ade80',titleGlow:'#16a34a',titleFont:'bold 38px Fredoka,sans-serif'},
  hangman:     {g1:'#0a0520',g2:'#1a0e05',titleColor:'#818cf8',titleGlow:'#6366f1',titleFont:'bold 34px Fredoka,sans-serif'},
  trivia:      {g1:'#1a0505',g2:'#1a1005',titleColor:'#fbbf24',titleGlow:'#dc2626',titleFont:'bold 30px Fredoka,sans-serif'},
  typing:      {g1:'#020e08',g2:'#060e18',titleColor:'#06d6a0',titleGlow:'#34d399',titleFont:'bold 30px Fredoka,sans-serif'},
  keyboard:    {g1:'#140520',g2:'#1a0505',titleColor:'#a78bfa',titleGlow:'#7c3aed',titleFont:'bold 24px Fredoka,sans-serif'},
  reaction:    {g1:'#1a0505',g2:'#051a0a',titleColor:'#06d6a0',titleGlow:'#06d6a0',titleFont:'bold 26px Fredoka,sans-serif'}
};

/* ── polished game-specific cover art ──────────────────────────── */
var coverArt={

  /* ── CONNECT 4 ─────────────────────────────────────────────── */
  connect4:function(x,W,H){
    var cx=W/2,cy=H/2-20;
    // Board frame with gradient
    var bw=W*0.78,bh=H*0.7,bx=cx-bw/2,by=cy-bh/2+5;
    var bf=x.createLinearGradient(bx,by,bx,by+bh);
    bf.addColorStop(0,'#2563eb');bf.addColorStop(1,'#1e3a8a');
    x.fillStyle=bf;x.beginPath();x.roundRect(bx,by,bw,bh,12);x.fill();
    // Board shine
    x.fillStyle='rgba(255,255,255,0.06)';x.fillRect(bx,by,bw,bh*0.35);
    // Grid holes 7x6
    var gw=7,gh=6,cellW=bw/gw,cellH=bh/gh,rad=cellW*0.36;
    for(var r=0;r<gh;r++)for(var c=0;c<gw;c++){
      var hx=bx+cellW*0.5+c*cellW,hy=by+cellH*0.5+r*cellH;
      x.fillStyle='#0c1445';x.beginPath();x.arc(hx,hy,rad,0,Math.PI*2);x.fill();
    }
    // Placed pieces (col,row,color) - bottom row is row 5
    var pcs=[[0,5,'#ef4444'],[1,5,'#fbbf24'],[2,5,'#ef4444'],[3,5,'#fbbf24'],
             [0,4,'#ef4444'],[1,4,'#fbbf24'],[2,4,'#ef4444'],[3,4,'#fbbf24'],
             [1,3,'#ef4444'],[2,3,'#fbbf24'],[4,5,'#ef4444'],[3,3,'#ef4444']];
    pcs.forEach(function(p){
      var px=bx+cellW*0.5+p[0]*cellW,py=by+cellH*0.5+p[1]*cellH;
      var pg=x.createRadialGradient(px-rad*0.3,py-rad*0.3,rad*0.1,px,py,rad);
      pg.addColorStop(0,p[2]==='#ef4444'?'#f87171':'#fde68a');pg.addColorStop(1,p[2]);
      x.fillStyle=pg;x.beginPath();x.arc(px,py,rad-1,0,Math.PI*2);x.fill();
      // shine
      x.fillStyle='rgba(255,255,255,0.25)';x.beginPath();x.arc(px-rad*0.25,py-rad*0.25,rad*0.3,0,Math.PI*2);x.fill();
    });
    // Diagonal win glow (col0row5 to col3row2)
    x.save();x.globalAlpha=0.35;x.strokeStyle='#fbbf24';x.lineWidth=cellW*0.7;x.lineCap='round';
    x.shadowColor='#fbbf24';x.shadowBlur=25;
    var w0x=bx+cellW*0.5+0*cellW,w0y=by+cellH*0.5+5*cellH;
    var w1x=bx+cellW*0.5+3*cellW,w1y=by+cellH*0.5+2*cellH;
    x.beginPath();x.moveTo(w0x,w0y);x.lineTo(w1x,w1y);x.stroke();x.restore();
  },

  /* ── TIC TAC TOE ───────────────────────────────────────────── */
  tictactoe:function(x,W,H){
    var cx=W/2,cy=H/2-18,sz=H*0.35,cell=sz/1.5;
    var gx=cx-cell*1.5,gy=cy-cell*1.5;
    // Glowing grid lines
    x.save();x.shadowColor='#118ab2';x.shadowBlur=14;
    x.strokeStyle='rgba(255,255,255,0.4)';x.lineWidth=3;
    x.beginPath();
    x.moveTo(gx+cell,gy);x.lineTo(gx+cell,gy+cell*3);
    x.moveTo(gx+cell*2,gy);x.lineTo(gx+cell*2,gy+cell*3);
    x.moveTo(gx,gy+cell);x.lineTo(gx+cell*3,gy+cell);
    x.moveTo(gx,gy+cell*2);x.lineTo(gx+cell*3,gy+cell*2);
    x.stroke();x.restore();
    // Xs and Os
    function drawX(px,py,s){
      x.save();x.strokeStyle='#ef476f';x.lineWidth=5;x.lineCap='round';
      x.shadowColor='#ef476f';x.shadowBlur=12;
      x.beginPath();x.moveTo(px-s,py-s);x.lineTo(px+s,py+s);
      x.moveTo(px+s,py-s);x.lineTo(px-s,py+s);x.stroke();x.restore();
    }
    function drawO(px,py,r){
      x.save();x.strokeStyle='#118ab2';x.lineWidth=5;x.lineCap='round';
      x.shadowColor='#118ab2';x.shadowBlur=12;
      x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.stroke();x.restore();
    }
    var ms=cell*0.3,mr=cell*0.32;
    drawX(gx+cell*0.5,gy+cell*0.5,ms);drawO(gx+cell*1.5,gy+cell*0.5,mr);drawX(gx+cell*2.5,gy+cell*0.5,ms);
    drawO(gx+cell*0.5,gy+cell*1.5,mr);drawX(gx+cell*1.5,gy+cell*1.5,ms);drawO(gx+cell*2.5,gy+cell*1.5,mr);
    drawX(gx+cell*0.5,gy+cell*2.5,ms);drawX(gx+cell*1.5,gy+cell*2.5,ms);drawO(gx+cell*2.5,gy+cell*2.5,mr);
    // Win diagonal line
    x.save();x.globalAlpha=0.55;x.strokeStyle='#ef476f';x.lineWidth=4;x.lineCap='round';
    x.shadowColor='#ef476f';x.shadowBlur=18;
    x.beginPath();x.moveTo(gx+cell*0.5,gy+cell*0.5);x.lineTo(gx+cell*2.5,gy+cell*2.5);x.stroke();x.restore();
  },

  /* ── ROCK PAPER SCISSORS ───────────────────────────────────── */
  rps:function(x,W,H){
    var cx=W/2,cy=H/2-18,R=H*0.32;
    // Triangle arrangement
    var pts=[
      {px:cx,py:cy-R*0.7,c:'#ef476f'},   // Rock (top)
      {px:cx-R*0.85,py:cy+R*0.5,c:'#06d6a0'}, // Paper (bottom-left)
      {px:cx+R*0.85,py:cy+R*0.5,c:'#ffd166'}  // Scissors (bottom-right)
    ];
    // Connecting triangle lines
    x.save();x.strokeStyle='rgba(255,255,255,0.08)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(pts[0].px,pts[0].py);x.lineTo(pts[1].px,pts[1].py);x.lineTo(pts[2].px,pts[2].py);x.closePath();x.stroke();x.restore();
    // Draw each hand
    pts.forEach(function(p,i){
      // Glow circle
      x.save();x.shadowColor=p.c;x.shadowBlur=18;
      x.fillStyle=p.c;x.globalAlpha=0.2;x.beginPath();x.arc(p.px,p.py,30,0,Math.PI*2);x.fill();
      x.globalAlpha=0.7;x.fillStyle=p.c;x.beginPath();x.arc(p.px,p.py,24,0,Math.PI*2);x.fill();
      x.restore();
      // Hand silhouettes
      x.save();x.fillStyle='rgba(255,255,255,0.9)';
      if(i===0){ // Rock - fist
        x.beginPath();x.arc(p.px,p.py,14,0,Math.PI*2);x.fill();
        x.fillStyle='rgba(255,255,255,0.5)';
        x.beginPath();x.arc(p.px,p.py-4,6,0,Math.PI*2);x.fill();
      }else if(i===1){ // Paper - open hand
        x.beginPath();x.roundRect(p.px-11,p.py-14,22,28,4);x.fill();
        // Fingers
        for(var f=0;f<4;f++){x.fillRect(p.px-10+f*6,p.py-22,4,10);}
        x.fillRect(p.px-16,p.py-6,6,4); // thumb
      }else{ // Scissors
        x.strokeStyle='rgba(255,255,255,0.9)';x.lineWidth=4;x.lineCap='round';
        x.beginPath();x.moveTo(p.px-6,p.py+10);x.lineTo(p.px+8,p.py-14);x.stroke();
        x.beginPath();x.moveTo(p.px+6,p.py+10);x.lineTo(p.px-8,p.py-14);x.stroke();
        // Handle
        x.beginPath();x.arc(p.px,p.py+10,6,0,Math.PI);x.fill();
      }
      x.restore();
    });
    // VS at center
    x.save();x.font='bold 16px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillStyle='rgba(255,255,255,0.12)';x.fillText('VS',cx,cy);x.restore();
  },

  /* ── CHESS ──────────────────────────────────────────────────── */
  chess:function(x,W,H){
    var cx=W/2,cy=H/2-16;
    // 4x4 chessboard centered
    var bsz=H*0.65,cellSz=bsz/4,bx=cx-bsz/2,by=cy-bsz/2;
    for(var r=0;r<4;r++)for(var c=0;c<4;c++){
      x.fillStyle=(r+c)%2===0?'rgba(226,213,183,0.35)':'rgba(100,80,60,0.4)';
      x.fillRect(bx+c*cellSz,by+r*cellSz,cellSz,cellSz);
    }
    x.strokeStyle='rgba(201,168,76,0.3)';x.lineWidth=2;x.strokeRect(bx,by,bsz,bsz);
    // King silhouette centered
    x.save();x.fillStyle='rgba(226,213,183,0.15)';
    var kx=cx,ky=cy;
    // Cross on top
    x.fillRect(kx-2,ky-42,4,10);x.fillRect(kx-5,ky-39,10,4);
    // Crown peaks
    x.beginPath();
    x.moveTo(kx-22,ky-10);x.lineTo(kx-18,ky-28);x.lineTo(kx-10,ky-18);
    x.lineTo(kx,ky-32);x.lineTo(kx+10,ky-18);x.lineTo(kx+18,ky-28);
    x.lineTo(kx+22,ky-10);x.closePath();x.fill();
    // Body
    x.fillRect(kx-20,ky-10,40,18);
    x.beginPath();x.roundRect(kx-24,ky+8,48,8,3);x.fill();
    x.beginPath();x.roundRect(kx-26,ky+16,52,6,3);x.fill();
    x.restore();
    // Subtle piece shadows at edges
    x.save();x.globalAlpha=0.15;x.fillStyle='#e2d5b7';x.font='26px serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('\u265B',bx+cellSz*0.5,by+cellSz*0.5);
    x.fillText('\u265E',bx+cellSz*3.5,by+cellSz*0.5);
    x.fillStyle='#555';
    x.fillText('\u2656',bx+cellSz*0.5,by+cellSz*3.5);
    x.fillText('\u2658',bx+cellSz*3.5,by+cellSz*3.5);
    x.restore();
  },

  /* ── CHECKERS ───────────────────────────────────────────────── */
  checkers:function(x,W,H){
    var cx=W/2,cy=H/2-16;
    var bsz=H*0.68,cellSz=bsz/5,bx=cx-bsz*0.7/2,by=cy-bsz/2;
    // Board 5x5 visible
    for(var r=0;r<5;r++)for(var c=0;c<5;c++){
      x.fillStyle=(r+c)%2===0?'rgba(26,26,46,0.5)':'rgba(180,40,40,0.35)';
      x.fillRect(bx+c*cellSz*1.4,by+r*cellSz,cellSz*1.4,cellSz);
    }
    // Checker pieces
    function drawPiece(px,py,col,king){
      x.save();
      x.fillStyle='rgba(0,0,0,0.35)';x.beginPath();x.ellipse(px+2,py+3,14,9,0,0,Math.PI*2);x.fill();
      // Side for 3D
      x.fillStyle=col==='r'?'#8b1a1a':'#111';
      x.beginPath();x.ellipse(px,py+4,14,9,0,0,Math.PI);x.fill();
      // Top face
      var tg=x.createRadialGradient(px-4,py-3,2,px,py,14);
      tg.addColorStop(0,col==='r'?'#f87171':'#555');tg.addColorStop(1,col==='r'?'#dc2626':'#222');
      x.fillStyle=tg;x.beginPath();x.ellipse(px,py,14,9,0,0,Math.PI*2);x.fill();
      // Shine
      x.fillStyle='rgba(255,255,255,0.18)';x.beginPath();x.ellipse(px-4,py-3,6,3.5,0,0,Math.PI*2);x.fill();
      if(king){
        // Crown
        x.fillStyle='#fbbf24';x.shadowColor='#fbbf24';x.shadowBlur=6;
        x.beginPath();x.moveTo(px-8,py+2);x.lineTo(px-6,py-5);x.lineTo(px-2,py);
        x.lineTo(px,py-7);x.lineTo(px+2,py);x.lineTo(px+6,py-5);x.lineTo(px+8,py+2);x.closePath();x.fill();
        x.shadowBlur=0;
      }
      x.restore();
    }
    drawPiece(bx+cellSz*0.7,by+cellSz*0.5,'r',false);
    drawPiece(bx+cellSz*2.8,by+cellSz*0.5,'r',false);
    drawPiece(bx+cellSz*4.9,by+cellSz*1.5,'r',true);
    drawPiece(bx+cellSz*1.4,by+cellSz*2.5,'b',false);
    drawPiece(bx+cellSz*3.5,by+cellSz*2.5,'b',false);
    drawPiece(bx+cellSz*0.7,by+cellSz*3.5,'b',false);
    // Jump arc
    x.save();x.strokeStyle='rgba(251,191,36,0.4)';x.lineWidth=2.5;x.setLineDash([5,4]);
    x.beginPath();x.moveTo(bx+cellSz*1.4,by+cellSz*2.5);x.quadraticCurveTo(bx+cellSz*2.8,by+cellSz*0.8,bx+cellSz*4.2,by+cellSz*1.5);x.stroke();
    x.setLineDash([]);x.restore();
  },

  /* ── SNAKE ─────────────────────────────────────────────────── */
  snake:function(x,W,H){
    var cx=W/2,cy=H/2-15;
    // Grid background
    x.strokeStyle='rgba(6,214,160,0.06)';x.lineWidth=0.5;
    for(var gy=0;gy<=H;gy+=16){x.beginPath();x.moveTo(0,gy);x.lineTo(W,gy);x.stroke();}
    for(var gx=0;gx<=W;gx+=16){x.beginPath();x.moveTo(gx,0);x.lineTo(gx,H);x.stroke();}
    // Snake body curving across canvas
    var pts=[[25,cy+20],[55,cy+20],[80,cy+10],[105,cy-5],[125,cy-20],[145,cy-25],[170,cy-18],[195,cy],[215,cy+15],[235,cy+20],[250,cy+10],[260,cy-5]];
    // Glow trail
    x.save();x.strokeStyle='#06d6a0';x.lineWidth=18;x.lineCap='round';x.lineJoin='round';
    x.shadowColor='#06d6a0';x.shadowBlur=22;x.globalAlpha=0.25;
    x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++)x.lineTo(pts[i][0],pts[i][1]);x.stroke();x.restore();
    // Body solid
    x.save();
    var sg=x.createLinearGradient(25,0,260,0);sg.addColorStop(0,'#0fa87f');sg.addColorStop(0.5,'#06d6a0');sg.addColorStop(1,'#10b981');
    x.strokeStyle=sg;x.lineWidth=14;x.lineCap='round';x.lineJoin='round';
    x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    for(var j=1;j<pts.length;j++)x.lineTo(pts[j][0],pts[j][1]);x.stroke();x.restore();
    // Pattern stripe
    x.strokeStyle='#04b87a';x.lineWidth=6;x.lineCap='round';x.lineJoin='round';
    x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    for(var k=1;k<pts.length;k++)x.lineTo(pts[k][0],pts[k][1]);x.stroke();
    // Segments
    for(var s=2;s<pts.length-1;s+=2){
      x.fillStyle='rgba(0,0,0,0.08)';x.beginPath();x.arc(pts[s][0],pts[s][1],7,0,Math.PI*2);x.fill();
    }
    // Head
    var hx=pts[pts.length-1][0],hy=pts[pts.length-1][1];
    x.fillStyle='#06d6a0';x.beginPath();x.arc(hx,hy,10,0,Math.PI*2);x.fill();
    // Eyes
    x.fillStyle='#fff';x.beginPath();x.arc(hx+5,hy-4,3.5,0,Math.PI*2);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(hx+6,hy-4,1.8,0,Math.PI*2);x.fill();
    // Tongue
    x.strokeStyle='#ef4444';x.lineWidth=1.5;x.lineCap='round';
    x.beginPath();x.moveTo(hx+9,hy);x.lineTo(hx+15,hy-2);x.moveTo(hx+12,hy-1);x.lineTo(hx+15,hy+2);x.stroke();
    // Apple
    x.save();x.shadowColor='#ef4444';x.shadowBlur=16;
    x.fillStyle='#ef4444';x.beginPath();x.arc(cx-30,cy+35,11,0,Math.PI*2);x.fill();x.restore();
    x.fillStyle='rgba(255,255,255,0.3)';x.beginPath();x.arc(cx-33,cy+31,3.5,0,Math.PI*2);x.fill();
    x.fillStyle='#16a34a';x.fillRect(cx-31,cy+23,3,5);
  },

  /* ── FLOPPY BIRD ───────────────────────────────────────────── */
  flappy:function(x,W,H){
    var cx=W/2,cy=H/2-15;
    // Sky gradient overlay
    x.save();var sky=x.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'rgba(56,189,248,0.18)');sky.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=sky;x.fillRect(0,0,W,H);x.restore();
    // Pipes with 3D look
    function drawPipe(px,topH,gap){
      var pw=36;
      var pg=x.createLinearGradient(px,0,px+pw,0);pg.addColorStop(0,'#16a34a');pg.addColorStop(0.4,'#4ade80');pg.addColorStop(1,'#15803d');
      x.fillStyle=pg;x.fillRect(px,0,pw,topH);
      // Lip
      var lg=x.createLinearGradient(px-4,0,px+pw+4,0);lg.addColorStop(0,'#15803d');lg.addColorStop(0.4,'#22c55e');lg.addColorStop(1,'#14532d');
      x.fillStyle=lg;x.beginPath();x.roundRect(px-4,topH-2,pw+8,12,3);x.fill();
      // Bottom pipe
      x.fillStyle=pg;x.fillRect(px,topH+gap,pw,H-topH-gap);
      x.fillStyle=lg;x.beginPath();x.roundRect(px-4,topH+gap-8,pw+8,12,3);x.fill();
    }
    drawPipe(cx-85,35,58);drawPipe(cx+10,50,52);drawPipe(cx+95,20,62);
    // Bird centered between first gap
    var bx=cx-45,by=cy-2;
    // Body glow
    x.save();x.shadowColor='#fbbf24';x.shadowBlur=16;
    x.fillStyle='#fbbf24';x.beginPath();x.ellipse(bx,by,18,14,0,0,Math.PI*2);x.fill();x.restore();
    // Body highlight
    x.fillStyle='#fde68a';x.beginPath();x.ellipse(bx-4,by-4,8,6,0,0,Math.PI*2);x.fill();
    // Wing
    x.fillStyle='#f59e0b';x.beginPath();x.ellipse(bx-10,by-6,10,7,-0.3,0,Math.PI*2);x.fill();
    // Eye white
    x.fillStyle='#fff';x.beginPath();x.arc(bx+10,by-4,6,0,Math.PI*2);x.fill();
    // Pupil
    x.fillStyle='#111';x.beginPath();x.arc(bx+12,by-4,3,0,Math.PI*2);x.fill();
    // Beak
    x.fillStyle='#f97316';x.beginPath();x.moveTo(bx+16,by+1);x.lineTo(bx+28,by-2);x.lineTo(bx+28,by+6);x.closePath();x.fill();
    // Motion lines
    x.strokeStyle='rgba(255,255,255,0.25)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(bx-25,by);x.lineTo(bx-35,by);x.stroke();
    x.beginPath();x.moveTo(bx-23,by+8);x.lineTo(bx-33,by+10);x.stroke();
    x.beginPath();x.moveTo(bx-24,by-7);x.lineTo(bx-32,by-9);x.stroke();
  },

  /* ── FRUIT NINJA ───────────────────────────────────────────── */
  fruitninja:function(x,W,H){
    var cx=W/2,cy=H/2-15;
    // Big watermelon halves centered
    var wr=32;
    // Left half
    x.save();
    x.fillStyle='#15803d';x.beginPath();x.arc(cx-8,cy,wr,Math.PI*0.5,Math.PI*1.5);x.fill();
    x.fillStyle='#ef4444';x.beginPath();x.arc(cx-8,cy,wr*0.82,Math.PI*0.5,Math.PI*1.5);x.fill();
    // Seeds
    x.fillStyle='#1a1a2e';
    for(var s=0;s<4;s++){x.beginPath();x.ellipse(cx-18-s*3,cy-10+s*7,2,1.2,0.5,0,Math.PI*2);x.fill();}
    // Right half
    x.fillStyle='#15803d';x.beginPath();x.arc(cx+8,cy,wr,Math.PI*1.5,Math.PI*0.5);x.fill();
    x.fillStyle='#ef4444';x.beginPath();x.arc(cx+8,cy,wr*0.82,Math.PI*1.5,Math.PI*0.5);x.fill();
    x.fillStyle='#1a1a2e';
    for(var s2=0;s2<4;s2++){x.beginPath();x.ellipse(cx+18+s2*3,cy-10+s2*7,2,1.2,-0.5,0,Math.PI*2);x.fill();}
    x.restore();
    // Smaller fruits
    // Orange top-right
    x.fillStyle='#f97316';x.beginPath();x.arc(cx+65,cy-28,16,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(cx+61,cy-32,5,0,Math.PI*2);x.fill();
    // Apple bottom-left
    x.fillStyle='#dc2626';x.beginPath();x.arc(cx-70,cy+20,14,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(cx-73,cy+17,4,0,Math.PI*2);x.fill();
    x.fillStyle='#16a34a';x.fillRect(cx-71,cy+5,2,5);
    // Slash arc with glow
    x.save();x.strokeStyle='rgba(255,255,255,0.9)';x.lineWidth=3.5;
    x.shadowColor='#fff';x.shadowBlur=14;
    x.beginPath();x.moveTo(20,H-20);x.quadraticCurveTo(cx,cy-50,W-20,cy+20);x.stroke();x.restore();
    // Second slash
    x.save();x.strokeStyle='rgba(255,255,255,0.35)';x.lineWidth=2;
    x.shadowColor='#fff';x.shadowBlur=8;
    x.beginPath();x.moveTo(30,15);x.quadraticCurveTo(cx+20,cy+30,W-30,20);x.stroke();x.restore();
    // Juice drops
    x.fillStyle='#ef4444';x.globalAlpha=0.6;
    var drops=[[cx-20,cy-25],[cx+15,cy+25],[cx-35,cy+5],[cx+30,cy-15],[cx,cy+32]];
    drops.forEach(function(d){x.beginPath();x.arc(d[0],d[1],1.5+2*0.7,0,Math.PI*2);x.fill();});
    x.globalAlpha=1;
  },

  /* ── 2048 ──────────────────────────────────────────────────── */
  '2048':function(x,W,H){
    var cx=W/2,cy=H/2-18;
    // 2x2 mini grid centered
    var gsz=H*0.55,pad=6,ts=(gsz-pad*3)/2,gx=cx-gsz/2,gy=cy-gsz/2;
    // Board background
    x.fillStyle='rgba(187,173,160,0.2)';x.beginPath();x.roundRect(gx-4,gy-4,gsz+8,gsz+8,12);x.fill();
    var tiles=[
      {v:2,c:'#eee4da',tc:'#776e65'},{v:128,c:'#edcf72',tc:'#fff'},
      {v:4,c:'#ede0c8',tc:'#776e65'},{v:2048,c:'#edc22e',tc:'#fff'}
    ];
    for(var r=0;r<2;r++)for(var c=0;c<2;c++){
      var t=tiles[r*2+c];
      var tx=gx+pad+c*(ts+pad),ty=gy+pad+r*(ts+pad);
      // Shadow
      x.fillStyle='rgba(0,0,0,0.12)';x.beginPath();x.roundRect(tx+2,ty+2,ts,ts,8);x.fill();
      // Tile gradient
      var tg=x.createLinearGradient(tx,ty,tx,ty+ts);
      tg.addColorStop(0,t.c);tg.addColorStop(1,t.v>=128?'#d4a730':t.c);
      x.fillStyle=tg;x.beginPath();x.roundRect(tx,ty,ts,ts,8);x.fill();
      // Shine
      x.fillStyle='rgba(255,255,255,0.15)';x.fillRect(tx+4,ty+2,ts-8,ts*0.3);
      // Value
      x.fillStyle=t.tc;
      var fsz=t.v>=1000?16:t.v>=100?20:26;
      x.font='bold '+fsz+'px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(t.v,tx+ts/2,ty+ts/2);
    }
    // Glow on 2048 tile
    x.save();x.shadowColor='#edc22e';x.shadowBlur=30;x.globalAlpha=0.35;
    x.fillStyle='#edc22e';x.beginPath();x.roundRect(gx+pad+1*(ts+pad),gy+pad+1*(ts+pad),ts,ts,8);x.fill();
    x.restore();
    // Merge arrows
    x.save();x.strokeStyle='rgba(255,255,255,0.1)';x.lineWidth=2;
    x.beginPath();x.moveTo(gx-15,cy);x.lineTo(gx-5,cy);x.moveTo(gx-9,cy-4);x.lineTo(gx-5,cy);x.lineTo(gx-9,cy+4);x.stroke();
    x.beginPath();x.moveTo(gx+gsz+15,cy);x.lineTo(gx+gsz+5,cy);x.moveTo(gx+gsz+9,cy-4);x.lineTo(gx+gsz+5,cy);x.lineTo(gx+gsz+9,cy+4);x.stroke();
    x.restore();
  },

  /* ── SOLITAIRE ─────────────────────────────────────────────── */
  solitaire:function(x,W,H){
    var cx=W/2,cy=H/2-15;
    // Cascade of cards fanned from center
    function drawCard(px,py,rot,faceUp,rank,suit,suitCol){
      x.save();x.translate(px,py);x.rotate(rot);
      var cw=42,ch=58;
      // Shadow
      x.fillStyle='rgba(0,0,0,0.25)';x.beginPath();x.roundRect(-cw/2+2,-ch/2+2,cw,ch,4);x.fill();
      if(faceUp){
        x.fillStyle='#fff';x.beginPath();x.roundRect(-cw/2,-ch/2,cw,ch,4);x.fill();
        // Rank + suit
        x.fillStyle=suitCol;x.font='bold 14px sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText(rank,-cw/2+10,-ch/2+12);
        x.font='18px sans-serif';x.fillText(suit,0,4);
      }else{
        // Card back
        var bg=x.createLinearGradient(-cw/2,-ch/2,-cw/2+cw,-ch/2+ch);
        bg.addColorStop(0,'#1e40af');bg.addColorStop(1,'#1e3a8a');
        x.fillStyle=bg;x.beginPath();x.roundRect(-cw/2,-ch/2,cw,ch,4);x.fill();
        // Pattern
        x.strokeStyle='rgba(255,255,255,0.12)';x.lineWidth=0.7;
        x.strokeRect(-cw/2+4,-ch/2+4,cw-8,ch-8);
        x.beginPath();x.moveTo(-cw/2+4,-ch/2+4);x.lineTo(cw/2-4,ch/2-4);x.stroke();
        x.beginPath();x.moveTo(cw/2-4,-ch/2+4);x.lineTo(-cw/2+4,ch/2-4);x.stroke();
      }
      x.restore();
    }
    // Fan of face-down cards behind
    drawCard(cx-55,cy-5,-0.35,false);
    drawCard(cx-35,cy-10,-0.2,false);
    drawCard(cx-15,cy-12,-0.08,false);
    // Face-up cards
    drawCard(cx+10,cy-10,0.05,true,'A','\u2660','#111');
    drawCard(cx+35,cy-5,0.18,true,'K','\u2665','#dc2626');
    drawCard(cx+58,cy+2,0.32,true,'Q','\u2666','#dc2626');
    // Ace highlight glow
    x.save();x.globalAlpha=0.15;x.shadowColor='#4ade80';x.shadowBlur=20;
    x.fillStyle='#4ade80';x.beginPath();x.arc(cx+10,cy-10,28,0,Math.PI*2);x.fill();x.restore();
  },

  /* ── WORDLE ────────────────────────────────────────────────── */
  wordle:function(x,W,H){
    var cx=W/2,cy=H/2-22;
    // 5-tile row centered large
    var tw=38,th=38,gap=4,rowW=tw*5+gap*4;
    var sx=cx-rowW/2,sy=cy-th/2;
    var letters=['S','O','L','V','E'];
    var colors=['#16a34a','#16a34a','#fbbf24','#3a3a4a','#16a34a'];
    for(var c=0;c<5;c++){
      var tx=sx+c*(tw+gap);
      // Tile
      var tg=x.createLinearGradient(tx,sy,tx,sy+th);
      tg.addColorStop(0,colors[c]);tg.addColorStop(1,colors[c]==='#16a34a'?'#15803d':colors[c]==='#fbbf24'?'#d97706':'#2a2a3a');
      x.fillStyle=tg;x.beginPath();x.roundRect(tx,sy,tw,th,5);x.fill();
      // Shine
      x.fillStyle='rgba(255,255,255,0.1)';x.fillRect(tx+2,sy+1,tw-4,th*0.3);
      // Letter
      x.fillStyle='#fff';x.font='bold 20px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(letters[c],tx+tw/2,sy+th/2);
    }
    // Win glow
    x.save();x.shadowColor='#16a34a';x.shadowBlur=18;x.globalAlpha=0.2;
    x.fillStyle='#16a34a';x.fillRect(sx-4,sy-4,rowW+8,th+8);x.restore();
    // Mini keyboard below
    var kRows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
    var ky=sy+th+14;
    for(var kr=0;kr<3;kr++){
      var kl=kRows[kr].length,ksz=12,kgap=2;
      var kx=cx-(kl*(ksz+kgap))/2;
      for(var ki=0;ki<kl;ki++){
        var letter=kRows[kr][ki];
        var used=letters.indexOf(letter)>=0;
        x.fillStyle=used?'rgba(22,163,74,0.3)':'rgba(255,255,255,0.06)';
        x.beginPath();x.roundRect(kx+ki*(ksz+kgap),ky+kr*16,ksz,13,2);x.fill();
        x.fillStyle=used?'#4ade80':'rgba(255,255,255,0.3)';
        x.font='bold 7px Outfit,sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText(letter,kx+ki*(ksz+kgap)+ksz/2,ky+kr*16+7);
      }
    }
  },

  /* ── PING PONG ─────────────────────────────────────────────── */
  pingpong:function(x,W,H){
    var cx=W/2,cy=H/2-12;
    // Table surface
    var tw=W*0.85,th=H*0.7,tx=cx-tw/2,ty=cy-th/2;
    x.fillStyle='rgba(0,100,80,0.25)';x.beginPath();x.roundRect(tx,ty,tw,th,4);x.fill();
    x.strokeStyle='rgba(255,255,255,0.15)';x.lineWidth=2;x.strokeRect(tx,ty,tw,th);
    // Center net
    x.strokeStyle='rgba(255,255,255,0.3)';x.lineWidth=2;x.setLineDash([6,4]);
    x.beginPath();x.moveTo(cx,ty-4);x.lineTo(cx,ty+th+4);x.stroke();x.setLineDash([]);
    // Left paddle
    x.save();x.shadowColor='#06d6a0';x.shadowBlur=12;
    var pg1=x.createLinearGradient(tx+8,0,tx+22,0);pg1.addColorStop(0,'#059669');pg1.addColorStop(1,'#06d6a0');
    x.fillStyle=pg1;x.beginPath();x.roundRect(tx+10,cy-28,14,56,6);x.fill();x.restore();
    // Right paddle
    x.save();x.shadowColor='#ef4444';x.shadowBlur=12;
    var pg2=x.createLinearGradient(tx+tw-22,0,tx+tw-8,0);pg2.addColorStop(0,'#ef4444');pg2.addColorStop(1,'#dc2626');
    x.fillStyle=pg2;x.beginPath();x.roundRect(tx+tw-24,cy-22,14,56,6);x.fill();x.restore();
    // Ball trail
    var trail=[[cx-60,cy-8,0.08],[cx-35,cy-2,0.16],[cx-10,cy+5,0.3]];
    trail.forEach(function(t){x.globalAlpha=t[2];x.fillStyle='#fff';x.beginPath();x.arc(t[0],t[1],7,0,Math.PI*2);x.fill();});
    x.globalAlpha=1;
    // Ball with glow
    x.save();x.shadowColor='#fff';x.shadowBlur=14;
    x.fillStyle='#fff';x.beginPath();x.arc(cx+18,cy+12,9,0,Math.PI*2);x.fill();x.restore();
    // Score watermark
    x.fillStyle='rgba(255,255,255,0.05)';x.font='bold 48px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('3',cx-tw*0.25,cy);x.fillText('2',cx+tw*0.25,cy);
  },

  /* ── SUIKA GAME ────────────────────────────────────────────── */
  suika:function(x,W,H){
    var cx=W/2,cy=H/2-10;
    // Container
    var cw=W*0.55,ch=H*0.72,clx=cx-cw/2,cly=cy-ch/2+10;
    x.strokeStyle='rgba(255,255,255,0.25)';x.lineWidth=2.5;
    x.beginPath();x.moveTo(clx,cly);x.lineTo(clx,cly+ch);x.lineTo(clx+cw,cly+ch);x.lineTo(clx+cw,cly);x.stroke();
    // Stacked fruits
    var fruits=[
      {cx:clx+cw*0.22,cy:cly+ch-12,r:10,c1:'#dc2626',c2:'#fca5a5'},  // Cherry
      {cx:clx+cw*0.55,cy:cly+ch-16,r:14,c1:'#f97316',c2:'#fed7aa'},  // Orange
      {cx:clx+cw*0.82,cy:cly+ch-14,r:12,c1:'#ec4899',c2:'#fbcfe8'},  // Peach
      {cx:clx+cw*0.35,cy:cly+ch-38,r:18,c1:'#16a34a',c2:'#86efac'},  // Apple
      {cx:clx+cw*0.68,cy:cly+ch-36,r:16,c1:'#eab308',c2:'#fef08a'},  // Lemon
      {cx:clx+cw*0.50,cy:cly+ch-64,r:24,c1:'#22c55e',c2:'#bbf7d0'}   // Watermelon
    ];
    fruits.forEach(function(f){
      x.fillStyle='rgba(0,0,0,0.2)';x.beginPath();x.arc(f.cx+2,f.cy+2,f.r,0,Math.PI*2);x.fill();
      var fg=x.createRadialGradient(f.cx-f.r*0.3,f.cy-f.r*0.3,f.r*0.1,f.cx,f.cy,f.r);
      fg.addColorStop(0,f.c2);fg.addColorStop(1,f.c1);
      x.fillStyle=fg;x.beginPath();x.arc(f.cx,f.cy,f.r,0,Math.PI*2);x.fill();
      // Shine
      x.fillStyle='rgba(255,255,255,0.28)';x.beginPath();x.arc(f.cx-f.r*0.25,f.cy-f.r*0.3,f.r*0.28,0,Math.PI*2);x.fill();
      // Watermelon stripes
      if(f.r>=22){
        x.save();x.strokeStyle='rgba(0,80,0,0.3)';x.lineWidth=2;
        for(var st=0;st<4;st++){
          x.beginPath();x.arc(f.cx,f.cy,f.r*0.5+st*3,Math.PI*0.8,Math.PI*1.2);x.stroke();
        }x.restore();
      }
    });
    // Merge sparkles
    x.save();x.globalAlpha=0.6;
    var mf=fruits[5];
    for(var sp=0;sp<10;sp++){
      var a=sp*0.628;x.fillStyle=sp%2===0?'#fbbf24':'#fff';
      x.beginPath();x.arc(mf.cx+Math.cos(a)*32,mf.cy+Math.sin(a)*32,1.8,0,Math.PI*2);x.fill();
    }x.restore();
  },

  /* ── AIM TRAINER ───────────────────────────────────────────── */
  aimtrainer:function(x,W,H){
    var cx=W/2,cy=H/2-15;
    // Target drawing helper
    function drawTarget(tx,ty,r,alpha){
      x.save();x.globalAlpha=alpha||1;
      var rings=[['#dc2626',1],['#fff',0.75],['#dc2626',0.52],['#fff',0.32],['#dc2626',0.15]];
      rings.forEach(function(ring){
        x.fillStyle=ring[0];x.beginPath();x.arc(tx,ty,r*ring[1],0,Math.PI*2);x.fill();
      });
      x.restore();
    }
    // Background faded target
    drawTarget(cx+60,cy-30,28,0.12);
    // Main large target centered
    x.save();x.shadowColor='#dc2626';x.shadowBlur=14;
    drawTarget(cx-15,cy,38,1);x.restore();
    // Second target
    drawTarget(cx+70,cy+25,22,0.7);
    // Small shattering target
    x.save();x.globalAlpha=0.5;
    var stx=cx-65,sty=cy+30;
    // Fragments
    x.fillStyle='#dc2626';
    x.beginPath();x.moveTo(stx-8,sty-6);x.lineTo(stx-2,sty-10);x.lineTo(stx+2,sty-4);x.closePath();x.fill();
    x.beginPath();x.moveTo(stx+5,sty-8);x.lineTo(stx+12,sty-5);x.lineTo(stx+6,sty+2);x.closePath();x.fill();
    x.fillStyle='#fff';
    x.beginPath();x.moveTo(stx-4,sty+3);x.lineTo(stx+3,sty+1);x.lineTo(stx+1,sty+8);x.closePath();x.fill();
    x.restore();
    // Crosshair centered over main target
    var chx=cx-15,chy=cy;
    x.save();x.strokeStyle='rgba(255,255,255,0.8)';x.lineWidth=1.5;
    x.shadowColor='#fff';x.shadowBlur=8;
    x.beginPath();x.arc(chx,chy,16,0,Math.PI*2);x.stroke();
    x.beginPath();
    x.moveTo(chx,chy-24);x.lineTo(chx,chy-10);
    x.moveTo(chx,chy+10);x.lineTo(chx,chy+24);
    x.moveTo(chx-24,chy);x.lineTo(chx-10,chy);
    x.moveTo(chx+10,chy);x.lineTo(chx+24,chy);x.stroke();
    // Center dot
    x.fillStyle='#ef4444';x.beginPath();x.arc(chx,chy,2,0,Math.PI*2);x.fill();
    x.restore();
  },

  /* ── PENALTY KICK ──────────────────────────────────────────── */
  penaltykick:function(x,W,H){
    var cx=W/2,cy=H/2-10;
    // Grass
    var gg=x.createLinearGradient(0,cy+20,0,H);
    gg.addColorStop(0,'#16a34a');gg.addColorStop(1,'#0f6c30');
    x.fillStyle=gg;x.fillRect(0,cy+20,W,H-cy-20);
    // Grass stripes
    x.fillStyle='rgba(255,255,255,0.04)';
    for(var s=0;s<W;s+=22){x.fillRect(s,cy+20,11,H-cy-20);}
    // Goal frame
    var gw=W*0.78,gh=H*0.48,glx=cx-gw/2,gly=cy-gh/2-5;
    x.save();x.strokeStyle='#fff';x.lineWidth=5;x.lineCap='round';
    x.beginPath();x.moveTo(glx,gly+gh);x.lineTo(glx,gly);x.lineTo(glx+gw,gly);x.lineTo(glx+gw,gly+gh);x.stroke();x.restore();
    // Net lines
    x.strokeStyle='rgba(255,255,255,0.07)';x.lineWidth=1;
    for(var ni=1;ni<10;ni++){x.beginPath();x.moveTo(glx+ni*(gw/10),gly);x.lineTo(glx+ni*(gw/10),gly+gh);x.stroke();}
    for(var nj=1;nj<5;nj++){x.beginPath();x.moveTo(glx,gly+nj*(gh/5));x.lineTo(glx+gw,gly+nj*(gh/5));x.stroke();}
    // Soccer ball
    var bx=cx,by=cy+28;
    x.save();x.shadowColor='#fff';x.shadowBlur=16;
    x.fillStyle='#fff';x.beginPath();x.arc(bx,by,14,0,Math.PI*2);x.fill();x.restore();
    // Pentagon pattern
    x.fillStyle='#333';
    x.beginPath();x.moveTo(bx,by-7);x.lineTo(bx+6,by-3);x.lineTo(bx+4,by+4);x.lineTo(bx-4,by+4);x.lineTo(bx-6,by-3);x.closePath();x.fill();
    // Small pentagons
    x.fillStyle='#555';x.globalAlpha=0.5;
    x.beginPath();x.arc(bx+9,by-8,3,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(bx-9,by-8,3,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(bx+11,by+5,3,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(bx-11,by+5,3,0,Math.PI*2);x.fill();
    x.globalAlpha=1;
    // Trajectory arc
    x.save();x.strokeStyle='rgba(255,255,255,0.25)';x.lineWidth=2;x.setLineDash([5,4]);
    x.beginPath();x.moveTo(bx,by);x.quadraticCurveTo(bx-20,by-40,cx-40,gly+15);x.stroke();x.setLineDash([]);x.restore();
  },

  /* ── BRICK BREAKER ─────────────────────────────────────────── */
  brickbreaker:function(x,W,H){
    var cx=W/2,cy=H/2-10;
    // Brick rows centered
    var bColors=[['#ef4444','#f87171'],['#f97316','#fb923c'],['#fbbf24','#fcd34d'],['#16a34a','#4ade80'],['#3b82f6','#60a5fa']];
    var cols=8,bw=(W-40)/cols,bh=13,pad=2;
    var startX=20,startY=15;
    for(var r=0;r<5;r++)for(var c=0;c<cols;c++){
      var bx=startX+c*bw,by=startY+r*(bh+pad);
      // Skip some for broken effect
      if((r===3&&c===4)||(r===4&&c===2)||(r===4&&c===6))continue;
      var bg=x.createLinearGradient(bx,by,bx,by+bh);
      bg.addColorStop(0,bColors[r][1]);bg.addColorStop(1,bColors[r][0]);
      x.fillStyle=bg;x.beginPath();x.roundRect(bx+1,by,bw-2,bh,2);x.fill();
      x.fillStyle='rgba(255,255,255,0.2)';x.fillRect(bx+1,by,bw-2,3);
    }
    // Break particles from missing bricks
    x.fillStyle='#fbbf24';x.globalAlpha=0.5;
    for(var p=0;p<8;p++){
      var pa=(p*0.785);
      x.beginPath();x.arc(startX+4*bw+bw/2+Math.cos(pa)*15,startY+3*(bh+pad)+bh/2+Math.sin(pa)*12,2,0,Math.PI*2);x.fill();
    }
    x.globalAlpha=1;
    // Paddle centered at bottom
    x.save();x.shadowColor='#fff';x.shadowBlur=10;
    var pg=x.createLinearGradient(cx-38,0,cx+38,0);pg.addColorStop(0,'#94a3b8');pg.addColorStop(0.5,'#fff');pg.addColorStop(1,'#94a3b8');
    x.fillStyle=pg;x.beginPath();x.roundRect(cx-38,H*0.72,76,10,5);x.fill();x.restore();
    // Ball with motion trail
    var ballY=H*0.58;
    x.fillStyle='rgba(255,255,255,0.15)';x.beginPath();x.arc(cx-10,ballY+15,5,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.3)';x.beginPath();x.arc(cx-5,ballY+8,5.5,0,Math.PI*2);x.fill();
    x.save();x.shadowColor='#fff';x.shadowBlur=10;
    x.fillStyle='#fff';x.beginPath();x.arc(cx,ballY,6.5,0,Math.PI*2);x.fill();x.restore();
  },

  /* ── WHACK-A-MOLE ──────────────────────────────────────────── */
  whackamole:function(x,W,H){
    var cx=W/2,cy=H/2-10;
    // 3 holes in a row
    var holes=[cx-75,cx,cx+75];
    holes.forEach(function(hx,i){
      var hy=cy+30;
      // Dirt mound
      x.fillStyle='#5c3d1a';x.beginPath();x.ellipse(hx,hy+10,36,10,0,0,Math.PI*2);x.fill();
      // Hole
      x.fillStyle='#2a1508';x.beginPath();x.ellipse(hx,hy,34,12,0,0,Math.PI);x.fill();
      if(i===1){
        // Mole in middle hole
        var my=hy-10;
        // Body
        x.fillStyle='#a0722a';x.beginPath();x.arc(hx,my,22,Math.PI,0);x.fill();
        x.fillRect(hx-22,my,44,18);
        // Face area
        x.fillStyle='#c49a3c';x.beginPath();x.arc(hx,my-4,16,Math.PI,0);x.fill();
        // Ears
        x.fillStyle='#8B6914';
        x.beginPath();x.arc(hx-16,my-10,6,0,Math.PI*2);x.fill();
        x.beginPath();x.arc(hx+16,my-10,6,0,Math.PI*2);x.fill();
        x.fillStyle='#c49a3c';
        x.beginPath();x.arc(hx-16,my-10,4,0,Math.PI*2);x.fill();
        x.beginPath();x.arc(hx+16,my-10,4,0,Math.PI*2);x.fill();
        // Eyes
        x.fillStyle='#fff';
        x.beginPath();x.arc(hx-8,my-8,5.5,0,Math.PI*2);x.fill();
        x.beginPath();x.arc(hx+8,my-8,5.5,0,Math.PI*2);x.fill();
        x.fillStyle='#111';
        x.beginPath();x.arc(hx-7,my-7,2.8,0,Math.PI*2);x.fill();
        x.beginPath();x.arc(hx+9,my-7,2.8,0,Math.PI*2);x.fill();
        // Nose
        x.fillStyle='#e88a7a';x.beginPath();x.ellipse(hx,my+2,6,4,0,0,Math.PI*2);x.fill();
        // Cheeks
        x.fillStyle='rgba(232,138,122,0.3)';
        x.beginPath();x.arc(hx-12,my,4,0,Math.PI*2);x.fill();
        x.beginPath();x.arc(hx+12,my,4,0,Math.PI*2);x.fill();
      }
    });
    // Mallet
    x.save();x.translate(cx+80,cy-30);x.rotate(0.45);
    // Handle
    x.fillStyle='#8B4513';
    var hg=x.createLinearGradient(-3,-38,5,-38);hg.addColorStop(0,'#6d3810');hg.addColorStop(1,'#a0522d');
    x.fillStyle=hg;x.fillRect(-4,-38,8,44);
    // Head
    x.save();x.shadowColor='#fbbf24';x.shadowBlur=10;
    var mg=x.createLinearGradient(-16,-54,16,-54);mg.addColorStop(0,'#555');mg.addColorStop(0.5,'#888');mg.addColorStop(1,'#555');
    x.fillStyle=mg;x.beginPath();x.roundRect(-16,-56,32,24,6);x.fill();x.restore();
    x.restore();
    // Impact effect
    x.save();x.fillStyle='#fbbf24';x.globalAlpha=0.4;
    for(var st=0;st<6;st++){var a=st*1.05;x.beginPath();x.arc(cx+Math.cos(a)*30,cy-18+Math.sin(a)*22,2.5,0,Math.PI*2);x.fill();}
    x.restore();
  },

  /* ── SIMON SAYS ────────────────────────────────────────────── */
  simonsays:function(x,W,H){
    var cx=W/2,cy=H/2-16,R=H*0.35;
    // Four quadrants
    var quads=[
      {c:'#dc2626',a1:Math.PI,a2:Math.PI*1.5,lit:false},
      {c:'#16a34a',a1:Math.PI*1.5,a2:Math.PI*2,lit:true},
      {c:'#2563eb',a1:Math.PI*0.5,a2:Math.PI,lit:false},
      {c:'#eab308',a1:0,a2:Math.PI*0.5,lit:false}
    ];
    quads.forEach(function(q){
      x.save();
      if(q.lit){x.shadowColor='#4ade80';x.shadowBlur=25;x.fillStyle='#22c55e';}
      else{x.fillStyle=q.c;}
      x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R,q.a1,q.a2);x.closePath();x.fill();
      // Inner highlight
      x.fillStyle='rgba(255,255,255,0.08)';
      x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R*0.7,q.a1,q.a2);x.closePath();x.fill();
      x.restore();
    });
    // Center dark circle
    x.fillStyle='#1a1a2e';x.beginPath();x.arc(cx,cy,R*0.22,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.06)';x.beginPath();x.arc(cx,cy,R*0.18,0,Math.PI*2);x.fill();
    // Separator lines
    x.strokeStyle='#0a0a14';x.lineWidth=4;
    x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();
    // Sound waves from green
    x.save();x.strokeStyle='rgba(74,222,128,0.35)';x.lineWidth=1.5;
    var wx=cx+R*0.55,wy=cy-R*0.55;
    for(var w=0;w<3;w++){x.beginPath();x.arc(wx,wy,8+w*9,Math.PI*0.15,Math.PI*0.65);x.stroke();}
    x.restore();
  },

  /* ── BATTLESHIP ────────────────────────────────────────────── */
  battleship:function(x,W,H){
    var cx=W/2,cy=H/2-12;
    // Ocean grid centered
    var gw=W*0.78,gh=H*0.72,glx=cx-gw/2,gly=cy-gh/2;
    var cols=8,rows=7,cellW=gw/cols,cellH=gh/rows;
    // Grid lines
    x.strokeStyle='rgba(34,211,238,0.12)';x.lineWidth=0.5;
    for(var i=0;i<=cols;i++){x.beginPath();x.moveTo(glx+i*cellW,gly);x.lineTo(glx+i*cellW,gly+gh);x.stroke();}
    for(var j=0;j<=rows;j++){x.beginPath();x.moveTo(glx,gly+j*cellH);x.lineTo(glx+gw,gly+j*cellH);x.stroke();}
    // Ships
    // Horizontal 4-cell
    x.fillStyle='rgba(148,163,184,0.3)';
    x.beginPath();x.roundRect(glx+cellW,gly+cellH*0.2,cellW*4,cellH*0.6,cellH*0.3);x.fill();
    // Vertical 3-cell
    x.fillStyle='rgba(148,163,184,0.25)';
    x.beginPath();x.roundRect(glx+cellW*5.2,gly+cellH*2,cellW*0.6,cellH*3,cellH*0.3);x.fill();
    // Horizontal 2-cell
    x.fillStyle='rgba(148,163,184,0.2)';
    x.beginPath();x.roundRect(glx+cellW*2,gly+cellH*4.2,cellW*2,cellH*0.6,cellH*0.3);x.fill();
    // Hit markers (red X with glow)
    x.save();x.shadowColor='#ef4444';x.shadowBlur=8;
    var hits=[[1.5,0.5],[2.5,0.5],[3.5,0.5],[5.5,2.5],[5.5,3.5]];
    hits.forEach(function(h){
      var hx=glx+h[0]*cellW,hy=gly+h[1]*cellH;
      x.fillStyle='#ef4444';x.beginPath();x.arc(hx,hy,5,0,Math.PI*2);x.fill();
      x.strokeStyle='#fff';x.lineWidth=1.5;
      x.beginPath();x.moveTo(hx-3,hy-3);x.lineTo(hx+3,hy+3);x.moveTo(hx+3,hy-3);x.lineTo(hx-3,hy+3);x.stroke();
    });x.restore();
    // Misses (white dots)
    var misses=[[0.5,2.5],[3.5,3.5],[6.5,1.5],[1.5,5.5]];
    misses.forEach(function(m){
      x.fillStyle='rgba(255,255,255,0.18)';x.beginPath();x.arc(glx+m[0]*cellW,gly+m[1]*cellH,4,0,Math.PI*2);x.fill();
    });
    // Water ripple
    x.save();x.strokeStyle='rgba(34,211,238,0.15)';x.lineWidth=1;
    x.beginPath();x.arc(glx+0.5*cellW,gly+2.5*cellH,8,0,Math.PI*2);x.stroke();
    x.beginPath();x.arc(glx+0.5*cellW,gly+2.5*cellH,14,0,Math.PI*2);x.stroke();x.restore();
  },

  /* ── BLOCK BLAST ───────────────────────────────────────────── */
  blockblast:function(x,W,H){
    var cx=W/2,cy=H/2-12;
    var colors=['#3b82f6','#ec4899','#06d6a0','#fbbf24','#a855f7','#ef4444'];
    // Grid centered
    var cols=8,rows=6,bw=(W-36)/cols,bh=(H*0.6)/rows;
    var gx=18,gy=8;
    var pattern=[
      [1,0,1,1,0,1,0,1],
      [1,1,0,1,1,0,1,0],
      [1,1,1,1,1,1,1,1],  // Full row (clearing)
      [0,1,1,0,1,1,1,0],
      [1,0,1,1,0,1,0,1],
      [0,1,0,1,1,0,1,1]
    ];
    for(var r=0;r<rows;r++)for(var c=0;c<cols;c++){
      if(pattern[r][c]){
        var bx=gx+c*bw,by=gy+r*bh;
        var bg=x.createLinearGradient(bx,by,bx,by+bh-2);
        bg.addColorStop(0,colors[(r+c)%6]);bg.addColorStop(1,colors[(r+c+2)%6]);
        x.fillStyle=bg;x.beginPath();x.roundRect(bx+1,by+1,bw-2,bh-2,3);x.fill();
        // Top shine
        x.fillStyle='rgba(255,255,255,0.2)';x.fillRect(bx+1,by+1,bw-2,bh*0.25);
      }
    }
    // Clearing glow on row 2 (full row)
    x.save();x.globalAlpha=0.25;x.fillStyle='#fff';
    x.shadowColor='#fff';x.shadowBlur=18;
    x.fillRect(gx-2,gy+2*bh-1,W-36+4,bh+2);x.restore();
    // Tetromino piece preview
    var pc=[{dx:0,dy:0},{dx:1,dy:0},{dx:1,dy:1},{dx:2,dy:0}];
    pc.forEach(function(p){
      x.fillStyle='rgba(236,72,153,0.5)';x.beginPath();x.roundRect(W*0.7+p.dx*18,H*0.7+p.dy*18,16,16,3);x.fill();
    });
  },

  /* ── TRIVIA RACE ───────────────────────────────────────────── */
  trivia:function(x,W,H){
    var cx=W/2,cy=H/2-18;
    // Question card
    x.fillStyle='rgba(255,255,255,0.08)';x.beginPath();x.roundRect(cx-110,cy-40,220,32,8);x.fill();
    x.strokeStyle='rgba(255,255,255,0.1)';x.lineWidth=1;x.beginPath();x.roundRect(cx-110,cy-40,220,32,8);x.stroke();
    // Question mark
    x.fillStyle='rgba(255,255,255,0.08)';x.font='bold 60px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('?',cx,cy+10);
    // 4 answer bubbles in 2x2 grid
    var opts=[{l:'A',c:'#16a34a',right:true},{l:'B',c:'#3b82f6',right:false},{l:'C',c:'#ef4444',right:false},{l:'D',c:'#fbbf24',right:false}];
    for(var i=0;i<4;i++){
      var ox=cx-105+(i%2)*110,oy=cy+2+(i>1?30:0);
      x.fillStyle=opts[i].right?'rgba(22,163,74,0.4)':'rgba(255,255,255,0.06)';
      x.beginPath();x.roundRect(ox,oy,100,25,6);x.fill();
      if(opts[i].right){
        x.save();x.shadowColor='#16a34a';x.shadowBlur=10;
        x.strokeStyle='#16a34a';x.lineWidth=1.5;x.beginPath();x.roundRect(ox,oy,100,25,6);x.stroke();x.restore();
      }
      // Badge
      x.fillStyle=opts[i].c;x.beginPath();x.arc(ox+14,oy+12,9,0,Math.PI*2);x.fill();
      x.fillStyle='#fff';x.font='bold 10px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(opts[i].l,ox+14,oy+13);
      // Answer line placeholder
      x.fillStyle='rgba(255,255,255,0.25)';x.fillRect(ox+28,oy+11,55,3);
    }
    // Timer bar at bottom
    x.fillStyle='rgba(255,255,255,0.05)';x.beginPath();x.roundRect(cx-100,cy+68,200,6,3);x.fill();
    var tg=x.createLinearGradient(cx-100,0,cx+40,0);tg.addColorStop(0,'#fbbf24');tg.addColorStop(1,'#f97316');
    x.fillStyle=tg;x.beginPath();x.roundRect(cx-100,cy+68,140,6,3);x.fill();
  },

  /* ── TYPING RACE ───────────────────────────────────────────── */
  typing:function(x,W,H){
    var cx=W/2,cy=H/2-12;
    // Floating keyboard keys ascending upward
    var keys=[
      {l:'A',px:cx-60,py:cy+30,sz:22,a:0.7},
      {l:'S',px:cx-25,py:cy+10,sz:24,a:0.8},
      {l:'D',px:cx+10,py:cy-15,sz:26,a:0.9},
      {l:'F',px:cx+50,py:cy-40,sz:28,a:1.0},
      {l:'G',px:cx-40,py:cy-35,sz:20,a:0.5},
      {l:'H',px:cx+80,py:cy+5,sz:18,a:0.4},
      {l:'J',px:cx-80,py:cy-5,sz:20,a:0.55}
    ];
    keys.forEach(function(k){
      x.save();x.globalAlpha=k.a;
      // Key body
      var kg=x.createLinearGradient(k.px,k.py,k.px,k.py+k.sz);
      kg.addColorStop(0,'rgba(6,214,160,0.3)');kg.addColorStop(1,'rgba(6,214,160,0.1)');
      x.fillStyle=kg;x.beginPath();x.roundRect(k.px-k.sz/2,k.py-k.sz/2,k.sz,k.sz,4);x.fill();
      x.strokeStyle='rgba(6,214,160,0.4)';x.lineWidth=1;x.beginPath();x.roundRect(k.px-k.sz/2,k.py-k.sz/2,k.sz,k.sz,4);x.stroke();
      // Letter
      x.fillStyle='#06d6a0';x.font='bold '+Math.floor(k.sz*0.55)+'px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(k.l,k.px,k.py);
      x.restore();
    });
    // Speed lines
    x.save();x.strokeStyle='rgba(6,214,160,0.15)';x.lineWidth=1;
    for(var sl=0;sl<5;sl++){
      x.beginPath();x.moveTo(cx-50+sl*25,H);x.lineTo(cx-70+sl*25,cy-50);x.stroke();
    }x.restore();
    // Cursor
    x.save();x.shadowColor='#06d6a0';x.shadowBlur=10;
    x.fillStyle='#06d6a0';x.fillRect(cx+10,cy-58,3,20);x.restore();
    // WPM badge
    x.fillStyle='rgba(6,214,160,0.15)';x.beginPath();x.roundRect(cx-30,cy+50,60,18,4);x.fill();
    x.fillStyle='#06d6a0';x.font='bold 10px Outfit,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('92 WPM',cx,cy+59);
  },

  /* ── KEYBOARD WARRIORS ─────────────────────────────────────── */
  keyboard:function(x,W,H){
    var cx=W/2,cy=H/2-10;
    // Energy slash effect in background
    x.save();x.strokeStyle='rgba(167,139,250,0.15)';x.lineWidth=3;
    x.beginPath();x.moveTo(cx-80,cy-40);x.quadraticCurveTo(cx,cy+20,cx+80,cy-40);x.stroke();
    x.beginPath();x.moveTo(cx-60,cy+30);x.quadraticCurveTo(cx+20,cy-30,cx+90,cy+20);x.stroke();
    x.restore();
    // Sword centered (made of keyboard key shapes)
    var sx=cx,sy=cy+15;
    x.save();x.shadowColor='#a78bfa';x.shadowBlur=14;
    // Blade from stacked keys
    var bladeKeys=['I','K','L','E'];
    for(var bk=0;bk<4;bk++){
      var bky=sy-55+bk*16,bkw=14-bk*1;
      x.fillStyle='rgba(229,231,235,0.85)';x.beginPath();x.roundRect(sx-bkw/2,bky,bkw,14,2);x.fill();
      x.fillStyle='rgba(167,139,250,0.5)';x.font='bold 8px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(bladeKeys[bk],sx,bky+7);
    }
    // Blade tip
    x.fillStyle='#e5e7eb';x.beginPath();x.moveTo(sx,sy-65);x.lineTo(sx-6,sy-55);x.lineTo(sx+6,sy-55);x.closePath();x.fill();
    // Guard (keyboard spacebar shape)
    x.fillStyle='#fbbf24';x.beginPath();x.roundRect(sx-18,sy+6,36,6,3);x.fill();
    // Handle
    x.fillStyle='#6d3a8a';x.beginPath();x.roundRect(sx-5,sy+12,10,18,3);x.fill();
    // Pommel
    x.fillStyle='#fbbf24';x.beginPath();x.arc(sx,sy+33,5,0,Math.PI*2);x.fill();
    x.restore();
    // Enemy characters
    function drawEnemy(ex,ey,r,col,letter){
      x.save();x.shadowColor=col;x.shadowBlur=14;
      x.fillStyle=col;x.globalAlpha=0.25;x.beginPath();x.arc(ex,ey,r+7,0,Math.PI*2);x.fill();
      x.globalAlpha=0.8;x.fillStyle=col;x.beginPath();x.arc(ex,ey,r,0,Math.PI*2);x.fill();x.restore();
      x.fillStyle='#fff';x.font='bold '+(r>15?'14':'11')+'px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(letter,ex,ey);
    }
    drawEnemy(cx-75,cy-30,16,'#ef4444','A');
    drawEnemy(cx+75,cy-25,14,'#fbbf24','K');
    drawEnemy(cx-55,cy+35,12,'#3b82f6','Z');
    drawEnemy(cx+60,cy+30,13,'#ec4899','M');
    drawEnemy(cx,cy-45,18,'#a855f7','X');
    // Projectile lines
    x.save();x.strokeStyle='rgba(251,191,36,0.2)';x.lineWidth=1.5;x.setLineDash([3,4]);
    x.beginPath();x.moveTo(sx,sy-65);x.lineTo(cx-75,cy-30);x.stroke();
    x.beginPath();x.moveTo(sx,sy-65);x.lineTo(cx,cy-45);x.stroke();
    x.beginPath();x.moveTo(sx,sy-65);x.lineTo(cx+75,cy-25);x.stroke();
    x.setLineDash([]);x.restore();
  },

  /* ── UNO ───────────────────────────────────────────────────── */
  uno:function(x,W,H){
    var cx=W/2,cy=H/2-15;
    var uColors=['#dc2626','#16a34a','#2563eb','#eab308','#dc2626'];
    var uVals=['7','R','5','+2','0'];
    // Fanned cards centered
    for(var i=0;i<5;i++){
      x.save();x.translate(cx+(i-2)*34,cy+5);x.rotate((i-2)*0.18);
      var cw=42,ch=60;
      // Shadow
      x.fillStyle='rgba(0,0,0,0.3)';x.beginPath();x.roundRect(-cw/2+2,-ch/2+2,cw,ch,6);x.fill();
      // Card body
      var cg=x.createLinearGradient(-cw/2,-ch/2,-cw/2,ch/2);
      cg.addColorStop(0,uColors[i]);cg.addColorStop(1,i===2?'#1d4ed8':uColors[i]);
      x.fillStyle=cg;x.beginPath();x.roundRect(-cw/2,-ch/2,cw,ch,6);x.fill();
      // White oval center
      x.fillStyle='rgba(255,255,255,0.92)';x.save();x.rotate(0.3);
      x.beginPath();x.ellipse(0,-2,14,20,0,0,Math.PI*2);x.fill();x.restore();
      // Value
      x.fillStyle=uColors[i];x.font='bold 20px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(uVals[i],0,-1);
      // Corner value
      x.fillStyle='#fff';x.font='bold 9px Fredoka,sans-serif';
      x.fillText(uVals[i],-cw/2+8,-ch/2+10);
      x.restore();
    }
    // Reverse arrow symbol subtle in background
    x.save();x.globalAlpha=0.08;x.strokeStyle='#fff';x.lineWidth=3;
    x.beginPath();x.arc(cx,cy,45,0.3,Math.PI*1.7);x.stroke();
    // Arrowhead
    x.fillStyle='#fff';x.beginPath();x.moveTo(cx+40,cy-20);x.lineTo(cx+48,cy-10);x.lineTo(cx+32,cy-10);x.closePath();x.fill();
    x.restore();
  },

  /* ── COIN MINER ────────────────────────────────────────────── */
  coinminer:function(x,W,H){
    var cx=W/2,cy=H/2-15;
    // Cave arch at top
    x.fillStyle='rgba(80,40,10,0.12)';
    x.beginPath();x.moveTo(15,H);x.quadraticCurveTo(15,20,cx,15);x.quadraticCurveTo(W-15,20,W-15,H);x.fill();
    // Coin stack centered
    var stackX=cx,stackBase=cy+25;
    function drawCoin(coinX,coinY,r){
      x.save();x.shadowColor='#fbbf24';x.shadowBlur=10;
      // Edge/side
      x.fillStyle='#b45309';x.beginPath();x.ellipse(coinX,coinY+3,r,r*0.45,0,0,Math.PI);x.fill();
      // Top face
      var cg=x.createRadialGradient(coinX-r*0.3,coinY-r*0.2,r*0.1,coinX,coinY,r);
      cg.addColorStop(0,'#fde68a');cg.addColorStop(1,'#d97706');
      x.fillStyle=cg;x.beginPath();x.ellipse(coinX,coinY,r,r*0.45,0,0,Math.PI*2);x.fill();
      // Inner ring
      x.strokeStyle='rgba(251,191,36,0.5)';x.lineWidth=1.5;
      x.beginPath();x.ellipse(coinX,coinY,r*0.7,r*0.32,0,0,Math.PI*2);x.stroke();
      // $ sign
      x.fillStyle='#92400e';x.font='bold '+Math.floor(r*0.6)+'px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText('$',coinX,coinY);
      x.restore();
    }
    // Stacked coins (bottom to top)
    drawCoin(stackX,stackBase,18);
    drawCoin(stackX,stackBase-10,18);
    drawCoin(stackX,stackBase-20,18);
    drawCoin(stackX,stackBase-30,18);
    // Scattered coins
    drawCoin(stackX-50,stackBase+5,14);
    drawCoin(stackX+55,stackBase,13);
    drawCoin(stackX+35,stackBase-40,12);
    drawCoin(stackX-40,stackBase-35,11);
    // Pickaxe
    x.save();x.translate(cx-65,cy+20);x.rotate(-0.6);
    var hg=x.createLinearGradient(-3,-40,5,-40);hg.addColorStop(0,'#6d3810');hg.addColorStop(1,'#a0522d');
    x.fillStyle=hg;x.fillRect(-3,-40,6,45);
    // Head
    x.fillStyle='#94a3b8';
    x.beginPath();x.moveTo(-3,-40);x.lineTo(18,-46);x.lineTo(15,-35);x.lineTo(-3,-37);x.closePath();x.fill();
    x.fillStyle='rgba(255,255,255,0.2)';
    x.beginPath();x.moveTo(-1,-39);x.lineTo(14,-44);x.lineTo(13,-38);x.lineTo(-1,-37);x.closePath();x.fill();
    x.restore();
    // Sparkle particles
    x.save();x.fillStyle='#fbbf24';x.globalAlpha=0.6;
    var sparkles=[[cx+20,cy-45],[cx-25,cy-40],[cx+40,cy-20],[cx-60,cy-10],[cx+65,cy+10],[cx-10,cy-50]];
    sparkles.forEach(function(s){
      // 4-point star
      x.beginPath();x.moveTo(s[0],s[1]-3);x.lineTo(s[0]+1,s[1]-1);x.lineTo(s[0]+3,s[1]);
      x.lineTo(s[0]+1,s[1]+1);x.lineTo(s[0],s[1]+3);x.lineTo(s[0]-1,s[1]+1);
      x.lineTo(s[0]-3,s[1]);x.lineTo(s[0]-1,s[1]-1);x.closePath();x.fill();
    });
    x.restore();
  },

  /* ── DOMINOES ──────────────────────────────────────────────── */
  dominoes:function(x,W,H){
    var cx=W/2,cy=H/2-12;
    // Green felt background
    x.fillStyle='rgba(22,101,52,0.12)';x.fillRect(20,10,W-40,H-30);
    function drawDomino(dx,dy,rot,top,bot){
      x.save();x.translate(dx,dy);x.rotate(rot);
      var dw=40,dh=78;
      // Shadow
      x.fillStyle='rgba(0,0,0,0.3)';x.beginPath();x.roundRect(-dw/2+2,-dh/2+2,dw,dh,5);x.fill();
      // Tile body with gradient
      var tg=x.createLinearGradient(-dw/2,-dh/2,-dw/2,dh/2);
      tg.addColorStop(0,'#faf5eb');tg.addColorStop(1,'#ede5d5');
      x.fillStyle=tg;x.beginPath();x.roundRect(-dw/2,-dh/2,dw,dh,5);x.fill();
      // Border
      x.strokeStyle='rgba(180,160,120,0.4)';x.lineWidth=1;x.beginPath();x.roundRect(-dw/2,-dh/2,dw,dh,5);x.stroke();
      // Divider line
      x.strokeStyle='#b0a080';x.lineWidth=2;x.beginPath();x.moveTo(-dw/2+4,0);x.lineTo(dw/2-4,0);x.stroke();
      // Pips
      x.fillStyle='#1a1a2e';
      function pip(px,py){x.beginPath();x.arc(px,py,3,0,Math.PI*2);x.fill();}
      function drawPips(val,yOff){
        if(val===1)pip(0,yOff);
        if(val===2){pip(-7,yOff-9);pip(7,yOff+9);}
        if(val===3){pip(-7,yOff-9);pip(0,yOff);pip(7,yOff+9);}
        if(val===4){pip(-7,yOff-9);pip(7,yOff-9);pip(-7,yOff+9);pip(7,yOff+9);}
        if(val===5){pip(-7,yOff-9);pip(7,yOff-9);pip(0,yOff);pip(-7,yOff+9);pip(7,yOff+9);}
        if(val===6){pip(-7,yOff-9);pip(7,yOff-9);pip(-7,yOff);pip(7,yOff);pip(-7,yOff+9);pip(7,yOff+9);}
      }
      drawPips(top,-dh/4);drawPips(bot,dh/4);
      x.restore();
    }
    drawDomino(cx-72,cy,-0.12,3,5);
    drawDomino(cx,cy+5,0.05,5,2);
    drawDomino(cx+72,cy-2,0.15,6,4);
    // Subtle connection glow
    x.save();x.strokeStyle='rgba(201,168,76,0.2)';x.lineWidth=1.5;x.setLineDash([4,4]);
    x.beginPath();x.moveTo(cx-50,cy);x.lineTo(cx-22,cy+5);x.stroke();
    x.beginPath();x.moveTo(cx+22,cy+5);x.lineTo(cx+50,cy-2);x.stroke();
    x.setLineDash([]);x.restore();
  },

  /* ── BOWLING ───────────────────────────────────────────────── */
  bowling:function(x,W,H){
    var cx=W/2,cy=H/2-10;
    // Lane
    var lw=W*0.42;
    x.fillStyle='rgba(194,154,100,0.15)';x.fillRect(cx-lw/2,0,lw,H);
    // Lane arrows
    x.fillStyle='rgba(255,255,255,0.06)';
    x.beginPath();x.moveTo(cx,35);x.lineTo(cx-10,50);x.lineTo(cx+10,50);x.closePath();x.fill();
    x.beginPath();x.moveTo(cx,55);x.lineTo(cx-8,67);x.lineTo(cx+8,67);x.closePath();x.fill();
    // Pins in triangle centered
    function drawPin(px,py,standing){
      x.save();
      if(standing){
        // Head
        x.fillStyle='#f5f0e8';x.beginPath();x.arc(px,py-7,5.5,0,Math.PI*2);x.fill();
        // Neck + body
        x.fillStyle='#e8e0d0';x.fillRect(px-3,py-2,6,11);
        // Red stripe
        x.fillStyle='#dc2626';x.beginPath();x.arc(px,py-7,5.5,0.3,Math.PI-0.3);x.fill();
      }else{
        x.globalAlpha=0.2;x.fillStyle='#f5f0e8';
        x.save();x.translate(px,py);x.rotate(0.8);
        x.beginPath();x.arc(0,-4,4,0,Math.PI*2);x.fill();x.fillRect(-2,0,4,8);
        x.restore();x.globalAlpha=1;
      }
      x.restore();
    }
    drawPin(cx,15,true);
    drawPin(cx-12,30,true);drawPin(cx+12,30,true);
    drawPin(cx-24,45,true);drawPin(cx,45,false);drawPin(cx+24,45,true);
    drawPin(cx-36,60,true);drawPin(cx-12,60,true);drawPin(cx+12,60,false);drawPin(cx+36,60,true);
    // Ball with glow
    x.save();x.shadowColor='#7c3aed';x.shadowBlur=16;
    var bg=x.createRadialGradient(cx-3,cy+35,3,cx,cy+38,18);
    bg.addColorStop(0,'#a78bfa');bg.addColorStop(1,'#4c1d95');
    x.fillStyle=bg;x.beginPath();x.arc(cx,cy+38,18,0,Math.PI*2);x.fill();x.restore();
    // Finger holes
    x.fillStyle='rgba(0,0,0,0.3)';
    x.beginPath();x.arc(cx-4,cy+32,3,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(cx+4,cy+30,3,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(cx,cy+37,2.5,0,Math.PI*2);x.fill();
  },

  /* ── HANGMAN ───────────────────────────────────────────────── */
  hangman:function(x,W,H){
    var cx=W/2,cy=H/2-14;
    // Gallows centered
    var gx=cx-30,gy=cy+50;
    x.save();x.strokeStyle='#8B6914';x.lineWidth=4;x.lineCap='round';
    x.shadowColor='rgba(139,105,20,0.3)';x.shadowBlur=6;
    // Base
    x.beginPath();x.moveTo(gx-30,gy);x.lineTo(gx+30,gy);x.stroke();
    // Vertical
    x.beginPath();x.moveTo(gx,gy);x.lineTo(gx,gy-95);x.stroke();
    // Top
    x.beginPath();x.moveTo(gx,gy-95);x.lineTo(gx+55,gy-95);x.stroke();
    // Brace
    x.lineWidth=2;x.beginPath();x.moveTo(gx,gy-75);x.lineTo(gx+18,gy-95);x.stroke();
    // Rope
    x.strokeStyle='#c9a84c';x.lineWidth=2;
    x.beginPath();x.moveTo(gx+55,gy-95);x.lineTo(gx+55,gy-80);x.stroke();
    x.restore();
    // Stick figure
    x.save();x.strokeStyle='#818cf8';x.lineWidth=3;x.lineCap='round';
    x.shadowColor='#818cf8';x.shadowBlur=10;
    var fx=gx+55,fy=gy-68;
    // Head
    x.beginPath();x.arc(fx,fy,12,0,Math.PI*2);x.stroke();
    // Body
    x.beginPath();x.moveTo(fx,fy+12);x.lineTo(fx,fy+40);x.stroke();
    // Arms
    x.beginPath();x.moveTo(fx,fy+20);x.lineTo(fx-18,fy+34);x.stroke();
    x.beginPath();x.moveTo(fx,fy+20);x.lineTo(fx+18,fy+34);x.stroke();
    // Legs
    x.beginPath();x.moveTo(fx,fy+40);x.lineTo(fx-15,fy+58);x.stroke();
    x.beginPath();x.moveTo(fx,fy+40);x.lineTo(fx+15,fy+58);x.stroke();
    x.restore();
    // Floating letters around
    x.save();
    var letters=[{l:'A',px:cx-80,py:cy-25,a:0.3},{l:'E',px:cx+70,py:cy-30,a:0.25},{l:'R',px:cx-70,py:cy+20,a:0.2},{l:'S',px:cx+80,py:cy+15,a:0.2},{l:'T',px:cx+60,py:cy-55,a:0.15},{l:'N',px:cx-55,py:cy-50,a:0.15}];
    letters.forEach(function(lt){
      x.globalAlpha=lt.a;x.fillStyle='#818cf8';x.font='bold 16px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(lt.l,lt.px,lt.py);
    });
    x.restore();
    // Letter blanks at bottom
    x.fillStyle='rgba(255,255,255,0.3)';x.font='bold 16px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('_ _ _ _ _ _',cx,gy+15);
  },

  /* ── MEMORY MATCH ──────────────────────────────────────────── */
  memory:function(x,W,H){
    var cx=W/2,cy=H/2-14;
    // 4x2 grid centered
    var cw=46,ch=52,gap=6;
    var gridW=4*(cw+gap)-gap,gridH=2*(ch+gap)-gap;
    var gx=cx-gridW/2,gy=cy-gridH/2;
    var flipped=[2,5]; // Matching pair revealed
    for(var r=0;r<2;r++)for(var c=0;c<4;c++){
      var idx=r*4+c;
      var cardX=gx+c*(cw+gap),cardY=gy+r*(ch+gap);
      var isFace=flipped.indexOf(idx)>=0;
      if(isFace){
        // Face-up card
        x.save();x.shadowColor='#fbbf24';x.shadowBlur=12;
        x.fillStyle='rgba(255,255,255,0.1)';x.beginPath();x.roundRect(cardX,cardY,cw,ch,6);x.fill();
        x.strokeStyle='#fbbf24';x.lineWidth=2;x.beginPath();x.roundRect(cardX,cardY,cw,ch,6);x.stroke();
        x.restore();
        // Star symbol
        x.save();x.fillStyle='#fbbf24';x.shadowColor='#fbbf24';x.shadowBlur=6;
        // 5-point star
        var stx=cardX+cw/2,sty=cardY+ch/2,sr=14;
        x.beginPath();
        for(var p=0;p<5;p++){
          var a1=p*Math.PI*2/5-Math.PI/2;
          var a2=(p+0.5)*Math.PI*2/5-Math.PI/2;
          x.lineTo(stx+Math.cos(a1)*sr,sty+Math.sin(a1)*sr);
          x.lineTo(stx+Math.cos(a2)*sr*0.4,sty+Math.sin(a2)*sr*0.4);
        }
        x.closePath();x.fill();x.restore();
      }else{
        // Face-down card
        var cg=x.createLinearGradient(cardX,cardY,cardX,cardY+ch);
        cg.addColorStop(0,'#2a4a7a');cg.addColorStop(1,'#1e3a5f');
        x.fillStyle=cg;x.beginPath();x.roundRect(cardX,cardY,cw,ch,6);x.fill();
        // Pattern
        x.strokeStyle='rgba(255,255,255,0.08)';x.lineWidth=0.7;
        for(var p2=0;p2<3;p2++){x.beginPath();x.arc(cardX+cw/2,cardY+ch/2,7+p2*7,0,Math.PI*2);x.stroke();}
        // Question mark
        x.fillStyle='rgba(255,255,255,0.15)';x.font='bold 18px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText('?',cardX+cw/2,cardY+ch/2);
      }
    }
    // Match sparkle line between the two face-up cards
    x.save();x.strokeStyle='rgba(251,191,36,0.3)';x.lineWidth=1.5;x.setLineDash([3,3]);
    var c1x=gx+2*(cw+gap)+cw/2,c1y=gy+ch/2;
    var c2x=gx+1*(cw+gap)+cw/2,c2y=gy+(ch+gap)+ch/2;
    x.beginPath();x.moveTo(c1x,c1y);x.lineTo(c2x,c2y);x.stroke();x.setLineDash([]);
    // Sparkles along the line
    x.fillStyle='#fbbf24';x.globalAlpha=0.6;
    var mx=(c1x+c2x)/2,my=(c1y+c2y)/2;
    x.beginPath();x.arc(mx,my,2.5,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(mx-6,my+4,1.8,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(mx+6,my-3,1.8,0,Math.PI*2);x.fill();
    x.restore();
  },

  /* ── REACTION TIME ─────────────────────────────────────────── */
  reaction:function(x,W,H){
    var cx=W/2,cy=H/2-18;
    // Dark red background glow
    x.save();x.globalAlpha=0.15;
    var rg=x.createRadialGradient(cx,cy,10,cx,cy,W*0.5);
    rg.addColorStop(0,'#ef4444');rg.addColorStop(1,'transparent');
    x.fillStyle=rg;x.fillRect(0,0,W,H);x.restore();
    // Big green circle (go signal)
    x.save();x.shadowColor='#06d6a0';x.shadowBlur=30;
    var gr=x.createRadialGradient(cx,cy-5,5,cx,cy-5,H*0.32);
    gr.addColorStop(0,'#34d399');gr.addColorStop(0.7,'#06d6a0');gr.addColorStop(1,'#059669');
    x.fillStyle=gr;x.beginPath();x.arc(cx,cy-5,H*0.3,0,Math.PI*2);x.fill();
    // Inner glow ring
    x.strokeStyle='rgba(255,255,255,0.15)';x.lineWidth=3;
    x.beginPath();x.arc(cx,cy-5,H*0.22,0,Math.PI*2);x.stroke();
    x.restore();
    // Time text "243ms"
    x.save();x.font='bold 28px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.shadowColor='rgba(0,0,0,0.6)';x.shadowBlur=8;
    x.fillStyle='#fff';x.fillText('243ms',cx,cy-5);
    x.restore();
    // Hand/cursor icon (pointer finger)
    x.save();x.translate(cx+30,cy+30);x.rotate(-0.3);
    // Finger shape
    x.fillStyle='#fbbf24';x.shadowColor='#f59e0b';x.shadowBlur=10;
    x.beginPath();x.roundRect(-6,-22,12,24,5);x.fill();
    // Palm
    x.fillStyle='#f59e0b';x.beginPath();x.roundRect(-10,-2,20,16,6);x.fill();
    x.restore();
    // Small red dots (wait indicators) in corners
    var dots=[[cx-60,cy-40],[cx+55,cy-35],[cx-50,cy+30],[cx+65,cy+25]];
    dots.forEach(function(d){
      x.save();x.globalAlpha=0.3;x.fillStyle='#ef4444';x.shadowColor='#ef4444';x.shadowBlur=8;
      x.beginPath();x.arc(d[0],d[1],4,0,Math.PI*2);x.fill();x.restore();
    });
  }
};


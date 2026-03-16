// ODA Hub Arcade - Shared utilities (back button + Firebase coin rewards)
(function(){
  // Add back button
  var btn=document.createElement('a');
  btn.href='../../student.html';
  btn.className='oda-back';
  btn.innerHTML='\u2190 Back to Hub';
  btn.style.cssText='position:fixed;top:16px;left:16px;background:rgba(17,24,39,.9);border:1px solid #2a3450;border-radius:10px;padding:8px 16px;color:#8892a8;font-family:Outfit,sans-serif;font-size:13px;font-weight:600;cursor:pointer;z-index:9999;text-decoration:none;transition:all .2s';
  btn.onmouseenter=function(){btn.style.borderColor='#06d6a0';btn.style.color='#f0f4ff'};
  btn.onmouseleave=function(){btn.style.borderColor='#2a3450';btn.style.color='#8892a8'};
  document.body.appendChild(btn);

  // Firebase coin reward
  window.odaRewardCoins=function(score){
    var coins=Math.max(1,Math.floor(score));
    var studentId=localStorage.getItem('studentId');
    if(!studentId)return;
    window.getFirebaseDB().then(function(fb){
      fb.fsMod.updateDoc(fb.fsMod.doc(fb.db,'students',studentId),{coins:fb.fsMod.increment(coins)}).then(function(){
        showCoinPopup(coins);
      });
    });
  };

  function showCoinPopup(coins){
    var popup=document.createElement('div');
    popup.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);background:rgba(17,24,39,.95);border:2px solid #ffd166;border-radius:16px;padding:24px 40px;text-align:center;z-index:99999;font-family:Outfit,sans-serif;transition:transform .3s ease';
    popup.innerHTML='<div style="font-size:36px;margin-bottom:8px">\u{1FA99}</div><div style="color:#ffd166;font-size:24px;font-weight:800">+'+coins+' Coins!</div><div style="color:#8892a8;font-size:13px;margin-top:4px">Added to your wallet</div>';
    document.body.appendChild(popup);
    requestAnimationFrame(function(){popup.style.transform='translate(-50%,-50%) scale(1)'});
    setTimeout(function(){popup.style.transform='translate(-50%,-50%) scale(0)';setTimeout(function(){popup.remove()},300)},2000);
  }
})();

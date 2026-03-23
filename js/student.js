/**
 * ODA Hub - Student Dashboard
 * Handles assignments, quizzes (spelling/vocab), tools, arcade, and AI features.
 * Dependencies: oda-core.js (esc, odaAI, odaToast, odaTrapFocus, odaConfetti, dataUriToBlobUrl)
 */

var ODA_VERSION='2026-03-14a';

/** Check for app updates and reload if newer version found */
function checkForUpdates(btn){
btn.disabled=true;btn.innerHTML='&#x1F504;';
fetch(location.href+'?_='+Date.now(),{cache:'no-store'}).then(function(r){return r.text()}).then(function(html){
var m=html.match(/ODA_VERSION='([^']+)'/);
var remote=m?m[1]:'';
if(remote&&remote!==ODA_VERSION){
btn.innerHTML='&#x2705;';
setTimeout(function(){location.reload(true)},600);
}else{
btn.innerHTML='&#x2705;';
setTimeout(function(){btn.innerHTML='&#x1F504;';btn.disabled=false},2000);
}
}).catch(function(){
btn.innerHTML='&#x1F504;';btn.disabled=false;
if(typeof odaToast==='function')odaToast('Unable to check for updates. Check your connection.','warning');
});
}
// GAMES array loaded from shared oda-games.js (window.ODA_GAMES)
var GAMES=window.ODA_GAMES||[];

var WORD_BANKS={
'spelling-k2':['cat','dog','run','big','the','and','see','play','jump','like'],
'spelling-34':['because','friend','school','before','believe','different','together','favorite','important','beautiful'],
'spelling-58':['necessary','rhythm','definitely','occurrence','accommodate','conscience','perseverance','entrepreneur','miscellaneous','surveillance'],
'vocab-k2':[{w:'Happy',d:'Feeling good and joyful',wrong:['Feeling sad','Feeling tired','Feeling hungry']},{w:'Brave',d:'Not afraid to do hard things',wrong:['Very small','Very loud','Very fast']},{w:'Enormous',d:'Really really big',wrong:['Really tiny','Really fast','Really old']},{w:'Gentle',d:'Soft and careful',wrong:['Loud and rough','Fast and wild','Dark and cold']},{w:'Curious',d:'Wanting to know more',wrong:['Wanting to sleep','Wanting to eat','Wanting to run']}],
'vocab-34':[{w:'Abundant',d:'More than enough of something',wrong:['Not enough','Exactly right','None at all']},{w:'Cautious',d:'Being very careful',wrong:['Being very fast','Being very loud','Being very silly']},{w:'Diligent',d:'Working hard and not giving up',wrong:['Being lazy','Being quiet','Being funny']},{w:'Elaborate',d:'Very detailed and complex',wrong:['Very simple','Very small','Very old']},{w:'Fragile',d:'Easy to break',wrong:['Very strong','Very heavy','Very big']}],
'vocab-58':[{w:'Ambiguous',d:'Having more than one meaning',wrong:['Very clear','Very loud','Very bright']},{w:'Benevolent',d:'Kind and generous',wrong:['Mean and cruel','Shy and quiet','Fast and loud']},{w:'Pragmatic',d:'Dealing with things in a practical way',wrong:['Dealing with dreams','Dealing with jokes','Dealing with colors']},{w:'Resilient',d:'Able to recover from difficulties',wrong:['Unable to move','Unable to speak','Unable to see']},{w:'Unanimous',d:'Everyone agrees completely',wrong:['Nobody agrees','Only one agrees','Half agree']}]
};

var activeQuiz=null; // {assignId, words, current, correct, type}

var stuTabOrder=['work','tools','arcade'];
function switchTab(id){
var tabs=document.querySelectorAll('.tab');
var secs=document.querySelectorAll('.section');
for(var i=0;i<tabs.length;i++){tabs[i].classList.remove('active');tabs[i].setAttribute('aria-selected','false');tabs[i].setAttribute('tabindex','-1');secs[i].classList.remove('show')}
document.getElementById('sec-'+id).classList.add('show');
var m={work:0,tools:1,arcade:2};
if(m[id]!==undefined){tabs[m[id]].classList.add('active');tabs[m[id]].setAttribute('aria-selected','true');tabs[m[id]].setAttribute('tabindex','0')}
if(id==='tools')renderMyTools();
odaAnnounce(id+' tab selected');
}
function stuTabKeyNav(e,current){
var idx=stuTabOrder.indexOf(current);if(idx<0)return;
if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
e.preventDefault();
var next=e.key==='ArrowRight'?(idx+1)%stuTabOrder.length:(idx-1+stuTabOrder.length)%stuTabOrder.length;
switchTab(stuTabOrder[next]);
document.getElementById('tab-'+stuTabOrder[next]).focus();
}else if(e.key==='Enter'||e.key===' '){e.preventDefault();switchTab(current)}
}
window.stuTabKeyNav=stuTabKeyNav;

// Auto-switch to tab based on URL hash (e.g. student.html#arcade)
(function(){
  var hash=window.location.hash.replace('#','');
  if(hash&&['work','tools','arcade'].indexOf(hash)>=0){
    setTimeout(function(){switchTab(hash)},100);
  }
})();

var _dashTimer=null;
function renderDashboard(){
if(_dashTimer)clearTimeout(_dashTimer);
_dashTimer=setTimeout(_renderDashboardNow,50);
}
function _renderDashboardNow(){
var assigns=window.myAssignments||[];
var pending=assigns.filter(function(a){return a.status==='pending'||a.status==='returned'});
var submitted=assigns.filter(function(a){return a.status==='submitted'});
var graded=assigns.filter(function(a){return a.status==='graded'});
var completed=assigns.filter(function(a){return a.status==='completed'});
var arcadeLocked=window.studentRecord&&window.studentRecord.arcadeLocked;
var arcadeUnlocked=!arcadeLocked;

// Badge
var badge=document.getElementById('workBadge');
badge.textContent=pending.length;
badge.className='tab-badge'+(pending.length===0?' zero':'');

// Unlock banner (only show if teacher locked arcade and student finished work)
document.getElementById('unlockBanner').className='unlock'+(arcadeLocked&&pending.length===0&&submitted.length===0?' show':'');

// Render assignments
var el=document.getElementById('assignmentList');
if(!assigns.length){
el.innerHTML='<div class="empty-state"><span class="emoji">&#x1F4ED;</span><p>No assignments yet! Your teacher will send you some soon.</p></div>';
}else{
var h='';
// Pending/returned first
pending.forEach(function(a){
var today=new Date().toISOString().split('T')[0];
var overdue=a.status==='pending'&&a.dueDate&&a.dueDate<today;
var isReturned=a.status==='returned';
h+='<div class="a-card pending" id="card-'+a.id+'">';
h+='<div class="a-header"><div class="a-title">'+getEmoji(a)+' '+esc(a.title||a.type)+'</div>';
h+='<span class="a-status '+(isReturned?'status-returned':overdue?'status-overdue':'status-pending')+'">'+(isReturned?'\u{1F504} Returned':overdue?'\u{26A0}\uFE0F Overdue':'Pending')+'</span></div>';
if(a.dueDate)h+='<div class="a-meta">Due: '+a.dueDate+'</div>';
if(isReturned&&a.feedback){
h+='<div class="a-feedback"><div class="a-feedback-label">Teacher Feedback</div>'+esc(a.feedback)+'</div>';
}
h+='<div class="a-actions" id="actions-'+a.id+'">';
h+=getActionButtons(a);
h+='</div></div>';
});
// Submitted
if(submitted.length){
h+='<div class="a-section-label">&#x1F4E4; Submitted ('+submitted.length+')</div>';
submitted.forEach(function(a){
h+='<div class="a-card a-card-submitted">';
h+='<div class="a-header"><div class="a-title">'+getEmoji(a)+' '+esc(a.title||a.type)+'</div>';
h+='<span class="a-status status-submitted">Submitted</span></div>';
h+='<div class="a-meta">Waiting for teacher to review</div>';
h+='</div>';
});
}
// Graded
if(graded.length){
h+='<div class="a-section-label">&#x1F4DD; Graded ('+graded.length+')</div>';
graded.forEach(function(a){
h+='<div class="a-card a-card-graded">';
h+='<div class="a-header"><div class="a-title">'+getEmoji(a)+' '+esc(a.title||a.type)+'</div>';
h+='<span class="a-status status-graded">Graded</span></div>';
var meta=a.gradedAt?'Graded: '+new Date(a.gradedAt).toLocaleDateString():'';
h+='<div class="a-meta">'+meta+'</div>';
if(a.score!==null&&a.score!==undefined)h+='<div class="a-score-wrap"><span class="a-score">'+a.score+'%</span></div>';
if(a.feedback)h+='<div class="a-feedback"><div class="a-feedback-label">Feedback</div>'+esc(a.feedback)+'</div>';
h+='<button class="study-buddy-btn" onclick="event.stopPropagation();aiStudyBuddy(\''+a.id+'\',this)">&#x1F916; AI Study Buddy</button>';
h+='<div class="study-buddy-result" id="buddy-'+a.id+'"></div>';
h+='</div>';
});
}
// Completed
if(completed.length){
h+='<div class="a-section-label">&#x2705; Completed ('+completed.length+')</div>';
completed.sort(function(a,b){return(b.completedAt||'').localeCompare(a.completedAt||'')});
completed.forEach(function(a){
h+='<div class="a-card completed">';
h+='<div class="a-header"><div class="a-title">'+getEmoji(a)+' '+esc(a.title||a.type)+'</div>';
h+='<span class="a-status status-done">\u2705 Done</span></div>';
var when=a.completedAt?new Date(a.completedAt).toLocaleDateString():'';
var sc=(a.score!==null&&a.score!==undefined)?' \u2022 Score: '+a.score+'%':'';
h+='<div class="a-meta">'+when+sc+'</div>';
h+='</div>';
});
}
el.innerHTML=h;
}

// Arcade
renderArcade();
}

function getEmoji(a){
var toolId=a.toolType||a.type;
var map={'spelling-k2':'\u{1F4D6}','spelling-34':'\u{1F4D6}','spelling-58':'\u{1F4D6}','vocab-k2':'\u{1F4AC}','vocab-34':'\u{1F4AC}','vocab-58':'\u{1F4AC}','pitch-challenge':'\u{1F4A1}','elevator-pitch':'\u{1F3A4}','lemonade-day':'\u{1F34B}','free-play':'\u{1F3AE}'};
if(map[toolId])return map[toolId];
var tmap={tool:'\u{1F6E0}\uFE0F',assignment:'\u{1F4CB}',worksheet:'\u{1F4CB}',link:'\u{1F4CB}',custom:'\u{1F4CB}'};
return tmap[a.type]||'\u{1F4CB}';
}

function getActionButtons(a){
var toolId=a.toolType||a.type;

// Tool assignments — pitch/elevator/lemonade
if(toolId==='pitch-challenge'||toolId==='elevator-pitch'){
var link=toolId==='pitch-challenge'?'pitch.html':'elevator.html';
var sid=localStorage.getItem('studentId')||'';
link+='?assignmentId='+encodeURIComponent(a.id)+'&studentId='+encodeURIComponent(sid);
return '<a class="a-btn start" href="'+link+'">Start Pitch \u{1F680}</a>';
}
if(toolId==='lemonade-day'){
return '<a class="a-btn start" href="lemonade.html">Open Lemonade Day \u{1F34B}</a>';
}
// Tool assignments — spelling/vocab quizzes
if(toolId&&(toolId.startsWith('spelling')||toolId.startsWith('vocab'))){
return '<button class="a-btn start" onclick="startQuiz(\''+a.id+'\',\''+toolId+'\')">Start Quiz \u{1F680}</button>';
}

// Assignment type (also handles legacy worksheet/link/custom)
if(a.type==='assignment'||a.type==='worksheet'||a.type==='link'||a.type==='custom'){
var bh='';
if(a.instructions)bh+='<div class="a-instructions">'+esc(a.instructions)+'</div>';
if(a.linkUrl&&/^https?:\/\//i.test(a.linkUrl))bh+='<div class="a-link-wrap"><a class="a-btn start" href="'+esc(a.linkUrl)+'" target="_blank" rel="noopener noreferrer">Open Link \u{1F517}</a></div>';
if(a.fileUrl||a.fileData){
var fSrc=a.fileUrl||null;
var isImage=a.fileUrl?a.fileUrl.match(/\.(png|jpg|jpeg|gif|webp)/i):false;
if(!fSrc&&a.fileData){
// Legacy base64
if(a.fileData.startsWith('data:image')){isImage=true;fSrc=a.fileData;}
else{fSrc=dataUriToBlobUrl(a.id,a.fileData);}
}
if(fSrc){
if(isImage){
bh+='<div class="a-file-preview"><img src="'+esc(fSrc)+'" alt="Attachment"></div>';
}else{
var openLink=a.fileUrl?esc(a.fileUrl):'#" onclick="openFileBlob(\''+a.id+'\');return false';
bh+='<div class="a-file-preview a-file-embed"><iframe src="'+esc(fSrc)+'" class="a-file-iframe"></iframe><div class="a-file-actions"><a href="'+openLink+'" target="_blank" class="a-btn start a-btn-sm">Open Full Screen \u{1F4C4}</a></div></div>';
}
}
}
if(a.gradingType==='teacher'){
bh+='<textarea class="a-response" id="resp-'+a.id+'" placeholder="Type your response here...">'+esc(a.studentResponse||'')+'</textarea>';
bh+='<div><button class="a-btn start a-btn-full" onclick="submitWork(\''+a.id+'\')">Submit \u{1F4E4}</button></div>';
}else{
bh+='<div><button class="a-btn done-btn a-btn-full" onclick="markDone(\''+a.id+'\')">Mark Done \u{2705}</button></div>';
}
return bh;
}

// Fallback for old-format tool assignments
if(a.type==='tool'){
return '<button class="a-btn done-btn" onclick="markDone(\''+a.id+'\')">Mark Done \u{2705}</button>';
}

return '';
}

// ===== QUIZ SYSTEM =====
function startQuiz(assignId,type){
var words=WORD_BANKS[type];
if(!words)return;
activeQuiz={assignId:assignId,words:words.slice(),current:0,correct:0,type:type};
if(type.startsWith('spelling'))renderSpelling();
else renderVocab();
}
window.startQuiz=startQuiz;

function renderSpelling(){
var q=activeQuiz;
if(q.current>=q.words.length){finishQuiz();return}
var word=q.words[q.current];
var el=document.getElementById('actions-'+q.assignId);
var h='<div class="quiz-area">';
h+='<div class="quiz-progress"><span>'+(q.current+1)+'/'+q.words.length+'</span><span>'+q.correct+' correct</span></div>';
h+='<div class="quiz-word" id="qWord">'+esc(word)+'</div>';
h+='<input type="text" class="quiz-input" id="qInput" placeholder="Type the word..." autocomplete="off" spellcheck="false">';
h+='<div class="quiz-feedback" id="qFb" role="status" aria-live="polite"></div>';
h+='<button class="quiz-btn" onclick="checkSpelling()">Check \u{2714}\uFE0F</button>';
h+='</div>';
el.innerHTML=h;
setTimeout(function(){var w=document.getElementById('qWord');if(w)w.textContent='\u{2022} \u{2022} \u{2022} \u{2022}';var inp=document.getElementById('qInput');if(inp)inp.focus()},2500);
}

function checkSpelling(){
var inp=document.getElementById('qInput').value.trim().toLowerCase();
var word=activeQuiz.words[activeQuiz.current].toLowerCase();
var fb=document.getElementById('qFb');
if(inp===word){activeQuiz.correct++;fb.innerHTML='<span class="quiz-correct">\u{2705} Correct!</span>'}
else fb.innerHTML='<span class="quiz-wrong">\u{274C} It was: '+esc(activeQuiz.words[activeQuiz.current])+'</span>';
activeQuiz.current++;
setTimeout(renderSpelling,1200);
}
window.checkSpelling=checkSpelling;

function renderVocab(){
var q=activeQuiz;
if(q.current>=q.words.length){finishQuiz();return}
var item=q.words[q.current];
var opts=[item.d].concat(item.wrong);
for(var i=opts.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=opts[i];opts[i]=opts[j];opts[j]=t}
var el=document.getElementById('actions-'+q.assignId);
var h='<div class="quiz-area">';
h+='<div class="quiz-progress"><span>'+(q.current+1)+'/'+q.words.length+'</span><span>'+q.correct+' correct</span></div>';
h+='<div class="quiz-word">'+esc(item.w)+'</div>';
h+='<div class="vocab-opts">';
for(var i=0;i<opts.length;i++){
h+='<div class="vocab-opt" onclick="checkVocab(this,\''+esc(opts[i]).replace(/'/g,"\\'")+'\',\''+esc(item.d).replace(/'/g,"\\'")+'\')">'+esc(opts[i])+'</div>';
}
h+='</div><div class="quiz-feedback" id="qFb" role="status" aria-live="polite"></div></div>';
el.innerHTML=h;
}

function checkVocab(el,picked,correct){
var fb=document.getElementById('qFb');
var opts=document.querySelectorAll('.vocab-opt');
for(var i=0;i<opts.length;i++)opts[i].style.pointerEvents='none';
if(picked===correct){el.classList.add('correct');activeQuiz.correct++;fb.innerHTML='<span class="quiz-correct">\u{2705} Correct!</span>'}
else{el.classList.add('wrong');for(var i=0;i<opts.length;i++){if(opts[i].textContent===correct)opts[i].classList.add('correct')}fb.innerHTML='<span class="quiz-wrong">\u{274C} Not quite!</span>'}
activeQuiz.current++;
setTimeout(renderVocab,1200);
}
window.checkVocab=checkVocab;

var _submitting={};
async function finishQuiz(){
if(!activeQuiz||_submitting.quiz)return;_submitting.quiz=true;
var pct=Math.round(activeQuiz.correct/activeQuiz.words.length*100);
var passed=pct>=60;
var el=document.getElementById('actions-'+activeQuiz.assignId);
el.innerHTML='<div class="quiz-result"><div class="quiz-result-emoji">'+(passed?'\u{1F389}':'\u{1F914}')+'</div><div class="quiz-result-title">'+(passed?'Great Job!':'Try Again!')+'</div><div class="quiz-result-meta">'+activeQuiz.correct+'/'+activeQuiz.words.length+' ('+pct+'%)'+(passed?'':' — need 60%')+'</div>'+(passed?'':'<button class="a-btn start" onclick="startQuiz(\''+activeQuiz.assignId+'\',\''+activeQuiz.type+'\')">Retry \u{1F504}</button>')+'</div>';
if(passed){
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',activeQuiz.assignId),{status:'completed',completedAt:new Date().toISOString(),score:pct});
fireConfetti();
}catch(e){console.error(e)}
}
activeQuiz=null;_submitting.quiz=false;
}

async function submitWork(assignId){
if(_submitting[assignId])return;
var resp=document.getElementById('resp-'+assignId);
if(!resp||!resp.value.trim()){odaToast('Please type your response before submitting','warning');return}
_submitting[assignId]=true;
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',assignId),{
studentResponse:resp.value.trim(),status:'submitted',submittedAt:new Date().toISOString()
});
fireConfetti();
}catch(e){console.error(e);odaToast('Error submitting. Try again.','error')}
finally{_submitting[assignId]=false}
}
window.submitWork=submitWork;

/* dataUriToBlobUrl provided by oda-core.js */

function openFileBlob(assignId){
var a=(window.myAssignments||[]).find(function(x){return x.id===assignId});
if(!a||!a.fileData)return;
window.open(dataUriToBlobUrl(a.id,a.fileData),'_blank');
}
window.openFileBlob=openFileBlob;

async function markDone(assignId){
if(_submitting[assignId])return;_submitting[assignId]=true;
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',assignId),{
status:'completed',completedAt:new Date().toISOString()
});
fireConfetti();
}catch(e){console.error(e);odaToast('Error marking done. Try again.','error')}
finally{_submitting[assignId]=false}
}
window.markDone=markDone;

async function completePitch(assignId){
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',assignId),{status:'completed',completedAt:new Date().toISOString(),score:100});
fireConfetti();
}catch(e){console.error(e)}
}
window.completePitch=completePitch;

var arcadeFilter='All';
var arcadeSearch='';
var _arcadeRendered=false;
/* coverCache + cover art functions in oda-covers.js */

/** Get recent games from localStorage */
function getRecentGames(){
try{var r=JSON.parse(localStorage.getItem('recentGames')||'[]');return r}catch(e){return[]}
}
/** Track a game play in recently played */
function trackRecentGame(gameId){
var recent=getRecentGames();
recent=recent.filter(function(id){return id!==gameId});
recent.unshift(gameId);
if(recent.length>5)recent=recent.slice(0,5);
localStorage.setItem('recentGames',JSON.stringify(recent));
}
/** Navigate to a game and track it */
function playArcadeGame(file,gameId){
trackRecentGame(gameId);
location.href=file;
}
window.playArcadeGame=playArcadeGame;

/** Category definitions for filter pills */
var ARCADE_CATEGORIES=[
  {id:'All',label:'All',icon:'\u{1F3AE}'},
  {id:'Multiplayer',label:'Multiplayer',icon:'\u{1F91D}'},
  {id:'Action',label:'Action',icon:'\u{1F579}\uFE0F'},
  {id:'Puzzle',label:'Puzzle',icon:'\u{1F9E9}'},
  {id:'Strategy',label:'Strategy',icon:'\u265F\uFE0F'},
  {id:'Word',label:'Word',icon:'\u{1F4DA}'},
  {id:'Sports',label:'Sports',icon:'\u26BD'}
];

/** Count games in a category */
function countGamesInCategory(catId){
if(catId==='All')return GAMES.length;
return GAMES.filter(function(g){return g.categories&&g.categories.indexOf(catId)!==-1}).length;
}

/** Apply arcade filters (category + search) by show/hide */
function applyArcadeFilters(){
var cards=document.querySelectorAll('.game-cover-card[data-game-id]');
var q=arcadeSearch.toLowerCase().trim();
var visibleCount=0;
cards.forEach(function(card){
  var gid=card.getAttribute('data-game-id');
  var game=null;
  for(var i=0;i<GAMES.length;i++){if(GAMES[i].id===gid){game=GAMES[i];break}}
  if(!game){card.style.display='none';return}
  var matchesCat=arcadeFilter==='All'||(game.categories&&game.categories.indexOf(arcadeFilter)!==-1);
  var matchesSearch=!q||game.title.toLowerCase().indexOf(q)!==-1;
  if(matchesCat&&matchesSearch){card.style.display='';visibleCount++}else{card.style.display='none'}
});
// Update filter pill active states
var pills=document.querySelectorAll('.arcade-filter-pill');
pills.forEach(function(p){
  if(p.getAttribute('data-cat')===arcadeFilter)p.classList.add('active');
  else p.classList.remove('active');
});
// Update game count display
var countEl=document.getElementById('arcadeGameCount');
if(countEl)countEl.textContent=visibleCount+' game'+(visibleCount!==1?'s':'');
// Update recently played visibility
var recentRow=document.getElementById('arcadeRecentRow');
if(recentRow){recentRow.style.display=(arcadeFilter==='All'&&!q)?'':'none'}
}
window.applyArcadeFilters=applyArcadeFilters;

/** Set arcade category filter */
function setArcadeFilter(catId){
arcadeFilter=catId;
applyArcadeFilters();
}
window.setArcadeFilter=setArcadeFilter;

/** Handle arcade search input */
function onArcadeSearch(val){
arcadeSearch=val;
applyArcadeFilters();
}
window.onArcadeSearch=onArcadeSearch;

function renderArcade(){
var arcadeLocked=window.studentRecord&&window.studentRecord.arcadeLocked;
var assigns=window.myAssignments||[];
var pending=assigns.filter(function(a){return a.status==='pending'||a.status==='returned'});
var submitted=assigns.filter(function(a){return a.status==='submitted'});
var locked=arcadeLocked&&(pending.length>0||submitted.length>0);
var coins=(window.studentRecord&&window.studentRecord.coins)||0;

// Only build the full DOM once; subsequent calls just update lock state
if(_arcadeRendered){
  // Update locked state on existing cards
  var cards=document.querySelectorAll('.game-cover-card[data-game-id]');
  cards.forEach(function(card){
    if(locked){card.classList.add('locked');card.setAttribute('tabindex','-1')}
    else{card.classList.remove('locked');card.setAttribute('tabindex','0')}
  });
  // Update coin display in shop banner
  var coinEl=document.getElementById('arcadeShopCoins');
  if(coinEl)coinEl.textContent=coins;
  return;
}
_arcadeRendered=true;

var h='';

// Search bar
h+='<div class="arcade-search-wrap">';
h+='<input type="text" class="arcade-search" id="arcadeSearchInput" placeholder="Search games..." oninput="onArcadeSearch(this.value)" autocomplete="off">';
h+='</div>';

// Category filter pills with game counts
h+='<div class="arcade-filters" id="arcadeFilters">';
ARCADE_CATEGORIES.forEach(function(c){
  var count=countGamesInCategory(c.id);
  h+='<button class="arcade-filter-pill'+(arcadeFilter===c.id?' active':'')+'" data-cat="'+c.id+'" onclick="setArcadeFilter(\''+c.id+'\')">';
  h+=c.icon+' '+c.label+' <span class="arcade-pill-count">'+count+'</span></button>';
});
h+='</div>';

// Game count summary
h+='<div class="arcade-game-count" id="arcadeGameCount">'+GAMES.length+' games</div>';

// Recently Played section
var recent=getRecentGames();
var recentGames=[];
recent.forEach(function(rid){
  for(var i=0;i<GAMES.length;i++){if(GAMES[i].id===rid){recentGames.push(GAMES[i]);break}}
});
if(recentGames.length>0){
  h+='<div class="arcade-recent" id="arcadeRecentRow">';
  h+='<div class="arcade-recent-label">\u{1F552} Recently Played</div>';
  h+='<div class="arcade-recent-scroll">';
  recentGames.forEach(function(g){
    var cover=generateCover(g);
    h+='<div class="arcade-recent-card'+(locked?' locked':'')+'" role="button" tabindex="'+(locked?'-1':'0')+'" '+(locked?'':'onclick="playArcadeGame(\''+g.file+'\',\''+g.id+'\')"')+'>';
    h+='<div class="arcade-recent-img" style="background-image:url('+cover+')"></div>';
    h+='<div class="arcade-recent-title">'+g.title+'</div>';
    h+='</div>';
  });
  h+='</div></div>';
}

// Shop banner
h+='<div class="game-cover-card shop-banner" role="button" tabindex="0" onclick="location.href=\'shop.html\'">';
h+='<div class="shop-banner-inner"><span style="font-size:32px">\u{1F6CD}\uFE0F</span>';
h+='<div><div style="font-weight:800;font-size:16px;font-family:Fredoka,sans-serif">ODA Shop</div>';
h+='<div style="color:var(--text2);font-size:13px">\u{1FA99} <span id="arcadeShopCoins">'+coins+'</span> coins \u2014 Avatars, colors & more</div></div></div></div>';

// Game cards with cover images — render ALL games, show/hide via filters
h+='<div class="game-cover-grid" id="arcadeCoverGrid">';
GAMES.forEach(function(g){
  var cover=generateCover(g);
  h+='<div class="game-cover-card'+(locked?' locked':'')+'" data-game-id="'+g.id+'" role="button" tabindex="'+(locked?'-1':'0')+'" '+(locked?'':'onclick="playArcadeGame(\''+g.file+'\',\''+g.id+'\')"')+'>';
  var catColors={multiplayer:'#06d6a0',arcade:'#ef476f',puzzle:'#118ab2',word:'#ffd166',strategy:'#a855f7'};
  var catLabels={multiplayer:'MULTIPLAYER',arcade:'ARCADE',puzzle:'PUZZLE',word:'WORD',strategy:'STRATEGY'};
  h+='<div class="game-cover-img" style="background-image:url('+cover+')">';
  h+='<span class="game-cat-badge" style="background:'+(catColors[g.cat]||'#06d6a0')+'">'+(catLabels[g.cat]||'')+'</span>';
  h+='</div>';
  h+='<div class="game-cover-info">';
  h+='<div class="game-cover-title">'+g.title+'</div>';
  h+='<div class="game-cover-desc">'+(locked?'Finish your work first!':g.desc)+'</div>';
  h+='</div></div>';
});
h+='</div>';

document.getElementById('gameGrid').innerHTML=h;

// Apply current filter state after render
applyArcadeFilters();
}

// ===== MY TOOLS =====
var ODA_TOOLS=[
{id:'pitch-challenge',emoji:'\u{1F4A1}',name:'Pitch Challenge',desc:'Build and record your business pitch!',url:'pitch.html',storageKey:'oda-pitch-projects'},
{id:'elevator-pitch',emoji:'\u{1F3A4}',name:'Elevator Pitch',desc:'Practice your 30-second elevator pitch!',url:'elevator.html',storageKey:null},
{id:'lemonade-day',emoji:'\u{1F34B}',name:'Lemonade Day',desc:'Build a real business with your team!',url:'lemonade.html',storageKey:null},
{id:'spelling',emoji:'\u{1F4D6}',name:'Spelling Bee',desc:'Practice spelling with fun challenges!',url:'spelling.html',storageKey:null},
{id:'jeopardy',emoji:'\u{1F3AF}',name:'Jeopardy',desc:'Play the classic game show with custom questions!',url:'jeopardy.html',storageKey:null},
{id:'kahoot',emoji:'\u26A1',name:'Quiz Blitz',desc:'Fast-paced timed quizzes — speed matters!',url:'kahoot.html',storageKey:null},
{id:'flashcards',emoji:'\u{1F4DA}',name:'Flashcards',desc:'Study with flip cards, quizzes & matching games!',url:'flashcards.html',storageKey:null},
{id:'wordsearch',emoji:'\u{1F50D}',name:'Word Search',desc:'Find hidden words in the puzzle grid!',url:'wordsearch.html',storageKey:null},
{id:'crossword',emoji:'\u270F\uFE0F',name:'Crossword',desc:'Solve crossword puzzles with vocabulary clues!',url:'crossword.html',storageKey:null},
{id:'library',emoji:'\u{1F4D6}',name:'Library',desc:'Read passages and answer comprehension questions!',url:'library.html',storageKey:null},
{id:'canvas',emoji:'\u{1F3A8}',name:'ODA Canvas',desc:'Draw, design posters, t-shirts & more!',url:'canvas.html',storageKey:null},
{id:'timer',emoji:'\u23F0',name:'Timer',desc:'Clock, countdown, stopwatch & alarms!',url:'timer.html',storageKey:null},
{id:'scoreboard',emoji:'\u{1F3C6}',name:'Scoreboard',desc:'Team scoreboard for classroom competitions!',url:'scoreboard.html',storageKey:null},
{id:'raffle',emoji:'\u{1F3B0}',name:'Raffle',desc:'Spend coins on raffle entries to win prizes!',url:'raffle.html',storageKey:null},
];
var COMING_SOON_TOOLS=[
{id:'oda-world',emoji:'\u{1F30D}',name:'ODA World',desc:'Explore an immersive virtual campus!'},
{id:'debate',emoji:'\u{1F5E3}\uFE0F',name:'Debate Club',desc:'Practice persuasive arguments!'}
];

function renderMyTools(){
var grid=document.getElementById('toolsGrid');
var h='';
ODA_TOOLS.forEach(function(t){
var count=0;
if(t.storageKey){try{var items=JSON.parse(localStorage.getItem(t.storageKey)||'[]');var sid=localStorage.getItem('studentId');if(sid){items=items.filter(function(p){return p.studentId===sid})}count=items.length}catch(e){}}
h+='<div class="tool-card" role="button" tabindex="0" onclick="window.open(\''+t.url+'\',\'_self\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window.open(\''+t.url+'\',\'_self\')}">';
h+='<span class="tc-emoji">'+t.emoji+'</span>';
h+='<div class="tc-name">'+t.name+'</div>';
h+='<div class="tc-desc">'+t.desc+'</div>';
if(count>0)h+='<span class="tc-count">'+count+' saved</span>';
h+='</div>';
});
grid.innerHTML=h;

var coming=document.getElementById('toolsComingSoon');
var ch='';
COMING_SOON_TOOLS.forEach(function(t){
ch+='<div class="tool-card coming-soon">';
ch+='<span class="tc-emoji">'+t.emoji+'</span>';
ch+='<div class="tc-name">'+t.name+'</div>';
ch+='<div class="tc-desc">'+t.desc+'</div>';
ch+='</div>';
});
coming.innerHTML=ch;
}

function studentLogout(){
var msg='Are you sure you want to log out?';
var overlay=document.createElement('div');
overlay.className='logout-overlay';
overlay.innerHTML='<div class="logout-card"><p>'+msg+'</p><div class="logout-btns"><button id="logoutCancel" class="btn btn-outline">Cancel</button><button id="logoutConfirm" class="btn btn-accent">Log Out</button></div></div>';
document.body.appendChild(overlay);
document.getElementById('logoutConfirm').onclick=function(){localStorage.removeItem('studentId');localStorage.removeItem('studentName');localStorage.removeItem('classCode');localStorage.removeItem('encourageShown');window.location.href='index.html'};
document.getElementById('logoutCancel').onclick=function(){overlay.remove()};
overlay.onclick=function(e){if(e.target===overlay)overlay.remove()};
}
window.studentLogout=studentLogout;

/** Trigger confetti celebration — delegates to odaConfetti from oda-core.js */
function fireConfetti(){ if(window.odaConfetti) odaConfetti(); }

document.addEventListener('keydown',function(e){if(e.key==='Enter'&&document.activeElement&&document.activeElement.id==='qInput')checkSpelling()});

// ===== AI STUDY BUDDY (8e) =====
async function aiStudyBuddy(assignId,btn){
var a=(window.myAssignments||[]).find(function(x){return x.id===assignId});
if(!a)return;
var result=document.getElementById('buddy-'+assignId);
if(!result)return;

// Toggle off if already showing
if(result.classList.contains('show')){result.classList.remove('show');return}

btn.classList.add('loading');btn.textContent='Thinking...';
result.classList.add('show');result.textContent='Loading...';

var prompt='You are a friendly AI study buddy for a K-12 student named '+(window.studentName||'Student')+'. They just completed an assignment: "'+
(a.title||a.type)+'". Their score was: '+(a.score!==null?a.score+'%':'not scored')+'. Teacher feedback: "'+(a.feedback||'None')+'". '+
'In a friendly, encouraging way, explain what they did well and what they could improve. Use simple language appropriate for a young student. '+
'Give 1-2 specific tips they can use next time. Keep it to 3-4 sentences. Be warm and supportive.';

try{
var text=await odaAI(prompt);
result.textContent=text;
}catch(e){console.error(e);result.textContent='Oops! Something went wrong. Try again later.'}
btn.classList.remove('loading');btn.innerHTML='&#x1F916; AI Study Buddy';
}
window.aiStudyBuddy=aiStudyBuddy;

// ===== AI ENCOURAGEMENT BANNER (8f) =====
var encourageShown=localStorage.getItem('encourageShown');
var _encourageRetries=0;
function generateEncouragement(){
if(encourageShown)return;
// Wait for assignments to load (max 5 retries)
var assigns=window.myAssignments;
if(!assigns||!assigns.length){if(_encourageRetries++<5){setTimeout(generateEncouragement,1500)}return}

var completed=assigns.filter(function(a){return a.status==='completed'||a.status==='graded'}).length;
var pending=assigns.filter(function(a){return a.status==='pending'}).length;
var scores=assigns.filter(function(a){return a.score!==null&&a.score!==undefined}).map(function(a){return a.score});
var avg=scores.length?Math.round(scores.reduce(function(s,v){return s+v},0)/scores.length):'N/A';

var prompt='You are a fun, encouraging AI buddy for a K-12 afterschool student named '+(window.studentName||'Student')+'. '+
'They have completed '+completed+' assignment(s) with '+pending+' still pending. Average score: '+avg+'. '+
'Write a SHORT (1-2 sentences) motivational message to start their session. Be upbeat, use age-appropriate language, and reference their progress. '+
'Do NOT use emojis. Keep it under 30 words.';

odaAI(prompt).then(function(text){
if(text){
document.getElementById('encourageText').textContent=text;
document.getElementById('encourageBanner').classList.add('show');
localStorage.setItem('encourageShown','1');
}
}).catch(function(e){console.error('Encouragement error:',e)});
}
setTimeout(generateEncouragement,2000);

// ===== FEEDBACK SYSTEM =====
var _feedbackTrapCleanup=null;
function openFeedbackModal(type){
var modal=document.getElementById('feedbackModal');
var title=document.getElementById('feedbackTitle');
var desc=document.getElementById('feedbackDesc');
title.textContent=type==='bug'?'\u{1F41B} Report a Bug':'\u{1F4A1} Request a Feature';
desc.placeholder=type==='bug'?'Describe the bug...':'Describe your idea...';
desc.value='';
document.getElementById('feedbackPage').value='';
modal.dataset.type=type;
modal.style.display='flex';modal.classList.add('show');
_feedbackTrapCleanup=odaTrapFocus(modal);
}
window.openFeedbackModal=openFeedbackModal;

function closeFeedbackModal(){
if(_feedbackTrapCleanup){_feedbackTrapCleanup();_feedbackTrapCleanup=null}
var fm=document.getElementById('feedbackModal');fm.classList.remove('show');fm.style.display='none';
}
window.closeFeedbackModal=closeFeedbackModal;

async function submitFeedback(){
var modal=document.getElementById('feedbackModal');
var type=modal.dataset.type;
var message=document.getElementById('feedbackDesc').value.trim();
var page=document.getElementById('feedbackPage').value.trim();
if(!message){odaToast('Please describe your feedback.','warning');return}
var btn=document.getElementById('feedbackSubmitBtn');
btn.disabled=true;btn.textContent='Submitting...';
try{
var fb=await getFirebaseDB();
await fb.fsMod.addDoc(fb.fsMod.collection(fb.db,'feedback'),{
type:type,
message:message,
page:page,
userName:localStorage.getItem('studentName')||'Anonymous',
userRole:'student',
userId:localStorage.getItem('studentId')||'',
classCode:localStorage.getItem('classCode')||'',
status:'new',
createdAt:fb.fsMod.serverTimestamp()
});
odaToast('Thanks! Your feedback has been submitted.','success');
closeFeedbackModal();
}catch(e){console.error(e);odaToast('Error submitting feedback.','error')}
btn.disabled=false;btn.textContent='Submit';
}
window.submitFeedback=submitFeedback;
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var m=document.getElementById('feedbackModal');if(m&&(m.classList.contains('show')||m.style.display==='flex'))closeFeedbackModal()}});

// ===== COSMETICS DISPLAY =====
// Called from onSnapshot in student.html — no extra Firestore read needed
function applyStudentCosmetics(d) {
  if (!d) return;

  // Update coins display
  var coinEl = document.getElementById('coinDisplay');
  if (coinEl) coinEl.textContent = (d.coins || 0);

  // Update avatar
  var eq = d.equipped || {};
  var avatarEl = document.getElementById('stuAvatar');
  if (avatarEl && eq.avatar && eq.avatar.emoji) {
    avatarEl.textContent = eq.avatar.emoji;
  }
  if (avatarEl && eq.border && eq.border.value && eq.border.value !== 'none') {
    avatarEl.style.boxShadow = eq.border.value;
  }

  // Update name color
  var nameEl = document.getElementById('studentNameEl');
  if (nameEl && eq.nameColor && eq.nameColor.value) {
    if (eq.nameColor.type === 'gradient' || eq.nameColor.type === 'animated-gradient') {
      nameEl.style.background = eq.nameColor.value;
      nameEl.style.webkitBackgroundClip = 'text';
      nameEl.style.webkitTextFillColor = 'transparent';
      nameEl.style.backgroundClip = 'text';
      if (eq.nameColor.type === 'animated-gradient') {
        nameEl.style.backgroundSize = '200% 100%';
        nameEl.style.animation = 'gradientShift 3s linear infinite';
      }
    } else {
      nameEl.style.color = eq.nameColor.value;
    }
  }
}
window.applyStudentCosmetics = applyStudentCosmetics;

// ===== PLAYER LEVELS + XP DISPLAY =====
var _currentXP = 0;
var _currentLevelInfo = null;

/** Update all XP/Level UI elements on the dashboard */
function updateXPDisplay(xp) {
  _currentXP = xp || 0;
  if (!window.odaXP) return;
  var info = window.odaXP.getLevel(_currentXP);
  _currentLevelInfo = info;

  // Topbar level badge
  var badge = document.getElementById('levelBadge');
  if (badge) {
    badge.textContent = 'Lv.' + info.level;
    badge.title = info.title + ' — ' + _currentXP + ' XP';
    // Color the badge based on level tier
    badge.className = 'level-badge level-tier-' + getLevelTier(info.level);
  }

  // XP progress bar
  var barLevel = document.getElementById('xpBarLevel');
  var barText = document.getElementById('xpBarText');
  var barFill = document.getElementById('xpBarFill');
  if (barLevel) barLevel.textContent = 'Lv.' + info.level + ' ' + info.title;
  if (barText) {
    if (info.level >= 50) {
      barText.textContent = _currentXP.toLocaleString() + ' XP — MAX LEVEL';
    } else {
      barText.textContent = _currentXP.toLocaleString() + ' / ' + info.xpForNext.toLocaleString() + ' XP';
    }
  }
  if (barFill) {
    var pct = Math.round(info.xpProgress * 100);
    barFill.style.width = pct + '%';
  }
}

/** Get tier name for badge coloring */
function getLevelTier(level) {
  if (level >= 50) return 'goat';
  if (level >= 40) return 'champion';
  if (level >= 30) return 'legend';
  if (level >= 25) return 'master';
  if (level >= 20) return 'expert';
  if (level >= 15) return 'veteran';
  if (level >= 10) return 'competitor';
  if (level >= 5) return 'star';
  return 'rookie';
}

/** Show level-up celebration overlay */
function showLevelUpCelebration(detail) {
  var overlay = document.getElementById('levelUpOverlay');
  if (!overlay) return;
  var numEl = document.getElementById('levelUpNumber');
  var titleEl = document.getElementById('levelUpTitle');
  if (numEl) numEl.textContent = detail.newLevel;
  if (titleEl) titleEl.textContent = detail.newTitle || '';
  overlay.style.display = 'flex';
  overlay.classList.add('show');
  // Confetti
  if (window.odaConfetti) window.odaConfetti();
  // Announce for screen readers
  if (window.odaAnnounce) window.odaAnnounce('Level up! You are now level ' + detail.newLevel + ', ' + (detail.newTitle || ''));
  // Auto-dismiss after 3.5 seconds
  setTimeout(function() {
    overlay.classList.remove('show');
    setTimeout(function() { overlay.style.display = 'none'; }, 400);
  }, 3500);
  // Click to dismiss early
  overlay.onclick = function() {
    overlay.classList.remove('show');
    setTimeout(function() { overlay.style.display = 'none'; }, 400);
  };
}

// Listen for level-up events from odaXP
window.addEventListener('oda-level-up', function(e) {
  showLevelUpCelebration(e.detail);
});

// Listen for XP gained events to refresh display
window.addEventListener('oda-xp-gained', function(e) {
  if (e.detail && e.detail.totalXP !== undefined) {
    updateXPDisplay(e.detail.totalXP);
  }
});

/** Load XP from student record — called when studentRecord is available */
function loadStudentXP() {
  var d = window.studentRecord;
  if (d && d.xp !== undefined) {
    updateXPDisplay(d.xp);
  } else {
    updateXPDisplay(0);
  }
}

// Hook into the existing onSnapshot callback — studentRecord is set there
var _origRenderDashboard = window.renderDashboard || renderDashboard;
var __xpInitialized = false;
// We piggyback on the existing renderDashboard since it's called from onSnapshot
var _origRenderDashNow = _renderDashboardNow;
_renderDashboardNow = function() {
  _origRenderDashNow();
  // Update XP display whenever dashboard re-renders (student record changed)
  if (window.studentRecord) {
    updateXPDisplay(window.studentRecord.xp || 0);
  }
};

// ===== PROFILE CARD =====
var PROFILE_ACHIEVEMENTS = [
  { id:'ach_first_game', name:'First Steps', icon:'\u{1F3AF}' },
  { id:'ach_play_10', name:'Warming Up', icon:'\u{1F3C3}' },
  { id:'ach_play_100', name:'Dedicated', icon:'\u{1F4AA}' },
  { id:'ach_first_win', name:'First Win', icon:'\u2B50' },
  { id:'ach_win_50', name:'Fifty Wins', icon:'\u{1F3C6}' },
  { id:'ach_win_100', name:'Century', icon:'\u{1F451}' },
  { id:'ach_streak_5', name:'On Fire', icon:'\u{1F525}' },
  { id:'ach_streak_10', name:'Unstoppable', icon:'\u26A1' },
  { id:'ach_ai_hard', name:'AI Slayer', icon:'\u{1F916}' },
  { id:'ach_ai_master', name:'AI Master', icon:'\u{1F9E0}' },
  { id:'ach_tourney_win', name:'Tournament Victor', icon:'\u{1F3C5}' },
  { id:'ach_diverse', name:'Explorer', icon:'\u{1F3AE}' },
  { id:'ach_completionist', name:'Completionist', icon:'\u{1F31F}' },
  { id:'ach_coins_1000', name:'Coin Collector', icon:'\u{1F4B0}' },
  { id:'ach_shopper', name:'Shopper', icon:'\u{1F6D2}' },
  { id:'ach_snake_master', name:'Snake Charmer', icon:'\u{1F40D}' },
  { id:'ach_chess_master', name:'Chess Master', icon:'\u265F\uFE0F' },
  { id:'ach_fruit_ninja_master', name:'Fruit Samurai', icon:'\u{1F349}' },
  { id:'ach_aim_trainer_master', name:'Bullseye', icon:'\u{1F3AF}' },
  { id:'ach_memory_match_master', name:'Memory King', icon:'\u{1F9E0}' }
];

// Rarity priority for showcase ordering (higher = more impressive)
var ACH_PRIORITY = {
  'ach_win_100':10,'ach_completionist':10,'ach_streak_10':9,'ach_tourney_win':9,
  'ach_ai_master':8,'ach_chess_master':8,'ach_win_50':7,'ach_snake_master':7,
  'ach_fruit_ninja_master':7,'ach_aim_trainer_master':7,'ach_memory_match_master':7,
  'ach_ai_hard':6,'ach_streak_5':6,'ach_coins_1000':5,'ach_play_100':5,
  'ach_diverse':4,'ach_shopper':4,'ach_play_10':3,'ach_first_win':2,'ach_first_game':1
};

// Game record collections to check for gamesPlayed
var GAME_RECORD_COLLECTIONS = [
  'snakeRecords','chessRecords','connect4Records','checkersRecords','battleshipRecords',
  'tictactoeRecords','rpsRecords','unoRecords','dominoesRecords','penaltykickRecords',
  'pingpongRecords','flappyRecords','fruitninjaRecords','brickbreakerRecords',
  'whackamoleRecords','aimtrainerRecords','coinminerRecords','2048Records',
  'solitaireRecords','blockblastRecords','suikaRecords','simonsaysRecords',
  'memoryRecords','wordleRecords','hangmanRecords','triviaRecords','typingRecords',
  'bowlingRecords'
];

var _cachedGamesPlayed = null;

async function loadTotalGamesPlayed() {
  if (_cachedGamesPlayed !== null) return _cachedGamesPlayed;
  var sid = window.studentId;
  if (!sid || !window.fbDb) return 0;
  var total = 0;
  var promises = GAME_RECORD_COLLECTIONS.map(function(col) {
    return window.fbGetDoc(window.fbDoc(window.fbDb, col, sid)).then(function(snap) {
      if (snap.exists()) {
        var data = snap.data();
        total += (data.gamesPlayed || 0);
      }
    }).catch(function() {});
  });
  await Promise.all(promises);
  _cachedGamesPlayed = total;
  // Cache expires after 60 seconds
  setTimeout(function() { _cachedGamesPlayed = null; }, 60000);
  return total;
}

function openProfileCard() {
  var d = window.studentRecord || {};
  var eq = d.equipped || {};
  var modal = document.getElementById('profileModal');

  // Avatar
  var avatarEl = document.getElementById('profileAvatar');
  avatarEl.textContent = (eq.avatar && eq.avatar.emoji) ? eq.avatar.emoji : '\u{1F464}';

  // Avatar border effect
  var avatarWrap = document.getElementById('profileAvatarWrap');
  avatarWrap.style.boxShadow = '';
  if (eq.border && eq.border.value && eq.border.value !== 'none') {
    avatarWrap.style.boxShadow = eq.border.value;
    avatarWrap.style.animation = 'profileBorderPulse 3s ease-in-out infinite';
  } else {
    avatarWrap.style.animation = '';
  }

  // Name + name color
  var nameEl = document.getElementById('profileName');
  nameEl.textContent = localStorage.getItem('studentName') || 'Student';
  nameEl.style.cssText = ''; // reset
  if (eq.nameColor && eq.nameColor.value) {
    if (eq.nameColor.type === 'gradient' || eq.nameColor.type === 'animated-gradient') {
      nameEl.style.background = eq.nameColor.value;
      nameEl.style.webkitBackgroundClip = 'text';
      nameEl.style.webkitTextFillColor = 'transparent';
      nameEl.style.backgroundClip = 'text';
      if (eq.nameColor.type === 'animated-gradient') {
        nameEl.style.backgroundSize = '200% 100%';
        nameEl.style.animation = 'gradientShift 3s linear infinite';
      }
    } else {
      nameEl.style.color = eq.nameColor.value;
    }
  }

  // Title
  var titleEl = document.getElementById('profileTitle');
  if (eq.title && eq.title.value) {
    titleEl.textContent = '\u{1F3F7}\uFE0F ' + eq.title.value;
  } else {
    titleEl.textContent = '';
  }

  // Profile background
  var bgLayer = document.getElementById('profileBgLayer');
  bgLayer.className = 'profile-bg-layer';
  if (eq.profileBackground && eq.profileBackground.style) {
    bgLayer.classList.add('bg-' + eq.profileBackground.style);
  }

  // Stats — Level + XP
  var xpVal = d.xp || 0;
  var lvlInfo = window.odaXP ? window.odaXP.getLevel(xpVal) : { level: 1, title: 'Rookie', xpProgress: 0, xpForNext: 50 };
  var profLevelEl = document.getElementById('profileLevel');
  var profLevelTitleEl = document.getElementById('profileLevelTitle');
  var profXpFill = document.getElementById('profileXpFill');
  var profXpLabel = document.getElementById('profileXpLabel');
  if (profLevelEl) profLevelEl.textContent = lvlInfo.level;
  if (profLevelTitleEl) profLevelTitleEl.textContent = '\u{2B50} ' + lvlInfo.title;
  if (profXpFill) profXpFill.style.width = Math.round(lvlInfo.xpProgress * 100) + '%';
  if (profXpLabel) {
    profXpLabel.textContent = lvlInfo.level >= 50
      ? xpVal.toLocaleString() + ' XP — MAX LEVEL'
      : xpVal.toLocaleString() + ' / ' + lvlInfo.xpForNext.toLocaleString() + ' XP';
  }

  // Stats — Coins
  document.getElementById('profileCoins').textContent = (d.coins || 0).toLocaleString();

  // Games played — load from game record collections asynchronously
  var gpEl = document.getElementById('profileGamesPlayed');
  gpEl.textContent = '...';
  loadTotalGamesPlayed().then(function(total) {
    gpEl.textContent = total.toLocaleString();
  });

  // Achievements
  var achs = d.achievements || [];
  document.getElementById('profileAchievements').textContent = achs.length;

  // Showcase: top 5 most impressive earned achievements
  var showcase = document.getElementById('profileShowcase');
  if (achs.length > 0) {
    // Sort by priority descending, pick top 5
    var sorted = achs.slice().sort(function(a, b) {
      return (ACH_PRIORITY[b] || 0) - (ACH_PRIORITY[a] || 0);
    });
    var top = sorted.slice(0, 5);
    var h = '<div class="profile-showcase-title">Achievement Showcase</div>';
    h += '<div class="profile-showcase-grid">';
    for (var j = 0; j < top.length; j++) {
      var achData = null;
      for (var k = 0; k < PROFILE_ACHIEVEMENTS.length; k++) {
        if (PROFILE_ACHIEVEMENTS[k].id === top[j]) { achData = PROFILE_ACHIEVEMENTS[k]; break; }
      }
      if (achData) {
        h += '<div class="profile-ach" title="' + esc(achData.name) + '">';
        h += '<span class="profile-ach-icon">' + achData.icon + '</span>';
        h += '<span class="profile-ach-name">' + esc(achData.name) + '</span>';
        h += '</div>';
      }
    }
    h += '</div>';
    showcase.innerHTML = h;
  } else {
    showcase.innerHTML = '<div class="profile-showcase-title">No achievements yet — play some games!</div>';
  }

  // Show modal
  modal.style.display = 'flex';
  modal.classList.add('show');
}
window.openProfileCard = openProfileCard;

function closeProfileCard() {
  var modal = document.getElementById('profileModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}
window.closeProfileCard = closeProfileCard;

// Close profile on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var m = document.getElementById('profileModal');
    if (m && m.classList.contains('show')) closeProfileCard();
  }
});

// Close profile on backdrop click
document.addEventListener('click', function(e) {
  var m = document.getElementById('profileModal');
  if (m && m.classList.contains('show') && e.target === m) closeProfileCard();
});

// ===== DAILY CHALLENGES =====
var CHALLENGE_POOL = [
  { id: 'play3diff', desc: 'Play 3 different games', reward: 15, icon: '\u{1F3B2}', target: 3, type: 'diffGames' },
  { id: 'score10', desc: 'Score 10+ in {game}', reward: 20, icon: '\u{1F3AF}', target: 10, type: 'scoreIn' },
  { id: 'winMultiplayer', desc: 'Win a game of {mpgame}', reward: 25, icon: '\u{1F3C6}', target: 1, type: 'winMp' },
  { id: 'play5total', desc: 'Play 5 games total', reward: 20, icon: '\u{1F3AE}', target: 5, type: 'totalGames' },
  { id: 'newHighScore', desc: 'Get a new high score in any game', reward: 30, icon: '\u2B50', target: 1, type: 'highScore' },
  { id: 'hardMode', desc: 'Play {game} on Hard mode', reward: 25, icon: '\u{1F525}', target: 1, type: 'hardMode' },
  { id: 'earn50coins', desc: 'Earn 50+ coins today', reward: 15, icon: '\u{1FA99}', target: 50, type: 'coinsToday' },
  { id: 'under60sec', desc: 'Complete a game in under 60 seconds', reward: 20, icon: '\u23F1\uFE0F', target: 1, type: 'speedRun' }
];

var MULTIPLAYER_GAMES = GAMES.filter(function(g) { return g.categories && g.categories.indexOf('Multiplayer') !== -1; });
var ALL_GAME_IDS = GAMES.map(function(g) { return g.id; });

/** Deterministic seed-based pseudo-random from day-of-year */
function dailySeed(dateStr) {
  var d = new Date(dateStr + 'T00:00:00Z');
  var start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var dayOfYear = Math.floor((d - start) / 86400000) + 1;
  // Simple seeded PRNG (mulberry32)
  var seed = dayOfYear * 2654435761 + d.getUTCFullYear() * 31;
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Get today's UTC date string */
function getTodayUTC() {
  return new Date().toISOString().split('T')[0];
}

/** Pick 3 challenges for a given date */
function getDailyChallenges(dateStr) {
  var rng = dailySeed(dateStr);
  // Shuffle pool indices
  var indices = [];
  for (var i = 0; i < CHALLENGE_POOL.length; i++) indices.push(i);
  for (var i = indices.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = indices[i]; indices[i] = indices[j]; indices[j] = t;
  }
  var picked = [];
  for (var k = 0; k < 3; k++) {
    var tpl = CHALLENGE_POOL[indices[k]];
    var ch = { id: tpl.id, desc: tpl.desc, reward: tpl.reward, icon: tpl.icon, target: tpl.target, type: tpl.type };
    // Fill in {game} and {mpgame} placeholders with deterministic game
    if (ch.desc.indexOf('{game}') !== -1) {
      var gi = Math.floor(rng() * GAMES.length);
      ch.gameId = GAMES[gi].id;
      ch.desc = ch.desc.replace('{game}', GAMES[gi].title);
    }
    if (ch.desc.indexOf('{mpgame}') !== -1) {
      var mi = Math.floor(rng() * MULTIPLAYER_GAMES.length);
      ch.gameId = MULTIPLAYER_GAMES[mi].id;
      ch.desc = ch.desc.replace('{mpgame}', MULTIPLAYER_GAMES[mi].title);
    }
    picked.push(ch);
  }
  return picked;
}

/** Load or initialize daily challenge progress from localStorage */
function loadDailyProgress() {
  var today = getTodayUTC();
  var key = 'dailyChallenges_' + today;
  try {
    var stored = JSON.parse(localStorage.getItem(key));
    if (stored && stored.date === today) return stored;
  } catch (e) {}
  // Initialize fresh progress
  var challenges = getDailyChallenges(today);
  var progress = {
    date: today,
    challenges: challenges.map(function(c) {
      return { id: c.id, progress: 0, completed: false };
    })
  };
  localStorage.setItem(key, JSON.stringify(progress));
  return progress;
}

/** Save daily challenge progress */
function saveDailyProgress(progress) {
  var key = 'dailyChallenges_' + progress.date;
  localStorage.setItem(key, JSON.stringify(progress));
}

/** Track daily stats for challenge tracking */
function getDailyStats() {
  var today = getTodayUTC();
  var key = 'dailyStats_' + today;
  try {
    var s = JSON.parse(localStorage.getItem(key));
    if (s && s.date === today) return s;
  } catch (e) {}
  return { date: today, gamesPlayed: 0, diffGames: [], coinsEarned: 0 };
}

function saveDailyStats(stats) {
  var key = 'dailyStats_' + stats.date;
  localStorage.setItem(key, JSON.stringify(stats));
}

/** Update daily stats when a game is played */
function trackDailyGamePlay(gameId) {
  var stats = getDailyStats();
  stats.gamesPlayed++;
  if (stats.diffGames.indexOf(gameId) === -1) stats.diffGames.push(gameId);
  saveDailyStats(stats);
  checkDailyChallenges();
}

/** Check and update challenge completions */
function checkDailyChallenges() {
  var today = getTodayUTC();
  var progress = loadDailyProgress();
  if (progress.date !== today) return;
  var challenges = getDailyChallenges(today);
  var stats = getDailyStats();
  var anyNewComplete = false;

  for (var i = 0; i < challenges.length; i++) {
    var ch = challenges[i];
    var p = progress.challenges[i];
    if (p.completed) continue;

    var newProgress = 0;
    switch (ch.type) {
      case 'diffGames':
        newProgress = stats.diffGames.length;
        break;
      case 'totalGames':
        newProgress = stats.gamesPlayed;
        break;
      case 'coinsToday':
        newProgress = stats.coinsEarned;
        break;
      case 'scoreIn':
      case 'winMp':
      case 'highScore':
      case 'hardMode':
      case 'speedRun':
        // These are tracked by game return signals stored in dailyStats
        newProgress = p.progress; // Keep existing, updated by signal
        break;
    }
    if (newProgress > p.progress) p.progress = newProgress;
    if (p.progress >= ch.target && !p.completed) {
      p.completed = true;
      anyNewComplete = true;
      // Award coins
      awardChallengeCoins(ch.reward);
      if (typeof odaToast === 'function') {
        odaToast('\u{1F389} Challenge complete! +' + ch.reward + ' coins: ' + ch.desc, 'success');
      }
    }
  }
  saveDailyProgress(progress);
  if (anyNewComplete) renderDailyChallenges();
}

/** Award coins for challenge completion (update Firestore) */
async function awardChallengeCoins(amount) {
  if (!window.studentId || !window.fbDb) return;
  try {
    var ref = window.fbDoc(window.fbDb, 'students', window.studentId);
    var snap = await window.fbGetDoc(ref);
    if (snap.exists()) {
      var current = snap.data().coins || 0;
      await window.fbUpdateDoc(ref, { coins: current + amount });
    }
  } catch (e) { console.error('Challenge coin award error:', e); }
  // Track coins earned today
  var stats = getDailyStats();
  stats.coinsEarned += amount;
  saveDailyStats(stats);
}

/** Signal from games: call this to report game-specific challenge completions */
function reportChallengeEvent(eventType, data) {
  var today = getTodayUTC();
  var progress = loadDailyProgress();
  if (progress.date !== today) return;
  var challenges = getDailyChallenges(today);

  for (var i = 0; i < challenges.length; i++) {
    var ch = challenges[i];
    var p = progress.challenges[i];
    if (p.completed) continue;

    if (eventType === 'score' && ch.type === 'scoreIn' && data.gameId === ch.gameId && data.score >= ch.target) {
      p.progress = ch.target;
    }
    if (eventType === 'win' && ch.type === 'winMp' && data.gameId === ch.gameId) {
      p.progress = ch.target;
    }
    if (eventType === 'highScore' && ch.type === 'highScore') {
      p.progress = ch.target;
    }
    if (eventType === 'hardMode' && ch.type === 'hardMode' && data.gameId === ch.gameId) {
      p.progress = ch.target;
    }
    if (eventType === 'speedRun' && ch.type === 'speedRun') {
      p.progress = ch.target;
    }
  }
  saveDailyProgress(progress);
  checkDailyChallenges();
}
window.reportChallengeEvent = reportChallengeEvent;

/** Render daily challenges UI */
function renderDailyChallenges() {
  var container = document.getElementById('dailyChallengesContainer');
  if (!container) return;
  var today = getTodayUTC();
  var challenges = getDailyChallenges(today);
  var progress = loadDailyProgress();

  var h = '<div class="daily-challenges">';
  h += '<div class="daily-challenges-header">';
  h += '<div class="daily-challenges-title">\u{1F525} Daily Challenges</div>';
  h += '<div class="daily-challenges-date">' + today + '</div>';
  h += '</div>';
  h += '<div class="daily-challenges-cards">';

  for (var i = 0; i < challenges.length; i++) {
    var ch = challenges[i];
    var p = progress.challenges[i];
    var pct = Math.min(100, Math.round((p.progress / ch.target) * 100));
    var done = p.completed;

    h += '<div class="dc-card' + (done ? ' dc-done' : '') + '">';
    h += '<div class="dc-icon">' + ch.icon + '</div>';
    h += '<div class="dc-body">';
    h += '<div class="dc-desc">' + esc(ch.desc) + '</div>';
    h += '<div class="dc-progress-wrap">';
    h += '<div class="dc-progress-bar"><div class="dc-progress-fill" style="width:' + pct + '%"></div></div>';
    h += '<span class="dc-progress-text">' + Math.min(p.progress, ch.target) + '/' + ch.target + '</span>';
    h += '</div>';
    h += '</div>';
    h += '<div class="dc-reward">';
    if (done) {
      h += '<span class="dc-complete-badge">\u2705</span>';
    } else {
      h += '<span class="dc-coin-reward">\u{1FA99} ' + ch.reward + '</span>';
    }
    h += '</div>';
    h += '</div>';
  }

  h += '</div></div>';
  container.innerHTML = h;
}
window.renderDailyChallenges = renderDailyChallenges;

// Hook into playArcadeGame to track daily stats
var _origPlayArcadeGame = window.playArcadeGame;
window.playArcadeGame = function(file, gameId) {
  trackDailyGamePlay(gameId);
  _origPlayArcadeGame(file, gameId);
};

// Check challenges on page load (returning from a game)
(function() {
  var today = getTodayUTC();
  var progress = loadDailyProgress();
  // Auto-reset if date changed
  if (progress.date !== today) {
    loadDailyProgress(); // re-initialize
  }
  // Check completion state on return
  setTimeout(checkDailyChallenges, 500);
})();

// ===== FAVORITES =====
/** Get favorite game IDs from localStorage */
function getFavoriteGames() {
  try { return JSON.parse(localStorage.getItem('favoriteGames') || '[]'); } catch (e) { return []; }
}

/** Toggle a game as favorite */
function toggleFavorite(gameId, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  var favs = getFavoriteGames();
  var idx = favs.indexOf(gameId);
  if (idx === -1) {
    favs.push(gameId);
  } else {
    favs.splice(idx, 1);
  }
  localStorage.setItem('favoriteGames', JSON.stringify(favs));
  // Update star button states
  updateFavStars();
  // Re-render favorites row
  renderFavoritesRow();
}
window.toggleFavorite = toggleFavorite;

/** Update all star button active states */
function updateFavStars() {
  var favs = getFavoriteGames();
  var stars = document.querySelectorAll('.fav-star');
  stars.forEach(function(star) {
    var gid = star.getAttribute('data-fav-id');
    if (favs.indexOf(gid) !== -1) {
      star.classList.add('active');
      star.textContent = '\u2B50';
      star.title = 'Remove from favorites';
    } else {
      star.classList.remove('active');
      star.textContent = '\u2606';
      star.title = 'Add to favorites';
    }
  });
}

/** Render favorites horizontal scroll row */
function renderFavoritesRow() {
  var existing = document.getElementById('arcadeFavoritesRow');
  if (existing) existing.remove();

  var favs = getFavoriteGames();
  if (favs.length === 0) return;

  var favGames = [];
  favs.forEach(function(fid) {
    for (var i = 0; i < GAMES.length; i++) {
      if (GAMES[i].id === fid) { favGames.push(GAMES[i]); break; }
    }
  });
  if (favGames.length === 0) return;

  var locked = false;
  if (window.studentRecord && window.studentRecord.arcadeLocked) {
    var assigns = window.myAssignments || [];
    var pending = assigns.filter(function(a) { return a.status === 'pending' || a.status === 'returned'; });
    var submitted = assigns.filter(function(a) { return a.status === 'submitted'; });
    locked = pending.length > 0 || submitted.length > 0;
  }

  var h = '<div class="arcade-favorites" id="arcadeFavoritesRow">';
  h += '<div class="arcade-recent-label">\u2B50 Favorites</div>';
  h += '<div class="arcade-recent-scroll">';
  favGames.forEach(function(g) {
    var cover = generateCover(g);
    h += '<div class="arcade-recent-card' + (locked ? ' locked' : '') + '" role="button" tabindex="' + (locked ? '-1' : '0') + '" ' + (locked ? '' : 'onclick="playArcadeGame(\'' + g.file + '\',\'' + g.id + '\')"') + '>';
    h += '<div class="arcade-recent-img" style="background-image:url(' + cover + ')"></div>';
    h += '<div class="arcade-recent-title">' + g.title + '</div>';
    h += '</div>';
  });
  h += '</div></div>';

  // Insert before recently played or before shop banner
  var recentRow = document.getElementById('arcadeRecentRow');
  var gameGrid = document.getElementById('gameGrid');
  if (recentRow) {
    recentRow.insertAdjacentHTML('beforebegin', h);
  } else {
    // Insert after game count, before shop banner
    var shopBanner = gameGrid ? gameGrid.querySelector('.shop-banner') : null;
    if (shopBanner) {
      shopBanner.insertAdjacentHTML('beforebegin', h);
    } else if (gameGrid) {
      gameGrid.insertAdjacentHTML('afterbegin', h);
    }
  }

  // Update fav row visibility based on filter state
  var favRow = document.getElementById('arcadeFavoritesRow');
  if (favRow) {
    favRow.style.display = (arcadeFilter === 'All' && !arcadeSearch) ? '' : 'none';
  }
}

// Override renderArcade to add star buttons and favorites row
var _origRenderArcade = renderArcade;
renderArcade = function() {
  _origRenderArcade();
  // Add star buttons to game cards (only once)
  var cards = document.querySelectorAll('.game-cover-card[data-game-id]');
  cards.forEach(function(card) {
    if (card.querySelector('.fav-star')) return; // already added
    var gid = card.getAttribute('data-game-id');
    var favs = getFavoriteGames();
    var isFav = favs.indexOf(gid) !== -1;
    var star = document.createElement('button');
    star.className = 'fav-star' + (isFav ? ' active' : '');
    star.setAttribute('data-fav-id', gid);
    star.textContent = isFav ? '\u2B50' : '\u2606';
    star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    star.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
    star.onclick = function(e) { toggleFavorite(gid, e); };
    card.appendChild(star);
  });
  // Render favorites row
  renderFavoritesRow();
  // Render daily challenges
  renderDailyChallenges();
};

// Update applyArcadeFilters to handle favorites row visibility
var _origApplyFilters = applyArcadeFilters;
applyArcadeFilters = function() {
  _origApplyFilters();
  var favRow = document.getElementById('arcadeFavoritesRow');
  if (favRow) {
    favRow.style.display = (arcadeFilter === 'All' && !arcadeSearch) ? '' : 'none';
  }
};
window.applyArcadeFilters = applyArcadeFilters;

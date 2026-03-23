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
var GAMES=[
// Multiplayer
{id:'connect4',emoji:'\u{1F534}',title:'Connect 4',desc:'Drop 4 in a row to win!',file:'arcade/connect4/index.html',cat:'multiplayer',colors:['#ef4444','#fbbf24']},
{id:'tictactoe',emoji:'\u274C',title:'Tic Tac Toe',desc:'Classic X vs O strategy',file:'arcade/tictactoe/index.html',cat:'multiplayer',colors:['#ef476f','#118ab2']},
{id:'rps',emoji:'\u270A',title:'Rock Paper Scissors',desc:'Best of 3 — read your opponent!',file:'arcade/rps/index.html',cat:'multiplayer',colors:['#06d6a0','#ffd166']},
{id:'chess',emoji:'\u265A',title:'Chess',desc:'The ultimate strategy game',file:'arcade/chess/index.html',cat:'strategy',colors:['#1a1a2e','#e2d5b7']},
{id:'checkers',emoji:'⛀',title:'Checkers',desc:'Jump, capture, king your pieces!',file:'arcade/checkers/index.html',cat:'strategy',colors:['#dc2626','#111827']},
{id:'battleship',emoji:'\u{1F6A2}',title:'Battleship',desc:'Find and sink the fleet!',file:'arcade/battleship/index.html',cat:'multiplayer',colors:['#1e3a5f','#22d3ee']},
{id:'uno',emoji:'\u{1F3B4}',title:'Uno',desc:'Match colors, empty your hand!',file:'arcade/uno/index.html',cat:'multiplayer',colors:['#ef4444','#fbbf24']},
{id:'dominoes',emoji:'\u{1F3B2}',title:'Dominoes',desc:'Match tiles, outsmart your opponent',file:'arcade/dominoes/index.html',cat:'multiplayer',colors:['#f5f0e8','#1a1a2e']},
{id:'penaltykick',emoji:'\u26BD',title:'Penalty Kick',desc:'Aim, shoot, save — score goals!',file:'arcade/penaltykick/index.html',cat:'multiplayer',colors:['#16a34a','#fafafa']},
{id:'pingpong',emoji:'\u{1F3D3}',title:'Ping Pong',desc:'Classic pong — beat the AI!',file:'arcade/pingpong/index.html',cat:'multiplayer',colors:['#1e293b','#06d6a0']},
// Arcade
{id:'snake',emoji:'\u{1F40D}',title:'Snake',desc:'Eat, grow, survive!',file:'arcade/snake/index.html',cat:'arcade',colors:['#06d6a0','#0a0e1a']},
{id:'flappy',emoji:'\u{1F426}',title:'Floppy Bird',desc:'Tap to fly, dodge the pipes!',file:'arcade/flappy/index.html',cat:'arcade',colors:['#fbbf24','#1e3a5f']},
{id:'fruitninja',emoji:'\u{1F52A}',title:'Fruit Ninja',desc:'Slash fruits, get combos!',file:'arcade/fruitninja/index.html',cat:'arcade',colors:['#ef4444','#16a34a']},
{id:'brickbreaker',emoji:'\u{1F9F1}',title:'Brick Breaker',desc:'Smash bricks, earn power-ups!',file:'arcade/brickbreaker/index.html',cat:'arcade',colors:['#ef4444','#3b82f6']},
{id:'whackamole',emoji:'\u{1F439}',title:'Whack-a-Mole',desc:'Whack moles before they hide!',file:'arcade/whackamole/index.html',cat:'arcade',colors:['#854d0e','#16a34a']},
{id:'aimtrainer',emoji:'\u{1F3AF}',title:'Aim Trainer',desc:'Test your reflexes!',file:'arcade/aimtrainer/index.html',cat:'arcade',colors:['#dc2626','#fafafa']},
{id:'coinminer',emoji:'\u{1FA99}',title:'Coin Miner',desc:'Tap to mine, buy upgrades!',file:'arcade/coinminer/index.html',cat:'arcade',colors:['#fbbf24','#7c3aed']},
// Puzzle
{id:'2048',emoji:'\u{1F522}',title:'2048',desc:'Slide and merge to 2048!',file:'arcade/2048/index.html',cat:'puzzle',colors:['#f59e0b','#1a1a2e']},
{id:'solitaire',emoji:'\u{1F0CF}',title:'Solitaire',desc:'Classic card game!',file:'arcade/solitaire/index.html',cat:'puzzle',colors:['#16a34a','#dc2626']},
{id:'blockblast',emoji:'\u{1F9F1}',title:'Block Blast',desc:'Place blocks, clear lines!',file:'arcade/blockblast/index.html',cat:'puzzle',colors:['#3b82f6','#ec4899']},
{id:'suika',emoji:'\u{1F349}',title:'Suika Game',desc:'Drop & merge fruits!',file:'arcade/suika/index.html',cat:'puzzle',colors:['#16a34a','#ef4444']},
{id:'simonsays',emoji:'\u{1F3B5}',title:'Simon Says',desc:'Watch, listen, repeat!',file:'arcade/simonsays/index.html',cat:'puzzle',colors:['#ef4444','#3b82f6']},
{id:'memory',emoji:'\u{1F9E0}',title:'Memory Match',desc:'Find matching pairs!',file:'arcade/memory/index.html',cat:'puzzle',colors:['#8b5cf6','#06d6a0']},
// Word
{id:'wordle',emoji:'\u{1F4DD}',title:'Wordle',desc:'Guess the word in 6 tries!',file:'arcade/wordle/index.html',cat:'word',colors:['#16a34a','#fbbf24']},
{id:'hangman',emoji:'\u{1F634}',title:'Hangman',desc:'Guess the word in time!',file:'arcade/hangman/index.html',cat:'word',colors:['#6366f1','#f59e0b']},
{id:'trivia',emoji:'\u{1F3C1}',title:'Trivia Race',desc:'Race to answer questions!',file:'arcade/trivia/index.html',cat:'word',colors:['#dc2626','#fbbf24']},
{id:'typing',emoji:'\u2328\uFE0F',title:'Typing Race',desc:'Type fast, race classmates!',file:'arcade/typing/index.html',cat:'word',colors:['#06d6a0','#1e293b']},
{id:'keyboard',emoji:'\u{1F3AE}',title:'Keyboard Warriors',desc:'Type to defeat enemies!',file:'keyboard.html',cat:'word',colors:['#7c3aed','#ef4444']},
];

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

var arcadeFilter='all';
var coverCache={};

function generateCover(g){
  if(coverCache[g.id])return coverCache[g.id];
  var W=280,H=180;
  var c=document.createElement('canvas');c.width=W;c.height=H;
  var ctx=c.getContext('2d');
  // Background gradient
  var grad=ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,g.colors?g.colors[0]:'#1a1a2e');
  grad.addColorStop(1,g.colors?g.colors[1]:'#16213e');
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  // Game-specific art
  var d=coverArt[g.id];
  if(d)d(ctx,W,H);
  else{ctx.font='60px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(g.emoji,W/2,H/2)}
  // Title bar at bottom
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,H-38,W,38);
  ctx.fillStyle='#fff';ctx.font='bold 14px Fredoka,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillText(g.title,12,H-19);
  var url=c.toDataURL('image/jpeg',0.82);
  coverCache[g.id]=url;
  return url;
}

var coverArt={
  connect4:function(x,W,H){
    // Grid with red/yellow pieces
    for(var r=0;r<4;r++)for(var c=0;c<5;c++){
      x.fillStyle='rgba(255,255,255,0.1)';x.beginPath();x.arc(60+c*40,30+r*38,15,0,Math.PI*2);x.fill();
    }
    var pieces=[[0,3,'#ef4444'],[1,3,'#fbbf24'],[2,3,'#ef4444'],[1,2,'#fbbf24'],[0,2,'#ef4444'],[3,3,'#fbbf24'],[2,2,'#ef4444']];
    pieces.forEach(function(p){x.fillStyle=p[2];x.beginPath();x.arc(60+p[0]*40,30+p[1]*38,14,0,Math.PI*2);x.fill();
      x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(56+p[0]*40,26+p[1]*38,5,0,Math.PI*2);x.fill()});
  },
  tictactoe:function(x,W,H){
    x.strokeStyle='rgba(255,255,255,0.3)';x.lineWidth=3;
    x.beginPath();x.moveTo(110,20);x.lineTo(110,150);x.moveTo(170,20);x.lineTo(170,150);
    x.moveTo(60,60);x.lineTo(220,60);x.moveTo(60,110);x.lineTo(220,110);x.stroke();
    // X's and O's
    x.strokeStyle='#ef476f';x.lineWidth=4;x.beginPath();x.moveTo(70,30);x.lineTo(100,50);x.moveTo(100,30);x.lineTo(70,50);x.stroke();
    x.strokeStyle='#118ab2';x.lineWidth=4;x.beginPath();x.arc(140,85,18,0,Math.PI*2);x.stroke();
    x.strokeStyle='#ef476f';x.lineWidth=4;x.beginPath();x.moveTo(125,120);x.lineTo(155,145);x.moveTo(155,120);x.lineTo(125,145);x.stroke();
    x.strokeStyle='#118ab2';x.lineWidth=4;x.beginPath();x.arc(195,40,18,0,Math.PI*2);x.stroke();
  },
  chess:function(x,W,H){
    for(var r=0;r<5;r++)for(var c=0;c<7;c++){
      x.fillStyle=(r+c)%2===0?'#e2d5b7':'#8b7355';x.fillRect(40+c*30,10+r*30,30,30);
    }
    x.font='26px sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('\u265A',85,55);x.fillText('\u265B',115,55);x.fillText('\u2654',175,115);x.fillText('\u2655',205,115);
  },
  snake:function(x,W,H){
    // Snake body
    var pts=[[40,90],[70,90],[100,90],[130,70],[160,50],[190,50],[220,70],[240,90]];
    x.strokeStyle='#06d6a0';x.lineWidth=14;x.lineCap='round';x.lineJoin='round';
    x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++)x.lineTo(pts[i][0],pts[i][1]);x.stroke();
    // Head
    x.fillStyle='#06d6a0';x.beginPath();x.arc(240,90,10,0,Math.PI*2);x.fill();
    x.fillStyle='#fff';x.beginPath();x.arc(244,86,3,0,Math.PI*2);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(245,86,1.5,0,Math.PI*2);x.fill();
    // Apple
    x.fillStyle='#ef4444';x.beginPath();x.arc(140,120,8,0,Math.PI*2);x.fill();
    // Grid dots
    x.fillStyle='rgba(255,255,255,0.05)';for(var gy=0;gy<6;gy++)for(var gx=0;gx<9;gx++){x.fillRect(20+gx*30,15+gy*30,2,2)}
  },
  flappy:function(x,W,H){
    // Pipes
    x.fillStyle='#06d6a0';x.fillRect(80,0,30,55);x.fillRect(75,50,40,12);
    x.fillRect(80,110,30,70);x.fillRect(75,110,40,12);
    x.fillRect(180,0,30,80);x.fillRect(175,75,40,12);
    x.fillRect(180,140,30,40);x.fillRect(175,135,40,12);
    // Bird
    x.fillStyle='#fbbf24';x.beginPath();x.ellipse(130,85,14,11,0,0,Math.PI*2);x.fill();
    x.fillStyle='#f59e0b';x.beginPath();x.ellipse(126,80,7,5,-0.3,0,Math.PI*2);x.fill();
    x.fillStyle='#fff';x.beginPath();x.arc(137,82,4,0,Math.PI*2);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(138,82,2,0,Math.PI*2);x.fill();
    x.fillStyle='#f97316';x.beginPath();x.moveTo(143,85);x.lineTo(152,82);x.lineTo(152,88);x.closePath();x.fill();
  },
  fruitninja:function(x,W,H){
    // Fruits
    var fruits=[{cx:80,cy:60,r:20,c:'#ef4444'},{cx:160,cy:80,r:18,c:'#f97316'},{cx:200,cy:45,r:22,c:'#16a34a'},{cx:120,cy:120,r:16,c:'#a855f7'}];
    fruits.forEach(function(f){x.fillStyle=f.c;x.beginPath();x.arc(f.cx,f.cy,f.r,0,Math.PI*2);x.fill();
      x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(f.cx-4,f.cy-4,f.r*0.35,0,Math.PI*2);x.fill()});
    // Slash line
    x.strokeStyle='rgba(255,255,255,0.8)';x.lineWidth=3;x.setLineDash([8,4]);
    x.beginPath();x.moveTo(40,140);x.quadraticCurveTo(140,20,250,100);x.stroke();x.setLineDash([]);
    // Juice particles
    x.fillStyle='#ef4444';[{x:90,y:45},{x:95,y:55},{x:75,y:50}].forEach(function(p){x.beginPath();x.arc(p.x,p.y,3,0,Math.PI*2);x.fill()});
  },
  '2048':function(x,W,H){
    var tiles=[{v:2,c:'#2a3450'},{v:4,c:'#2d3a55'},{v:8,c:'#e88a3a'},{v:16,c:'#e87c3a'},{v:32,c:'#ef6b4f'},{v:64,c:'#ef4f3a'},{v:128,c:'#f0d165'},{v:256,c:'#f0cc57'},{v:2048,c:'#06d6a0'}];
    for(var r=0;r<3;r++)for(var c2=0;c2<3;c2++){
      var t=tiles[r*3+c2];x.fillStyle=t.c;
      var tx=55+c2*65,ty=15+r*52;
      x.beginPath();x.roundRect(tx,ty,58,46,8);x.fill();
      x.fillStyle=t.v>=8?'#fff':'#776e65';x.font='bold '+(t.v>=100?'14':'18')+'px Fredoka,sans-serif';
      x.textAlign='center';x.textBaseline='middle';x.fillText(t.v,tx+29,ty+23);
    }
  },
  solitaire:function(x,W,H){
    // Cards fanned out
    for(var i=0;i<5;i++){
      x.save();x.translate(90+i*30,90);x.rotate((i-2)*0.12);
      x.fillStyle='#fff';x.beginPath();x.roundRect(-18,-30,36,50,4);x.fill();
      x.fillStyle=i%2===0?'#dc2626':'#111';x.font='bold 14px sans-serif';x.textAlign='center';
      x.fillText((['A','\u2665','K','\u2660','Q'])[i],0,-8);
      x.fillStyle=i%2===0?'#dc2626':'#111';x.font='10px sans-serif';
      x.fillText((['\u2665','\u2666','\u2660','\u2663','\u2665'])[i],0,10);
      x.restore();
    }
  },
  wordle:function(x,W,H){
    var word='WORDLE';var colors=['#16a34a','#fbbf24','#16a34a','#3a3a4a','#16a34a','#fbbf24'];
    for(var i=0;i<6;i++){
      x.fillStyle=colors[i];x.beginPath();x.roundRect(45+i*33,40,30,35,4);x.fill();
      x.fillStyle='#fff';x.font='bold 18px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(word[i],60+i*33,57);
    }
    // Empty rows below
    for(var r2=0;r2<2;r2++)for(var c3=0;c3<6;c3++){
      x.strokeStyle='rgba(255,255,255,0.15)';x.lineWidth=1.5;x.beginPath();x.roundRect(45+c3*33,85+r2*38,30,35,4);x.stroke();
    }
  },
  pingpong:function(x,W,H){
    // Court
    x.strokeStyle='rgba(255,255,255,0.2)';x.lineWidth=2;x.setLineDash([6,4]);
    x.beginPath();x.moveTo(W/2,10);x.lineTo(W/2,H-10);x.stroke();x.setLineDash([]);
    // Paddles
    x.fillStyle='#06d6a0';x.beginPath();x.roundRect(30,50,10,50,4);x.fill();
    x.fillStyle='#ef4444';x.beginPath();x.roundRect(240,70,10,50,4);x.fill();
    // Ball with trail
    x.globalAlpha=0.15;x.fillStyle='#fff';x.beginPath();x.arc(100,80,6,0,Math.PI*2);x.fill();
    x.globalAlpha=0.3;x.beginPath();x.arc(120,85,6,0,Math.PI*2);x.fill();
    x.globalAlpha=1;x.fillStyle='#fff';x.beginPath();x.arc(145,90,7,0,Math.PI*2);x.fill();
    // Score
    x.fillStyle='rgba(255,255,255,0.08)';x.font='bold 60px Fredoka,sans-serif';x.textAlign='center';x.fillText('3',95,100);x.fillText('2',185,100);
  },
  suika:function(x,W,H){
    // Container
    x.strokeStyle='rgba(255,255,255,0.3)';x.lineWidth=2;x.beginPath();x.moveTo(70,20);x.lineTo(70,150);x.lineTo(210,150);x.lineTo(210,20);x.stroke();
    // Fruits stacked
    var fruits=[{cx:110,cy:130,r:12,c:'#dc2626'},{cx:150,cy:125,r:16,c:'#f97316'},{cx:130,cy:100,r:20,c:'#16a34a'},{cx:170,cy:105,r:10,c:'#ef4444'},{cx:100,cy:90,r:8,c:'#ec4899'}];
    fruits.forEach(function(f){x.fillStyle=f.c;x.beginPath();x.arc(f.cx,f.cy,f.r,0,Math.PI*2);x.fill();
      x.fillStyle='rgba(255,255,255,0.15)';x.beginPath();x.arc(f.cx-f.r*0.25,f.cy-f.r*0.25,f.r*0.3,0,Math.PI*2);x.fill()});
    // Merge sparkle
    x.fillStyle='#fbbf24';x.globalAlpha=0.6;for(var s=0;s<5;s++){var a=s*1.26;x.beginPath();x.arc(130+Math.cos(a)*25,100+Math.sin(a)*25,2,0,Math.PI*2);x.fill()}x.globalAlpha=1;
  },
  aimtrainer:function(x,W,H){
    // Targets
    var targets=[{cx:100,cy:70,r:25},{cx:200,cy:50,r:20},{cx:150,cy:120,r:22}];
    targets.forEach(function(t){
      x.fillStyle='#dc2626';x.beginPath();x.arc(t.cx,t.cy,t.r,0,Math.PI*2);x.fill();
      x.fillStyle='#fff';x.beginPath();x.arc(t.cx,t.cy,t.r*0.7,0,Math.PI*2);x.fill();
      x.fillStyle='#dc2626';x.beginPath();x.arc(t.cx,t.cy,t.r*0.4,0,Math.PI*2);x.fill();
      x.fillStyle='#fff';x.beginPath();x.arc(t.cx,t.cy,t.r*0.15,0,Math.PI*2);x.fill();
    });
    // Crosshair
    x.strokeStyle='rgba(255,255,255,0.5)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(140,60);x.lineTo(140,80);x.moveTo(130,70);x.lineTo(150,70);x.stroke();
    x.beginPath();x.arc(140,70,12,0,Math.PI*2);x.stroke();
  },
  penaltykick:function(x,W,H){
    // Goal posts
    x.strokeStyle='#fff';x.lineWidth=4;x.beginPath();x.moveTo(50,30);x.lineTo(50,130);x.lineTo(230,130);x.lineTo(230,30);x.lineTo(50,30);x.stroke();
    // Net
    x.strokeStyle='rgba(255,255,255,0.1)';x.lineWidth=1;
    for(var i=0;i<8;i++){x.beginPath();x.moveTo(50+i*25,30);x.lineTo(50+i*25,130);x.stroke()}
    for(var j=0;j<5;j++){x.beginPath();x.moveTo(50,30+j*25);x.lineTo(230,30+j*25);x.stroke()}
    // Ball
    x.fillStyle='#fff';x.beginPath();x.arc(140,110,12,0,Math.PI*2);x.fill();
    x.strokeStyle='#333';x.lineWidth=1;x.beginPath();x.arc(140,110,12,0,Math.PI*2);x.stroke();
    // Grass
    x.fillStyle='#16a34a';x.fillRect(0,130,W,50);
  },
  brickbreaker:function(x,W,H){
    // Bricks
    var bColors=['#ef4444','#f97316','#fbbf24','#16a34a','#3b82f6'];
    for(var r=0;r<5;r++)for(var c4=0;c4<6;c4++){
      x.fillStyle=bColors[r];x.beginPath();x.roundRect(30+c4*37,15+r*18,34,14,3);x.fill();
      x.fillStyle='rgba(255,255,255,0.15)';x.fillRect(30+c4*37,15+r*18,34,4);
    }
    // Paddle
    x.fillStyle='#fff';x.beginPath();x.roundRect(100,145,60,10,5);x.fill();
    // Ball
    x.fillStyle='#fff';x.beginPath();x.arc(130,130,5,0,Math.PI*2);x.fill();
  },
  whackamole:function(x,W,H){
    // Holes
    for(var r=0;r<2;r++)for(var c5=0;c5<3;c5++){
      x.fillStyle='#3d2614';x.beginPath();x.ellipse(70+c5*70,80+r*55,25,10,0,0,Math.PI*2);x.fill();
    }
    // Mole popping up
    x.fillStyle='#8B6914';x.beginPath();x.arc(140,65,18,Math.PI,0);x.fill();
    x.fillRect(122,65,36,15);
    x.fillStyle='#fff';x.beginPath();x.arc(132,58,4,0,Math.PI*2);x.fill();x.beginPath();x.arc(148,58,4,0,Math.PI*2);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(133,58,2,0,Math.PI*2);x.fill();x.beginPath();x.arc(149,58,2,0,Math.PI*2);x.fill();
    x.fillStyle='#e88a7a';x.beginPath();x.ellipse(140,66,4,3,0,0,Math.PI*2);x.fill();
    // Mallet
    x.save();x.translate(210,40);x.rotate(0.4);
    x.fillStyle='#8B4513';x.fillRect(-4,-30,8,35);
    x.fillStyle='#666';x.beginPath();x.roundRect(-12,-45,24,20,4);x.fill();
    x.restore();
  },
  simonsays:function(x,W,H){
    // Four colored buttons
    x.fillStyle='#dc2626';x.beginPath();x.arc(110,60,35,Math.PI,Math.PI*1.5);x.lineTo(110,25);x.lineTo(75,60);x.fill();
    x.fillStyle='#16a34a';x.beginPath();x.arc(170,60,35,Math.PI*1.5,0);x.lineTo(205,60);x.lineTo(170,25);x.fill();
    x.fillStyle='#2563eb';x.beginPath();x.arc(110,120,35,Math.PI*0.5,Math.PI);x.lineTo(75,120);x.lineTo(110,155);x.fill();
    x.fillStyle='#eab308';x.beginPath();x.arc(170,120,35,0,Math.PI*0.5);x.lineTo(170,155);x.lineTo(205,120);x.fill();
    // Glow on green
    x.fillStyle='rgba(22,163,74,0.4)';x.beginPath();x.arc(170,60,40,Math.PI*1.5,0);x.lineTo(210,60);x.lineTo(170,20);x.fill();
  },
  battleship:function(x,W,H){
    // Grid
    x.strokeStyle='rgba(255,255,255,0.15)';x.lineWidth=1;
    for(var i=0;i<8;i++){x.beginPath();x.moveTo(50+i*25,15);x.lineTo(50+i*25,155);x.stroke();
      x.beginPath();x.moveTo(50,15+i*20);x.lineTo(225,15+i*20);x.stroke()}
    // Hits and misses
    x.fillStyle='#dc2626';x.beginPath();x.arc(87,45,6,0,Math.PI*2);x.fill();
    x.fillStyle='#dc2626';x.beginPath();x.arc(112,45,6,0,Math.PI*2);x.fill();
    x.fillStyle='#dc2626';x.beginPath();x.arc(137,45,6,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(87,85,4,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(162,65,4,0,Math.PI*2);x.fill();
  },
  rps:function(x,W,H){
    x.font='50px sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('\u270A',80,70);x.fillText('\u270B',140,70);x.fillText('\u270C',200,70);
    x.strokeStyle='rgba(255,255,255,0.2)';x.lineWidth=1;
    x.beginPath();x.arc(140,70,55,0,Math.PI*2);x.stroke();
  },
  checkers:function(x,W,H){
    for(var r=0;r<5;r++)for(var c6=0;c6<7;c6++){
      x.fillStyle=(r+c6)%2===0?'#1a1a2e':'#dc2626';x.fillRect(35+c6*30,10+r*30,30,30);
    }
    x.fillStyle='#111';x.beginPath();x.arc(95,55,10,0,Math.PI*2);x.fill();
    x.fillStyle='#dc2626';x.beginPath();x.arc(155,85,10,0,Math.PI*2);x.fill();
    x.fillStyle='#fbbf24';x.beginPath();x.arc(155,85,4,0,Math.PI*2);x.fill();
  },
  hangman:function(x,W,H){
    // Gallows
    x.strokeStyle='rgba(255,255,255,0.5)';x.lineWidth=3;
    x.beginPath();x.moveTo(60,140);x.lineTo(60,30);x.lineTo(130,30);x.lineTo(130,50);x.stroke();
    // Figure
    x.strokeStyle='#fbbf24';x.lineWidth=3;
    x.beginPath();x.arc(130,60,10,0,Math.PI*2);x.stroke();
    x.beginPath();x.moveTo(130,70);x.lineTo(130,100);x.stroke();
    x.beginPath();x.moveTo(130,80);x.lineTo(115,95);x.stroke();
    x.beginPath();x.moveTo(130,80);x.lineTo(145,95);x.stroke();
    // Letters
    x.fillStyle='rgba(255,255,255,0.3)';x.font='bold 16px Fredoka,sans-serif';x.textAlign='center';
    x.fillText('_ _ _ _ _',180,90);
  },
  memory:function(x,W,H){
    var memColors=['#8b5cf6','#06d6a0','#ef4444','#3b82f6','#fbbf24','#ec4899'];
    for(var r=0;r<2;r++)for(var c7=0;c7<4;c7++){
      var idx=r*4+c7;
      if(idx===2||idx===5){x.fillStyle=memColors[idx%6];x.beginPath();x.roundRect(45+c7*50,30+r*60,42,50,6);x.fill();
        x.fillStyle='rgba(255,255,255,0.3)';x.font='20px sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText(['\u2605','\u2665','\u2605','\u2663','\u2665','\u2666'][idx%6],66+c7*50,55+r*60);
      }else{x.fillStyle='#2a3450';x.beginPath();x.roundRect(45+c7*50,30+r*60,42,50,6);x.fill();
        x.fillStyle='rgba(255,255,255,0.08)';x.font='16px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('?',66+c7*50,55+r*60)}
    }
  },
  trivia:function(x,W,H){
    x.fillStyle='rgba(255,255,255,0.1)';x.beginPath();x.roundRect(40,20,200,35,8);x.fill();
    x.fillStyle='#fff';x.font='bold 13px Outfit,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('What is the capital of...?',140,37);
    var ans=['A) Paris','B) London','C) Berlin','D) Madrid'];var ac=['#16a34a','#dc2626','#dc2626','#dc2626'];
    for(var i=0;i<4;i++){x.fillStyle=ac[i];x.globalAlpha=0.3;x.beginPath();x.roundRect(50+i%2*100,70+(i>1?35:0),90,28,6);x.fill();
      x.globalAlpha=1;x.fillStyle='#fff';x.font='11px Outfit,sans-serif';x.fillText(ans[i],95+i%2*100,84+(i>1?35:0))}
  },
  blockblast:function(x,W,H){
    var colors=['#3b82f6','#ec4899','#06d6a0','#fbbf24','#a855f7'];
    for(var r=0;r<5;r++)for(var c8=0;c8<6;c8++){
      if(Math.random()>0.4){x.fillStyle=colors[(r+c8)%5];x.beginPath();x.roundRect(50+c8*32,15+r*28,28,24,4);x.fill();
        x.fillStyle='rgba(255,255,255,0.15)';x.fillRect(50+c8*32,15+r*28,28,6)}
    }
  },
  typing:function(x,W,H){
    // Keyboard keys
    var keys='QWERTYUIOP';
    for(var i=0;i<10;i++){x.fillStyle='rgba(255,255,255,0.1)';x.beginPath();x.roundRect(28+i*22,90,20,22,3);x.fill();
      x.fillStyle='rgba(255,255,255,0.5)';x.font='bold 10px Outfit,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(keys[i],38+i*22,101)}
    // Text being typed
    x.fillStyle='#06d6a0';x.font='bold 16px monospace';x.textAlign='left';x.fillText('The quick brown',50,50);
    x.fillStyle='rgba(255,255,255,0.3)';x.fillText(' fox jumps',195,50);
    // Cursor
    x.fillStyle='#06d6a0';x.fillRect(192,42,2,18);
  },
  keyboard:function(x,W,H){
    // Enemies
    x.fillStyle='#ef4444';x.beginPath();x.arc(80,50,15,0,Math.PI*2);x.fill();
    x.fillStyle='#fff';x.font='bold 12px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('A',80,50);
    x.fillStyle='#fbbf24';x.beginPath();x.arc(160,70,18,0,Math.PI*2);x.fill();
    x.fillStyle='#fff';x.fillText('X',160,70);
    x.fillStyle='#a855f7';x.beginPath();x.arc(220,40,12,0,Math.PI*2);x.fill();
    x.fillStyle='#fff';x.fillText('K',220,40);
    // Sword
    x.strokeStyle='#fbbf24';x.lineWidth=3;x.beginPath();x.moveTo(130,130);x.lineTo(130,95);x.stroke();
    x.strokeStyle='#fbbf24';x.lineWidth=2;x.beginPath();x.moveTo(120,110);x.lineTo(140,110);x.stroke();
  },
  uno:function(x,W,H){
    // Cards fanned
    var uColors=['#dc2626','#16a34a','#2563eb','#eab308'];
    for(var i=0;i<4;i++){
      x.save();x.translate(100+i*30,85);x.rotate((i-1.5)*0.15);
      x.fillStyle=uColors[i];x.beginPath();x.roundRect(-20,-32,40,55,5);x.fill();
      x.fillStyle='#fff';x.font='bold 20px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText([3,7,'R',5][i],0,0);x.restore();
    }
  },
  coinminer:function(x,W,H){
    // Coins
    for(var i=0;i<6;i++){
      var cx=60+i*35+Math.sin(i)*10,cy=40+Math.cos(i*2)*30;
      x.fillStyle='#fbbf24';x.beginPath();x.arc(cx,cy,14,0,Math.PI*2);x.fill();
      x.fillStyle='#f59e0b';x.beginPath();x.arc(cx,cy,10,0,Math.PI*2);x.fill();
      x.fillStyle='#fbbf24';x.font='bold 10px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('$',cx,cy);
    }
    // Pickaxe
    x.strokeStyle='#8B4513';x.lineWidth=3;x.beginPath();x.moveTo(180,130);x.lineTo(220,80);x.stroke();
    x.fillStyle='#888';x.beginPath();x.moveTo(220,80);x.lineTo(235,75);x.lineTo(225,65);x.closePath();x.fill();
  },
  dominoes:function(x,W,H){
    // Domino tiles
    for(var i=0;i<3;i++){
      x.save();x.translate(70+i*60,80);x.rotate((i-1)*0.1);
      x.fillStyle='#f5f0e8';x.beginPath();x.roundRect(-18,-35,36,70,4);x.fill();
      x.strokeStyle='#333';x.lineWidth=1;x.beginPath();x.moveTo(-14,0);x.lineTo(14,0);x.stroke();
      // Pips
      x.fillStyle='#111';
      var pips=[2,5,6];
      for(var p=0;p<Math.min(pips[i],3);p++){x.beginPath();x.arc(-6+p*6,-18+p*6,2.5,0,Math.PI*2);x.fill()}
      for(var p2=0;p2<Math.min(pips[i],3);p2++){x.beginPath();x.arc(-6+p2*6,12+p2*3,2.5,0,Math.PI*2);x.fill()}
      x.restore();
    }
  }
};

function renderArcade(){
var arcadeLocked=window.studentRecord&&window.studentRecord.arcadeLocked;
var assigns=window.myAssignments||[];
var pending=assigns.filter(function(a){return a.status==='pending'||a.status==='returned'});
var submitted=assigns.filter(function(a){return a.status==='submitted'});
var locked=arcadeLocked&&(pending.length>0||submitted.length>0);
var coins=(window.studentRecord&&window.studentRecord.coins)||0;
var h='';

// Category filter tabs
var cats=[
  {id:'all',label:'All Games',icon:'\u{1F3AE}'},
  {id:'multiplayer',label:'Multiplayer',icon:'\u{1F91D}'},
  {id:'arcade',label:'Arcade',icon:'\u{1F579}\uFE0F'},
  {id:'puzzle',label:'Puzzle',icon:'\u{1F9E9}'},
  {id:'word',label:'Word & Trivia',icon:'\u{1F4DA}'},
  {id:'strategy',label:'Strategy',icon:'\u265F\uFE0F'}
];
h+='<div class="arcade-tabs" id="arcadeTabs">';
cats.forEach(function(c){
  h+='<button class="arcade-tab'+(arcadeFilter===c.id?' active':'')+'" onclick="arcadeFilter=\''+c.id+'\';renderArcade()" data-cat="'+c.id+'">';
  h+='<span>'+c.icon+'</span> '+c.label+'</button>';
});
h+='</div>';

// Shop banner
h+='<div class="game-cover-card shop-banner" role="button" tabindex="0" onclick="location.href=\'shop.html\'">';
h+='<div class="shop-banner-inner"><span style="font-size:32px">\u{1F6CD}\uFE0F</span>';
h+='<div><div style="font-weight:800;font-size:16px;font-family:Fredoka,sans-serif">ODA Shop</div>';
h+='<div style="color:var(--text2);font-size:13px">\u{1FA99} '+coins+' coins \u2014 Avatars, colors & more</div></div></div></div>';

// Game cards with cover images
var filtered=arcadeFilter==='all'?GAMES:GAMES.filter(function(g){return g.cat===arcadeFilter});
h+='<div class="game-cover-grid">';
filtered.forEach(function(g){
  var cover=generateCover(g);
  h+='<div class="game-cover-card'+(locked?' locked':'')+'" role="button" tabindex="'+(locked?'-1':'0')+'" '+(locked?'':'onclick="location.href=\''+g.file+'\'"')+'>';
  var catColors={multiplayer:'#06d6a0',arcade:'#ef476f',puzzle:'#118ab2',word:'#ffd166',strategy:'#a855f7'};
  var catLabels={multiplayer:'MULTIPLAYER',arcade:'ARCADE',puzzle:'PUZZLE',word:'WORD',strategy:'STRATEGY'};
  h+='<div class="game-cover-img" style="background-image:url('+cover+')">';
  h+='<span class="game-cat-badge" style="background:'+( catColors[g.cat]||'#06d6a0')+'">'+(catLabels[g.cat]||'')+'</span>';
  h+='</div>';
  h+='<div class="game-cover-info">';
  h+='<div class="game-cover-desc">'+(locked?'Finish your work first!':g.desc)+'</div>';
  h+='</div></div>';
});
h+='</div>';

document.getElementById('gameGrid').innerHTML=h;
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

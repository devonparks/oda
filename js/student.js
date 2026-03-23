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
function generateCover(g){
  if(coverCache[g.id])return coverCache[g.id];
  var W=280,H=180;
  var c=document.createElement('canvas');c.width=W;c.height=H;
  var ctx=c.getContext('2d');

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
  keyboard:    {g1:'#140520',g2:'#1a0505',titleColor:'#a78bfa',titleGlow:'#7c3aed',titleFont:'bold 24px Fredoka,sans-serif'}
};

/* ── polished game-specific cover art ──────────────────────────── */
var coverArt={

  /* ── CONNECT 4 ─────────────────────────────────────────────── */
  connect4:function(x,W,H){
    // Board frame
    x.fillStyle='#1e3a8a';x.beginPath();x.roundRect(30,8,220,130,10);x.fill();
    // Holes grid 7x5
    for(var r=0;r<5;r++)for(var c=0;c<7;c++){
      x.fillStyle='#0c1445';x.beginPath();x.arc(52+c*30,24+r*24,10,0,Math.PI*2);x.fill();
    }
    // Placed pieces with highlights
    var pcs=[[0,4,'#ef4444'],[1,4,'#fbbf24'],[2,4,'#ef4444'],[1,3,'#fbbf24'],[0,3,'#ef4444'],[3,4,'#fbbf24'],[2,3,'#ef4444'],[3,3,'#fbbf24'],[0,2,'#ef4444'],[4,4,'#fbbf24'],[5,4,'#ef4444'],[2,2,'#fbbf24']];
    pcs.forEach(function(p){
      x.fillStyle=p[2];x.beginPath();x.arc(52+p[0]*30,24+p[1]*24,9.5,0,Math.PI*2);x.fill();
      // shine
      x.fillStyle='rgba(255,255,255,0.25)';x.beginPath();x.arc(49+p[0]*30,20+p[1]*24,3.5,0,Math.PI*2);x.fill();
    });
    // Win glow line (diagonal)
    x.save();x.globalAlpha=0.35;x.strokeStyle='#fbbf24';x.lineWidth=22;x.lineCap='round';
    x.shadowColor='#fbbf24';x.shadowBlur=20;
    x.beginPath();x.moveTo(52,24+4*24);x.lineTo(52+3*30,24+1*24);x.stroke();
    x.restore();
  },

  /* ── TIC TAC TOE ───────────────────────────────────────────── */
  tictactoe:function(x,W,H){
    // Glowing grid lines
    x.save();x.shadowColor='#118ab2';x.shadowBlur=12;
    x.strokeStyle='rgba(255,255,255,0.35)';x.lineWidth=3;
    x.beginPath();
    x.moveTo(108,10);x.lineTo(108,130);x.moveTo(168,10);x.lineTo(168,130);
    x.moveTo(50,48);x.lineTo(228,48);x.moveTo(50,92);x.lineTo(228,92);
    x.stroke();x.restore();
    // X marks with glow
    function drawX(cx,cy,sz){
      x.save();x.strokeStyle='#ef476f';x.lineWidth=5;x.lineCap='round';
      x.shadowColor='#ef476f';x.shadowBlur=10;
      x.beginPath();x.moveTo(cx-sz,cy-sz);x.lineTo(cx+sz,cy+sz);
      x.moveTo(cx+sz,cy-sz);x.lineTo(cx-sz,cy+sz);x.stroke();x.restore();
    }
    // O marks with glow
    function drawO(cx,cy,r2){
      x.save();x.strokeStyle='#118ab2';x.lineWidth=5;x.lineCap='round';
      x.shadowColor='#118ab2';x.shadowBlur=10;
      x.beginPath();x.arc(cx,cy,r2,0,Math.PI*2);x.stroke();x.restore();
    }
    drawX(79,29,12);drawO(138,29,13);drawX(198,29,12);
    drawO(79,70,13);drawX(138,70,12);drawO(198,70,13);
    drawX(79,111,12);drawX(138,111,12);drawO(198,111,13);
    // Win line through diagonal
    x.save();x.globalAlpha=0.5;x.strokeStyle='#ef476f';x.lineWidth=4;x.lineCap='round';
    x.shadowColor='#ef476f';x.shadowBlur=14;
    x.beginPath();x.moveTo(65,17);x.lineTo(210,123);x.stroke();x.restore();
  },

  /* ── ROCK PAPER SCISSORS ───────────────────────────────────── */
  rps:function(x,W,H){
    // Three big circles with hand silhouettes
    var items=[
      {cx:60,cy:55,c:'#ef476f',label:'ROCK',shape:function(){
        x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(60,50,18,0,Math.PI*2);x.fill();
      }},
      {cx:140,cy:45,c:'#06d6a0',label:'PAPER',shape:function(){
        x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.roundRect(125,32,30,30,3);x.fill();
      }},
      {cx:220,cy:55,c:'#ffd166',label:'SCISSORS',shape:function(){
        x.save();x.strokeStyle='rgba(255,255,255,0.25)';x.lineWidth=4;x.lineCap='round';
        x.beginPath();x.moveTo(210,42);x.lineTo(230,60);x.moveTo(230,42);x.lineTo(210,60);x.stroke();x.restore();
      }}
    ];
    items.forEach(function(it){
      x.save();x.shadowColor=it.c;x.shadowBlur=18;
      x.fillStyle=it.c;x.globalAlpha=0.3;x.beginPath();x.arc(it.cx,it.cy,28,0,Math.PI*2);x.fill();
      x.globalAlpha=1;x.restore();
      it.shape();
    });
    // VS text
    x.save();x.font='bold 14px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillStyle='rgba(255,255,255,0.15)';x.fillText('VS',100,55);x.fillText('VS',180,55);x.restore();
    // Lightning bolts
    x.strokeStyle='rgba(255,255,255,0.1)';x.lineWidth=2;
    x.beginPath();x.moveTo(95,30);x.lineTo(105,50);x.lineTo(95,50);x.lineTo(105,70);x.stroke();
    x.beginPath();x.moveTo(175,30);x.lineTo(185,50);x.lineTo(175,50);x.lineTo(185,70);x.stroke();
  },

  /* ── CHESS ──────────────────────────────────────────────────── */
  chess:function(x,W,H){
    // Board with perspective feel
    x.save();
    for(var r=0;r<6;r++)for(var c=0;c<8;c++){
      x.fillStyle=(r+c)%2===0?'rgba(226,213,183,0.35)':'rgba(139,115,85,0.35)';
      x.fillRect(20+c*30,5+r*22,30,22);
    }
    x.restore();
    // King silhouette - large centered
    x.save();x.fillStyle='rgba(255,255,255,0.12)';
    // Crown shape
    x.beginPath();
    x.moveTo(110,30);x.lineTo(105,60);x.lineTo(115,50);x.lineTo(125,65);x.lineTo(135,45);
    x.lineTo(145,65);x.lineTo(155,50);x.lineTo(165,60);x.lineTo(160,30);
    x.lineTo(155,40);x.lineTo(140,25);x.lineTo(135,35);x.lineTo(125,20);
    x.lineTo(115,35);x.lineTo(110,30);x.fill();
    // Base
    x.fillRect(105,60,60,8);x.fillRect(100,68,70,6);
    x.restore();
    // Glowing pieces
    x.save();x.shadowColor='#c9a84c';x.shadowBlur=12;
    x.fillStyle='#e2d5b7';x.font='28px serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('\u265A',80,100);x.fillText('\u265B',120,105);
    x.fillStyle='#444';x.fillText('\u2654',180,100);x.fillText('\u2655',220,105);
    x.restore();
  },

  /* ── CHECKERS ───────────────────────────────────────────────── */
  checkers:function(x,W,H){
    // Board
    for(var r=0;r<5;r++)for(var c=0;c<7;c++){
      x.fillStyle=(r+c)%2===0?'rgba(26,26,46,0.5)':'rgba(180,40,40,0.3)';
      x.fillRect(30+c*32,5+r*25,32,25);
    }
    // Pieces with 3D effect
    function drawPiece(cx,cy,col,king){
      x.save();
      // Shadow
      x.fillStyle='rgba(0,0,0,0.4)';x.beginPath();x.ellipse(cx+2,cy+3,12,8,0,0,Math.PI*2);x.fill();
      // Side
      x.fillStyle=col==='r'?'#8b1a1a':'#111';x.beginPath();x.ellipse(cx,cy+3,12,8,0,0,Math.PI);x.fill();
      // Top
      x.fillStyle=col==='r'?'#dc2626':'#333';x.beginPath();x.ellipse(cx,cy,12,8,0,0,Math.PI*2);x.fill();
      // Shine
      x.fillStyle='rgba(255,255,255,0.15)';x.beginPath();x.ellipse(cx-3,cy-2,5,3,0,0,Math.PI*2);x.fill();
      if(king){x.fillStyle='#fbbf24';x.font='bold 10px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('\u2654',cx,cy);}
      x.restore();
    }
    drawPiece(78,30,'r',false);drawPiece(142,30,'r',false);drawPiece(206,55,'r',true);
    drawPiece(110,80,'b',false);drawPiece(174,80,'b',false);drawPiece(78,105,'b',false);
    // Jump arrow
    x.save();x.strokeStyle='rgba(251,191,36,0.4)';x.lineWidth=3;x.setLineDash([4,4]);
    x.beginPath();x.moveTo(110,80);x.quadraticCurveTo(140,40,175,55);x.stroke();x.setLineDash([]);x.restore();
  },

  /* ── SNAKE ─────────────────────────────────────────────────── */
  snake:function(x,W,H){
    // Grid background
    x.strokeStyle='rgba(6,214,160,0.06)';x.lineWidth=0.5;
    for(var gy=0;gy<10;gy++){x.beginPath();x.moveTo(0,gy*18);x.lineTo(W,gy*18);x.stroke();}
    for(var gx=0;gx<16;gx++){x.beginPath();x.moveTo(gx*18,0);x.lineTo(gx*18,H);x.stroke();}
    // Snake body with segments
    var pts=[[30,70],[50,70],[70,70],[90,60],[110,45],[130,35],[150,35],[170,45],[190,60],[210,70],[230,80],[245,90]];
    // Body glow
    x.save();x.strokeStyle='#06d6a0';x.lineWidth=16;x.lineCap='round';x.lineJoin='round';
    x.shadowColor='#06d6a0';x.shadowBlur=20;x.globalAlpha=0.3;
    x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++)x.lineTo(pts[i][0],pts[i][1]);x.stroke();x.restore();
    // Body solid
    x.strokeStyle='#06d6a0';x.lineWidth=12;x.lineCap='round';x.lineJoin='round';
    x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    for(var j=1;j<pts.length;j++)x.lineTo(pts[j][0],pts[j][1]);x.stroke();
    // Body pattern
    x.strokeStyle='#0fa87f';x.lineWidth=6;x.lineCap='round';x.lineJoin='round';
    x.beginPath();x.moveTo(pts[0][0],pts[0][1]);
    for(var k=1;k<pts.length;k++)x.lineTo(pts[k][0],pts[k][1]);x.stroke();
    // Head
    x.fillStyle='#06d6a0';x.beginPath();x.arc(245,90,9,0,Math.PI*2);x.fill();
    x.fillStyle='#fff';x.beginPath();x.arc(250,86,3,0,Math.PI*2);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(251,86,1.5,0,Math.PI*2);x.fill();
    // Apple with glow
    x.save();x.shadowColor='#ef4444';x.shadowBlur=15;
    x.fillStyle='#ef4444';x.beginPath();x.arc(80,110,10,0,Math.PI*2);x.fill();x.restore();
    x.fillStyle='rgba(255,255,255,0.3)';x.beginPath();x.arc(77,106,3,0,Math.PI*2);x.fill();
    x.fillStyle='#16a34a';x.fillRect(79,99,3,5);
  },

  /* ── FLOPPY BIRD ───────────────────────────────────────────── */
  flappy:function(x,W,H){
    // Sky gradient overlay
    x.save();var sky=x.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'rgba(56,189,248,0.15)');sky.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=sky;x.fillRect(0,0,W,H);x.restore();
    // Pipes with 3D look
    function drawPipe(px,topH,gap){
      // Top pipe
      var pg=x.createLinearGradient(px,0,px+34,0);pg.addColorStop(0,'#16a34a');pg.addColorStop(0.5,'#4ade80');pg.addColorStop(1,'#15803d');
      x.fillStyle=pg;x.fillRect(px,0,34,topH);
      x.fillStyle='#15803d';x.beginPath();x.roundRect(px-4,topH-2,42,12,3);x.fill();
      // Bottom pipe
      x.fillStyle=pg;x.fillRect(px,topH+gap,34,H);
      x.fillStyle='#15803d';x.beginPath();x.roundRect(px-4,topH+gap-8,42,12,3);x.fill();
    }
    drawPipe(55,40,55);drawPipe(145,55,50);drawPipe(235,25,60);
    // Bird with glow
    x.save();x.shadowColor='#fbbf24';x.shadowBlur=14;
    x.fillStyle='#fbbf24';x.beginPath();x.ellipse(115,72,16,13,0,0,Math.PI*2);x.fill();x.restore();
    // Wing
    x.fillStyle='#f59e0b';x.beginPath();x.ellipse(108,66,9,6,-0.3,0,Math.PI*2);x.fill();
    // Eye
    x.fillStyle='#fff';x.beginPath();x.arc(124,68,5,0,Math.PI*2);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(126,68,2.5,0,Math.PI*2);x.fill();
    // Beak
    x.fillStyle='#f97316';x.beginPath();x.moveTo(130,72);x.lineTo(142,69);x.lineTo(142,76);x.closePath();x.fill();
    // Motion lines
    x.strokeStyle='rgba(255,255,255,0.2)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(90,70);x.lineTo(80,70);x.stroke();
    x.beginPath();x.moveTo(92,78);x.lineTo(82,80);x.stroke();
  },

  /* ── FRUIT NINJA ───────────────────────────────────────────── */
  fruitninja:function(x,W,H){
    // Fruit halves with splatter
    function drawFruit(cx,cy,r,c1,c2,cut){
      x.save();
      if(cut){
        // Left half
        x.fillStyle=c1;x.beginPath();x.arc(cx-4,cy,r,Math.PI*0.5,Math.PI*1.5);x.fill();
        x.fillStyle=c2;x.beginPath();x.arc(cx-4,cy,r*0.7,Math.PI*0.5,Math.PI*1.5);x.fill();
        // Right half
        x.fillStyle=c1;x.beginPath();x.arc(cx+4,cy,r,Math.PI*1.5,Math.PI*0.5);x.fill();
        x.fillStyle=c2;x.beginPath();x.arc(cx+4,cy,r*0.7,Math.PI*1.5,Math.PI*0.5);x.fill();
        // Juice drops
        x.fillStyle=c1;x.globalAlpha=0.6;
        for(var d=0;d<5;d++){x.beginPath();x.arc(cx-15+d*8,cy-12+d*6,1.5+Math.random()*2,0,Math.PI*2);x.fill();}
        x.globalAlpha=1;
      }else{
        x.fillStyle=c1;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill();
        x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(cx-r*0.2,cy-r*0.2,r*0.35,0,Math.PI*2);x.fill();
      }
      x.restore();
    }
    drawFruit(65,45,22,'#ef4444','#fca5a5',true);
    drawFruit(170,55,20,'#f97316','#fed7aa',true);
    drawFruit(110,100,18,'#16a34a','#86efac',false);
    drawFruit(230,35,15,'#a855f7','#d8b4fe',false);
    // Slash arc with glow
    x.save();x.strokeStyle='rgba(255,255,255,0.85)';x.lineWidth=3;
    x.shadowColor='#fff';x.shadowBlur=10;
    x.beginPath();x.moveTo(20,130);x.quadraticCurveTo(130,10,260,80);x.stroke();x.restore();
    // Second slash
    x.save();x.strokeStyle='rgba(255,255,255,0.4)';x.lineWidth=2;
    x.shadowColor='#fff';x.shadowBlur=6;
    x.beginPath();x.moveTo(40,20);x.quadraticCurveTo(150,110,250,30);x.stroke();x.restore();
  },

  /* ── 2048 ──────────────────────────────────────────────────── */
  '2048':function(x,W,H){
    // Background board
    x.fillStyle='rgba(187,173,160,0.15)';x.beginPath();x.roundRect(35,5,210,125,10);x.fill();
    var tiles=[
      {v:2,c:'#eee4da',tc:'#776e65'},{v:4,c:'#ede0c8',tc:'#776e65'},
      {v:8,c:'#f2b179',tc:'#fff'},{v:16,c:'#f59563',tc:'#fff'},
      {v:32,c:'#f67c5f',tc:'#fff'},{v:64,c:'#f65e3b',tc:'#fff'},
      {v:128,c:'#edcf72',tc:'#fff'},{v:256,c:'#edcc61',tc:'#fff'},
      {v:2048,c:'#edc22e',tc:'#fff'}
    ];
    for(var r=0;r<3;r++)for(var c=0;c<3;c++){
      var t=tiles[r*3+c];var tx=45+c*68,ty=12+r*40;
      // Tile shadow
      x.fillStyle='rgba(0,0,0,0.15)';x.beginPath();x.roundRect(tx+2,ty+2,60,34,6);x.fill();
      // Tile
      x.fillStyle=t.c;x.beginPath();x.roundRect(tx,ty,60,34,6);x.fill();
      // Value
      x.fillStyle=t.tc;x.font='bold '+(t.v>=100?t.v>=1000?'12':'14':'18')+'px Fredoka,sans-serif';
      x.textAlign='center';x.textBaseline='middle';x.fillText(t.v,tx+30,ty+17);
    }
    // Glow behind the 2048 tile
    x.save();x.shadowColor='#edc22e';x.shadowBlur=25;x.globalAlpha=0.3;
    x.fillStyle='#edc22e';x.beginPath();x.roundRect(45+2*68,12+2*40,60,34,6);x.fill();
    x.restore();
  },

  /* ── SOLITAIRE ─────────────────────────────────────────────── */
  solitaire:function(x,W,H){
    // Foundation piles at top
    var suits=['\u2660','\u2665','\u2666','\u2663'];var suitC=['#333','#dc2626','#dc2626','#333'];
    for(var i=0;i<4;i++){
      x.fillStyle='rgba(255,255,255,0.06)';x.beginPath();x.roundRect(50+i*48,8,40,30,4);x.fill();
      x.strokeStyle='rgba(255,255,255,0.15)';x.lineWidth=1;x.beginPath();x.roundRect(50+i*48,8,40,30,4);x.stroke();
      x.fillStyle=suitC[i];x.font='16px sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(suits[i],70+i*48,23);
    }
    // Cascading tableau cards
    for(var col=0;col<5;col++){
      for(var row=0;row<=col;row++){
        var cx=40+col*44,cy=50+row*14;
        if(row===col){
          // Face up
          x.fillStyle='#fff';x.beginPath();x.roundRect(cx,cy,38,28,3);x.fill();
          x.fillStyle=col%2===0?'#dc2626':'#111';x.font='bold 12px sans-serif';x.textAlign='center';
          x.fillText((['A','7','K','3','Q'])[col],cx+14,cy+12);
          x.fillStyle=col%2===0?'#dc2626':'#111';x.font='9px sans-serif';
          x.fillText(suits[col%4],cx+28,cy+12);
        }else{
          // Face down (card back)
          x.fillStyle='#1e40af';x.beginPath();x.roundRect(cx,cy,38,28,3);x.fill();
          x.strokeStyle='rgba(255,255,255,0.1)';x.lineWidth=0.5;
          // Diamond pattern on back
          x.beginPath();x.moveTo(cx+19,cy+4);x.lineTo(cx+28,cy+14);x.lineTo(cx+19,cy+24);x.lineTo(cx+10,cy+14);x.closePath();x.stroke();
        }
      }
    }
  },

  /* ── WORDLE ────────────────────────────────────────────────── */
  wordle:function(x,W,H){
    var rows=[
      {w:'CRANE',c:['#3a3a4a','#3a3a4a','#3a3a4a','#3a3a4a','#fbbf24']},
      {w:'BLUNT',c:['#3a3a4a','#fbbf24','#3a3a4a','#3a3a4a','#3a3a4a']},
      {w:'FLAME',c:['#3a3a4a','#16a34a','#3a3a4a','#3a3a4a','#16a34a']},
      {w:'GLOVE',c:['#3a3a4a','#16a34a','#16a34a','#3a3a4a','#16a34a']},
      {w:'SOLVE',c:['#16a34a','#16a34a','#16a34a','#16a34a','#16a34a']}
    ];
    for(var r=0;r<rows.length;r++){
      for(var c=0;c<5;c++){
        var tx=52+c*36,ty=6+r*24;
        x.fillStyle=rows[r].c[c];x.beginPath();x.roundRect(tx,ty,32,21,3);x.fill();
        x.fillStyle='#fff';x.font='bold 13px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText(rows[r].w[c],tx+16,ty+11);
      }
    }
    // Glow on winning row
    x.save();x.shadowColor='#16a34a';x.shadowBlur=15;x.globalAlpha=0.25;
    x.fillStyle='#16a34a';x.fillRect(50,6+4*24-2,186,25);x.restore();
    // Empty row hint
    for(var e=0;e<5;e++){
      x.strokeStyle='rgba(255,255,255,0.12)';x.lineWidth=1.5;
      x.beginPath();x.roundRect(52+e*36,6+5*24,32,21,3);x.stroke();
    }
  },

  /* ── PING PONG ─────────────────────────────────────────────── */
  pingpong:function(x,W,H){
    // Table surface
    x.fillStyle='rgba(0,100,80,0.2)';x.fillRect(15,20,250,110);
    x.strokeStyle='rgba(255,255,255,0.12)';x.lineWidth=1;
    x.strokeRect(15,20,250,110);
    // Net (center dashed)
    x.strokeStyle='rgba(255,255,255,0.25)';x.lineWidth=2;x.setLineDash([5,4]);
    x.beginPath();x.moveTo(W/2,15);x.lineTo(W/2,135);x.stroke();x.setLineDash([]);
    // Paddles with glow
    x.save();x.shadowColor='#06d6a0';x.shadowBlur=10;
    x.fillStyle='#06d6a0';x.beginPath();x.roundRect(25,50,12,50,5);x.fill();x.restore();
    x.save();x.shadowColor='#ef4444';x.shadowBlur=10;
    x.fillStyle='#ef4444';x.beginPath();x.roundRect(243,60,12,50,5);x.fill();x.restore();
    // Ball trail
    x.globalAlpha=0.08;x.fillStyle='#fff';x.beginPath();x.arc(80,70,7,0,Math.PI*2);x.fill();
    x.globalAlpha=0.15;x.beginPath();x.arc(105,75,7,0,Math.PI*2);x.fill();
    x.globalAlpha=0.3;x.beginPath();x.arc(130,82,7,0,Math.PI*2);x.fill();
    x.globalAlpha=1;
    // Ball with glow
    x.save();x.shadowColor='#fff';x.shadowBlur=12;
    x.fillStyle='#fff';x.beginPath();x.arc(158,88,8,0,Math.PI*2);x.fill();x.restore();
    // Score
    x.fillStyle='rgba(255,255,255,0.06)';x.font='bold 50px Fredoka,sans-serif';x.textAlign='center';
    x.fillText('3',85,95);x.fillText('2',195,95);
  },

  /* ── SUIKA GAME ────────────────────────────────────────────── */
  suika:function(x,W,H){
    // Container walls
    x.strokeStyle='rgba(255,255,255,0.25)';x.lineWidth=2;
    x.beginPath();x.moveTo(65,10);x.lineTo(65,130);x.lineTo(215,130);x.lineTo(215,10);x.stroke();
    // Stacked fruits with 3D feel
    var fruits=[
      {cx:95,cy:115,r:10,c1:'#dc2626',c2:'#fca5a5'},
      {cx:140,cy:110,r:14,c1:'#f97316',c2:'#fed7aa'},
      {cx:175,cy:108,r:12,c1:'#ec4899',c2:'#fbcfe8'},
      {cx:115,cy:90,r:18,c1:'#16a34a',c2:'#86efac'},
      {cx:160,cy:85,r:16,c1:'#eab308',c2:'#fef08a'},
      {cx:135,cy:62,r:22,c1:'#22c55e',c2:'#bbf7d0'}
    ];
    fruits.forEach(function(f){
      // Shadow
      x.fillStyle='rgba(0,0,0,0.2)';x.beginPath();x.arc(f.cx+2,f.cy+2,f.r,0,Math.PI*2);x.fill();
      // Gradient ball
      var fg=x.createRadialGradient(f.cx-f.r*0.3,f.cy-f.r*0.3,f.r*0.1,f.cx,f.cy,f.r);
      fg.addColorStop(0,f.c2);fg.addColorStop(1,f.c1);
      x.fillStyle=fg;x.beginPath();x.arc(f.cx,f.cy,f.r,0,Math.PI*2);x.fill();
      // Shine
      x.fillStyle='rgba(255,255,255,0.25)';x.beginPath();x.arc(f.cx-f.r*0.25,f.cy-f.r*0.3,f.r*0.25,0,Math.PI*2);x.fill();
    });
    // Merge sparkle effects
    x.save();x.globalAlpha=0.5;
    for(var s=0;s<8;s++){
      var a=s*0.785;x.fillStyle='#fbbf24';
      x.beginPath();x.arc(135+Math.cos(a)*30,62+Math.sin(a)*30,1.5,0,Math.PI*2);x.fill();
    }
    x.restore();
  },

  /* ── AIM TRAINER ───────────────────────────────────────────── */
  aimtrainer:function(x,W,H){
    // Multiple targets
    function drawTarget(cx,cy,r){
      var rings=[['#dc2626',1],['#fff',0.72],['#dc2626',0.48],['#fff',0.28],['#dc2626',0.12]];
      rings.forEach(function(ring){
        x.fillStyle=ring[0];x.beginPath();x.arc(cx,cy,r*ring[1],0,Math.PI*2);x.fill();
      });
    }
    // Background target (faded)
    x.globalAlpha=0.15;drawTarget(200,40,30);x.globalAlpha=1;
    // Main targets
    x.save();x.shadowColor='#dc2626';x.shadowBlur=10;
    drawTarget(90,55,28);drawTarget(190,80,22);x.restore();
    drawTarget(60,110,16);
    // Crosshair with glow
    x.save();x.strokeStyle='rgba(255,255,255,0.7)';x.lineWidth=1.5;
    x.shadowColor='#fff';x.shadowBlur=6;
    var chx=145,chy=65;
    x.beginPath();x.arc(chx,chy,14,0,Math.PI*2);x.stroke();
    x.beginPath();x.moveTo(chx,chy-20);x.lineTo(chx,chy-8);x.moveTo(chx,chy+8);x.lineTo(chx,chy+20);
    x.moveTo(chx-20,chy);x.lineTo(chx-8,chy);x.moveTo(chx+8,chy);x.lineTo(chx+20,chy);x.stroke();
    x.restore();
    // Hit markers
    x.strokeStyle='rgba(255,255,255,0.3)';x.lineWidth=2;
    x.beginPath();x.moveTo(85,50);x.lineTo(95,60);x.moveTo(95,50);x.lineTo(85,60);x.stroke();
  },

  /* ── PENALTY KICK ──────────────────────────────────────────── */
  penaltykick:function(x,W,H){
    // Grass
    x.fillStyle='#15803d';x.fillRect(0,100,W,80);
    x.fillStyle='#16a34a';
    for(var s=0;s<14;s++){x.fillRect(s*20,100,10,80);}
    // Goal with perspective
    x.save();
    x.strokeStyle='#fff';x.lineWidth=5;
    x.beginPath();x.moveTo(30,25);x.lineTo(30,100);x.lineTo(250,100);x.lineTo(250,25);x.lineTo(30,25);x.stroke();
    // Net grid
    x.strokeStyle='rgba(255,255,255,0.08)';x.lineWidth=1;
    for(var i=0;i<10;i++){x.beginPath();x.moveTo(30+i*22,25);x.lineTo(30+i*22,100);x.stroke();}
    for(var j=0;j<4;j++){x.beginPath();x.moveTo(30,25+j*19);x.lineTo(250,25+j*19);x.stroke();}
    x.restore();
    // Soccer ball with glow
    x.save();x.shadowColor='#fff';x.shadowBlur=14;
    x.fillStyle='#fff';x.beginPath();x.arc(140,88,13,0,Math.PI*2);x.fill();x.restore();
    // Pentagon pattern on ball
    x.fillStyle='#333';
    x.beginPath();x.moveTo(140,80);x.lineTo(146,84);x.lineTo(144,90);x.lineTo(136,90);x.lineTo(134,84);x.closePath();x.fill();
    // Motion arrow
    x.save();x.strokeStyle='rgba(255,255,255,0.3)';x.lineWidth=2;x.setLineDash([4,3]);
    x.beginPath();x.moveTo(140,88);x.quadraticCurveTo(140,60,100,35);x.stroke();x.setLineDash([]);x.restore();
  },

  /* ── BRICK BREAKER ─────────────────────────────────────────── */
  brickbreaker:function(x,W,H){
    // Brick rows with gradient
    var bColors=[['#ef4444','#f87171'],['#f97316','#fb923c'],['#fbbf24','#fcd34d'],['#16a34a','#4ade80'],['#3b82f6','#60a5fa'],['#8b5cf6','#a78bfa']];
    for(var r=0;r<6;r++)for(var c=0;c<7;c++){
      var bx=18+c*36,by=8+r*15;
      var bg=x.createLinearGradient(bx,by,bx,by+12);
      bg.addColorStop(0,bColors[r][1]);bg.addColorStop(1,bColors[r][0]);
      x.fillStyle=bg;x.beginPath();x.roundRect(bx,by,33,12,2);x.fill();
      // Shine on top
      x.fillStyle='rgba(255,255,255,0.2)';x.fillRect(bx,by,33,3);
    }
    // Some bricks missing (broken)
    x.fillStyle='rgba(10,14,26,0.95)';
    x.fillRect(18+2*36,8+3*15,33,12);x.fillRect(18+4*36,8+4*15,33,12);x.fillRect(18+5*36,8+5*15,33,12);
    // Break particles
    x.fillStyle='#fbbf24';x.globalAlpha=0.5;
    for(var p=0;p<6;p++){x.beginPath();x.arc(100+p*8,65+p*4,2,0,Math.PI*2);x.fill();}
    x.globalAlpha=1;
    // Paddle with glow
    x.save();x.shadowColor='#fff';x.shadowBlur=8;
    x.fillStyle='#fff';x.beginPath();x.roundRect(100,125,70,10,5);x.fill();x.restore();
    // Ball with trail
    x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(125,115,5,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.4)';x.beginPath();x.arc(128,112,5,0,Math.PI*2);x.fill();
    x.save();x.shadowColor='#fff';x.shadowBlur=8;
    x.fillStyle='#fff';x.beginPath();x.arc(132,108,6,0,Math.PI*2);x.fill();x.restore();
  },

  /* ── WHACK-A-MOLE ──────────────────────────────────────────── */
  whackamole:function(x,W,H){
    // Dirt mounds / holes
    for(var r=0;r<2;r++)for(var c=0;c<3;c++){
      var hx=55+c*75,hy=70+r*48;
      // Dirt mound
      x.fillStyle='#5c3d1a';x.beginPath();x.ellipse(hx,hy+8,30,8,0,0,Math.PI*2);x.fill();
      // Hole
      x.fillStyle='#2a1508';x.beginPath();x.ellipse(hx,hy,28,10,0,0,Math.PI);x.fill();
    }
    // Mole popping up (middle top)
    var mx=130,my=58;
    x.fillStyle='#a0722a';x.beginPath();x.arc(mx,my,20,Math.PI,0);x.fill();
    x.fillRect(mx-20,my,40,18);
    // Mole face
    x.fillStyle='#c49a3c';x.beginPath();x.arc(mx,my-2,14,Math.PI,0);x.fill();
    x.fillStyle='#fff';x.beginPath();x.arc(mx-7,my-6,5,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(mx+7,my-6,5,0,Math.PI*2);x.fill();
    x.fillStyle='#111';x.beginPath();x.arc(mx-6,my-5,2.5,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(mx+8,my-5,2.5,0,Math.PI*2);x.fill();
    x.fillStyle='#e88a7a';x.beginPath();x.ellipse(mx,my+3,5,3.5,0,0,Math.PI*2);x.fill();
    // Mallet with motion blur
    x.save();x.translate(215,25);x.rotate(0.5);
    x.fillStyle='#8B4513';x.fillRect(-4,-35,8,40);
    x.fillStyle='#666';x.shadowColor='#fbbf24';x.shadowBlur=10;
    x.beginPath();x.roundRect(-14,-50,28,22,5);x.fill();
    x.restore();
    // Impact stars
    x.save();x.fillStyle='#fbbf24';x.globalAlpha=0.4;
    for(var st=0;st<5;st++){var a=st*1.26;x.beginPath();x.arc(mx+Math.cos(a)*28,my-5+Math.sin(a)*20,2,0,Math.PI*2);x.fill();}
    x.restore();
  },

  /* ── SIMON SAYS ────────────────────────────────────────────── */
  simonsays:function(x,W,H){
    var cx=140,cy=65,R=48;
    // Four quadrants with glow
    var quads=[
      {c:'#dc2626',gc:'rgba(220,38,38,0.4)',a1:Math.PI,a2:Math.PI*1.5},
      {c:'#16a34a',gc:'rgba(22,163,74,0.5)',a1:Math.PI*1.5,a2:0},
      {c:'#2563eb',gc:'rgba(37,99,235,0.4)',a1:Math.PI*0.5,a2:Math.PI},
      {c:'#eab308',gc:'rgba(234,179,8,0.4)',a1:0,a2:Math.PI*0.5}
    ];
    quads.forEach(function(q,i){
      x.save();
      // Glow for active (green one)
      if(i===1){x.shadowColor='#4ade80';x.shadowBlur=20;}
      x.fillStyle=i===1?'#22c55e':q.c;
      x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R,q.a1,q.a2);x.closePath();x.fill();
      x.restore();
    });
    // Center circle
    x.fillStyle='#1a1a2e';x.beginPath();x.arc(cx,cy,14,0,Math.PI*2);x.fill();
    x.fillStyle='rgba(255,255,255,0.1)';x.beginPath();x.arc(cx,cy,12,0,Math.PI*2);x.fill();
    // Separator lines
    x.strokeStyle='#0a0a14';x.lineWidth=3;
    x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();
    // Sound wave arcs around the green section
    x.save();x.strokeStyle='rgba(74,222,128,0.3)';x.lineWidth=1.5;
    for(var w=0;w<3;w++){x.beginPath();x.arc(cx+35,cy-35,10+w*8,Math.PI*0.2,Math.PI*0.7);x.stroke();}
    x.restore();
  },

  /* ── BATTLESHIP ────────────────────────────────────────────── */
  battleship:function(x,W,H){
    // Ocean grid
    x.strokeStyle='rgba(34,211,238,0.12)';x.lineWidth=0.5;
    for(var i=0;i<=8;i++){
      x.beginPath();x.moveTo(40+i*25,5);x.lineTo(40+i*25,135);x.stroke();
      x.beginPath();x.moveTo(40,5+i*16);x.lineTo(240,5+i*16);x.stroke();
    }
    // Row/col labels
    x.fillStyle='rgba(34,211,238,0.2)';x.font='bold 8px Outfit,sans-serif';x.textAlign='center';x.textBaseline='middle';
    'ABCDEFGH'.split('').forEach(function(l,i){x.fillText(l,32,13+i*16);});
    for(var n=1;n<=8;n++){x.fillText(n,40+n*25-12,140);}
    // Ship (horizontal 4-cell)
    x.fillStyle='rgba(148,163,184,0.3)';x.beginPath();x.roundRect(65,20,100,13,6);x.fill();
    // Ship (vertical 3-cell)
    x.fillStyle='rgba(148,163,184,0.3)';x.beginPath();x.roundRect(190,37,13,48,6);x.fill();
    // Hits with glow (red)
    x.save();x.shadowColor='#ef4444';x.shadowBlur=8;
    [[90,26],[115,26],[140,26]].forEach(function(h){
      x.fillStyle='#ef4444';x.beginPath();x.arc(h[0],h[1],5,0,Math.PI*2);x.fill();
      // X mark
      x.strokeStyle='#fff';x.lineWidth=1.5;x.beginPath();
      x.moveTo(h[0]-3,h[1]-3);x.lineTo(h[0]+3,h[1]+3);
      x.moveTo(h[0]+3,h[1]-3);x.lineTo(h[0]-3,h[1]+3);x.stroke();
    });x.restore();
    // Misses (white dots)
    [[90,70],[165,54],[115,86]].forEach(function(m){
      x.fillStyle='rgba(255,255,255,0.2)';x.beginPath();x.arc(m[0],m[1],4,0,Math.PI*2);x.fill();
    });
    // Water ripple
    x.save();x.strokeStyle='rgba(34,211,238,0.15)';x.lineWidth=1;
    x.beginPath();x.arc(90,70,8,0,Math.PI*2);x.stroke();
    x.beginPath();x.arc(90,70,14,0,Math.PI*2);x.stroke();x.restore();
  },

  /* ── BLOCK BLAST ───────────────────────────────────────────── */
  blockblast:function(x,W,H){
    var colors=['#3b82f6','#ec4899','#06d6a0','#fbbf24','#a855f7','#ef4444'];
    // Deterministic grid (no Math.random)
    var pattern=[
      [1,0,1,1,0,1,0],
      [1,1,0,1,1,0,1],
      [0,1,1,0,1,1,1],
      [1,0,1,1,0,1,0],
      [0,1,0,1,1,0,1]
    ];
    for(var r=0;r<5;r++)for(var c=0;c<7;c++){
      if(pattern[r][c]){
        var bx=30+c*34,by=6+r*24;
        var bg=x.createLinearGradient(bx,by,bx,by+20);
        bg.addColorStop(0,colors[(r+c)%6]);bg.addColorStop(1,colors[(r+c+1)%6]);
        x.fillStyle=bg;x.beginPath();x.roundRect(bx,by,30,20,4);x.fill();
        x.fillStyle='rgba(255,255,255,0.2)';x.fillRect(bx,by,30,5);
      }
    }
    // Clearing glow on row 3
    x.save();x.globalAlpha=0.2;x.fillStyle='#fff';
    x.shadowColor='#fff';x.shadowBlur=15;x.fillRect(28,6+2*24-2,244,24);x.restore();
    // Piece preview at bottom
    var pc=[{dx:0,dy:0},{dx:1,dy:0},{dx:0,dy:1}];
    pc.forEach(function(p){
      x.fillStyle='rgba(236,72,153,0.5)';x.beginPath();x.roundRect(200+p.dx*18,110+p.dy*18,16,16,3);x.fill();
    });
  },

  /* ── TRIVIA RACE ───────────────────────────────────────────── */
  trivia:function(x,W,H){
    // Question card
    x.fillStyle='rgba(255,255,255,0.08)';x.beginPath();x.roundRect(30,10,220,35,8);x.fill();
    x.strokeStyle='rgba(255,255,255,0.1)';x.lineWidth=1;x.beginPath();x.roundRect(30,10,220,35,8);x.stroke();
    x.fillStyle='#fff';x.font='bold 12px Outfit,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText('What is the largest planet?',140,28);
    // Answer options with A B C D badges
    var opts=[{l:'A',t:'Jupiter',c:'#16a34a',right:true},{l:'B',t:'Saturn',c:'#3b82f6',right:false},{l:'C',t:'Mars',c:'#ef4444',right:false},{l:'D',t:'Venus',c:'#fbbf24',right:false}];
    for(var i=0;i<4;i++){
      var ox=40+(i%2)*110,oy=55+(i>1?32:0);
      x.fillStyle=opts[i].right?'rgba(22,163,74,0.35)':'rgba(255,255,255,0.06)';
      x.beginPath();x.roundRect(ox,oy,100,26,6);x.fill();
      if(opts[i].right){x.save();x.shadowColor='#16a34a';x.shadowBlur=8;
        x.strokeStyle='#16a34a';x.lineWidth=1.5;x.beginPath();x.roundRect(ox,oy,100,26,6);x.stroke();x.restore();}
      // Badge circle
      x.fillStyle=opts[i].c;x.beginPath();x.arc(ox+14,oy+13,8,0,Math.PI*2);x.fill();
      x.fillStyle='#fff';x.font='bold 9px Outfit,sans-serif';x.textAlign='center';x.fillText(opts[i].l,ox+14,oy+14);
      // Text
      x.fillStyle='#fff';x.font='11px Outfit,sans-serif';x.textAlign='left';x.fillText(opts[i].t,ox+26,oy+14);
    }
    // Timer bar
    x.fillStyle='rgba(255,255,255,0.05)';x.beginPath();x.roundRect(30,120,220,6,3);x.fill();
    x.fillStyle='#fbbf24';x.beginPath();x.roundRect(30,120,150,6,3);x.fill();
  },

  /* ── TYPING RACE ───────────────────────────────────────────── */
  typing:function(x,W,H){
    // Text line being typed
    x.fillStyle='#06d6a0';x.font='bold 15px monospace';x.textAlign='left';x.textBaseline='middle';
    x.fillText('The quick brown',30,30);
    x.fillStyle='rgba(255,255,255,0.25)';x.fillText(' fox jumps',175,30);
    // Blinking cursor
    x.save();x.shadowColor='#06d6a0';x.shadowBlur=8;
    x.fillStyle='#06d6a0';x.fillRect(173,22,2,18);x.restore();
    // Speed indicator
    x.fillStyle='rgba(255,255,255,0.06)';x.beginPath();x.roundRect(180,48,80,20,4);x.fill();
    x.fillStyle='#06d6a0';x.font='bold 10px Outfit,sans-serif';x.textAlign='center';
    x.fillText('85 WPM',220,59);
    // Keyboard rows
    var rows=[
      {keys:'QWERTYUIOP',y:78,x0:18,sz:21},
      {keys:'ASDFGHJKL',y:102,x0:28,sz:21},
      {keys:'ZXCVBNM',y:126,x0:48,sz:21}
    ];
    rows.forEach(function(row){
      for(var i=0;i<row.keys.length;i++){
        var kx=row.x0+i*(row.sz+2);
        // Active key highlight
        var active=row.keys[i]==='F';
        x.fillStyle=active?'rgba(6,214,160,0.3)':'rgba(255,255,255,0.07)';
        x.beginPath();x.roundRect(kx,row.y,row.sz,20,3);x.fill();
        if(active){x.save();x.shadowColor='#06d6a0';x.shadowBlur=6;
          x.strokeStyle='#06d6a0';x.lineWidth=1;x.beginPath();x.roundRect(kx,row.y,row.sz,20,3);x.stroke();x.restore();}
        x.fillStyle=active?'#06d6a0':'rgba(255,255,255,0.4)';
        x.font='bold 9px Outfit,sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText(row.keys[i],kx+row.sz/2,row.y+10);
      }
    });
  },

  /* ── KEYBOARD WARRIORS ─────────────────────────────────────── */
  keyboard:function(x,W,H){
    // Dark battlefield with enemy orbs approaching
    function drawEnemy(ex,ey,r,col,letter){
      x.save();x.shadowColor=col;x.shadowBlur=12;
      x.fillStyle=col;x.globalAlpha=0.3;x.beginPath();x.arc(ex,ey,r+6,0,Math.PI*2);x.fill();
      x.globalAlpha=1;x.fillStyle=col;x.beginPath();x.arc(ex,ey,r,0,Math.PI*2);x.fill();x.restore();
      x.fillStyle='#fff';x.font='bold '+(r>14?'14':'11')+'px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(letter,ex,ey);
    }
    drawEnemy(60,35,16,'#ef4444','A');drawEnemy(150,50,20,'#a855f7','X');
    drawEnemy(230,30,13,'#fbbf24','K');drawEnemy(100,85,14,'#3b82f6','Z');
    drawEnemy(200,75,11,'#ec4899','M');
    // Sword at bottom center with glow
    x.save();
    var sx=140,sy=120;
    // Blade
    x.shadowColor='#fbbf24';x.shadowBlur=12;
    x.fillStyle='#e5e7eb';
    x.beginPath();x.moveTo(sx,sy-45);x.lineTo(sx-5,sy-10);x.lineTo(sx+5,sy-10);x.closePath();x.fill();
    // Guard
    x.fillStyle='#fbbf24';x.fillRect(sx-14,sy-12,28,5);
    // Handle
    x.fillStyle='#8B4513';x.fillRect(sx-3,sy-7,6,18);
    // Pommel
    x.fillStyle='#fbbf24';x.beginPath();x.arc(sx,sy+13,4,0,Math.PI*2);x.fill();
    x.restore();
    // Projectile lines from sword to enemies
    x.save();x.strokeStyle='rgba(251,191,36,0.2)';x.lineWidth=1;x.setLineDash([3,4]);
    x.beginPath();x.moveTo(sx,sy-45);x.lineTo(60,35);x.stroke();
    x.beginPath();x.moveTo(sx,sy-45);x.lineTo(150,50);x.stroke();x.setLineDash([]);x.restore();
  },

  /* ── UNO ───────────────────────────────────────────────────── */
  uno:function(x,W,H){
    var uColors=['#dc2626','#16a34a','#2563eb','#eab308','#dc2626'];
    var uVals=['7','R','5','+2','0'];
    for(var i=0;i<5;i++){
      x.save();x.translate(75+i*33,70);x.rotate((i-2)*0.18);
      // Card shadow
      x.fillStyle='rgba(0,0,0,0.3)';x.beginPath();x.roundRect(-18,-28,38,55,5);x.fill();
      // Card body
      x.fillStyle=uColors[i];x.beginPath();x.roundRect(-20,-30,38,55,5);x.fill();
      // White oval center
      x.fillStyle='rgba(255,255,255,0.9)';x.save();x.rotate(0.3);
      x.beginPath();x.ellipse(0,-2,12,18,0,0,Math.PI*2);x.fill();x.restore();
      // Value
      x.fillStyle=uColors[i];x.font='bold 18px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(uVals[i],-1,-2);
      x.restore();
    }
    // Glow behind fanned cards
    x.save();x.globalCompositeOperation='destination-over';
    x.shadowColor=uColors[2];x.shadowBlur=20;x.globalAlpha=0.2;
    x.fillStyle=uColors[2];x.beginPath();x.ellipse(140,70,80,40,0,0,Math.PI*2);x.fill();
    x.restore();
  },

  /* ── COIN MINER ────────────────────────────────────────────── */
  coinminer:function(x,W,H){
    // Cave background texture
    x.fillStyle='rgba(139,69,19,0.1)';
    for(var i=0;i<6;i++){
      x.beginPath();x.arc(30+i*45,130,20+i*5,Math.PI,0);x.fill();
    }
    // Falling coins with glow
    var coins=[{cx:55,cy:30,r:14},{cx:120,cy:50,r:16},{cx:180,cy:25,r:13},{cx:230,cy:55,r:12},{cx:90,cy:80,r:15},{cx:160,cy:90,r:11}];
    coins.forEach(function(c){
      x.save();
      // Glow
      x.shadowColor='#fbbf24';x.shadowBlur=12;
      // Coin body
      var cg=x.createRadialGradient(c.cx-3,c.cy-3,c.r*0.1,c.cx,c.cy,c.r);
      cg.addColorStop(0,'#fde68a');cg.addColorStop(1,'#d97706');
      x.fillStyle=cg;x.beginPath();x.arc(c.cx,c.cy,c.r,0,Math.PI*2);x.fill();
      // Inner ring
      x.strokeStyle='rgba(251,191,36,0.5)';x.lineWidth=1.5;x.beginPath();x.arc(c.cx,c.cy,c.r*0.7,0,Math.PI*2);x.stroke();
      // Dollar sign
      x.fillStyle='#92400e';x.font='bold '+(c.r>13?'12':'10')+'px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText('$',c.cx,c.cy);
      x.restore();
    });
    // Pickaxe
    x.save();x.translate(40,120);x.rotate(-0.5);
    x.fillStyle='#8B4513';x.fillRect(-3,-35,6,38);
    x.fillStyle='#94a3b8';
    x.beginPath();x.moveTo(-3,-35);x.lineTo(15,-40);x.lineTo(12,-30);x.lineTo(-3,-32);x.closePath();x.fill();
    x.restore();
  },

  /* ── DOMINOES ──────────────────────────────────────────────── */
  dominoes:function(x,W,H){
    function drawDomino(dx,dy,rot,top,bot){
      x.save();x.translate(dx,dy);x.rotate(rot);
      // Shadow
      x.fillStyle='rgba(0,0,0,0.3)';x.beginPath();x.roundRect(-16,-33,36,70,4);x.fill();
      // Tile body
      x.fillStyle='#f5f0e8';x.beginPath();x.roundRect(-18,-35,36,70,4);x.fill();
      // Divider
      x.strokeStyle='#c9a84c';x.lineWidth=1.5;x.beginPath();x.moveTo(-14,0);x.lineTo(14,0);x.stroke();
      // Pips
      x.fillStyle='#1a1a2e';
      function pip(px,py){x.beginPath();x.arc(px,py,2.5,0,Math.PI*2);x.fill();}
      function drawPips(val,yOff){
        if(val>=1)pip(0,yOff);
        if(val>=2){pip(-6,yOff-8);pip(6,yOff+8);}
        if(val>=3){pip(-6,yOff+8);pip(6,yOff-8);}
        if(val>=4){pip(-6,yOff-8);pip(6,yOff-8);pip(-6,yOff+8);pip(6,yOff+8);}
        if(val>=5)pip(0,yOff);
        if(val>=6){pip(-6,yOff);pip(6,yOff);}
      }
      drawPips(top,-17);drawPips(bot,17);
      x.restore();
    }
    drawDomino(65,70,-0.12,3,5);drawDomino(130,75,0.05,5,2);drawDomino(195,68,0.15,6,4);
    // Subtle connection lines
    x.save();x.strokeStyle='rgba(201,168,76,0.15)';x.lineWidth=1;x.setLineDash([3,3]);
    x.beginPath();x.moveTo(83,70);x.lineTo(112,75);x.stroke();
    x.beginPath();x.moveTo(148,75);x.lineTo(177,68);x.stroke();x.setLineDash([]);x.restore();
  },

  /* ── BOWLING ───────────────────────────────────────────────── */
  bowling:function(x,W,H){
    // Lane
    x.fillStyle='rgba(194,154,100,0.15)';x.fillRect(80,0,120,H);
    // Lane arrows
    x.fillStyle='rgba(255,255,255,0.05)';
    x.beginPath();x.moveTo(140,40);x.lineTo(130,55);x.lineTo(150,55);x.closePath();x.fill();
    x.beginPath();x.moveTo(140,60);x.lineTo(132,72);x.lineTo(148,72);x.closePath();x.fill();
    // Pins in triangle formation
    function drawPin(px,py,standing){
      x.save();
      if(standing){
        x.fillStyle='#f5f0e8';x.beginPath();x.arc(px,py-6,5,0,Math.PI*2);x.fill();
        x.fillStyle='#e5e0d8';x.fillRect(px-3,py-2,6,10);
        x.fillStyle='#dc2626';x.beginPath();x.arc(px,py-6,5,0.3,Math.PI-0.3);x.fill();
      }else{
        x.globalAlpha=0.2;x.fillStyle='#f5f0e8';
        x.save();x.translate(px,py);x.rotate(0.8);
        x.beginPath();x.arc(0,-4,4,0,Math.PI*2);x.fill();x.fillRect(-2,0,4,8);
        x.restore();x.globalAlpha=1;
      }
      x.restore();
    }
    // Pin layout
    drawPin(140,20,true);
    drawPin(130,34,true);drawPin(150,34,true);
    drawPin(120,48,true);drawPin(140,48,false);drawPin(160,48,true);
    drawPin(110,62,true);drawPin(130,62,true);drawPin(150,62,false);drawPin(170,62,true);
    // Ball with glow
    x.save();x.shadowColor='#7c3aed';x.shadowBlur=14;
    var bg=x.createRadialGradient(137,108,3,140,112,16);
    bg.addColorStop(0,'#a78bfa');bg.addColorStop(1,'#4c1d95');
    x.fillStyle=bg;x.beginPath();x.arc(140,112,16,0,Math.PI*2);x.fill();x.restore();
    // Finger holes
    x.fillStyle='rgba(0,0,0,0.3)';
    x.beginPath();x.arc(136,106,3,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(143,104,3,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(140,110,2.5,0,Math.PI*2);x.fill();
  },

  /* ── HANGMAN ───────────────────────────────────────────────── */
  hangman:function(x,W,H){
    // Gallows with wood texture
    x.save();x.strokeStyle='#8B6914';x.lineWidth=4;x.lineCap='round';
    x.shadowColor='rgba(139,105,20,0.3)';x.shadowBlur=6;
    // Base
    x.beginPath();x.moveTo(40,130);x.lineTo(100,130);x.stroke();
    // Vertical
    x.beginPath();x.moveTo(70,130);x.lineTo(70,25);x.stroke();
    // Top
    x.beginPath();x.moveTo(70,25);x.lineTo(145,25);x.stroke();
    // Rope
    x.lineWidth=2;x.strokeStyle='#c9a84c';
    x.beginPath();x.moveTo(145,25);x.lineTo(145,40);x.stroke();
    // Brace
    x.lineWidth=2;x.strokeStyle='#8B6914';
    x.beginPath();x.moveTo(70,45);x.lineTo(90,25);x.stroke();
    x.restore();
    // Stick figure with glow
    x.save();x.strokeStyle='#fbbf24';x.lineWidth=3;x.lineCap='round';
    x.shadowColor='#fbbf24';x.shadowBlur=8;
    // Head
    x.beginPath();x.arc(145,52,12,0,Math.PI*2);x.stroke();
    // Body
    x.beginPath();x.moveTo(145,64);x.lineTo(145,98);x.stroke();
    // Arms
    x.beginPath();x.moveTo(145,75);x.lineTo(125,90);x.stroke();
    x.beginPath();x.moveTo(145,75);x.lineTo(165,90);x.stroke();
    // Legs
    x.beginPath();x.moveTo(145,98);x.lineTo(128,118);x.stroke();
    x.beginPath();x.moveTo(145,98);x.lineTo(162,118);x.stroke();
    x.restore();
    // Letter blanks
    x.fillStyle='rgba(255,255,255,0.3)';x.font='bold 18px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
    var blanks='_ _ _ _ _ _';
    x.fillText(blanks,190,70);
    // Guessed letters
    x.fillStyle='rgba(255,255,255,0.1)';x.font='12px Outfit,sans-serif';
    x.fillText('A  E  R  S',190,100);
  },

  /* ── MEMORY MATCH ──────────────────────────────────────────── */
  memory:function(x,W,H){
    var syms=['\u2605','\u2665','\u2605','\u2663','\u2665','\u2666','\u2660','\u2666'];
    var symC=['#fbbf24','#ef4444','#fbbf24','#333','#ef4444','#3b82f6','#333','#3b82f6'];
    var flipped=[2,5]; // indices that are face-up
    for(var r=0;r<2;r++)for(var c=0;c<4;c++){
      var idx=r*4+c;var cx=52+c*52,cy=25+r*58;
      var isFace=flipped.indexOf(idx)>=0;
      if(isFace){
        // Face-up card with glow
        x.save();x.shadowColor=symC[idx];x.shadowBlur=10;
        x.fillStyle='rgba(255,255,255,0.12)';x.beginPath();x.roundRect(cx,cy,44,50,6);x.fill();x.restore();
        x.strokeStyle=symC[idx];x.lineWidth=2;x.beginPath();x.roundRect(cx,cy,44,50,6);x.stroke();
        x.fillStyle=symC[idx];x.font='24px sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText(syms[idx],cx+22,cy+25);
      }else{
        // Face-down card
        x.fillStyle='#1e3a5f';x.beginPath();x.roundRect(cx,cy,44,50,6);x.fill();
        // Pattern on back
        x.strokeStyle='rgba(255,255,255,0.08)';x.lineWidth=0.5;
        for(var p=0;p<3;p++){x.beginPath();x.arc(cx+22,cy+25,6+p*6,0,Math.PI*2);x.stroke();}
        x.fillStyle='rgba(255,255,255,0.12)';x.font='bold 14px Fredoka,sans-serif';x.textAlign='center';x.textBaseline='middle';
        x.fillText('?',cx+22,cy+26);
      }
    }
    // Match indicator sparkle between the two face-up cards
    x.save();x.strokeStyle='rgba(251,191,36,0.3)';x.lineWidth=1.5;x.setLineDash([3,3]);
    x.beginPath();x.moveTo(52+2*52+22,25+25);x.lineTo(52+1*52+22,25+58+25);x.stroke();x.setLineDash([]);
    // Sparkle
    x.fillStyle='#fbbf24';x.globalAlpha=0.5;
    x.beginPath();x.arc(140,65,2,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(135,70,1.5,0,Math.PI*2);x.fill();
    x.beginPath();x.arc(145,60,1.5,0,Math.PI*2);x.fill();
    x.restore();
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

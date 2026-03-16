var ODA_VERSION='2026-03-14a';
var students=[],allAssignments=[],currentClass='All Students',selectedStudent=null,selectedOpt=null;

// ===== HTML BUILDER HELPERS =====
// Reduce h+= string concatenation by centralizing common UI patterns

/** Status badge HTML */
function badgeHTML(status, label) {
  var cls = { pending:'st-pending', submitted:'st-submitted', graded:'st-graded', completed:'st-completed', returned:'st-returned' };
  return '<span class="a-status '+(cls[status]||'st-pending')+'">'+(label||status)+'</span>';
}

/** Status class lookup */
function statusClass(status) {
  return { pending:'st-pending', submitted:'st-submitted', graded:'st-graded', completed:'st-completed', returned:'st-returned' }[status] || 'st-pending';
}

/** Status display label */
function statusLabel(status) {
  return { pending:'Pending', submitted:'Needs Review', graded:'Graded', completed:'Completed', returned:'Returned' }[status] || status;
}

/** Emoji for assignment type */
function typeEmoji(type) {
  return { 'elevator-pitch':'\u{1F399}\uFE0F', 'pitch-challenge':'\u{1F4A1}', 'lemonade-day':'\u{1F34B}', 'spelling-bee':'\u{1F41D}', assignment:'\u{1F4CB}', tool:'\u{1F6E0}\uFE0F' }[type] || '\u{1F4CB}';
}

function checkForUpdates(btn){
btn.disabled=true;btn.innerHTML='&#x1F504; Checking...';
fetch(location.href+'?_='+Date.now(),{cache:'no-store'}).then(function(r){return r.text()}).then(function(html){
var m=html.match(/ODA_VERSION='([^']+)'/);
var remote=m?m[1]:'';
if(remote&&remote!==ODA_VERSION){
btn.innerHTML='&#x2705; Update found! Reloading...';
setTimeout(function(){location.reload(true)},600);
}else{
btn.innerHTML='&#x2705; Up to date!';
setTimeout(function(){btn.innerHTML='&#x1F504; Update';btn.disabled=false},2000);
}
}).catch(function(){
btn.innerHTML='&#x1F504; Update';btn.disabled=false;
location.reload(true);
});
}

var ASSIGN_TYPES={
'spelling-k2':{title:'Spelling K-2',emoji:'\u{1F4D6}'},'spelling-34':{title:'Spelling 3-4',emoji:'\u{1F4D6}'},'spelling-58':{title:'Spelling 5-8',emoji:'\u{1F4D6}'},
'vocab-k2':{title:'Vocab K-2',emoji:'\u{1F4AC}'},'vocab-34':{title:'Vocab 3-4',emoji:'\u{1F4AC}'},'vocab-58':{title:'Vocab 5-8',emoji:'\u{1F4AC}'},
'pitch-challenge':{title:'Pitch Challenge',emoji:'\u{1F4A1}'},'elevator-pitch':{title:'Elevator Pitch',emoji:'\u{1F3A4}'},'lemonade-day':{title:'Lemonade Day',emoji:'\u{1F34B}'},
'free-play':{title:'Free Play',emoji:'\u{1F3AE}'},
'worksheet':{title:'Worksheet',emoji:'\u{1F4C4}'},
'link':{title:'Link',emoji:'\u{1F517}'},
'custom':{title:'Custom',emoji:'\u270F\uFE0F'}
};

var teacherTabOrder=['home','tools','roster','assignments','arcade','settings'];
function switchTab(id){
var tabs=document.querySelectorAll('.tab[role="tab"]');
var secs=document.querySelectorAll('.section');
for(var i=0;i<tabs.length;i++){tabs[i].classList.remove('active');tabs[i].setAttribute('aria-selected','false');tabs[i].setAttribute('tabindex','-1');secs[i].classList.remove('show')}
document.getElementById('sec-'+id).classList.add('show');
var m={home:0,tools:1,roster:2,assignments:3,arcade:4,settings:5};
if(m[id]!==undefined){tabs[m[id]].classList.add('active');tabs[m[id]].setAttribute('aria-selected','true');tabs[m[id]].setAttribute('tabindex','0')}
closeProfile();
if(id==='assignments'){renderAssignmentsList();populateClassFilters()}
if(id==='tools'){renderMyTools()}
odaAnnounce(id+' tab selected');
}
window.switchTab=switchTab;
function teacherTabKeyNav(e,current){
var idx=teacherTabOrder.indexOf(current);if(idx<0)return;
if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
e.preventDefault();
var next=e.key==='ArrowRight'?(idx+1)%teacherTabOrder.length:(idx-1+teacherTabOrder.length)%teacherTabOrder.length;
switchTab(teacherTabOrder[next]);
document.getElementById('tab-'+teacherTabOrder[next]).focus();
}else if(e.key==='Enter'||e.key===' '){e.preventDefault();switchTab(current)}
}
window.teacherTabKeyNav=teacherTabKeyNav;

// ===== MY TOOLS =====
var TEACHER_TOOLS=[
{id:'pitch-challenge',emoji:'\u{1F4A1}',name:'Pitch Challenge',desc:'Full business pitch \u2014 problem, idea, customers, record & present.',url:'pitch.html',toolType:'pitch-challenge'},
{id:'elevator-pitch',emoji:'\u{1F3A4}',name:'Elevator Pitch',desc:'10-question interview \u2192 auto-generated pitch. 3 styles.',url:'elevator.html',toolType:'elevator-pitch'},
{id:'lemonade',emoji:'\u{1F34B}',name:'Lemonade Day',desc:'Mikaila video, mission statement, sign-ups & hype.',url:'lemonade.html',toolType:'lemonade-day'},
{id:'spelling',emoji:'\u{1F41D}',name:'Spelling Bee',desc:'Cleveland-themed spelling challenges. 5 levels.',url:'spelling.html',toolType:'spelling-bee'},
{id:'oda-studio',emoji:'\u2728',name:'ODA Studio',desc:'Build custom tools with AI! Chat-powered studio.',url:'builder.html',toolType:'oda-studio'},
{id:'jeopardy',emoji:'\u{1F3AF}',name:'Jeopardy',desc:'Create custom Jeopardy boards. AI generates 25 questions instantly.',url:'jeopardy.html',toolType:'jeopardy'},
{id:'kahoot',emoji:'\u26A1',name:'Quiz Blitz',desc:'Kahoot-style quizzes. Host live or assign for practice.',url:'kahoot.html',toolType:'kahoot'},
{id:'flashcards',emoji:'\u{1F4DA}',name:'Flashcards',desc:'Create decks with AI. Browse, quiz, match & speed round modes.',url:'flashcards.html',toolType:'flashcards'},
{id:'wordsearch',emoji:'\u{1F50D}',name:'Word Search',desc:'AI-generated word search puzzles from any topic.',url:'wordsearch.html',toolType:'wordsearch'},
{id:'crossword',emoji:'\u270F\uFE0F',name:'Crossword',desc:'Auto-generated crosswords with vocabulary clues.',url:'crossword.html',toolType:'crossword'},
{id:'library',emoji:'\u{1F4D6}',name:'Library',desc:'AI reading passages with comprehension quizzes & reading logs.',url:'library.html',toolType:'library'},
{id:'canvas',emoji:'\u{1F3A8}',name:'ODA Canvas',desc:'Drawing & design tool. Posters, t-shirts, comics & more.',url:'canvas.html',toolType:'canvas'},
{id:'timer',emoji:'\u23F0',name:'Timer',desc:'Clock, countdown timer, stopwatch & alarms. Projector-ready.',url:'timer.html',toolType:'timer'},
{id:'scoreboard',emoji:'\u{1F3C6}',name:'Scoreboard',desc:'Team scoreboard with buzzer mode. Great for competitions.',url:'scoreboard.html',toolType:'scoreboard'},
{id:'raffle',emoji:'\u{1F3B0}',name:'Raffle',desc:'Coin-powered raffle with animated prize wheel drawing.',url:'raffle.html',toolType:'raffle'}
];
var COMING_SOON_TEACHER=[
{id:'oda-world',emoji:'\u{1F30D}',name:'ODA World',desc:'Immersive virtual campus for students to explore.'},
{id:'debate',emoji:'\u{1F5E3}\uFE0F',name:'Debate Club',desc:'Structured debate practice for students.'}
];

function renderMyTools(){
var grid=document.getElementById('teacherToolsGrid');
var h='';
TEACHER_TOOLS.forEach(function(t){
// Count submissions for this tool
var subs=0;var assigned=0;
if(window.allAssignments){
window.allAssignments.forEach(function(a){
if(a.toolType===t.toolType){
assigned++;
if(a.status==='submitted'||a.status==='completed')subs++;
}
});
}
h+='<div class="tool-card">';
h+='<span class="tool-emoji">'+t.emoji+'</span>';
h+='<div class="tool-title">'+t.name+'</div>';
h+='<div class="tool-desc">'+t.desc+'</div>';
if(assigned>0)h+='<span class="tool-stat">'+subs+'/'+assigned+' submitted</span>';
h+='<div class="tool-actions">';
h+='<a class="tool-btn" href="'+t.url+'">Open</a>';
h+='<button class="tool-btn assign" onclick="quickAssignTool(\''+t.toolType+'\')">Assign</button>';
if(subs>0)h+='<button class="tool-btn subs" onclick="viewToolSubmissions(\''+t.toolType+'\')">View Work</button>';
h+='</div></div>';
});
grid.innerHTML=h;

var coming=document.getElementById('teacherToolsComingSoon');
var ch='';
COMING_SOON_TEACHER.forEach(function(t){
ch+='<div class="tool-card coming-soon">';
ch+='<span class="tool-emoji">'+t.emoji+'</span>';
ch+='<div class="tool-title">'+t.name+'</div>';
ch+='<div class="tool-desc">'+t.desc+'</div>';
ch+='</div>';
});
coming.innerHTML=ch;
}

function quickAssignTool(toolType){
switchTab('assignments');
setTimeout(function(){
openCreateAssignment();
setTimeout(function(){
// Try to auto-select the tool
var cards=document.querySelectorAll('.tool-pick');
cards.forEach(function(c){
if(c.getAttribute('data-val')===toolType){c.click()}
});
},200);
},100);
}
window.quickAssignTool=quickAssignTool;

function viewToolSubmissions(toolType){
switchTab('assignments');
setTimeout(function(){
var sel=document.getElementById('filterStatus');
if(sel){sel.value='submitted';filterAssignments()}
},100);
}
window.viewToolSubmissions=viewToolSubmissions;

// ===== CLASSES =====
function loadClasses(){
var classes=window.teacherData&&window.teacherData.classes?window.teacherData.classes.filter(function(c){return c!=='All Students'}):[];
renderClassTabs(classes);
}

function renderClassTabs(classes){
var el=document.getElementById('classTabs');
var h='<button class="class-tab'+(currentClass==='All Students'?' active':'')+'" onclick="filterClass(\'All Students\')">All Students</button>';
for(var i=0;i<classes.length;i++){
h+='<button class="class-tab'+(classes[i]===currentClass?' active':'')+'" onclick="filterClass(\''+esc(classes[i])+'\')">';
h+=esc(classes[i]);
h+=' <span onclick="event.stopPropagation();deleteClass(\''+esc(classes[i])+'\')" style="margin-left:4px;opacity:.5;cursor:pointer">&times;</span>';
h+='</button>';
}
el.innerHTML=h;
}

function filterClass(name){
currentClass=name;
loadClasses();
renderStudentList();
}
window.filterClass=filterClass;

var _odaFocusTraps={};
function openClassModal(){var m=document.getElementById('classModal');m.classList.add('show');if(window.odaTrapFocus)_odaFocusTraps.classModal=window.odaTrapFocus(m)}
function closeClassModal(){document.getElementById('classModal').classList.remove('show');document.getElementById('className').value='';if(_odaFocusTraps.classModal){_odaFocusTraps.classModal();_odaFocusTraps.classModal=null}}
window.openClassModal=openClassModal;window.closeClassModal=closeClassModal;

function openAddStudentModal(){
var sel=document.getElementById('addStudentClass');
var classes=window.teacherData&&window.teacherData.classes?window.teacherData.classes.filter(function(c){return c!=='All Students'}):[];
if(!classes.length){odaToast('Create a class first before adding students.','warning');openClassModal();return}
var h='<option value="">Choose a class...</option>';
for(var i=0;i<classes.length;i++){
var isSelected=currentClass!=='All Students'&&classes[i]===currentClass;
h+='<option value="'+esc(classes[i])+'"'+(isSelected?' selected':'')+'>'+esc(classes[i])+'</option>';
}
sel.innerHTML=h;
var m=document.getElementById('addStudentModal');m.classList.add('show');
if(window.odaTrapFocus)_odaFocusTraps.addStudentModal=window.odaTrapFocus(m);
}
function closeAddStudentModal(){
document.getElementById('addStudentModal').classList.remove('show');if(_odaFocusTraps.addStudentModal){_odaFocusTraps.addStudentModal();_odaFocusTraps.addStudentModal=null}
document.getElementById('addStudentName').value='';
document.getElementById('addStudentGrade').value='';
document.getElementById('addStudentGradeCustom').value='';
document.getElementById('addStudentGradeCustom').style.display='none';
}
window.openAddStudentModal=openAddStudentModal;window.closeAddStudentModal=closeAddStudentModal;

async function deleteClass(name){
if(!confirm('Delete class "'+name+'"? Students in this class won\'t be deleted.'))return;
var classes=window.teacherData.classes||[];
var idx=classes.indexOf(name);
if(idx>=0)classes.splice(idx,1);
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'teachers',window.currentTeacher.uid),{classes:classes});
window.teacherData.classes=classes;
if(currentClass===name)currentClass='All Students';
loadClasses();
renderStudentList();
}catch(e){console.error(e)}
}
window.deleteClass=deleteClass;

// Settings population
function populateSettings(){
if(!window.teacherData)return;
var td=window.teacherData;
document.getElementById('setName').value=td.name||'';
document.getElementById('setDistrict').value=td.district||'';
document.getElementById('setSchool').value=td.school||'';
document.getElementById('setGrades').value=td.gradeLevels||'';
document.getElementById('setTeam').value=td.team||'';
document.getElementById('setProgram').value=td.program||'';
document.getElementById('settingsClassCode').textContent=td.classCode||'------';
}

function updateToggleBtn(id,on){
var btn=document.getElementById(id);
if(!btn)return;
btn.textContent=on?'ON':'OFF';
btn.style.background=on?'var(--accent)':'';
btn.style.color=on?'var(--bg)':'';
btn.style.borderColor=on?'var(--accent)':'';
}

async function saveProfile(){
var name=document.getElementById('setName').value.trim();
var district=document.getElementById('setDistrict').value;
var school=document.getElementById('setSchool').value;
var grades=document.getElementById('setGrades').value.trim();
var team=document.getElementById('setTeam').value;
var program=document.getElementById('setProgram').value;
if(!name){odaToast('Name is required','warning');return}
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'teachers',window.currentTeacher.uid),{name:name,district:district,school:school,gradeLevels:grades,team:team,program:program});
window.teacherData.name=name;
window.teacherData.district=district;
window.teacherData.school=school;
window.teacherData.gradeLevels=grades;
window.teacherData.team=team;
window.teacherData.program=program;
document.getElementById('teacherName').textContent=name;
document.getElementById('welcomeName').textContent=name.split(' ')[0];
var msg=document.getElementById('profileSaveMsg');msg.style.display='block';setTimeout(function(){msg.style.display='none'},2000);
}catch(e){console.error(e);odaToast('Error saving','error')}
}
window.saveProfile=saveProfile;

async function generateUniqueClassCode(){
for(var attempts=0;attempts<10;attempts++){
var code=String(Math.floor(100000+Math.random()*900000));
var q=window.fbQuery(window.fbCollection(window.fbDb,'teachers'),window.fbWhere('classCode','==',code));
var snap=await window.fbGetDocs(q);
var taken=false;
snap.forEach(function(d){if(d.id!==window.currentTeacher.uid)taken=true});
if(!taken)return code;
}
return String(Math.floor(100000+Math.random()*900000)); // fallback
}

async function regenerateClassCode(){
try{
var code=await generateUniqueClassCode();
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'teachers',window.currentTeacher.uid),{classCode:code});
window.teacherData.classCode=code;
document.getElementById('classCodeDisplay').textContent=code;
document.getElementById('settingsClassCode').textContent=code;
var msg=document.getElementById('codeSaveMsg');msg.style.display='block';setTimeout(function(){msg.style.display='none'},2000);
}catch(e){console.error(e);odaToast('Error: '+e.message,'error')}
}
window.regenerateClassCode=regenerateClassCode;

function copyClassCode(){
var code=window.teacherData&&window.teacherData.classCode?window.teacherData.classCode:'';
if(!code)return;
navigator.clipboard.writeText(code).then(function(){odaToast('Class code copied!','success')}).catch(function(){
var ta=document.createElement('textarea');ta.value=code;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);odaToast('Class code copied!','success');
});
}
window.copyClassCode=copyClassCode;

async function createClass(){
var name=document.getElementById('className').value.trim();
if(!name)return;
var classes=(window.teacherData.classes||[]).filter(function(c){return c!=='All Students'});
if(classes.indexOf(name)===-1)classes.push(name);
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'teachers',window.currentTeacher.uid),{classes:classes});
window.teacherData.classes=classes;
currentClass=name;
loadClasses();
closeClassModal();
}catch(e){console.error(e)}
}
window.createClass=createClass;

// ===== STUDENTS =====
async function loadStudents(){
try{
var q=window.fbQuery(window.fbCollection(window.fbDb,'students'),window.fbWhere('teacherId','==',window.currentTeacher.uid));
var snap=await window.fbGetDocs(q);
students=[];snap.forEach(function(d){students.push({id:d.id,...d.data()})});

// Backfill parentCode for any students missing one
students.forEach(function(s){
if(!s.parentCode){
var pc=String(Math.floor(1000+Math.random()*9000));
s.parentCode=pc;
window.fbSetDoc(window.fbDoc(window.fbDb,'students',s.id),{parentCode:pc},{merge:true}).catch(function(e){console.error('parentCode backfill:',e)});
}
});

// If no real-time listener yet, do a one-time load of assignments
if(!window._assignListenerActive){
var aq=window.fbQuery(window.fbCollection(window.fbDb,'assignments'),window.fbWhere('teacherId','==',window.currentTeacher.uid));
var asnap=await window.fbGetDocs(aq);
allAssignments=[];asnap.forEach(function(d){allAssignments.push({id:d.id,...d.data()})});
}

renderStudentList();
updateStats();
updateAnalytics();
updateNotifBadge();
renderAssignmentsList();
populateClassFilters();
}catch(e){console.error(e);document.getElementById('studentList').innerHTML='<div class="empty-state"><span class="emoji">&#x26A0;&#xFE0F;</span><p>Error loading.</p></div>'}
}

// Real-time assignment listener
function setupAssignmentListener(){
if(!window.currentTeacher)return;
var aq=window.fbQuery(window.fbCollection(window.fbDb,'assignments'),window.fbWhere('teacherId','==',window.currentTeacher.uid));
window.fbOnSnapshot(aq,function(snap){
allAssignments=[];snap.forEach(function(d){allAssignments.push({id:d.id,...d.data()})});
window._assignListenerActive=true;
updateStats();
updateAnalytics();
updateNotifBadge();
renderAssignmentsList();
if(selectedStudent)renderProfileAssignments();
});
}
window.setupAssignmentListener=setupAssignmentListener;

function updateStats(){
document.getElementById('statStudents').textContent=students.length;
var pending=0,done=0,overdue=0,review=0;
var today=new Date().toISOString().split('T')[0];
allAssignments.forEach(function(a){
if(a.status==='completed'||a.status==='graded')done++;
else if(a.status==='submitted'){review++;pending++}
else{
pending++;
if(a.dueDate&&a.dueDate<today)overdue++;
}
});
document.getElementById('statPending').textContent=pending;
document.getElementById('statReview').textContent=review;
document.getElementById('statDone').textContent=done;
document.getElementById('statOverdue').textContent=overdue;
}

function renderStudentList(){
var el=document.getElementById('studentList');
var filtered=currentClass==='All Students'?students:students.filter(function(s){return s.className===currentClass});
document.getElementById('rosterCount').textContent='('+filtered.length+')';

if(!filtered.length){el.innerHTML='<div class="empty-state"><span class="emoji">&#x1F393;</span><p>No students'+(currentClass!=='All Students'?' in this class':' yet. Create a class and add students to get started!')+'</p></div>';return}
filtered.sort(function(a,b){return(a.name||'').localeCompare(b.name||'')});

var h='';
for(var i=0;i<filtered.length;i++){
var s=filtered[i];
var init=(s.name||'?').charAt(0).toUpperCase();
var sAssigns=allAssignments.filter(function(a){return a.studentId===s.id});
var pending=sAssigns.filter(function(a){return a.status==='pending'}).length;
var completed=sAssigns.filter(function(a){return a.status==='completed'}).length;
var badge,badgeClass;
if(pending>0){badge=pending+' pending';badgeClass='badge-pending'}
else if(completed>0){badge='All done';badgeClass='badge-done'}
else{badge='No tasks';badgeClass='badge-idle'}
var checked=_selectedStudentIds.indexOf(s.id)>=0;
h+='<div class="s-row'+(checked?' selected-row':'')+'" role="button" tabindex="0" onclick="openProfile(\''+s.id+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openProfile(\''+s.id+'\')}">';
h+='<input type="checkbox" class="s-check" data-sid="'+s.id+'"'+(checked?' checked':'')+' onclick="event.stopPropagation();toggleStudentCheck(\''+s.id+'\',this)">';
h+='<div class="s-info"><div class="s-avatar">'+init+'</div><div><div class="s-name">'+esc(s.name)+'</div><div class="s-meta">Grade '+esc(s.grade||'?')+(s.className?' • '+esc(s.className):'')+'</div></div></div>';
h+='<div class="s-right"><span class="s-badge '+badgeClass+'">'+badge+'</span></div>';
h+='</div>';
}
el.innerHTML=h;
updateRosterBulkBar();
}

// Grade select: show custom input when "Other" is chosen
document.getElementById('addStudentGrade').addEventListener('change',function(){
var custom=document.getElementById('addStudentGradeCustom');
custom.style.display=this.value==='Other'?'':'none';
if(this.value!=='Other')custom.value='';
});

var _addingStudent=false;
async function addStudent(){
if(_addingStudent)return;
var name=document.getElementById('addStudentName').value.trim();
var gradeSelect=document.getElementById('addStudentGrade').value;
var grade=gradeSelect==='Other'?document.getElementById('addStudentGradeCustom').value.trim():gradeSelect;
var className=document.getElementById('addStudentClass').value;
if(!name)return;
if(!grade){odaToast('Please select a grade.','warning');return}
if(!className){odaToast('Please select a class for this student.','warning');return}
_addingStudent=true;
var btn=document.querySelector('#addStudentModal .btn-accent');
if(btn){btn.textContent='Adding...';btn.disabled=true}
try{
var parentCode=String(Math.floor(1000+Math.random()*9000));
await window.fbAddDoc(window.fbCollection(window.fbDb,'students'),{
name:name,nameLower:name.toLowerCase(),grade:grade,
teacherId:window.currentTeacher.uid,
school:window.teacherData?window.teacherData.school:'',
className:className,
parentCode:parentCode,
createdAt:new Date().toISOString()
});
closeAddStudentModal();
loadStudents();
}catch(e){console.error(e);odaToast('Error: '+e.message,'error')}
finally{_addingStudent=false;if(btn){btn.textContent='Add Student';btn.disabled=false}}
}
window.addStudent=addStudent;

// ===== STUDENT PROFILE =====
function openProfile(id){
selectedStudent=students.find(function(s){return s.id===id});
if(!selectedStudent)return;
document.getElementById('rosterView').style.display='none';
document.getElementById('profilePanel').classList.add('show');
document.getElementById('profileAvatar').textContent=(selectedStudent.name||'?').charAt(0).toUpperCase();
document.getElementById('profileName').textContent=selectedStudent.name;
document.getElementById('profileDetail').textContent='Grade '+(selectedStudent.grade||'?')+(selectedStudent.className?' \u2022 '+selectedStudent.className:'')+(selectedStudent.parentCode?' \u2022 Parent Code: '+selectedStudent.parentCode:'');
// Arcade toggle
var arcOn=selectedStudent.arcadeUnlocked||false;
var abtn=document.getElementById('arcadeToggleBtn');
abtn.textContent=arcOn?'\u{1F512} Lock Arcade':'\u{1F3AE} Unlock Arcade';
abtn.style.background=arcOn?'var(--accent3)':'';
abtn.style.borderColor=arcOn?'var(--accent3)':'';
renderProfileAssignments();
loadStudentWork();
}
window.openProfile=openProfile;

function closeProfile(){
document.getElementById('profilePanel').classList.remove('show');
document.getElementById('rosterView').style.display='';
selectedStudent=null;
}
window.closeProfile=closeProfile;

async function deleteStudent(){
if(!selectedStudent)return;
if(!confirm('Delete "'+selectedStudent.name+'"? This will also delete all their assignments. This cannot be undone.'))return;
var sName=selectedStudent.name;
var sId=selectedStudent.id;
try{
var aq=window.fbQuery(window.fbCollection(window.fbDb,'assignments'),window.fbWhere('studentId','==',sId));
var asnap=await window.fbGetDocs(aq);
var deletes=[];
asnap.forEach(function(d){deletes.push(window.fbDeleteDoc(window.fbDoc(window.fbDb,'assignments',d.id)))});
await Promise.all(deletes);
await window.fbDeleteDoc(window.fbDoc(window.fbDb,'students',sId));
closeProfile();
await loadStudents();
odaToast('"'+sName+'" deleted','success');
}catch(e){console.error(e);odaToast('Error deleting student: '+e.message,'error')}
}
window.deleteStudent=deleteStudent;

// ===== MULTI-SELECT DELETE =====
var _selectedStudentIds=[];

function toggleStudentCheck(sid,cb){
var idx=_selectedStudentIds.indexOf(sid);
if(cb.checked&&idx<0)_selectedStudentIds.push(sid);
else if(!cb.checked&&idx>=0)_selectedStudentIds.splice(idx,1);
var row=cb.closest('.s-row');
if(row)row.classList.toggle('selected-row',cb.checked);
updateRosterBulkBar();
}
window.toggleStudentCheck=toggleStudentCheck;

function updateRosterBulkBar(){
var bar=document.getElementById('rosterBulkBar');
var count=_selectedStudentIds.length;
if(count>0){
bar.style.display='flex';
document.getElementById('rosterBulkCount').textContent=count+' student'+(count!==1?'s':'')+' selected';
}else{
bar.style.display='none';
}
}

function selectAllStudents(){
var boxes=document.querySelectorAll('#studentList .s-check');
_selectedStudentIds=[];
boxes.forEach(function(cb){
cb.checked=true;
_selectedStudentIds.push(cb.getAttribute('data-sid'));
var row=cb.closest('.s-row');
if(row)row.classList.add('selected-row');
});
updateRosterBulkBar();
}
window.selectAllStudents=selectAllStudents;

function clearStudentSelection(){
_selectedStudentIds=[];
var boxes=document.querySelectorAll('#studentList .s-check');
boxes.forEach(function(cb){
cb.checked=false;
var row=cb.closest('.s-row');
if(row)row.classList.remove('selected-row');
});
updateRosterBulkBar();
}
window.clearStudentSelection=clearStudentSelection;

async function deleteSelectedStudents(){
var count=_selectedStudentIds.length;
if(!count)return;
if(!confirm('Delete '+count+' student'+(count!==1?'s':'')+'? This will also delete all their assignments. This cannot be undone.'))return;
try{
for(var i=0;i<_selectedStudentIds.length;i++){
var sid=_selectedStudentIds[i];
var aq=window.fbQuery(window.fbCollection(window.fbDb,'assignments'),window.fbWhere('studentId','==',sid));
var asnap=await window.fbGetDocs(aq);
var dels=[];
asnap.forEach(function(d){dels.push(window.fbDeleteDoc(window.fbDoc(window.fbDb,'assignments',d.id)))});
await Promise.all(dels);
await window.fbDeleteDoc(window.fbDoc(window.fbDb,'students',sid));
}
_selectedStudentIds=[];
updateRosterBulkBar();
await loadStudents();
odaToast(count+' student'+(count!==1?'s':'')+' deleted','success');
}catch(e){console.error(e);odaToast('Error deleting students: '+e.message,'error')}
}
window.deleteSelectedStudents=deleteSelectedStudents;

async function loadStudentWork(){
if(!selectedStudent)return;
var el=document.getElementById('profileWork');
el.innerHTML='<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px">Loading student work...</div>';
var sid=selectedStudent.id;
var h='';
try{
// Parallel fetch all student work
var _work=await Promise.all([
window.fbGetDoc(window.fbDoc(window.fbDb,'elevatorPitches',sid)),
window.fbGetDoc(window.fbDoc(window.fbDb,'pitchChallenges',sid)),
window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,'lemonadeGroups'),window.fbWhere('memberIds','array-contains',sid))),
window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,'spellingResults'),window.fbWhere('studentId','==',sid)))
]);
var epDoc=_work[0],pcDoc=_work[1],lemSnap=_work[2],srSnap=_work[3];
// Elevator Pitch
if(epDoc.exists()){
var ep=epDoc.data();
h+='<div class="work-card"><div class="work-header"><span class="work-type wt-elevator">\u{1F3A4} Elevator Pitch</span><div style="display:flex;align-items:center;gap:8px"><span class="work-date">'+(ep.savedAt?new Date(ep.savedAt).toLocaleDateString():'')+'</span><button class="btn btn-red btn-sm" onclick="deleteStudentWork(\'elevatorPitches\',\''+sid+'\')" style="padding:2px 7px;font-size:11px" title="Delete">&times;</button></div></div>';
h+='<div class="work-body">';
if(ep.answers){
if(ep.answers.name)h+='<div class="wl"><span class="wl-label">Name:</span> <span class="wl-value">'+esc(ep.answers.name)+'</span></div>';
if(ep.answers.dream)h+='<div class="wl"><span class="wl-label">Dream Job:</span> <span class="wl-value">'+esc(ep.answers.dream)+'</span></div>';
if(ep.answers.why)h+='<div class="wl"><span class="wl-label">Why:</span> <span class="wl-value">'+esc(ep.answers.why)+'</span></div>';
if(ep.answers.hobby)h+='<div class="wl"><span class="wl-label">Hobbies:</span> <span class="wl-value">'+esc(ep.answers.hobby)+'</span></div>';
if(ep.answers.fact)h+='<div class="wl"><span class="wl-label">Fun Fact:</span> <span class="wl-value">'+esc(ep.answers.fact)+'</span></div>';
}
if(ep.pitch)h+='<div class="pitch-text">'+esc(ep.pitch)+'</div>';
h+='</div></div>';
}

// Pitch Challenge
if(pcDoc.exists()){
var pc=pcDoc.data();
h+='<div class="work-card"><div class="work-header"><span class="work-type wt-pitch">\u{1F4A1} Pitch Challenge</span><div style="display:flex;align-items:center;gap:8px"><span class="work-date">'+(pc.savedAt?new Date(pc.savedAt).toLocaleDateString():'')+'</span><button class="btn btn-red btn-sm" onclick="deleteStudentWork(\'pitchChallenges\',\''+sid+'\')" style="padding:2px 7px;font-size:11px" title="Delete">&times;</button></div></div>';
h+='<div class="work-body">';
if(pc.studentName)h+='<div class="wl"><span class="wl-label">Student:</span> <span class="wl-value">'+esc(pc.studentName)+'</span></div>';
if(pc.businessName)h+='<div class="wl"><span class="wl-label">Business:</span> <span class="wl-value">'+esc(pc.businessName)+(pc.businessDesc?' — '+esc(pc.businessDesc):'')+'</span></div>';
if(pc.problem)h+='<div class="wl"><span class="wl-label">Problem:</span> <span class="wl-value">'+esc(pc.problem)+'</span></div>';
if(pc.customers&&pc.customers.length)h+='<div class="wl"><span class="wl-label">Customers:</span> <span class="wl-value">'+esc(pc.customers.join(', '))+'</span></div>';
if(pc.advantages&&pc.advantages.length)h+='<div class="wl"><span class="wl-label">Advantages:</span> <span class="wl-value">'+esc(pc.advantages.join(' • '))+'</span></div>';
if(pc.hook)h+='<div class="pitch-text">'+esc(pc.hook)+'</div>';
h+='</div></div>';
}


// Lemonade Day Groups
if(!lemSnap.empty){
lemSnap.forEach(function(d){
var lg=d.data();
h+='<div class="work-card"><div class="work-header"><span class="work-type" style="background:rgba(245,158,11,.12);color:#F59E0B">&#x1F34B; Lemonade Day</span><span class="work-date">'+(lg.createdAt?new Date(lg.createdAt).toLocaleDateString():'')+'</span></div>';
h+='<div class="work-body">';
h+='<div class="wl"><span class="wl-label">Company:</span> <span class="wl-value">'+esc(lg.companyName||'')+'</span></div>';
h+='<div class="wl"><span class="wl-label">Group:</span> <span class="wl-value">'+esc(lg.groupName||'')+' ('+((lg.members||[]).length)+' members)</span></div>';
h+='<div class="wl"><span class="wl-label">Status:</span> <span class="wl-value">'+(lg.status||'?')+'</span></div>';
if(lg.score!==undefined&&lg.score!==null)h+='<div class="wl"><span class="wl-label">Score:</span> <span class="wl-value" style="color:var(--gold)">'+lg.score+'%</span></div>';
h+='</div></div>';
});
}

// Spelling Results
if(!srSnap.empty){
var results=[];srSnap.forEach(function(d){results.push(d.data())});
results.sort(function(a,b){return(b.savedAt||'').localeCompare(a.savedAt||'')});
h+='<div class="work-card"><div class="work-header"><span class="work-type wt-spelling">\u{1F41D} Spelling Bee</span><div style="display:flex;align-items:center;gap:8px"><span class="work-date">'+results.length+' attempt'+(results.length!==1?'s':'')+'</span><button class="btn btn-red btn-sm" onclick="deleteStudentWork(\'spellingResults\',\''+sid+'\')" style="padding:2px 7px;font-size:11px" title="Delete">&times;</button></div></div>';
h+='<div class="work-body">';
h+='<div class="spelling-scores">';
results.forEach(function(r){
var cls=r.score>=80?'spell-good':r.score>=60?'spell-ok':'spell-low';
h+='<span class="spell-score '+cls+'">'+(r.grade||'?')+': '+r.score+'%</span>';
});
h+='</div>';
// Show most recent attempt details
var latest=results[0];
if(latest.words&&latest.results){
h+='<div style="margin-top:10px;font-size:12px;color:var(--text2)">Latest attempt ('+esc(latest.grade||'')+'):</div>';
h+='<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">';
for(var i=0;i<latest.words.length;i++){
var ok=latest.results[i];
h+='<span style="padding:2px 8px;border-radius:4px;font-size:11px;font-family:Space Mono,monospace;'+(ok?'background:rgba(6,214,160,.1);color:var(--accent)':'background:rgba(239,71,111,.1);color:var(--accent3)')+'">'+esc(latest.words[i])+'</span>';
}
h+='</div>';
}
h+='</div></div>';
}

if(!h)h='<div class="empty-state"><span class="emoji">\u{1F4AD}</span><p>No saved work yet. Assign something and have the student complete it!</p></div>';
el.innerHTML=h;
}catch(e){
console.error('Error loading student work:',e);
el.innerHTML='<div class="empty-state"><span class="emoji">\u{26A0}\uFE0F</span><p>Error loading work. Try refreshing.</p></div>';
}
}
window.loadStudentWork=loadStudentWork;

function renderProfileAssignments(){
if(!selectedStudent)return;
var sAssigns=allAssignments.filter(function(a){return a.studentId===selectedStudent.id});
var active=sAssigns.filter(function(a){return a.status==='pending'||a.status==='submitted'||a.status==='returned'});
var finished=sAssigns.filter(function(a){return a.status==='completed'||a.status==='graded'});

var el=document.getElementById('profileAssignments');
if(!active.length){el.innerHTML='<div class="empty-state"><span class="emoji">&#x2705;</span><p>No pending assignments</p></div>'}
else{
var h='';
active.forEach(function(a){
var t=ASSIGN_TYPES[a.toolType]||ASSIGN_TYPES[a.type]||{title:a.title||a.type,emoji:'\u{1F4CB}'};
var due=a.dueDate?'Due: '+a.dueDate:'No due date';
var today=new Date().toISOString().split('T')[0];
var overdue=a.status==='pending'&&a.dueDate&&a.dueDate<today;
var statusLabel=a.status==='submitted'?' \u2022 Needs Review':a.status==='returned'?' \u2022 Returned':'';
h+='<div class="a-item"'+(a.status==='submitted'?' style="border-color:var(--accent3)"':'')+'>';
h+='<div class="a-info"><div class="a-title">'+t.emoji+' '+(a.title||t.title)+'</div><div class="a-detail"'+(overdue?' style="color:var(--accent3)"':'')+'>'+due+(overdue?' \u{26A0}\uFE0F OVERDUE':'')+statusLabel+'</div></div>';
h+='<div style="display:flex;gap:6px">';
if(a.status==='submitted')h+='<button class="btn btn-blue btn-sm" onclick="openGradePanel(\''+a.id+'\')">Review</button>';
else h+='<button class="btn btn-accent btn-sm" onclick="markComplete(\''+a.id+'\')">Done</button>';
h+='<button class="btn btn-red btn-sm" onclick="deleteAssignment(\''+a.id+'\')">&times;</button></div>';
h+='</div>';
});
el.innerHTML=h;
}

var hel=document.getElementById('profileHistory');
if(!finished.length){hel.innerHTML='<div class="empty-state"><span class="emoji">&#x1F4AD;</span><p>No completed work yet</p></div>'}
else{
var h='';
finished.sort(function(a,b){return(b.completedAt||b.gradedAt||'').localeCompare(a.completedAt||a.gradedAt||'')});
finished.forEach(function(a){
var t=ASSIGN_TYPES[a.toolType]||ASSIGN_TYPES[a.type]||{title:a.title||a.type,emoji:'\u{1F4CB}'};
var when=a.completedAt?new Date(a.completedAt).toLocaleDateString():a.gradedAt?new Date(a.gradedAt).toLocaleDateString():'';
var scoreStr=(a.score!==null&&a.score!==undefined)?(' \u2022 '+a.score+'%'):'';
var label=a.status==='graded'?'Graded':'Completed';
h+='<div class="a-item">';
h+='<div class="a-info"><div class="a-title">'+t.emoji+' '+(a.title||t.title)+'</div><div class="a-detail">'+label+' '+when+scoreStr+'</div></div>';
h+='<div style="display:flex;gap:6px;align-items:center"><span class="a-status" style="background:rgba(6,214,160,.1);color:var(--accent)">\u2705</span><button class="btn btn-red btn-sm" onclick="deleteAssignment(\''+a.id+'\')" style="padding:3px 8px;font-size:11px">&times;</button></div>';
h+='</div>';
});
hel.innerHTML=h;
}
}

// ===== ASSIGN MODAL (routes to new create modal) =====
function openAssignModal(){
if(!selectedStudent)return;
openCreateAssignment(selectedStudent.id);
}
function closeAssignModal(){document.getElementById('assignModal').classList.remove('show')}
window.openAssignModal=openAssignModal;window.closeAssignModal=closeAssignModal;

async function toggleArcade(){
if(!selectedStudent)return;
var on=!(selectedStudent.arcadeUnlocked);
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'students',selectedStudent.id),{arcadeUnlocked:on});
selectedStudent.arcadeUnlocked=on;
var abtn=document.getElementById('arcadeToggleBtn');
abtn.textContent=on?'\u{1F512} Lock Arcade':'\u{1F3AE} Unlock Arcade';
abtn.style.background=on?'var(--accent3)':'';
abtn.style.borderColor=on?'var(--accent3)':'';
loadStudents();
}catch(e){console.error(e)}
}
window.toggleArcade=toggleArcade;

async function markComplete(assignId){
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',assignId),{status:'completed',completedAt:new Date().toISOString()});
await loadStudents();renderProfileAssignments();
}catch(e){console.error(e)}
}
window.markComplete=markComplete;

async function deleteAssignment(assignId){
if(!confirm('Remove this assignment?'))return;
try{await window.fbDeleteDoc(window.fbDoc(window.fbDb,'assignments',assignId));await loadStudents();renderProfileAssignments()}catch(e){console.error(e)}
}
window.deleteAssignment=deleteAssignment;

async function deleteStudentWork(collectionName,studentId){
if(!confirm('Delete this student work? This cannot be undone.'))return;
try{
if(collectionName==='spellingResults'){
var q=window.fbQuery(window.fbCollection(window.fbDb,'spellingResults'),window.fbWhere('studentId','==',studentId));
var snap=await window.fbGetDocs(q);
var deletes=[];snap.forEach(function(d){deletes.push(window.fbDeleteDoc(window.fbDoc(window.fbDb,'spellingResults',d.id)))});
await Promise.all(deletes);
}else{
await window.fbDeleteDoc(window.fbDoc(window.fbDb,collectionName,studentId));
}
await loadStudentWork();
}catch(e){console.error('Error deleting student work:',e)}
}
window.deleteStudentWork=deleteStudentWork;

// ===== ASSIGNMENTS TAB =====
var createType='tool';
var templates=[];

function openCreateAssignment(preSelectStudentId){
createType='tool';
var tabs=document.querySelectorAll('.type-tab');
tabs.forEach(function(t,i){t.classList.toggle('active',i===0)});
var panels=document.querySelectorAll('.type-panel');
panels.forEach(function(p){p.classList.remove('show')});
document.getElementById('panel-tool').classList.add('show');
document.getElementById('createToolSelect').value='';
document.querySelectorAll('.tool-pick').forEach(function(t){t.classList.remove('selected')});
document.getElementById('createAssignTitle').value='';
document.getElementById('createAssignInstructions').value='';
document.getElementById('createAssignLink').value='';
document.getElementById('createAssignFile').value='';
document.getElementById('createAssignGrading').value='teacher';
document.getElementById('createDueDate').value='';
document.getElementById('saveAsTemplate').checked=false;
var bs=document.getElementById('createBottomSection');if(bs)bs.style.display='';
var ft=document.getElementById('btnCreateAssign');if(ft)ft.parentElement.style.display='';
populateClassFilters();
renderStudentPicker();
if(preSelectStudentId){
setTimeout(function(){
var checks=document.querySelectorAll('.sp-check');
checks.forEach(function(c){c.checked=(c.value===preSelectStudentId)});
},50);
}
var m=document.getElementById('createAssignModal');m.classList.add('show');
if(window.odaTrapFocus)_odaFocusTraps.createAssignModal=window.odaTrapFocus(m);
}
window.openCreateAssignment=openCreateAssignment;

function closeCreateAssignment(){document.getElementById('createAssignModal').classList.remove('show');if(_odaFocusTraps.createAssignModal){_odaFocusTraps.createAssignModal();_odaFocusTraps.createAssignModal=null}}
window.closeCreateAssignment=closeCreateAssignment;

function switchCreateTab(type){
createType=type==='templates'?'tool':type;
var types=['tool','assignment','templates'];
var tabs=document.querySelectorAll('.type-tab');
tabs.forEach(function(t,i){t.classList.toggle('active',types[i]===type)});
types.forEach(function(tp){
var p=document.getElementById('panel-'+tp);
if(p)p.classList.toggle('show',tp===type);
});
var isTmpl=type==='templates';
var el=document.getElementById('createBottomSection');if(el)el.style.display=isTmpl?'none':'';
var ft=document.getElementById('btnCreateAssign');if(ft)ft.parentElement.style.display=isTmpl?'none':'';
if(type==='templates')loadTemplates();
}
window.switchCreateTab=switchCreateTab;

function pickTool(el){
document.querySelectorAll('.tool-pick').forEach(function(t){t.classList.remove('selected')});
el.classList.add('selected');
document.getElementById('createToolSelect').value=el.getAttribute('data-val');
}
window.pickTool=pickTool;

function populateClassFilters(){
var classes=window.teacherData&&window.teacherData.classes?window.teacherData.classes.filter(function(c){return c!=='All Students'}):[];
var fc=document.getElementById('filterClass');
if(fc){
var val=fc.value;
fc.innerHTML='<option value="">All Classes</option>';
classes.forEach(function(c){fc.innerHTML+='<option value="'+esc(c)+'">'+esc(c)+'</option>'});
fc.value=val;
}
var sp=document.getElementById('spClassFilter');
if(sp){
sp.innerHTML='<option value="">All Classes</option>';
classes.forEach(function(c){sp.innerHTML+='<option value="'+esc(c)+'">'+esc(c)+'</option>'});
}
}

function renderStudentPicker(){
var el=document.getElementById('studentPicker');
if(!el)return;
var classFilter=document.getElementById('spClassFilter');
var cf=classFilter?classFilter.value:'';
var filtered=cf?students.filter(function(s){return s.className===cf}):students;
filtered.sort(function(a,b){return(a.name||'').localeCompare(b.name||'')});
if(!filtered.length){el.innerHTML='<div style="text-align:center;padding:16px;color:var(--text2);font-size:14px">No students found</div>';return}
var h='';
filtered.forEach(function(s){
h+='<label class="sp-item"><input type="checkbox" value="'+s.id+'" class="sp-check">';
h+='<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(s.name)+'</span>';
if(s.className)h+='<span class="sp-class">'+esc(s.className)+'</span>';
h+='</label>';
});
el.innerHTML=h;
}
window.renderStudentPicker=renderStudentPicker;

function spSelectAll(){document.querySelectorAll('.sp-check').forEach(function(c){c.checked=true})}
window.spSelectAll=spSelectAll;

function spSelectNone(){document.querySelectorAll('.sp-check').forEach(function(c){c.checked=false})}
window.spSelectNone=spSelectNone;

function getSelectedStudentIds(){
var ids=[];
document.querySelectorAll('.sp-check:checked').forEach(function(c){ids.push(c.value)});
return ids;
}

function readFileAsBase64(file){
return new Promise(function(resolve,reject){
var reader=new FileReader();
reader.onload=function(){resolve(reader.result)};
reader.onerror=function(){reject(reader.error)};
reader.readAsDataURL(file);
});
}

async function submitCreateAssignment(){
var studentIds=getSelectedStudentIds();
if(!studentIds.length){odaToast('Select at least one student','warning');return}
var dueDate=document.getElementById('createDueDate').value||null;
var assignData={};

if(createType==='tool'){
var tool=document.getElementById('createToolSelect').value;
if(!tool){odaToast('Select a tool','warning');return}
var t=ASSIGN_TYPES[tool]||{title:tool};
var isAutoGrade=tool.startsWith('spelling')||tool.startsWith('vocab');
assignData={type:'tool',toolType:tool,title:t.title||tool,instructions:'',gradingType:isAutoGrade?'auto':'completion',fileData:null,linkUrl:null};
}else if(createType==='assignment'){
var aTitle=document.getElementById('createAssignTitle').value.trim();
if(!aTitle){odaToast('Enter a title','warning');return}
var aInstructions=document.getElementById('createAssignInstructions').value.trim();
if(!aInstructions){odaToast('Enter instructions so students know what to do','warning');return}
var aLink=document.getElementById('createAssignLink').value.trim()||null;
var aGrading=document.getElementById('createAssignGrading').value;
var fileInput=document.getElementById('createAssignFile');
var fileUrl=null;
if(fileInput.files.length>0){
var file=fileInput.files[0];
if(file.size>10*1024*1024){odaToast('File must be under 10MB','warning');return}
showLoading('Uploading file...');
try{
var ts=Date.now();
var safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
var path='assignments/'+window.currentTeacher.uid+'/'+ts+'_'+safeName;
var sRef=window.fbStorageRef(window.fbStorage,path);
await window.fbUploadBytes(sRef,file);
fileUrl=await window.fbGetDownloadURL(sRef);
}catch(e){hideLoading();console.error(e);odaToast('File upload failed: '+e.message,'error');return}
}
assignData={type:'assignment',toolType:null,title:aTitle,instructions:aInstructions,gradingType:aGrading,fileData:null,fileUrl:fileUrl,linkUrl:aLink};
}

if(document.getElementById('saveAsTemplate').checked){
try{
await window.fbAddDoc(window.fbCollection(window.fbDb,'templates'),{
teacherId:window.currentTeacher.uid,createType:createType,
type:assignData.type,toolType:assignData.toolType,title:assignData.title,
instructions:assignData.instructions,gradingType:assignData.gradingType,
linkUrl:assignData.linkUrl,createdAt:new Date().toISOString()
});
}catch(e){console.error('Template save error:',e)}
}

var td=window.teacherData||{};
showLoading('Creating '+studentIds.length+' assignment(s)...');
try{
var _assignPromises=studentIds.map(function(sid){
var student=students.find(function(s){return s.id===sid});
return window.fbAddDoc(window.fbCollection(window.fbDb,'assignments'),{
studentId:sid,teacherId:window.currentTeacher.uid,
type:assignData.type,toolType:assignData.toolType,title:assignData.title,
instructions:assignData.instructions||'',status:'pending',gradingType:assignData.gradingType,
assignedAt:new Date().toISOString(),dueDate:dueDate,
submittedAt:null,completedAt:null,gradedAt:null,
score:null,feedback:null,aiSuggestedScore:null,aiSuggestedFeedback:null,
school:td.school||'',district:td.district||'',program:td.program||'',
grade:student?student.grade:'',
fileData:assignData.fileData||null,fileUrl:assignData.fileUrl||null,linkUrl:assignData.linkUrl,studentResponse:null,templateId:null
});
});
await Promise.all(_assignPromises);
hideLoading();
closeCreateAssignment();
odaToast(studentIds.length+' assignment(s) created','success');
await loadStudents();
renderAssignmentsList();
if(selectedStudent)renderProfileAssignments();
}catch(e){hideLoading();console.error(e);odaToast('Error creating assignments: '+e.message,'error')}
}
window.submitCreateAssignment=submitCreateAssignment;

function filterAssignments(){window._assignShowAll=false;renderAssignmentsList()}
window.filterAssignments=filterAssignments;

function renderAssignmentsList(){
var el=document.getElementById('assignmentsList');
if(!el)return;
var list=allAssignments.slice();
var classFilter=document.getElementById('filterClass');
var statusFilter=document.getElementById('filterStatus');
var typeFilter=document.getElementById('filterType');
var searchInput=document.getElementById('assignSearch');
var cf=classFilter?classFilter.value:'';
var sf=statusFilter?statusFilter.value:'';
var tf=typeFilter?typeFilter.value:'';
var search=searchInput?(searchInput.value||'').toLowerCase():'';

if(cf){
var classStudentIds=students.filter(function(s){return s.className===cf}).map(function(s){return s.id});
list=list.filter(function(a){return classStudentIds.indexOf(a.studentId)>=0});
}
if(sf){list=list.filter(function(a){return a.status===sf})}
if(tf){
if(tf==='tool')list=list.filter(function(a){return a.type==='tool'||ASSIGN_TYPES[a.type]});
else if(tf==='assignment')list=list.filter(function(a){return a.type==='assignment'||a.type==='worksheet'||a.type==='link'||a.type==='custom'});
else list=list.filter(function(a){return a.type===tf});
}
if(search){
list=list.filter(function(a){
var student=students.find(function(s){return s.id===a.studentId});
var studentName=student?(student.name||'').toLowerCase():'';
var title=(a.title||a.type||'').toLowerCase();
return title.indexOf(search)>=0||studentName.indexOf(search)>=0;
});
}

list.sort(function(a,b){return(b.assignedAt||'').localeCompare(a.assignedAt||'')});

if(!list.length){
el.innerHTML='<div class="empty-state"><span class="emoji">&#x1F4CB;</span><p>No assignments match your filters.</p></div>';
document.getElementById('bulkBar').classList.remove('show');
return;
}

// Group assignments by title + type + dueDate
var groups={};
var groupOrder=[];
list.forEach(function(a){
var key=(a.title||a.type)+'||'+a.type+'||'+(a.dueDate||'none');
if(!groups[key]){
groups[key]={title:a.title||a.type,type:a.type,toolType:a.toolType,dueDate:a.dueDate,emoji:getAssignEmoji(a),items:[]};
groupOrder.push(key);
}
groups[key].items.push(a);
});

var today=new Date().toISOString().split('T')[0];
var h='';
var ASSIGN_PAGE_SIZE=20;
var visibleGroups=window._assignShowAll?groupOrder.length:Math.min(groupOrder.length,ASSIGN_PAGE_SIZE);
groupOrder.slice(0,visibleGroups).forEach(function(key,gi){
var g=groups[key];
var counts={pending:0,submitted:0,graded:0,completed:0,returned:0};
g.items.forEach(function(a){counts[a.status]=(counts[a.status]||0)+1});
var hasReview=counts.submitted>0;
var overdue=counts.pending>0&&g.dueDate&&g.dueDate<today;

h+='<div class="assign-group'+(hasReview?' has-review':'')+'" id="ag-'+gi+'">';
h+='<div class="ag-header" role="button" tabindex="0" onclick="toggleAssignGroup('+gi+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleAssignGroup('+gi+')}">';
h+='<span class="ag-emoji">'+g.emoji+'</span>';
h+='<div class="ag-info">';
h+='<div class="ag-title">'+esc(g.title)+'</div>';
h+='<div class="ag-stats">';
if(counts.submitted>0)h+='<span class="ag-pill ag-pill-review">'+counts.submitted+' to review</span>';
if(counts.pending>0)h+='<span class="ag-pill ag-pill-pending">'+counts.pending+' pending</span>';
if(counts.returned>0)h+='<span class="ag-pill ag-pill-returned">'+counts.returned+' returned</span>';
if(counts.graded>0)h+='<span class="ag-pill ag-pill-graded">'+counts.graded+' graded</span>';
if(counts.completed>0)h+='<span class="ag-pill ag-pill-done">'+counts.completed+' done</span>';
h+='</div></div>';
h+='<div class="ag-count">';
if(g.dueDate)h+='<span class="ag-due'+(overdue?' overdue':'')+'">Due '+g.dueDate+(overdue?' \u26A0\uFE0F':'')+'</span>';
h+='<span>'+g.items.length+' student'+(g.items.length!==1?'s':'')+'</span>';
h+='<span class="ag-chevron">\u25BC</span>';
h+='</div></div>';

h+='<div class="ag-body">';
h+='<div class="ag-bulk"><label><input type="checkbox" class="ag-bulk-check" onclick="event.stopPropagation();toggleGroupBulk('+gi+')" style="accent-color:var(--accent);width:14px;height:14px;cursor:pointer"> Select all</label></div>';
// Sort students: submitted first, then pending, returned, graded, completed
var statusOrder={submitted:0,pending:1,returned:2,graded:3,completed:4};
var sorted=g.items.slice().sort(function(a,b){return(statusOrder[a.status]||9)-(statusOrder[b.status]||9)});
sorted.forEach(function(a){
var student=students.find(function(s){return s.id===a.studentId});
var studentName=student?student.name:'Unknown';
var statusClass=getStatusClass(a.status);
var statusLabel=getStatusLabel(a.status);
h+='<div class="ag-student" role="button" tabindex="0" onclick="openGradePanel(\''+a.id+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openGradePanel(\''+a.id+'\')}">';
h+='<input type="checkbox" class="bulk-check" value="'+a.id+'" onclick="event.stopPropagation();updateBulkBar()" style="accent-color:var(--accent);width:14px;height:14px;cursor:pointer;flex-shrink:0">';
h+='<span class="ag-student-name">'+esc(studentName)+'</span>';
if(a.score!==null&&a.score!==undefined)h+='<span class="ag-student-score">'+a.score+'%</span>';
h+='<span class="ac-status '+statusClass+'" style="flex-shrink:0">'+statusLabel+'</span>';
h+='</div>';
});
h+='</div></div>';
});
if(groupOrder.length>visibleGroups){
h+='<div style="text-align:center;padding:14px"><button class="btn btn-outline" onclick="window._assignShowAll=true;renderAssignmentsList()">Show All '+groupOrder.length+' Groups</button></div>';
}
el.innerHTML=h;
document.getElementById('bulkBar').classList.remove('show');
}

function toggleAssignGroup(gi){
var el=document.getElementById('ag-'+gi);
if(el)el.classList.toggle('open');
}
window.toggleAssignGroup=toggleAssignGroup;

function toggleGroupBulk(gi){
var el=document.getElementById('ag-'+gi);
if(!el)return;
var master=el.querySelector('.ag-bulk-check');
var checks=el.querySelectorAll('.bulk-check');
checks.forEach(function(c){c.checked=master.checked});
updateBulkBar();
}
window.toggleGroupBulk=toggleGroupBulk;

function getAssignEmoji(a){
if(a.toolType&&ASSIGN_TYPES[a.toolType])return ASSIGN_TYPES[a.toolType].emoji;
if(ASSIGN_TYPES[a.type])return ASSIGN_TYPES[a.type].emoji;
var map={tool:'\u{1F6E0}\uFE0F',assignment:'\u{1F4CB}',worksheet:'\u{1F4CB}',link:'\u{1F4CB}',custom:'\u{1F4CB}'};
return map[a.type]||'\u{1F4CB}';
}

function getStatusClass(status){
var map={pending:'st-pending',submitted:'st-submitted',graded:'st-graded',completed:'st-completed',returned:'st-returned'};
return map[status]||'st-pending';
}

function getStatusLabel(status){
var map={pending:'Pending',submitted:'Needs Review',graded:'Graded',completed:'Completed',returned:'Returned'};
return map[status]||status;
}

// ===== GRADE PANEL =====
var gradingAssignment=null;

function openGradePanel(assignId){
gradingAssignment=allAssignments.find(function(a){return a.id===assignId});
if(!gradingAssignment)return;
// Redirect tools to their own grading views
if(gradingAssignment.toolType==='pitch-challenge'){
window.open('pitch.html?grade='+assignId,'_blank');
return;
}
if(gradingAssignment.toolType==='lemonade-day'){
window.open('lemonade.html?grade='+assignId,'_blank');
return;
}
if(gradingAssignment.toolType==='elevator-pitch'){
window.open('elevator.html?grade='+assignId,'_blank');
return;
}
var student=students.find(function(s){return s.id===gradingAssignment.studentId});
var a=gradingAssignment;
var el=document.getElementById('gradePanelContent');

// Header
var h='<div class="grade-header">';
h+='<h2>'+getAssignEmoji(a)+' '+esc(a.title)+'</h2>';
h+='<div class="grade-meta">';
h+='<strong>'+esc(student?student.name:'Unknown')+'</strong>';
h+=' &bull; '+(a.assignedAt?new Date(a.assignedAt).toLocaleDateString():'');
h+=' &bull; <span class="ac-status '+getStatusClass(a.status)+'">'+getStatusLabel(a.status)+'</span>';
if(a.score!==null&&a.score!==undefined)h+=' &bull; <span style="font-family:Space Mono,monospace;color:var(--gold);font-weight:700">'+a.score+'%</span>';
h+='</div>';
if(a.instructions)h+='<div class="grade-instructions"><strong>Instructions:</strong> '+esc(a.instructions)+'</div>';
if(a.feedback)h+='<div class="grade-instructions" style="border-left:3px solid var(--accent);margin-top:6px"><strong>Previous Feedback:</strong> '+esc(a.feedback)+'</div>';
h+='</div>';

// Student work
if(a.studentResponse){
var pitchParsed=null;
try{pitchParsed=JSON.parse(a.studentResponse)}catch(e){}
if(pitchParsed&&pitchParsed.businessName){
h+='<div class="grade-work">';
h+='<div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:18px;margin-bottom:14px;color:var(--accent)">\u{1F3A4} '+esc(pitchParsed.businessName)+'</div>';
h+='<div class="gw-value"><div class="gw-label">Problem</div>'+esc(stripMd(pitchParsed.problem||''))+'</div>';
h+='<div class="gw-value"><div class="gw-label">Business Description</div>'+esc(stripMd(pitchParsed.businessDesc||''))+'</div>';
if(pitchParsed.skills&&pitchParsed.skills.length)h+='<div class="gw-value"><div class="gw-label">Skills</div>'+esc(pitchParsed.skills.join(', '))+'</div>';
if(pitchParsed.customers&&pitchParsed.customers.length)h+='<div class="gw-value"><div class="gw-label">Customers</div>'+esc(pitchParsed.customers.join(', '))+'</div>';
if(pitchParsed.advantages&&pitchParsed.advantages.length)h+='<div class="gw-value"><div class="gw-label">Advantages</div>'+esc(stripMd(pitchParsed.advantages.join(' \u2022 ')))+'</div>';

h+='<div class="gw-section"><div class="gw-label">Full Pitch</div><div class="gw-pitch">';
if(pitchParsed.hook)h+=esc(stripMd(pitchParsed.hook))+'<br><br>';
h+='My business is called <strong>'+esc(pitchParsed.businessName)+'</strong>. '+esc(stripMd(pitchParsed.businessDesc||''))+'<br><br>';
if(pitchParsed.advantages){pitchParsed.advantages.forEach(function(av){h+='\u{1F3C6} '+esc(stripMd(av))+'<br>'})}
if(pitchParsed.callToAction)h+='<br><strong>'+esc(stripMd(pitchParsed.callToAction))+'</strong>';
h+='</div></div>';

if(pitchParsed.videoUrl)h+='<div class="gw-section"><div class="gw-label">\u{1F3AC} Video Recording</div><div style="margin-top:8px"><video controls playsinline style="width:100%;max-height:360px;border-radius:10px;background:#000" src="'+esc(pitchParsed.videoUrl)+'"></video></div></div>';
if(pitchParsed.aiCoachFeedback)h+='<div class="gw-section"><div class="gw-label">\u{1F9E0} AI Coach Feedback</div><div style="margin-top:6px;padding:12px;background:rgba(17,138,178,.08);border-radius:10px;font-size:14px;line-height:1.7">'+esc(stripMd(pitchParsed.aiCoachFeedback))+'</div></div>';
if(pitchParsed.polishedPitch)h+='<div class="gw-section"><div class="gw-label">\u2728 AI-Polished Pitch</div><div style="margin-top:6px;padding:12px;background:rgba(6,214,160,.08);border-radius:10px;font-size:14px;font-style:italic;line-height:1.7">'+esc(stripMd(pitchParsed.polishedPitch))+'</div></div>';
if(pitchParsed.score)h+='<div class="gw-section"><div class="gw-label">\u2B50 Scorecard</div><div style="font-size:18px;font-weight:700;color:var(--gold);margin-top:4px">'+(pitchParsed.score.total||0)+'/'+(pitchParsed.score.max||6)+' Stars</div></div>';
h+='</div>';
}else if(pitchParsed&&pitchParsed.answers){
var ans=pitchParsed.answers;
h+='<div class="grade-work">';
h+='<div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:20px;margin-bottom:4px;color:var(--accent2)">\u{1F3A4} '+esc(ans.name||'Student')+'\'s Elevator Pitch</div>';
h+='<div style="font-size:13px;color:var(--text2);margin-bottom:16px">'+esc(ans.grade?'Grade '+ans.grade:'')+' '+esc(ans.school?' \u2022 '+ans.school:'')+' '+esc(ans.from?' \u2022 From '+ans.from:'')+'</div>';

// About Me section
h+='<div class="gw-section"><div class="gw-label">\u{1F464} About Me</div>';
if(ans.age)h+='<div class="gw-value"><strong>Age:</strong> '+esc(ans.age)+'</div>';
if(ans.dream)h+='<div class="gw-value" style="margin-top:4px"><strong>Dream Job:</strong> '+esc(ans.dream)+'</div>';
if(ans.why)h+='<div class="gw-value" style="margin-top:4px"><strong>Why:</strong> '+esc(ans.why)+'</div>';
if(ans.hobby)h+='<div class="gw-value" style="margin-top:4px"><strong>Favorite Hobby:</strong> '+esc(ans.hobby)+'</div>';
if(ans.fact)h+='<div class="gw-value" style="margin-top:4px"><strong>Fun Fact:</strong> '+esc(ans.fact)+'</div>';
if(ans.remember)h+='<div class="gw-value" style="margin-top:4px"><strong>Remember Me For:</strong> '+esc(ans.remember)+'</div>';
h+='</div>';

// Generated Pitch
if(pitchParsed.pitchText){
h+='<div class="gw-section"><div class="gw-label">\u{1F4AC} Generated Pitch</div>';
h+='<div style="margin-top:8px;padding:16px;background:rgba(17,138,178,.06);border-radius:12px;border-left:3px solid var(--accent2);font-size:15px;line-height:1.8;font-style:italic">'+esc(pitchParsed.pitchText)+'</div>';
h+='</div>';
}

// Video Recording
if(pitchParsed.videoUrl){
h+='<div class="gw-section"><div class="gw-label">\u{1F3AC} Video Recording</div>';
h+='<div style="margin-top:8px"><video controls playsinline style="width:100%;max-height:360px;border-radius:10px;background:#000" src="'+esc(pitchParsed.videoUrl)+'"></video></div>';
h+='</div>';
}

// AI Summary
if(pitchParsed.aiSummary){
h+='<div class="gw-section"><div class="gw-label">\u2728 AI Personalized Summary</div>';
h+='<div style="margin-top:6px;padding:14px;background:rgba(6,214,160,.08);border-radius:12px;font-size:14px;line-height:1.7">'+esc(pitchParsed.aiSummary)+'</div>';
h+='</div>';
}
h+='</div>';
}else{
h+='<div class="grade-work" style="white-space:pre-wrap">'+esc(a.studentResponse)+'</div>';
}
}
if(a.fileUrl||a.fileData){
if(a.fileUrl){
if(a.fileUrl.match(/\.(png|jpg|jpeg|gif|webp)/i)){
h+='<div class="grade-work" style="text-align:center"><img src="'+esc(a.fileUrl)+'" style="max-width:100%;border-radius:10px"></div>';
}else{
h+='<div class="grade-work"><iframe src="'+esc(a.fileUrl)+'" style="width:100%;height:500px;border:none;border-radius:10px"></iframe><div style="margin-top:8px;text-align:center"><a href="'+esc(a.fileUrl)+'" target="_blank" style="color:var(--accent2);font-size:13px;font-weight:600">Open in new tab \u2197\uFE0F</a></div></div>';
}
}else if(a.fileData){
if(a.fileData.startsWith('data:image')){
h+='<div class="grade-work" style="text-align:center"><img src="'+esc(a.fileData)+'" style="max-width:100%;border-radius:10px"></div>';
}else{
var pdfUrl=dataUriToBlobUrl(a.id,a.fileData);
h+='<div class="grade-work"><iframe src="'+pdfUrl+'" style="width:100%;height:500px;border:none;border-radius:10px"></iframe><div style="margin-top:8px;text-align:center"><a href="#" onclick="openFileBlob(\''+a.id+'\');return false" style="color:var(--accent2);font-size:13px;font-weight:600">Open in new tab \u2197\uFE0F</a></div></div>';
}
}
}
if(a.linkUrl){
h+='<div style="margin-bottom:18px"><a href="'+esc(a.linkUrl)+'" target="_blank" class="btn btn-blue btn-sm">Open Link &#x1F517;</a></div>';
}

// Grading section — show for any submitted/pending/returned work
if(a.status==='submitted'||a.status==='pending'||a.status==='returned'){
h+='<div class="grade-actions">';
h+='<div class="ga-title">Grade This Assignment</div>';
h+='<div class="grade-score-row">';
h+='<div><div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:4px">Score (0-100)</div>';
h+='<input type="number" class="score-input" id="gradeScore" min="0" max="100" value="'+(a.aiSuggestedScore||'')+'"></div>';
h+='<button class="btn btn-blue btn-sm" onclick="aiSuggestGrade()" id="aiGradeBtn">&#x1F916; AI Suggest</button>';
h+='</div>';
h+='<div class="grade-feedback-area"><label>Feedback <button class="btn btn-outline btn-sm" onclick="aiWriteFeedback()" id="aiFeedbackBtn" style="font-size:10px">&#x1F916; AI Write</button></label>';
h+='<textarea id="gradeFeedback">'+(a.aiSuggestedFeedback||a.feedback||'')+'</textarea></div>';
h+='<div class="grade-btn-row">';
h+='<button class="btn btn-accent" onclick="gradeAssignment()">&#x2705; Grade</button>';
h+='<button class="btn btn-gold" onclick="returnForRevision()">&#x1F504; Return for Revision</button>';
h+='</div></div>';
}

h+='<div class="grade-footer">';
if(a.status==='pending')h+='<button class="btn btn-accent btn-sm" onclick="markCompleteFromPanel()">Mark Complete</button>';
else h+='<div></div>';
h+='<button class="btn btn-red btn-sm" onclick="deleteFromPanel()">Delete</button>';
h+='</div>';

el.innerHTML=h;
var gm=document.getElementById('gradePanel');gm.classList.add('show');
if(window.odaTrapFocus)_odaFocusTraps.gradePanel=window.odaTrapFocus(gm);
}
window.openGradePanel=openGradePanel;

function closeGradePanel(){document.getElementById('gradePanel').classList.remove('show');gradingAssignment=null;if(_odaFocusTraps.gradePanel){_odaFocusTraps.gradePanel();_odaFocusTraps.gradePanel=null}}
window.closeGradePanel=closeGradePanel;

/* dataUriToBlobUrl provided by oda-core.js */

function openFileBlob(assignId){
var a=allAssignments.find(function(x){return x.id===assignId});
if(!a||!a.fileData)return;
window.open(dataUriToBlobUrl(a.id,a.fileData),'_blank');
}
window.openFileBlob=openFileBlob;

async function gradeAssignment(){
if(!gradingAssignment)return;
var score=parseInt(document.getElementById('gradeScore').value);
var feedback=document.getElementById('gradeFeedback').value.trim();
if(isNaN(score)||score<0||score>100){odaToast('Enter a valid score (0-100)','warning');return}
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',gradingAssignment.id),{status:'graded',score:score,feedback:feedback,gradedAt:new Date().toISOString()});
closeGradePanel();
odaToast('Assignment graded: '+score+'%','success');
await loadStudents();
renderAssignmentsList();
if(selectedStudent)renderProfileAssignments();
}catch(e){console.error(e);odaToast('Error grading','error')}
}
window.gradeAssignment=gradeAssignment;

async function returnForRevision(){
if(!gradingAssignment)return;
var feedback=document.getElementById('gradeFeedback').value.trim();
if(!feedback){odaToast('Please enter feedback for the student','warning');return}
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',gradingAssignment.id),{status:'returned',feedback:feedback});
closeGradePanel();
await loadStudents();
renderAssignmentsList();
if(selectedStudent)renderProfileAssignments();
}catch(e){console.error(e);odaToast('Error: '+e.message,'error')}
}
window.returnForRevision=returnForRevision;

async function markCompleteFromPanel(){
if(!gradingAssignment)return;
try{
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',gradingAssignment.id),{status:'completed',completedAt:new Date().toISOString()});
closeGradePanel();
await loadStudents();
renderAssignmentsList();
if(selectedStudent)renderProfileAssignments();
}catch(e){console.error(e);odaToast('Error: '+e.message,'error')}
}
window.markCompleteFromPanel=markCompleteFromPanel;

async function deleteFromPanel(){
if(!gradingAssignment||!confirm('Delete this assignment?'))return;
try{
await window.fbDeleteDoc(window.fbDoc(window.fbDb,'assignments',gradingAssignment.id));
closeGradePanel();
await loadStudents();
renderAssignmentsList();
if(selectedStudent)renderProfileAssignments();
}catch(e){console.error(e);odaToast('Error: '+e.message,'error')}
}
window.deleteFromPanel=deleteFromPanel;

async function aiSuggestGrade(){
if(!gradingAssignment)return;
var a=gradingAssignment;
var btn=document.getElementById('aiGradeBtn');
btn.textContent='Thinking...';btn.disabled=true;
var prompt='Grade this student submission on a scale of 0-100. The assignment was: "'+
(a.title||'')+'" with instructions: "'+(a.instructions||'None')+'". The student submitted: "'+
(a.studentResponse||'No text response')+'". Respond with ONLY a JSON object: {"score": number, "feedback": "string"}';
try{
var text=await odaAI(prompt);
var match=text.match(/\{[\s\S]*\}/);
if(match){
var parsed=JSON.parse(match[0]);
document.getElementById('gradeScore').value=parsed.score||'';
document.getElementById('gradeFeedback').value=parsed.feedback||'';
await window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',a.id),{aiSuggestedScore:parsed.score||null,aiSuggestedFeedback:parsed.feedback||null});
}else{odaToast('AI response was not in expected format','error')}
}catch(e){console.error(e);odaToast('AI grading failed: '+e.message,'error')}
btn.textContent='\u{1F916} AI Suggest';btn.disabled=false;
}
window.aiSuggestGrade=aiSuggestGrade;

// ===== TEMPLATES =====
var toolLabels={'spelling-k2':'Spelling Bee K-2','spelling-34':'Spelling Bee 3-4','spelling-58':'Spelling Bee 5-8','vocab-k2':'Vocab K-2','vocab-34':'Vocab 3-4','vocab-58':'Vocab 5-8','pitch-challenge':'Pitch Challenge','elevator-pitch':'Elevator Pitch','lemonade-day':'Lemonade Day'};

async function loadTemplates(){
var list=document.getElementById('templateList');
if(!list)return;
try{
var q=window.fbQuery(window.fbCollection(window.fbDb,'templates'),window.fbWhere('teacherId','==',window.currentTeacher.uid));
var snap=await window.fbGetDocs(q);
templates=[];snap.forEach(function(d){templates.push({id:d.id,...d.data()})});
if(!templates.length){
list.innerHTML='<div class="tmpl-empty"><div class="tmpl-empty-icon">\u{1F4C1}</div><div class="tmpl-empty-text">No templates yet.<br>Create an assignment and check "Save as Template" to save one here.</div></div>';
return;
}
var h='';
templates.forEach(function(t){
var ct=t.createType||t.type||'tool';
var isTool=ct==='tool';
var icon=isTool?'\u{1F6E0}\uFE0F':'\u{1F4CB}';
var tagClass=isTool?'tag-tool':'tag-assign';
var tagLabel=isTool?(toolLabels[t.toolType]||t.toolType||'Tool'):'Assignment';
var meta=t.gradingType==='completion'?'Completion':'Teacher Graded';
var date=t.createdAt?new Date(t.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
h+='<div class="tmpl-card" onclick="loadTemplate(\''+t.id+'\')">';
h+='<div class="tmpl-card-icon">'+icon+'</div>';
h+='<div class="tmpl-card-info">';
h+='<div class="tmpl-card-title">'+esc(t.title||tagLabel)+'</div>';
h+='<div class="tmpl-card-meta"><span class="tag '+tagClass+'">'+tagLabel+'</span>';
if(!isTool)h+='<span>'+meta+'</span>';
if(date)h+='<span>'+date+'</span>';
h+='</div></div>';
h+='<button class="tmpl-card-del" onclick="event.stopPropagation();deleteTemplate(\''+t.id+'\')" title="Delete template">\u{1F5D1}</button>';
h+='</div>';
});
list.innerHTML=h;
}catch(e){console.error(e);list.innerHTML='<div class="tmpl-empty"><div class="tmpl-empty-text">Failed to load templates.</div></div>'}
}

async function deleteTemplate(id){
if(!confirm('Delete this template?'))return;
try{
await window.fbDeleteDoc(window.fbDoc(window.fbDb,'templates',id));
templates=templates.filter(function(t){return t.id!==id});
loadTemplates();
}catch(e){console.error(e);odaToast('Failed to delete template','error')}
}
window.deleteTemplate=deleteTemplate;

function loadTemplate(id){
var t=templates.find(function(x){return x.id===id});
if(!t)return;
var ct=t.createType||t.type||'tool';
if(ct==='worksheet'||ct==='link'||ct==='custom')ct='assignment';
switchCreateTab(ct);
if(ct==='tool'&&t.toolType)document.getElementById('createToolSelect').value=t.toolType;
if(ct==='assignment'){
document.getElementById('createAssignTitle').value=t.title||'';
document.getElementById('createAssignInstructions').value=t.instructions||'';
document.getElementById('createAssignLink').value=t.linkUrl||'';
document.getElementById('createAssignGrading').value=t.gradingType||'teacher';
}
odaToast('Template loaded! Set due date and select students.','info');
}
window.loadTemplate=loadTemplate;

function logout(){window.fbSignOut(window.fbAuth).then(function(){window.location.href='index.html'})}
window.logout=logout;

function stripMd(t){if(!t)return'';return t.replace(/^#{1,6}\s+/gm,'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*\*/g,'').replace(/\*(.+?)\*/g,'$1').replace(/__(.+?)__/g,'$1').replace(/_(.+?)_/g,'$1').replace(/^[-*]\s+/gm,'').replace(/^---+$/gm,'').replace(/`(.+?)`/g,'$1').replace(/^\s*\n/gm,'\n').trim()}
document.addEventListener('keydown',function(e){
if(e.key==='Escape'){
var modals=[['assignModal',closeAssignModal],['classModal',closeClassModal],['addStudentModal',closeAddStudentModal],['createAssignModal',closeCreateAssignment],['gradePanel',closeGradePanel],['aiGenModal',closeAiGen],['aiDiffModal',closeAiDiff]];
for(var i=0;i<modals.length;i++){if(document.getElementById(modals[i][0]).classList.contains('show')){modals[i][1]();return}}
var fbm=document.getElementById('feedbackModal');if(fbm&&fbm.style.display==='flex'){closeFeedbackModal();return}
}
if(e.key==='Enter'){
if(document.activeElement.id==='addStudentName'||document.activeElement.id==='addStudentGrade')addStudent();
if(document.activeElement.id==='className')createClass();
}
});

// ===== LOADING & TOAST HELPERS =====
function showLoading(msg){
document.getElementById('loadingText').textContent=msg||'Loading...';
document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoading(){document.getElementById('loadingOverlay').classList.remove('show')}
window.showLoading=showLoading;window.hideLoading=hideLoading;

/* showToast replaced by odaToast from oda-core.js */

/* btnLoading / btnReset provided by oda-core.js — no duplicate here */

// ===== NOTIFICATION BADGE =====
function updateNotifBadge(){
var review=allAssignments.filter(function(a){return a.status==='submitted'}).length;
var badge=document.getElementById('assignNotifBadge');
if(badge){badge.textContent=review;badge.className='notif-badge'+(review===0?' zero':'')}
}
window.updateNotifBadge=updateNotifBadge;

// ===== SEARCH: ROSTER =====
var _rosterSearchTimer=null;
function debouncedFilterRoster(){clearTimeout(_rosterSearchTimer);_rosterSearchTimer=setTimeout(filterRoster,150)}
window.debouncedFilterRoster=debouncedFilterRoster;
function filterRoster(){
var term=(document.getElementById('rosterSearch').value||'').toLowerCase();
var rows=document.querySelectorAll('#studentList .s-row');
rows.forEach(function(r){
var name=(r.querySelector('.s-name')||{}).textContent||'';
r.style.display=name.toLowerCase().indexOf(term)>=0?'':'none';
});
}
window.filterRoster=filterRoster;

// ===== ANALYTICS DASHBOARD =====
function updateAnalytics(){
var now=new Date();
var weekAgo=new Date(now.getTime()-7*24*60*60*1000);
var weekStr=weekAgo.toISOString();

// Completed this week
var completedThisWeek=allAssignments.filter(function(a){
return(a.status==='completed'||a.status==='graded')&&(a.completedAt||a.gradedAt||'')>=weekStr;
});
document.getElementById('anCompleted').textContent=completedThisWeek.length;

// Avg score
var scores=allAssignments.filter(function(a){return a.score!==null&&a.score!==undefined}).map(function(a){return a.score});
var avg=scores.length?Math.round(scores.reduce(function(s,v){return s+v},0)/scores.length):'--';
document.getElementById('anAvgScore').textContent=avg+(typeof avg==='number'?'%':'');

// Completion rate
var total=allAssignments.length;
var done=allAssignments.filter(function(a){return a.status==='completed'||a.status==='graded'}).length;
var rate=total?Math.round(done/total*100):0;
document.getElementById('anCompRate').textContent=rate+'%';

// Top tool
var toolCounts={};
allAssignments.forEach(function(a){var t=a.toolType||a.type;toolCounts[t]=(toolCounts[t]||0)+1});
var topTool='--';var topCount=0;
Object.keys(toolCounts).forEach(function(k){if(toolCounts[k]>topCount){topCount=toolCounts[k];topTool=k}});
var toolNames={'spelling-k2':'Spell K2','spelling-34':'Spell 3-4','spelling-58':'Spell 5-8','vocab-k2':'Vocab K2','vocab-34':'Vocab 3-4','vocab-58':'Vocab 5-8','pitch-challenge':'Pitch','elevator-pitch':'Elevator','lemonade-day':'Lemonade',tool:'Tool',worksheet:'Worksheet',link:'Link',custom:'Custom'};
document.getElementById('anTopTool').textContent=toolNames[topTool]||topTool;

// Bar chart
var barData={};
allAssignments.forEach(function(a){
var t=a.toolType||a.type;
var label=toolNames[t]||t;
barData[label]=(barData[label]||0)+1;
});
var barKeys=Object.keys(barData);
var maxVal=Math.max.apply(null,barKeys.map(function(k){return barData[k]}));
var colors=['var(--accent)','var(--accent2)','var(--gold)','var(--accent3)','#a855f7','#06d6a0','#118ab2','#ffd166'];
var bh='';
barKeys.forEach(function(k,i){
var pct=maxVal>0?Math.round(barData[k]/maxVal*100):0;
bh+='<div class="bar-col"><div class="bar-val">'+barData[k]+'</div>';
bh+='<div class="bar-fill" style="height:'+pct+'%;background:'+colors[i%colors.length]+'"></div>';
bh+='<div class="bar-label">'+k+'</div></div>';
});
document.getElementById('anBarChart').innerHTML=bh||'<div style="text-align:center;width:100%;color:var(--text2);font-size:12px">No data yet</div>';

// Leaderboard
var studentCounts={};
allAssignments.forEach(function(a){
if(a.status==='completed'||a.status==='graded'){
var s=students.find(function(st){return st.id===a.studentId});
var name=s?s.name:'Unknown';
studentCounts[name]=(studentCounts[name]||0)+1;
}
});
var lb=Object.keys(studentCounts).map(function(k){return{name:k,count:studentCounts[k]}});
lb.sort(function(a,b){return b.count-a.count});
lb=lb.slice(0,10);
var lh='';
lb.forEach(function(item,i){
var medal=i===0?'\u{1F947}':i===1?'\u{1F948}':i===2?'\u{1F949}':'';
lh+='<div class="lb-row"><span class="lb-rank">'+(medal||(i+1))+'</span><span class="lb-name">'+esc(item.name)+'</span><span class="lb-count">'+item.count+'</span></div>';
});
document.getElementById('anLeaderboard').innerHTML=lh||'<div style="text-align:center;padding:12px;color:var(--text2);font-size:12px">No completions yet</div>';
}
window.updateAnalytics=updateAnalytics;

// ===== BULK ACTIONS =====
var bulkSelected=[];

function updateBulkBar(){
var checks=document.querySelectorAll('.bulk-check:checked');
bulkSelected=[];
checks.forEach(function(c){bulkSelected.push(c.value)});
var bar=document.getElementById('bulkBar');
if(bulkSelected.length>0){
bar.classList.add('show');
document.getElementById('bulkCount').textContent=bulkSelected.length+' selected';
}else{
bar.classList.remove('show');
}
}
window.updateBulkBar=updateBulkBar;

function bulkSelectAll(){
var checks=document.querySelectorAll('.bulk-check');
checks.forEach(function(c){c.checked=true});
updateBulkBar();
}
window.bulkSelectAll=bulkSelectAll;

async function bulkComplete(){
if(!bulkSelected.length)return;
if(!confirm('Mark '+bulkSelected.length+' assignment(s) as complete?'))return;
showLoading('Completing assignments...');
try{
await Promise.all(bulkSelected.map(function(id){return window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',id),{status:'completed',completedAt:new Date().toISOString()})}));
odaToast(bulkSelected.length+' assignments completed','success');
}catch(e){console.error(e);odaToast('Error completing assignments','error')}
hideLoading();
}
window.bulkComplete=bulkComplete;

async function bulkGrade(){
if(!bulkSelected.length)return;
var score=prompt('Enter score (0-100) for all selected assignments:');
if(score===null)return;
score=parseInt(score);
if(isNaN(score)||score<0||score>100){odaToast('Enter a valid score (0-100)','warning');return}
showLoading('Grading assignments...');
try{
await Promise.all(bulkSelected.map(function(id){return window.fbUpdateDoc(window.fbDoc(window.fbDb,'assignments',id),{status:'graded',score:score,gradedAt:new Date().toISOString()})}));
odaToast(bulkSelected.length+' assignments graded at '+score+'%','success');
}catch(e){console.error(e);odaToast('Error grading','error')}
hideLoading();
}
window.bulkGrade=bulkGrade;

async function bulkDelete(){
if(!bulkSelected.length)return;
if(!confirm('Delete '+bulkSelected.length+' assignment(s)? This cannot be undone.'))return;
showLoading('Deleting assignments...');
try{
await Promise.all(bulkSelected.map(function(id){return window.fbDeleteDoc(window.fbDoc(window.fbDb,'assignments',id))}));
odaToast(bulkSelected.length+' assignments deleted','success');
}catch(e){console.error(e);odaToast('Error deleting','error')}
hideLoading();
}
window.bulkDelete=bulkDelete;

// ===== AI: CLASS SUMMARY (8b) =====
async function aiClassSummary(){
var result=document.getElementById('aiClassSummaryResult');
result.style.display='block';result.textContent='Generating class summary...';

var total=allAssignments.length;
var done=allAssignments.filter(function(a){return a.status==='completed'||a.status==='graded'}).length;
var pending=allAssignments.filter(function(a){return a.status==='pending'}).length;
var submitted=allAssignments.filter(function(a){return a.status==='submitted'}).length;
var scores=allAssignments.filter(function(a){return a.score!==null&&a.score!==undefined}).map(function(a){return a.score});
var avg=scores.length?Math.round(scores.reduce(function(s,v){return s+v},0)/scores.length):'N/A';

// Per-student summary
var perStudent={};
students.forEach(function(s){perStudent[s.name]={completed:0,pending:0,avgScore:null,scores:[]}});
allAssignments.forEach(function(a){
var s=students.find(function(st){return st.id===a.studentId});
if(!s)return;
if(a.status==='completed'||a.status==='graded')perStudent[s.name].completed++;
else if(a.status==='pending'||a.status==='returned')perStudent[s.name].pending++;
if(a.score!==null&&a.score!==undefined)perStudent[s.name].scores.push(a.score);
});
var studentSummary=Object.keys(perStudent).map(function(name){
var d=perStudent[name];
var avg2=d.scores.length?Math.round(d.scores.reduce(function(s,v){return s+v},0)/d.scores.length):'N/A';
return name+': '+d.completed+' done, '+d.pending+' pending, avg: '+avg2;
}).join('; ');

var prompt='You are a helpful education assistant for an afterschool program. Write a weekly class summary for the teacher. Class data: '+students.length+' students, '+total+' total assignments, '+done+' completed, '+pending+' pending, '+submitted+' needs review, class avg score: '+avg+'. Per-student breakdown: '+studentSummary+'. Write a friendly 3-4 paragraph narrative summary highlighting class achievements, students who are excelling, students who may need extra support, and 2-3 actionable recommendations for next week. Keep it encouraging and professional.';

try{
var text=await odaAI(prompt);
result.textContent=text;
result.scrollIntoView({behavior:'smooth',block:'nearest'});
}catch(e){console.error(e);result.textContent='Error generating summary. Please try again.';result.scrollIntoView({behavior:'smooth',block:'nearest'})}
}
window.aiClassSummary=aiClassSummary;

// ===== AI: ASSIGNMENT GENERATOR (8a) =====
function openAiGen(){var m=document.getElementById('aiGenModal');m.classList.add('show');document.getElementById('aiGenTopic').value='';document.getElementById('aiGenResult').style.display='none';document.getElementById('aiGenActions').style.display='none';if(window.odaTrapFocus)_odaFocusTraps.aiGenModal=window.odaTrapFocus(m)}
function closeAiGen(){document.getElementById('aiGenModal').classList.remove('show');if(_odaFocusTraps.aiGenModal){_odaFocusTraps.aiGenModal();_odaFocusTraps.aiGenModal=null}}
window.openAiGen=openAiGen;window.closeAiGen=closeAiGen;

var lastAiAssignment=null;

async function generateAiAssignment(){
var topic=document.getElementById('aiGenTopic').value.trim();
if(!topic){odaToast('Enter a topic','warning');return}
var grade=document.getElementById('aiGenGrade').value;
var btn=document.getElementById('aiGenBtn');
var result=document.getElementById('aiGenResult');
window.btnLoading(btn,'Generating...');
result.style.display='block';result.textContent='AI is creating your assignment...';
document.getElementById('aiGenActions').style.display='none';

var prompt='You are an education assistant for a K-12 afterschool program. Create an assignment for grade level '+grade+' on this topic: "'+topic+'". Respond with ONLY a JSON object: {"title": "assignment title", "instructions": "detailed instructions for the student (2-4 sentences)", "gradingType": "teacher" or "completion"}. Make it engaging, age-appropriate, and educational.';

try{
var text=await odaAI(prompt);
var match=text.match(/\{[\s\S]*\}/);
if(match){
lastAiAssignment=JSON.parse(match[0]);
result.textContent='Title: '+lastAiAssignment.title+'\n\nInstructions: '+lastAiAssignment.instructions+'\n\nGrading: '+(lastAiAssignment.gradingType||'teacher');
document.getElementById('aiGenActions').style.display='block';
}else{result.textContent='AI response:\n\n'+text;lastAiAssignment=null}
}catch(e){console.error(e);result.textContent='Error: '+e.message;lastAiAssignment=null}
window.btnReset(btn,'Generate Assignment \u{1F680}');
}
window.generateAiAssignment=generateAiAssignment;

function useAiAssignment(){
if(!lastAiAssignment)return;
closeAiGen();
openCreateAssignment();
setTimeout(function(){
switchCreateTab('assignment');
document.getElementById('createAssignTitle').value=lastAiAssignment.title||'';
document.getElementById('createAssignInstructions').value=lastAiAssignment.instructions||'';
document.getElementById('createAssignGrading').value=lastAiAssignment.gradingType||'teacher';
},100);
}
window.useAiAssignment=useAiAssignment;

// ===== AI: DIFFERENTIATION (8c) =====
function openAiDiff(){document.getElementById('aiDiffModal').classList.add('show');document.getElementById('aiDiffResult').style.display='none'}
function closeAiDiff(){document.getElementById('aiDiffModal').classList.remove('show')}
window.openAiDiff=openAiDiff;window.closeAiDiff=closeAiDiff;

async function runAiDifferentiation(){
var btn=document.getElementById('aiDiffBtn');
var result=document.getElementById('aiDiffResult');
window.btnLoading(btn,'Analyzing...');
result.style.display='block';result.textContent='Analyzing student performance...';

// Build per-student data
var perStudent=[];
students.forEach(function(s){
var sAssigns=allAssignments.filter(function(a){return a.studentId===s.id});
var scores=sAssigns.filter(function(a){return a.score!==null&&a.score!==undefined}).map(function(a){return a.score});
var avg=scores.length?Math.round(scores.reduce(function(sum,v){return sum+v},0)/scores.length):'N/A';
var completed=sAssigns.filter(function(a){return a.status==='completed'||a.status==='graded'}).length;
perStudent.push(s.name+' (grade '+s.grade+', avg: '+avg+', completed: '+completed+'/'+sAssigns.length+')');
});

var prompt='You are an education consultant for a K-12 afterschool program. Analyze these students and suggest differentiation groupings (K-2 level, 3-4 level, 5-8 level) for each student based on their performance. Also suggest specific activities or supports for each group. Students: '+perStudent.join('; ')+'. Format your response clearly with group headers and student names under each group, followed by recommendations for each group.';

try{
var text=await odaAI(prompt);
result.textContent=text;
}catch(e){console.error(e);result.textContent='Error: '+e.message}
window.btnReset(btn,'Analyze Students \u{1F52C}');
}
window.runAiDifferentiation=runAiDifferentiation;

// ===== AI: FEEDBACK WRITER (8d) =====
async function aiWriteFeedback(){
if(!gradingAssignment)return;
var a=gradingAssignment;
var student=students.find(function(s){return s.id===a.studentId});
var studentName=student?student.name:'the student';

// Get student history
var history=allAssignments.filter(function(x){return x.studentId===a.studentId&&(x.status==='completed'||x.status==='graded')});
var historyStr=history.map(function(x){return(x.title||x.type)+': '+(x.score!==null?x.score+'%':'done')}).join(', ')||'no prior work';

var btn=document.getElementById('aiFeedbackBtn');
if(btn)window.btnLoading(btn,'Writing...');

var prompt='You are a supportive afterschool program teacher writing personalized feedback for a K-12 student named '+studentName+'. Assignment: "'+
(a.title||'')+'" with instructions: "'+(a.instructions||'None')+'". Student response: "'+
(a.studentResponse||'No text response')+'". Student history: '+historyStr+'. Write 2-3 sentences of warm, specific, actionable feedback. Be encouraging but honest. Reference specific things the student did well and one area to improve.';

try{
var text=await odaAI(prompt);
var fb=document.getElementById('gradeFeedback');
if(fb)fb.value=text;
}catch(e){console.error(e);odaToast('Error generating feedback','error')}
if(btn)window.btnReset(btn,'\u{1F916} AI Write Feedback');
}
window.aiWriteFeedback=aiWriteFeedback;

// ===== FEEDBACK SYSTEM =====
function openFeedbackModal(type){
var modal=document.getElementById('feedbackModal');
var title=document.getElementById('feedbackTitle');
var desc=document.getElementById('feedbackDesc');
title.textContent=type==='bug'?'\u{1F41B} Report a Bug':'\u{1F4A1} Request a Feature';
desc.placeholder=type==='bug'?'Describe the bug...':'Describe your idea...';
desc.value='';
document.getElementById('feedbackPage').value='';
modal.dataset.type=type;
modal.style.display='flex';
if(window.odaTrapFocus)_odaFocusTraps.feedbackModal=window.odaTrapFocus(modal);
}
window.openFeedbackModal=openFeedbackModal;

function closeFeedbackModal(){
if(_odaFocusTraps.feedbackModal){_odaFocusTraps.feedbackModal();_odaFocusTraps.feedbackModal=null}
document.getElementById('feedbackModal').style.display='none';
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
var teacherName=(window.teacherData&&window.teacherData.name)||'Teacher';
var teacherUid=(window.currentTeacher&&window.currentTeacher.uid)||'';
var classCode=(window.teacherData&&window.teacherData.classCode)||'';
await window.fbAddDoc(window.fbCollection(window.fbDb,'feedback'),{
type:type,
message:message,
page:page,
userName:teacherName,
userRole:'teacher',
userId:teacherUid,
classCode:classCode,
status:'new',
createdAt:window.fbTimestamp.now()
});
odaToast('Thanks! Your feedback has been submitted.','success');
closeFeedbackModal();
}catch(e){console.error(e);odaToast('Error submitting feedback.','error')}
btn.disabled=false;btn.textContent='Submit';
}
window.submitFeedback=submitFeedback;

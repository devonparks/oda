/**
 * ODA Hub - Teacher Core Module
 * Shared state, config, helpers, tab navigation, tools grid, and keyboard handlers.
 * Dependencies: oda-core.js
 *
 * Module architecture:
 *   teacher.js            — Core (this file): state, config, helpers, tabs, tools
 *   teacher-roster.js     — Classes, students, profiles, student work
 *   teacher-assignments.js — Assignment CRUD, grading, templates
 *   teacher-ai.js         — Analytics, bulk actions, AI features, feedback
 */

var ODA_VERSION = '2026-03-16a';

// ============================================
// Shared State (accessed by all teacher modules)
// ============================================
var students = [];
var allAssignments = [];
var currentClass = 'All Students';
var selectedStudent = null;
var _odaFocusTraps = {};
var _selectedStudentIds = [];

// ============================================
// HTML Builder Helpers
// ============================================

/** Generate a status badge <span> element */
function badgeHTML(status, label) {
  var cls = { pending: 'st-pending', submitted: 'st-submitted', graded: 'st-graded', completed: 'st-completed', returned: 'st-returned' };
  return '<span class="a-status ' + (cls[status] || 'st-pending') + '">' + (label || status) + '</span>';
}

/** Map assignment status to CSS class */
function statusClass(status) {
  return { pending: 'st-pending', submitted: 'st-submitted', graded: 'st-graded', completed: 'st-completed', returned: 'st-returned' }[status] || 'st-pending';
}

/** Map assignment status to display label */
function statusLabel(status) {
  return { pending: 'Pending', submitted: 'Needs Review', graded: 'Graded', completed: 'Completed', returned: 'Returned' }[status] || status;
}

/** Get emoji for an assignment type */
function typeEmoji(type) {
  return { 'elevator-pitch': '\u{1F399}\uFE0F', 'pitch-challenge': '\u{1F4A1}', 'lemonade-day': '\u{1F34B}', 'spelling-bee': '\u{1F41D}', assignment: '\u{1F4CB}', tool: '\u{1F6E0}\uFE0F' }[type] || '\u{1F4CB}';
}

/** Strip markdown formatting from text */
function stripMd(t) {
  if (!t) return '';
  return t.replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*\*/g, '').replace(/\*(.+?)\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/_(.+?)_/g, '$1').replace(/^[-*]\s+/gm, '').replace(/^---+$/gm, '').replace(/`(.+?)`/g, '$1').replace(/^\s*\n/gm, '\n').trim();
}

// ============================================
// Version Check
// ============================================

/** Check for app updates and reload if newer version found */
function checkForUpdates(btn) {
  btn.disabled = true; btn.innerHTML = '&#x1F504; Checking...';
  fetch(location.href + '?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (html) {
    var m = html.match(/ODA_VERSION='([^']+)'/);
    var remote = m ? m[1] : '';
    if (remote && remote !== ODA_VERSION) {
      btn.innerHTML = '&#x2705; Update found! Reloading...';
      setTimeout(function () { location.reload(true); }, 600);
    } else {
      btn.innerHTML = '&#x2705; Up to date!';
      setTimeout(function () { btn.innerHTML = '&#x1F504; Update'; btn.disabled = false; }, 2000);
    }
  }).catch(function () {
    btn.innerHTML = '&#x1F504; Update'; btn.disabled = false;
    location.reload(true);
  });
}

// ============================================
// Assignment Type Config
// ============================================

var ASSIGN_TYPES = {
  'spelling-k2': { title: 'Spelling K-2', emoji: '\u{1F4D6}' },
  'spelling-34': { title: 'Spelling 3-4', emoji: '\u{1F4D6}' },
  'spelling-58': { title: 'Spelling 5-8', emoji: '\u{1F4D6}' },
  'vocab-k2': { title: 'Vocab K-2', emoji: '\u{1F4AC}' },
  'vocab-34': { title: 'Vocab 3-4', emoji: '\u{1F4AC}' },
  'vocab-58': { title: 'Vocab 5-8', emoji: '\u{1F4AC}' },
  'pitch-challenge': { title: 'Pitch Challenge', emoji: '\u{1F4A1}' },
  'elevator-pitch': { title: 'Elevator Pitch', emoji: '\u{1F3A4}' },
  'lemonade-day': { title: 'Lemonade Day', emoji: '\u{1F34B}' },
  'free-play': { title: 'Free Play', emoji: '\u{1F3AE}' },
  'worksheet': { title: 'Worksheet', emoji: '\u{1F4C4}' },
  'link': { title: 'Link', emoji: '\u{1F517}' },
  'custom': { title: 'Custom', emoji: '\u270F\uFE0F' }
};

// ============================================
// Tab Navigation
// ============================================

var teacherTabOrder = ['home', 'tools', 'roster', 'assignments', 'arcade', 'settings'];

/** Switch the active dashboard tab */
function switchTab(id) {
  var tabs = document.querySelectorAll('.tab[role="tab"]');
  var secs = document.querySelectorAll('.section');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
    tabs[i].setAttribute('aria-selected', 'false');
    tabs[i].setAttribute('tabindex', '-1');
    secs[i].classList.remove('show');
  }
  document.getElementById('sec-' + id).classList.add('show');
  var m = { home: 0, tools: 1, roster: 2, assignments: 3, arcade: 4, settings: 5 };
  if (m[id] !== undefined) {
    tabs[m[id]].classList.add('active');
    tabs[m[id]].setAttribute('aria-selected', 'true');
    tabs[m[id]].setAttribute('tabindex', '0');
  }
  closeProfile();
  if (id === 'assignments') { renderAssignmentsList(); populateClassFilters(); }
  if (id === 'tools') { renderMyTools(); }
  odaAnnounce(id + ' tab selected');
}
window.switchTab = switchTab;

// Auto-switch to tab based on URL hash (e.g. teacher.html#arcade)
(function(){
  var hash=window.location.hash.replace('#','');
  if(hash&&['home','tools','roster','assignments','arcade','settings'].indexOf(hash)>=0){
    setTimeout(function(){switchTab(hash)},100);
  }
})();

/** Handle arrow-key navigation between tabs */
function teacherTabKeyNav(e, current) {
  var idx = teacherTabOrder.indexOf(current); if (idx < 0) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    var next = e.key === 'ArrowRight' ? (idx + 1) % teacherTabOrder.length : (idx - 1 + teacherTabOrder.length) % teacherTabOrder.length;
    switchTab(teacherTabOrder[next]);
    document.getElementById('tab-' + teacherTabOrder[next]).focus();
  } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTab(current); }
}
window.teacherTabKeyNav = teacherTabKeyNav;

// ============================================
// My Tools Grid
// ============================================

var TEACHER_TOOLS = [
  { id: 'pitch-challenge', emoji: '\u{1F4A1}', name: 'Pitch Challenge', desc: 'Full business pitch \u2014 problem, idea, customers, record & present.', url: 'pitch.html', toolType: 'pitch-challenge' },
  { id: 'elevator-pitch', emoji: '\u{1F3A4}', name: 'Elevator Pitch', desc: '10-question interview \u2192 auto-generated pitch. 3 styles.', url: 'elevator.html', toolType: 'elevator-pitch' },
  { id: 'lemonade', emoji: '\u{1F34B}', name: 'Lemonade Day', desc: 'Mikaila video, mission statement, sign-ups & hype.', url: 'lemonade.html', toolType: 'lemonade-day' },
  { id: 'spelling', emoji: '\u{1F41D}', name: 'Spelling Bee', desc: 'Cleveland-themed spelling challenges. 5 levels.', url: 'spelling.html', toolType: 'spelling-bee' },
  { id: 'oda-studio', emoji: '\u2728', name: 'ODA Studio', desc: 'Build custom tools with AI! Chat-powered studio.', url: 'builder.html', toolType: 'oda-studio' },
  { id: 'jeopardy', emoji: '\u{1F3AF}', name: 'Jeopardy', desc: 'Create custom Jeopardy boards. AI generates 25 questions instantly.', url: 'jeopardy.html', toolType: 'jeopardy' },
  { id: 'kahoot', emoji: '\u26A1', name: 'Quiz Blitz', desc: 'Kahoot-style quizzes. Host live or assign for practice.', url: 'kahoot.html', toolType: 'kahoot' },
  { id: 'flashcards', emoji: '\u{1F4DA}', name: 'Flashcards', desc: 'Create decks with AI. Browse, quiz, match & speed round modes.', url: 'flashcards.html', toolType: 'flashcards' },
  { id: 'wordsearch', emoji: '\u{1F50D}', name: 'Word Search', desc: 'AI-generated word search puzzles from any topic.', url: 'wordsearch.html', toolType: 'wordsearch' },
  { id: 'crossword', emoji: '\u270F\uFE0F', name: 'Crossword', desc: 'Auto-generated crosswords with vocabulary clues.', url: 'crossword.html', toolType: 'crossword' },
  { id: 'library', emoji: '\u{1F4D6}', name: 'Library', desc: 'AI reading passages with comprehension quizzes & reading logs.', url: 'library.html', toolType: 'library' },
  { id: 'canvas', emoji: '\u{1F3A8}', name: 'ODA Canvas', desc: 'Drawing & design tool. Posters, t-shirts, comics & more.', url: 'canvas.html', toolType: 'canvas' },
  { id: 'timer', emoji: '\u23F0', name: 'Timer', desc: 'Clock, countdown timer, stopwatch & alarms. Projector-ready.', url: 'timer.html', toolType: 'timer' },
  { id: 'scoreboard', emoji: '\u{1F3C6}', name: 'Scoreboard', desc: 'Team scoreboard with buzzer mode. Great for competitions.', url: 'scoreboard.html', toolType: 'scoreboard' },
  { id: 'raffle', emoji: '\u{1F3B0}', name: 'Raffle', desc: 'Coin-powered raffle with animated prize wheel drawing.', url: 'raffle.html', toolType: 'raffle' }
];

var COMING_SOON_TEACHER = [
  { id: 'oda-world', emoji: '\u{1F30D}', name: 'ODA World', desc: 'Immersive virtual campus for students to explore.' },
  { id: 'debate', emoji: '\u{1F5E3}\uFE0F', name: 'Debate Club', desc: 'Structured debate practice for students.' }
];

/** Render the teacher tools grid with submission counts */
function renderMyTools() {
  var grid = document.getElementById('teacherToolsGrid');
  var h = '';
  TEACHER_TOOLS.forEach(function (t) {
    var subs = 0; var assigned = 0;
    if (window.allAssignments) {
      window.allAssignments.forEach(function (a) {
        if (a.toolType === t.toolType) { assigned++; if (a.status === 'submitted' || a.status === 'completed') subs++; }
      });
    }
    h += '<div class="tool-card">';
    h += '<span class="tool-emoji">' + t.emoji + '</span>';
    h += '<div class="tool-title">' + t.name + '</div>';
    h += '<div class="tool-desc">' + t.desc + '</div>';
    if (assigned > 0) h += '<span class="tool-stat">' + subs + '/' + assigned + ' submitted</span>';
    h += '<div class="tool-actions">';
    h += '<a class="tool-btn" href="' + t.url + '">Open</a>';
    h += '<button class="tool-btn assign" onclick="quickAssignTool(\'' + t.toolType + '\')">Assign</button>';
    if (subs > 0) h += '<button class="tool-btn subs" onclick="viewToolSubmissions(\'' + t.toolType + '\')">View Work</button>';
    h += '</div></div>';
  });
  grid.innerHTML = h;

  var coming = document.getElementById('teacherToolsComingSoon');
  var ch = '';
  COMING_SOON_TEACHER.forEach(function (t) {
    ch += '<div class="tool-card coming-soon">';
    ch += '<span class="tool-emoji">' + t.emoji + '</span>';
    ch += '<div class="tool-title">' + t.name + '</div>';
    ch += '<div class="tool-desc">' + t.desc + '</div>';
    ch += '</div>';
  });
  coming.innerHTML = ch;
}

/** Quick-assign a tool from the tools grid */
function quickAssignTool(toolType) {
  switchTab('assignments');
  setTimeout(function () {
    openCreateAssignment();
    setTimeout(function () {
      var cards = document.querySelectorAll('.tool-pick');
      cards.forEach(function (c) { if (c.getAttribute('data-val') === toolType) { c.click(); } });
    }, 200);
  }, 100);
}
window.quickAssignTool = quickAssignTool;

/** View submissions for a specific tool */
function viewToolSubmissions(toolType) {
  switchTab('assignments');
  setTimeout(function () {
    var sel = document.getElementById('filterStatus');
    if (sel) { sel.value = 'submitted'; filterAssignments(); }
  }, 100);
}
window.viewToolSubmissions = viewToolSubmissions;

// ============================================
// Logout
// ============================================

function logout() {
  window.fbSignOut(window.fbAuth).then(function () { window.location.href = 'index.html'; });
}
window.logout = logout;

// ============================================
// Keyboard Handlers
// ============================================

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var modals = [
      ['assignModal', closeAssignModal],
      ['classModal', closeClassModal],
      ['addStudentModal', closeAddStudentModal],
      ['createAssignModal', closeCreateAssignment],
      ['gradePanel', closeGradePanel],
      ['aiGenModal', closeAiGen],
      ['aiDiffModal', closeAiDiff]
    ];
    for (var i = 0; i < modals.length; i++) {
      if (document.getElementById(modals[i][0]).classList.contains('show')) { modals[i][1](); return; }
    }
    var fbm = document.getElementById('feedbackModal');
    if (fbm && fbm.style.display === 'flex') { closeFeedbackModal(); return; }
  }
  if (e.key === 'Enter') {
    if (document.activeElement.id === 'addStudentName' || document.activeElement.id === 'addStudentGrade') addStudent();
    if (document.activeElement.id === 'className') createClass();
  }
});

// ============================================
// Loading Overlay
// ============================================

/** Show full-screen loading overlay */
function showLoading(msg) {
  document.getElementById('loadingText').textContent = msg || 'Loading...';
  document.getElementById('loadingOverlay').classList.add('show');
}

/** Hide loading overlay */
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('show'); }
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// ============================================
// Notification Badge
// ============================================

/** Update the assignments tab notification badge count */
function updateNotifBadge() {
  var review = allAssignments.filter(function (a) { return a.status === 'submitted'; }).length;
  var badge = document.getElementById('assignNotifBadge');
  if (badge) { badge.textContent = review; badge.className = 'notif-badge' + (review === 0 ? ' zero' : ''); }
}
window.updateNotifBadge = updateNotifBadge;

// ============================================
// Roster Search
// ============================================

var _rosterSearchTimer = null;

function debouncedFilterRoster() { clearTimeout(_rosterSearchTimer); _rosterSearchTimer = setTimeout(filterRoster, 150); }
window.debouncedFilterRoster = debouncedFilterRoster;

/** Filter the roster list by search term */
function filterRoster() {
  var term = (document.getElementById('rosterSearch').value || '').toLowerCase();
  var rows = document.querySelectorAll('#studentList .s-row');
  rows.forEach(function (r) {
    var name = (r.querySelector('.s-name') || {}).textContent || '';
    r.style.display = name.toLowerCase().indexOf(term) >= 0 ? '' : 'none';
  });
}
window.filterRoster = filterRoster;

console.log('[ODA] Teacher core loaded v' + ODA_VERSION);

/**
 * ODA Hub - Teacher AI & Analytics Module
 * Handles analytics dashboard, bulk actions, AI features, and feedback system.
 * Dependencies: teacher.js (shared state & helpers), oda-core.js (odaAI, btnLoading/btnReset)
 */

// ============================================
// Analytics Dashboard
// ============================================

/** Update all analytics charts and leaderboard */
function updateAnalytics() {
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var weekStr = weekAgo.toISOString();

  // Completed this week
  var completedThisWeek = allAssignments.filter(function (a) {
    return (a.status === 'completed' || a.status === 'graded') && (a.completedAt || a.gradedAt || '') >= weekStr;
  });
  document.getElementById('anCompleted').textContent = completedThisWeek.length;

  // Avg score
  var scores = allAssignments.filter(function (a) { return a.score !== null && a.score !== undefined; }).map(function (a) { return a.score; });
  var avg = scores.length ? Math.round(scores.reduce(function (s, v) { return s + v; }, 0) / scores.length) : '--';
  document.getElementById('anAvgScore').textContent = avg + (typeof avg === 'number' ? '%' : '');

  // Completion rate
  var total = allAssignments.length;
  var done = allAssignments.filter(function (a) { return a.status === 'completed' || a.status === 'graded'; }).length;
  var rate = total ? Math.round(done / total * 100) : 0;
  document.getElementById('anCompRate').textContent = rate + '%';

  // Top tool
  var toolCounts = {};
  allAssignments.forEach(function (a) { var t = a.toolType || a.type; toolCounts[t] = (toolCounts[t] || 0) + 1; });
  var topTool = '--'; var topCount = 0;
  Object.keys(toolCounts).forEach(function (k) { if (toolCounts[k] > topCount) { topCount = toolCounts[k]; topTool = k; } });
  var toolNames = {
    'spelling-k2': 'Spell K2', 'spelling-34': 'Spell 3-4', 'spelling-58': 'Spell 5-8',
    'vocab-k2': 'Vocab K2', 'vocab-34': 'Vocab 3-4', 'vocab-58': 'Vocab 5-8',
    'pitch-challenge': 'Pitch', 'elevator-pitch': 'Elevator', 'lemonade-day': 'Lemonade',
    tool: 'Tool', worksheet: 'Worksheet', link: 'Link', custom: 'Custom'
  };
  document.getElementById('anTopTool').textContent = toolNames[topTool] || topTool;

  // Bar chart
  var barData = {};
  allAssignments.forEach(function (a) {
    var t = a.toolType || a.type;
    var label = toolNames[t] || t;
    barData[label] = (barData[label] || 0) + 1;
  });
  var barKeys = Object.keys(barData);
  var maxVal = Math.max.apply(null, barKeys.map(function (k) { return barData[k]; }));
  var colors = ['var(--accent)', 'var(--accent2)', 'var(--gold)', 'var(--accent3)', '#a855f7', '#06d6a0', '#118ab2', '#ffd166'];
  var bh = '';
  barKeys.forEach(function (k, i) {
    var pct = maxVal > 0 ? Math.round(barData[k] / maxVal * 100) : 0;
    bh += '<div class="bar-col"><div class="bar-val">' + barData[k] + '</div>';
    bh += '<div class="bar-fill" style="height:' + pct + '%;background:' + colors[i % colors.length] + '"></div>';
    bh += '<div class="bar-label">' + k + '</div></div>';
  });
  document.getElementById('anBarChart').innerHTML = bh || '<div style="text-align:center;width:100%;color:var(--text2);font-size:12px">No data yet</div>';

  // Leaderboard
  var studentCounts = {};
  allAssignments.forEach(function (a) {
    if (a.status === 'completed' || a.status === 'graded') {
      var s = students.find(function (st) { return st.id === a.studentId; });
      var name = s ? s.name : 'Unknown';
      studentCounts[name] = (studentCounts[name] || 0) + 1;
    }
  });
  var lb = Object.keys(studentCounts).map(function (k) { return { name: k, count: studentCounts[k] }; });
  lb.sort(function (a, b) { return b.count - a.count; });
  lb = lb.slice(0, 10);
  var lh = '';
  lb.forEach(function (item, i) {
    var medal = i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : '';
    lh += '<div class="lb-row"><span class="lb-rank">' + (medal || (i + 1)) + '</span><span class="lb-name">' + esc(item.name) + '</span><span class="lb-count">' + item.count + '</span></div>';
  });
  document.getElementById('anLeaderboard').innerHTML = lh || '<div style="text-align:center;padding:12px;color:var(--text2);font-size:12px">No completions yet</div>';
}
window.updateAnalytics = updateAnalytics;

// ============================================
// Bulk Actions
// ============================================

var bulkSelected = [];

/** Update the bulk action bar based on selected checkboxes */
function updateBulkBar() {
  var checks = document.querySelectorAll('.bulk-check:checked');
  bulkSelected = [];
  checks.forEach(function (c) { bulkSelected.push(c.value); });
  var bar = document.getElementById('bulkBar');
  if (bulkSelected.length > 0) {
    bar.classList.add('show');
    document.getElementById('bulkCount').textContent = bulkSelected.length + ' selected';
  } else {
    bar.classList.remove('show');
  }
}
window.updateBulkBar = updateBulkBar;

function bulkSelectAll() {
  var checks = document.querySelectorAll('.bulk-check');
  checks.forEach(function (c) { c.checked = true; });
  updateBulkBar();
}
window.bulkSelectAll = bulkSelectAll;

/** Bulk mark assignments as complete */
async function bulkComplete() {
  if (!bulkSelected.length) return;
  if (!confirm('Mark ' + bulkSelected.length + ' assignment(s) as complete?')) return;
  showLoading('Completing assignments...');
  try {
    await Promise.all(bulkSelected.map(function (id) { return window.fbUpdateDoc(window.fbDoc(window.fbDb, 'assignments', id), { status: 'completed', completedAt: new Date().toISOString() }); }));
    odaToast(bulkSelected.length + ' assignments completed', 'success');
  } catch (e) { console.error(e); odaToast('Error completing assignments', 'error'); }
  hideLoading();
}
window.bulkComplete = bulkComplete;

/** Bulk grade assignments with a single score */
async function bulkGrade() {
  if (!bulkSelected.length) return;
  var score = prompt('Enter score (0-100) for all selected assignments:');
  if (score === null) return;
  score = parseInt(score);
  if (isNaN(score) || score < 0 || score > 100) { odaToast('Enter a valid score (0-100)', 'warning'); return; }
  showLoading('Grading assignments...');
  try {
    await Promise.all(bulkSelected.map(function (id) { return window.fbUpdateDoc(window.fbDoc(window.fbDb, 'assignments', id), { status: 'graded', score: score, gradedAt: new Date().toISOString() }); }));
    odaToast(bulkSelected.length + ' assignments graded at ' + score + '%', 'success');
  } catch (e) { console.error(e); odaToast('Error grading', 'error'); }
  hideLoading();
}
window.bulkGrade = bulkGrade;

/** Bulk delete assignments */
async function bulkDelete() {
  if (!bulkSelected.length) return;
  if (!confirm('Delete ' + bulkSelected.length + ' assignment(s)? This cannot be undone.')) return;
  showLoading('Deleting assignments...');
  try {
    await Promise.all(bulkSelected.map(function (id) { return window.fbDeleteDoc(window.fbDoc(window.fbDb, 'assignments', id)); }));
    odaToast(bulkSelected.length + ' assignments deleted', 'success');
  } catch (e) { console.error(e); odaToast('Error deleting', 'error'); }
  hideLoading();
}
window.bulkDelete = bulkDelete;

// ============================================
// AI: Class Summary
// ============================================

/** Generate an AI-powered weekly class summary */
async function aiClassSummary() {
  var result = document.getElementById('aiClassSummaryResult');
  result.style.display = 'block'; result.textContent = 'Generating class summary...';

  var total = allAssignments.length;
  var done = allAssignments.filter(function (a) { return a.status === 'completed' || a.status === 'graded'; }).length;
  var pending = allAssignments.filter(function (a) { return a.status === 'pending'; }).length;
  var submitted = allAssignments.filter(function (a) { return a.status === 'submitted'; }).length;
  var scores = allAssignments.filter(function (a) { return a.score !== null && a.score !== undefined; }).map(function (a) { return a.score; });
  var avg = scores.length ? Math.round(scores.reduce(function (s, v) { return s + v; }, 0) / scores.length) : 'N/A';

  // Per-student summary
  var perStudent = {};
  students.forEach(function (s) { perStudent[s.name] = { completed: 0, pending: 0, avgScore: null, scores: [] }; });
  allAssignments.forEach(function (a) {
    var s = students.find(function (st) { return st.id === a.studentId; });
    if (!s) return;
    if (a.status === 'completed' || a.status === 'graded') perStudent[s.name].completed++;
    else if (a.status === 'pending' || a.status === 'returned') perStudent[s.name].pending++;
    if (a.score !== null && a.score !== undefined) perStudent[s.name].scores.push(a.score);
  });
  var studentSummary = Object.keys(perStudent).map(function (name) {
    var d = perStudent[name];
    var avg2 = d.scores.length ? Math.round(d.scores.reduce(function (s, v) { return s + v; }, 0) / d.scores.length) : 'N/A';
    return name + ': ' + d.completed + ' done, ' + d.pending + ' pending, avg: ' + avg2;
  }).join('; ');

  var prompt = 'You are a helpful education assistant for an afterschool program. Write a weekly class summary for the teacher. Class data: ' + students.length + ' students, ' + total + ' total assignments, ' + done + ' completed, ' + pending + ' pending, ' + submitted + ' needs review, class avg score: ' + avg + '. Per-student breakdown: ' + studentSummary + '. Write a friendly 3-4 paragraph narrative summary highlighting class achievements, students who are excelling, students who may need extra support, and 2-3 actionable recommendations for next week. Keep it encouraging and professional.';

  try {
    var text = await odaAI(prompt);
    result.textContent = text;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) { console.error(e); result.textContent = 'Error generating summary. Please try again.'; result.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}
window.aiClassSummary = aiClassSummary;

// ============================================
// AI: Assignment Generator
// ============================================

function openAiGen() {
  var m = document.getElementById('aiGenModal'); m.classList.add('show');
  document.getElementById('aiGenTopic').value = '';
  document.getElementById('aiGenResult').style.display = 'none';
  document.getElementById('aiGenActions').style.display = 'none';
  if (window.odaTrapFocus) _odaFocusTraps.aiGenModal = window.odaTrapFocus(m);
}
function closeAiGen() {
  document.getElementById('aiGenModal').classList.remove('show');
  if (_odaFocusTraps.aiGenModal) { _odaFocusTraps.aiGenModal(); _odaFocusTraps.aiGenModal = null; }
}
window.openAiGen = openAiGen;
window.closeAiGen = closeAiGen;

var lastAiAssignment = null;

/** Generate an AI-created assignment from a topic */
async function generateAiAssignment() {
  var topic = document.getElementById('aiGenTopic').value.trim();
  if (!topic) { odaToast('Enter a topic', 'warning'); return; }
  var grade = document.getElementById('aiGenGrade').value;
  var btn = document.getElementById('aiGenBtn');
  var result = document.getElementById('aiGenResult');
  window.btnLoading(btn, 'Generating...');
  result.style.display = 'block'; result.textContent = 'AI is creating your assignment...';
  document.getElementById('aiGenActions').style.display = 'none';

  var prompt = 'You are an education assistant for a K-12 afterschool program. Create an assignment for grade level ' + grade + ' on this topic: "' + topic + '". Respond with ONLY a JSON object: {"title": "assignment title", "instructions": "detailed instructions for the student (2-4 sentences)", "gradingType": "teacher" or "completion"}. Make it engaging, age-appropriate, and educational.';

  try {
    var text = await odaAI(prompt);
    var match = text.match(/\{[\s\S]*\}/);
    if (match) {
      lastAiAssignment = JSON.parse(match[0]);
      result.textContent = 'Title: ' + lastAiAssignment.title + '\n\nInstructions: ' + lastAiAssignment.instructions + '\n\nGrading: ' + (lastAiAssignment.gradingType || 'teacher');
      document.getElementById('aiGenActions').style.display = 'block';
    } else { result.textContent = 'AI response:\n\n' + text; lastAiAssignment = null; }
  } catch (e) { console.error(e); result.textContent = 'Error: ' + e.message; lastAiAssignment = null; }
  window.btnReset(btn, 'Generate Assignment \u{1F680}');
}
window.generateAiAssignment = generateAiAssignment;

/** Use the AI-generated assignment in the create modal */
function useAiAssignment() {
  if (!lastAiAssignment) return;
  closeAiGen();
  openCreateAssignment();
  setTimeout(function () {
    switchCreateTab('assignment');
    document.getElementById('createAssignTitle').value = lastAiAssignment.title || '';
    document.getElementById('createAssignInstructions').value = lastAiAssignment.instructions || '';
    document.getElementById('createAssignGrading').value = lastAiAssignment.gradingType || 'teacher';
  }, 100);
}
window.useAiAssignment = useAiAssignment;

// ============================================
// AI: Differentiation
// ============================================

function openAiDiff() {
  document.getElementById('aiDiffModal').classList.add('show');
  document.getElementById('aiDiffResult').style.display = 'none';
}
function closeAiDiff() { document.getElementById('aiDiffModal').classList.remove('show'); }
window.openAiDiff = openAiDiff;
window.closeAiDiff = closeAiDiff;

/** Analyze students and suggest differentiation groupings */
async function runAiDifferentiation() {
  var btn = document.getElementById('aiDiffBtn');
  var result = document.getElementById('aiDiffResult');
  window.btnLoading(btn, 'Analyzing...');
  result.style.display = 'block'; result.textContent = 'Analyzing student performance...';

  var perStudent = [];
  students.forEach(function (s) {
    var sAssigns = allAssignments.filter(function (a) { return a.studentId === s.id; });
    var scores = sAssigns.filter(function (a) { return a.score !== null && a.score !== undefined; }).map(function (a) { return a.score; });
    var avg = scores.length ? Math.round(scores.reduce(function (sum, v) { return sum + v; }, 0) / scores.length) : 'N/A';
    var completed = sAssigns.filter(function (a) { return a.status === 'completed' || a.status === 'graded'; }).length;
    perStudent.push(s.name + ' (grade ' + s.grade + ', avg: ' + avg + ', completed: ' + completed + '/' + sAssigns.length + ')');
  });

  var prompt = 'You are an education consultant for a K-12 afterschool program. Analyze these students and suggest differentiation groupings (K-2 level, 3-4 level, 5-8 level) for each student based on their performance. Also suggest specific activities or supports for each group. Students: ' + perStudent.join('; ') + '. Format your response clearly with group headers and student names under each group, followed by recommendations for each group.';

  try {
    var text = await odaAI(prompt);
    result.textContent = text;
  } catch (e) { console.error(e); result.textContent = 'Error: ' + e.message; }
  window.btnReset(btn, 'Analyze Students \u{1F52C}');
}
window.runAiDifferentiation = runAiDifferentiation;

// ============================================
// AI: Feedback Writer
// ============================================

/** Use AI to write personalized feedback for a student submission */
async function aiWriteFeedback() {
  if (!gradingAssignment) return;
  var a = gradingAssignment;
  var student = students.find(function (s) { return s.id === a.studentId; });
  var studentName = student ? student.name : 'the student';

  var history = allAssignments.filter(function (x) { return x.studentId === a.studentId && (x.status === 'completed' || x.status === 'graded'); });
  var historyStr = history.map(function (x) { return (x.title || x.type) + ': ' + (x.score !== null ? x.score + '%' : 'done'); }).join(', ') || 'no prior work';

  var btn = document.getElementById('aiFeedbackBtn');
  if (btn) window.btnLoading(btn, 'Writing...');

  var prompt = 'You are a supportive afterschool program teacher writing personalized feedback for a K-12 student named ' + studentName + '. Assignment: "' +
    (a.title || '') + '" with instructions: "' + (a.instructions || 'None') + '". Student response: "' +
    (a.studentResponse || 'No text response') + '". Student history: ' + historyStr + '. Write 2-3 sentences of warm, specific, actionable feedback. Be encouraging but honest. Reference specific things the student did well and one area to improve.';

  try {
    var text = await odaAI(prompt);
    var fb = document.getElementById('gradeFeedback');
    if (fb) fb.value = text;
  } catch (e) { console.error(e); odaToast('Error generating feedback', 'error'); }
  if (btn) window.btnReset(btn, '\u{1F916} AI Write Feedback');
}
window.aiWriteFeedback = aiWriteFeedback;

// ============================================
// Feedback System (Bug Reports / Feature Requests)
// ============================================

/** Open the feedback modal for bug reports or feature requests */
function openFeedbackModal(type) {
  var modal = document.getElementById('feedbackModal');
  var title = document.getElementById('feedbackTitle');
  var desc = document.getElementById('feedbackDesc');
  title.textContent = type === 'bug' ? '\u{1F41B} Report a Bug' : '\u{1F4A1} Request a Feature';
  desc.placeholder = type === 'bug' ? 'Describe the bug...' : 'Describe your idea...';
  desc.value = '';
  document.getElementById('feedbackPage').value = '';
  modal.dataset.type = type;
  modal.style.display = 'flex';
  if (window.odaTrapFocus) _odaFocusTraps.feedbackModal = window.odaTrapFocus(modal);
}
window.openFeedbackModal = openFeedbackModal;

function closeFeedbackModal() {
  if (_odaFocusTraps.feedbackModal) { _odaFocusTraps.feedbackModal(); _odaFocusTraps.feedbackModal = null; }
  document.getElementById('feedbackModal').style.display = 'none';
}
window.closeFeedbackModal = closeFeedbackModal;

/** Submit user feedback to Firestore */
async function submitFeedback() {
  var modal = document.getElementById('feedbackModal');
  var type = modal.dataset.type;
  var message = document.getElementById('feedbackDesc').value.trim();
  var page = document.getElementById('feedbackPage').value.trim();
  if (!message) { odaToast('Please describe your feedback.', 'warning'); return; }
  var btn = document.getElementById('feedbackSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    var teacherName = (window.teacherData && window.teacherData.name) || 'Teacher';
    var teacherUid = (window.currentTeacher && window.currentTeacher.uid) || '';
    var classCode = (window.teacherData && window.teacherData.classCode) || '';
    await window.fbAddDoc(window.fbCollection(window.fbDb, 'feedback'), {
      type: type, message: message, page: page,
      userName: teacherName, userRole: 'teacher', userId: teacherUid,
      classCode: classCode, status: 'new',
      createdAt: window.fbTimestamp.now()
    });
    odaToast('Thanks! Your feedback has been submitted.', 'success');
    closeFeedbackModal();
  } catch (e) { console.error(e); odaToast('Error submitting feedback.', 'error'); }
  btn.disabled = false; btn.textContent = 'Submit';
}
window.submitFeedback = submitFeedback;

console.log('[ODA] Teacher AI & analytics module loaded');

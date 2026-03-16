/**
 * ODA Hub - Teacher Assignments Module
 * Handles assignment creation, filtering, rendering, grading, and templates.
 * Dependencies: teacher.js (shared state & helpers), teacher-roster.js, oda-core.js
 */

// ============================================
// Create Assignment Modal
// ============================================

var createType = 'tool';
var templates = [];

/** Open the create assignment modal, optionally pre-selecting a student */
function openCreateAssignment(preSelectStudentId) {
  createType = 'tool';
  var tabs = document.querySelectorAll('.type-tab');
  tabs.forEach(function (t, i) { t.classList.toggle('active', i === 0); });
  var panels = document.querySelectorAll('.type-panel');
  panels.forEach(function (p) { p.classList.remove('show'); });
  document.getElementById('panel-tool').classList.add('show');
  document.getElementById('createToolSelect').value = '';
  document.querySelectorAll('.tool-pick').forEach(function (t) { t.classList.remove('selected'); });
  document.getElementById('createAssignTitle').value = '';
  document.getElementById('createAssignInstructions').value = '';
  document.getElementById('createAssignLink').value = '';
  document.getElementById('createAssignFile').value = '';
  document.getElementById('createAssignGrading').value = 'teacher';
  document.getElementById('createDueDate').value = '';
  document.getElementById('saveAsTemplate').checked = false;
  var bs = document.getElementById('createBottomSection'); if (bs) bs.style.display = '';
  var ft = document.getElementById('btnCreateAssign'); if (ft) ft.parentElement.style.display = '';
  populateClassFilters();
  renderStudentPicker();
  if (preSelectStudentId) {
    setTimeout(function () {
      var checks = document.querySelectorAll('.sp-check');
      checks.forEach(function (c) { c.checked = (c.value === preSelectStudentId); });
    }, 50);
  }
  var m = document.getElementById('createAssignModal'); m.classList.add('show');
  if (window.odaTrapFocus) _odaFocusTraps.createAssignModal = window.odaTrapFocus(m);
}
window.openCreateAssignment = openCreateAssignment;

function closeCreateAssignment() {
  document.getElementById('createAssignModal').classList.remove('show');
  if (_odaFocusTraps.createAssignModal) { _odaFocusTraps.createAssignModal(); _odaFocusTraps.createAssignModal = null; }
}
window.closeCreateAssignment = closeCreateAssignment;

/** Switch between Tool / Assignment / Templates tabs in create modal */
function switchCreateTab(type) {
  createType = type === 'templates' ? 'tool' : type;
  var types = ['tool', 'assignment', 'templates'];
  var tabs = document.querySelectorAll('.type-tab');
  tabs.forEach(function (t, i) { t.classList.toggle('active', types[i] === type); });
  types.forEach(function (tp) {
    var p = document.getElementById('panel-' + tp);
    if (p) p.classList.toggle('show', tp === type);
  });
  var isTmpl = type === 'templates';
  var el = document.getElementById('createBottomSection'); if (el) el.style.display = isTmpl ? 'none' : '';
  var ft = document.getElementById('btnCreateAssign'); if (ft) ft.parentElement.style.display = isTmpl ? 'none' : '';
  if (type === 'templates') loadTemplates();
}
window.switchCreateTab = switchCreateTab;

/** Select a tool in the create assignment modal */
function pickTool(el) {
  document.querySelectorAll('.tool-pick').forEach(function (t) { t.classList.remove('selected'); });
  el.classList.add('selected');
  document.getElementById('createToolSelect').value = el.getAttribute('data-val');
}
window.pickTool = pickTool;

// ============================================
// Student Picker & Class Filters
// ============================================

/** Populate class filter dropdowns throughout the UI */
function populateClassFilters() {
  var classes = window.teacherData && window.teacherData.classes
    ? window.teacherData.classes.filter(function (c) { return c !== 'All Students'; })
    : [];
  var fc = document.getElementById('filterClass');
  if (fc) {
    var val = fc.value;
    fc.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(function (c) { fc.innerHTML += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    fc.value = val;
  }
  var sp = document.getElementById('spClassFilter');
  if (sp) {
    sp.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(function (c) { sp.innerHTML += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
  }
}

/** Render the student picker checkboxes in the create modal */
function renderStudentPicker() {
  var el = document.getElementById('studentPicker');
  if (!el) return;
  var classFilter = document.getElementById('spClassFilter');
  var cf = classFilter ? classFilter.value : '';
  var filtered = cf ? students.filter(function (s) { return s.className === cf; }) : students;
  filtered.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  if (!filtered.length) { el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:14px">No students found</div>'; return; }
  var h = '';
  filtered.forEach(function (s) {
    h += '<label class="sp-item"><input type="checkbox" value="' + s.id + '" class="sp-check">';
    h += '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.name) + '</span>';
    if (s.className) h += '<span class="sp-class">' + esc(s.className) + '</span>';
    h += '</label>';
  });
  el.innerHTML = h;
}
window.renderStudentPicker = renderStudentPicker;

function spSelectAll() { document.querySelectorAll('.sp-check').forEach(function (c) { c.checked = true; }); }
window.spSelectAll = spSelectAll;

function spSelectNone() { document.querySelectorAll('.sp-check').forEach(function (c) { c.checked = false; }); }
window.spSelectNone = spSelectNone;

function getSelectedStudentIds() {
  var ids = [];
  document.querySelectorAll('.sp-check:checked').forEach(function (c) { ids.push(c.value); });
  return ids;
}

/** Read a file as base64 data URI */
function readFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

// ============================================
// Submit Assignment
// ============================================

/** Create assignments for selected students */
async function submitCreateAssignment() {
  var studentIds = getSelectedStudentIds();
  if (!studentIds.length) { odaToast('Select at least one student', 'warning'); return; }
  var dueDate = document.getElementById('createDueDate').value || null;
  var assignData = {};

  if (createType === 'tool') {
    var tool = document.getElementById('createToolSelect').value;
    if (!tool) { odaToast('Select a tool', 'warning'); return; }
    var t = ASSIGN_TYPES[tool] || { title: tool };
    var isAutoGrade = tool.startsWith('spelling') || tool.startsWith('vocab');
    assignData = { type: 'tool', toolType: tool, title: t.title || tool, instructions: '', gradingType: isAutoGrade ? 'auto' : 'completion', fileData: null, linkUrl: null };
  } else if (createType === 'assignment') {
    var aTitle = document.getElementById('createAssignTitle').value.trim();
    if (!aTitle) { odaToast('Enter a title', 'warning'); return; }
    var aInstructions = document.getElementById('createAssignInstructions').value.trim();
    if (!aInstructions) { odaToast('Enter instructions so students know what to do', 'warning'); return; }
    var aLink = document.getElementById('createAssignLink').value.trim() || null;
    var aGrading = document.getElementById('createAssignGrading').value;
    var fileInput = document.getElementById('createAssignFile');
    var fileUrl = null;
    if (fileInput.files.length > 0) {
      var file = fileInput.files[0];
      if (file.size > 10 * 1024 * 1024) { odaToast('File must be under 10MB', 'warning'); return; }
      showLoading('Uploading file...');
      try {
        var ts = Date.now();
        var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var path = 'assignments/' + window.currentTeacher.uid + '/' + ts + '_' + safeName;
        var sRef = window.fbStorageRef(window.fbStorage, path);
        await window.fbUploadBytes(sRef, file);
        fileUrl = await window.fbGetDownloadURL(sRef);
      } catch (e) { hideLoading(); console.error(e); odaToast('File upload failed: ' + e.message, 'error'); return; }
    }
    assignData = { type: 'assignment', toolType: null, title: aTitle, instructions: aInstructions, gradingType: aGrading, fileData: null, fileUrl: fileUrl, linkUrl: aLink };
  }

  // Save as template if checked
  if (document.getElementById('saveAsTemplate').checked) {
    try {
      await window.fbAddDoc(window.fbCollection(window.fbDb, 'templates'), {
        teacherId: window.currentTeacher.uid, createType: createType,
        type: assignData.type, toolType: assignData.toolType, title: assignData.title,
        instructions: assignData.instructions, gradingType: assignData.gradingType,
        linkUrl: assignData.linkUrl, createdAt: new Date().toISOString()
      });
    } catch (e) { console.error('Template save error:', e); }
  }

  var td = window.teacherData || {};
  showLoading('Creating ' + studentIds.length + ' assignment(s)...');
  try {
    var _assignPromises = studentIds.map(function (sid) {
      var student = students.find(function (s) { return s.id === sid; });
      return window.fbAddDoc(window.fbCollection(window.fbDb, 'assignments'), {
        studentId: sid, teacherId: window.currentTeacher.uid,
        type: assignData.type, toolType: assignData.toolType, title: assignData.title,
        instructions: assignData.instructions || '', status: 'pending', gradingType: assignData.gradingType,
        assignedAt: new Date().toISOString(), dueDate: dueDate,
        submittedAt: null, completedAt: null, gradedAt: null,
        score: null, feedback: null, aiSuggestedScore: null, aiSuggestedFeedback: null,
        school: td.school || '', district: td.district || '', program: td.program || '',
        grade: student ? student.grade : '',
        fileData: assignData.fileData || null, fileUrl: assignData.fileUrl || null, linkUrl: assignData.linkUrl, studentResponse: null, templateId: null
      });
    });
    await Promise.all(_assignPromises);
    hideLoading();
    closeCreateAssignment();
    odaToast(studentIds.length + ' assignment(s) created', 'success');
    await loadStudents();
    renderAssignmentsList();
    if (selectedStudent) renderProfileAssignments();
  } catch (e) { hideLoading(); console.error(e); odaToast('Error creating assignments: ' + e.message, 'error'); }
}
window.submitCreateAssignment = submitCreateAssignment;

// ============================================
// Assignment List (Filter + Render)
// ============================================

function filterAssignments() { window._assignShowAll = false; renderAssignmentsList(); }
window.filterAssignments = filterAssignments;

/** Render the grouped assignments list with filters applied */
function renderAssignmentsList() {
  var el = document.getElementById('assignmentsList');
  if (!el) return;
  var list = allAssignments.slice();
  var classFilter = document.getElementById('filterClass');
  var statusFilter = document.getElementById('filterStatus');
  var typeFilter = document.getElementById('filterType');
  var searchInput = document.getElementById('assignSearch');
  var cf = classFilter ? classFilter.value : '';
  var sf = statusFilter ? statusFilter.value : '';
  var tf = typeFilter ? typeFilter.value : '';
  var search = searchInput ? (searchInput.value || '').toLowerCase() : '';

  if (cf) {
    var classStudentIds = students.filter(function (s) { return s.className === cf; }).map(function (s) { return s.id; });
    list = list.filter(function (a) { return classStudentIds.indexOf(a.studentId) >= 0; });
  }
  if (sf) { list = list.filter(function (a) { return a.status === sf; }); }
  if (tf) {
    if (tf === 'tool') list = list.filter(function (a) { return a.type === 'tool' || ASSIGN_TYPES[a.type]; });
    else if (tf === 'assignment') list = list.filter(function (a) { return a.type === 'assignment' || a.type === 'worksheet' || a.type === 'link' || a.type === 'custom'; });
    else list = list.filter(function (a) { return a.type === tf; });
  }
  if (search) {
    list = list.filter(function (a) {
      var student = students.find(function (s) { return s.id === a.studentId; });
      var studentName = student ? (student.name || '').toLowerCase() : '';
      var title = (a.title || a.type || '').toLowerCase();
      return title.indexOf(search) >= 0 || studentName.indexOf(search) >= 0;
    });
  }

  list.sort(function (a, b) { return (b.assignedAt || '').localeCompare(a.assignedAt || ''); });

  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><span class="emoji">&#x1F4CB;</span><p>No assignments match your filters.</p></div>';
    document.getElementById('bulkBar').classList.remove('show');
    return;
  }

  // Group assignments by title + type + dueDate
  var groups = {};
  var groupOrder = [];
  list.forEach(function (a) {
    var key = (a.title || a.type) + '||' + a.type + '||' + (a.dueDate || 'none');
    if (!groups[key]) {
      groups[key] = { title: a.title || a.type, type: a.type, toolType: a.toolType, dueDate: a.dueDate, emoji: getAssignEmoji(a), items: [] };
      groupOrder.push(key);
    }
    groups[key].items.push(a);
  });

  var today = new Date().toISOString().split('T')[0];
  var h = '';
  var ASSIGN_PAGE_SIZE = 20;
  var visibleGroups = window._assignShowAll ? groupOrder.length : Math.min(groupOrder.length, ASSIGN_PAGE_SIZE);
  groupOrder.slice(0, visibleGroups).forEach(function (key, gi) {
    var g = groups[key];
    var counts = { pending: 0, submitted: 0, graded: 0, completed: 0, returned: 0 };
    g.items.forEach(function (a) { counts[a.status] = (counts[a.status] || 0) + 1; });
    var hasReview = counts.submitted > 0;
    var overdue = counts.pending > 0 && g.dueDate && g.dueDate < today;

    h += '<div class="assign-group' + (hasReview ? ' has-review' : '') + '" id="ag-' + gi + '">';
    h += '<div class="ag-header" role="button" tabindex="0" onclick="toggleAssignGroup(' + gi + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleAssignGroup(' + gi + ')}">';
    h += '<span class="ag-emoji">' + g.emoji + '</span>';
    h += '<div class="ag-info">';
    h += '<div class="ag-title">' + esc(g.title) + '</div>';
    h += '<div class="ag-stats">';
    if (counts.submitted > 0) h += '<span class="ag-pill ag-pill-review">' + counts.submitted + ' to review</span>';
    if (counts.pending > 0) h += '<span class="ag-pill ag-pill-pending">' + counts.pending + ' pending</span>';
    if (counts.returned > 0) h += '<span class="ag-pill ag-pill-returned">' + counts.returned + ' returned</span>';
    if (counts.graded > 0) h += '<span class="ag-pill ag-pill-graded">' + counts.graded + ' graded</span>';
    if (counts.completed > 0) h += '<span class="ag-pill ag-pill-done">' + counts.completed + ' done</span>';
    h += '</div></div>';
    h += '<div class="ag-count">';
    if (g.dueDate) h += '<span class="ag-due' + (overdue ? ' overdue' : '') + '">Due ' + g.dueDate + (overdue ? ' \u26A0\uFE0F' : '') + '</span>';
    h += '<span>' + g.items.length + ' student' + (g.items.length !== 1 ? 's' : '') + '</span>';
    h += '<span class="ag-chevron">\u25BC</span>';
    h += '</div></div>';

    h += '<div class="ag-body">';
    h += '<div class="ag-bulk"><label><input type="checkbox" class="ag-bulk-check" onclick="event.stopPropagation();toggleGroupBulk(' + gi + ')" style="accent-color:var(--accent);width:14px;height:14px;cursor:pointer"> Select all</label></div>';
    var statusOrder = { submitted: 0, pending: 1, returned: 2, graded: 3, completed: 4 };
    var sorted = g.items.slice().sort(function (a, b) { return (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9); });
    sorted.forEach(function (a) {
      var student = students.find(function (s) { return s.id === a.studentId; });
      var studentName = student ? student.name : 'Unknown';
      h += '<div class="ag-student" role="button" tabindex="0" onclick="openGradePanel(\'' + a.id + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openGradePanel(\'' + a.id + '\')}">';
      h += '<input type="checkbox" class="bulk-check" value="' + a.id + '" onclick="event.stopPropagation();updateBulkBar()" style="accent-color:var(--accent);width:14px;height:14px;cursor:pointer;flex-shrink:0">';
      h += '<span class="ag-student-name">' + esc(studentName) + '</span>';
      if (a.score !== null && a.score !== undefined) h += '<span class="ag-student-score">' + a.score + '%</span>';
      h += '<span class="ac-status ' + statusClass(a.status) + '" style="flex-shrink:0">' + statusLabel(a.status) + '</span>';
      h += '</div>';
    });
    h += '</div></div>';
  });
  if (groupOrder.length > visibleGroups) {
    h += '<div style="text-align:center;padding:14px"><button class="btn btn-outline" onclick="window._assignShowAll=true;renderAssignmentsList()">Show All ' + groupOrder.length + ' Groups</button></div>';
  }
  el.innerHTML = h;
  document.getElementById('bulkBar').classList.remove('show');
}

function toggleAssignGroup(gi) {
  var el = document.getElementById('ag-' + gi);
  if (el) el.classList.toggle('open');
}
window.toggleAssignGroup = toggleAssignGroup;

function toggleGroupBulk(gi) {
  var el = document.getElementById('ag-' + gi);
  if (!el) return;
  var master = el.querySelector('.ag-bulk-check');
  var checks = el.querySelectorAll('.bulk-check');
  checks.forEach(function (c) { c.checked = master.checked; });
  updateBulkBar();
}
window.toggleGroupBulk = toggleGroupBulk;

/** Get the emoji for an assignment based on its type */
function getAssignEmoji(a) {
  if (a.toolType && ASSIGN_TYPES[a.toolType]) return ASSIGN_TYPES[a.toolType].emoji;
  if (ASSIGN_TYPES[a.type]) return ASSIGN_TYPES[a.type].emoji;
  var map = { tool: '\u{1F6E0}\uFE0F', assignment: '\u{1F4CB}', worksheet: '\u{1F4CB}', link: '\u{1F4CB}', custom: '\u{1F4CB}' };
  return map[a.type] || '\u{1F4CB}';
}

// ============================================
// Grade Panel
// ============================================

var gradingAssignment = null;

/** Render pitch challenge work for the grade panel */
function renderPitchWork(p) {
  var h = '<div class="grade-work">';
  h += '<div class="gw-biz-title gw-biz-accent">\u{1F3A4} ' + esc(p.businessName) + '</div>';
  h += '<div class="gw-value"><div class="gw-label">Problem</div>' + esc(stripMd(p.problem || '')) + '</div>';
  h += '<div class="gw-value"><div class="gw-label">Business Description</div>' + esc(stripMd(p.businessDesc || '')) + '</div>';
  if (p.skills && p.skills.length) h += '<div class="gw-value"><div class="gw-label">Skills</div>' + esc(p.skills.join(', ')) + '</div>';
  if (p.customers && p.customers.length) h += '<div class="gw-value"><div class="gw-label">Customers</div>' + esc(p.customers.join(', ')) + '</div>';
  if (p.advantages && p.advantages.length) h += '<div class="gw-value"><div class="gw-label">Advantages</div>' + esc(stripMd(p.advantages.join(' \u2022 '))) + '</div>';
  h += '<div class="gw-section"><div class="gw-label">Full Pitch</div><div class="gw-pitch">';
  if (p.hook) h += esc(stripMd(p.hook)) + '<br><br>';
  h += 'My business is called <strong>' + esc(p.businessName) + '</strong>. ' + esc(stripMd(p.businessDesc || '')) + '<br><br>';
  if (p.advantages) { p.advantages.forEach(function (av) { h += '\u{1F3C6} ' + esc(stripMd(av)) + '<br>'; }); }
  if (p.callToAction) h += '<br><strong>' + esc(stripMd(p.callToAction)) + '</strong>';
  h += '</div></div>';
  if (p.videoUrl) h += '<div class="gw-section"><div class="gw-label">\u{1F3AC} Video Recording</div><div class="gw-media"><video controls playsinline class="gw-video" src="' + esc(p.videoUrl) + '"></video></div></div>';
  if (p.aiCoachFeedback) h += '<div class="gw-section"><div class="gw-label">\u{1F9E0} AI Coach Feedback</div><div class="gw-ai-box gw-ai-coach">' + esc(stripMd(p.aiCoachFeedback)) + '</div></div>';
  if (p.polishedPitch) h += '<div class="gw-section"><div class="gw-label">\u2728 AI-Polished Pitch</div><div class="gw-ai-box gw-ai-polish">' + esc(stripMd(p.polishedPitch)) + '</div></div>';
  if (p.score) h += '<div class="gw-section"><div class="gw-label">\u2B50 Scorecard</div><div class="gw-scorecard">' + (p.score.total || 0) + '/' + (p.score.max || 6) + ' Stars</div></div>';
  h += '</div>';
  return h;
}

/** Render elevator pitch work for the grade panel */
function renderElevatorWork(p) {
  var ans = p.answers;
  var h = '<div class="grade-work">';
  h += '<div class="gw-biz-title gw-biz-accent2">\u{1F3A4} ' + esc(ans.name || 'Student') + '\'s Elevator Pitch</div>';
  h += '<div class="gw-subtitle">' + esc(ans.grade ? 'Grade ' + ans.grade : '') + ' ' + esc(ans.school ? ' \u2022 ' + ans.school : '') + ' ' + esc(ans.from ? ' \u2022 From ' + ans.from : '') + '</div>';
  h += '<div class="gw-section"><div class="gw-label">\u{1F464} About Me</div>';
  if (ans.age) h += '<div class="gw-value"><strong>Age:</strong> ' + esc(ans.age) + '</div>';
  if (ans.dream) h += '<div class="gw-value gw-gap"><strong>Dream Job:</strong> ' + esc(ans.dream) + '</div>';
  if (ans.why) h += '<div class="gw-value gw-gap"><strong>Why:</strong> ' + esc(ans.why) + '</div>';
  if (ans.hobby) h += '<div class="gw-value gw-gap"><strong>Favorite Hobby:</strong> ' + esc(ans.hobby) + '</div>';
  if (ans.fact) h += '<div class="gw-value gw-gap"><strong>Fun Fact:</strong> ' + esc(ans.fact) + '</div>';
  if (ans.remember) h += '<div class="gw-value gw-gap"><strong>Remember Me For:</strong> ' + esc(ans.remember) + '</div>';
  h += '</div>';
  if (p.pitchText) {
    h += '<div class="gw-section"><div class="gw-label">\u{1F4AC} Generated Pitch</div>';
    h += '<div class="gw-ai-box gw-ai-pitch">' + esc(p.pitchText) + '</div></div>';
  }
  if (p.videoUrl) {
    h += '<div class="gw-section"><div class="gw-label">\u{1F3AC} Video Recording</div>';
    h += '<div class="gw-media"><video controls playsinline class="gw-video" src="' + esc(p.videoUrl) + '"></video></div></div>';
  }
  if (p.aiSummary) {
    h += '<div class="gw-section"><div class="gw-label">\u2728 AI Personalized Summary</div>';
    h += '<div class="gw-ai-box gw-ai-polish">' + esc(p.aiSummary) + '</div></div>';
  }
  h += '</div>';
  return h;
}

/** Render file/image attachments for the grade panel */
function renderFileAttachments(a) {
  var h = '';
  if (a.fileUrl) {
    if (a.fileUrl.match(/\.(png|jpg|jpeg|gif|webp)/i)) {
      h += '<div class="grade-work gw-center"><img src="' + esc(a.fileUrl) + '" class="gw-img"></div>';
    } else {
      h += '<div class="grade-work"><iframe src="' + esc(a.fileUrl) + '" class="gw-iframe"></iframe><div class="gw-open-link"><a href="' + esc(a.fileUrl) + '" target="_blank" class="gw-ext-link">Open in new tab \u2197\uFE0F</a></div></div>';
    }
  } else if (a.fileData) {
    if (a.fileData.startsWith('data:image')) {
      h += '<div class="grade-work gw-center"><img src="' + esc(a.fileData) + '" class="gw-img"></div>';
    } else {
      var pdfUrl = dataUriToBlobUrl(a.id, a.fileData);
      h += '<div class="grade-work"><iframe src="' + pdfUrl + '" class="gw-iframe"></iframe><div class="gw-open-link"><a href="#" onclick="openFileBlob(\'' + a.id + '\');return false" class="gw-ext-link">Open in new tab \u2197\uFE0F</a></div></div>';
    }
  }
  return h;
}

/** Render the grading form (score, feedback, buttons) */
function renderGradingForm(a) {
  var h = '<div class="grade-actions">';
  h += '<div class="ga-title">Grade This Assignment</div>';
  h += '<div class="grade-score-row">';
  h += '<div><div class="gw-field-label">Score (0-100)</div>';
  h += '<input type="number" class="score-input" id="gradeScore" min="0" max="100" value="' + (a.aiSuggestedScore || '') + '"></div>';
  h += '<button class="btn btn-blue btn-sm" onclick="aiSuggestGrade()" id="aiGradeBtn">&#x1F916; AI Suggest</button>';
  h += '</div>';
  h += '<div class="grade-feedback-area"><label>Feedback <button class="btn btn-outline btn-sm gw-ai-write-btn" onclick="aiWriteFeedback()" id="aiFeedbackBtn">&#x1F916; AI Write</button></label>';
  h += '<textarea id="gradeFeedback">' + (a.aiSuggestedFeedback || a.feedback || '') + '</textarea></div>';
  h += '<div class="grade-btn-row">';
  h += '<button class="btn btn-accent" onclick="gradeAssignment()">&#x2705; Grade</button>';
  h += '<button class="btn btn-gold" onclick="returnForRevision()">&#x1F504; Return for Revision</button>';
  h += '</div></div>';
  return h;
}

/** Open the grade/review panel for an assignment */
function openGradePanel(assignId) {
  gradingAssignment = allAssignments.find(function (a) { return a.id === assignId; });
  if (!gradingAssignment) return;

  // Redirect tools to their own grading views
  if (gradingAssignment.toolType === 'pitch-challenge') { window.open('pitch.html?grade=' + assignId, '_blank'); return; }
  if (gradingAssignment.toolType === 'lemonade-day') { window.open('lemonade.html?grade=' + assignId, '_blank'); return; }
  if (gradingAssignment.toolType === 'elevator-pitch') { window.open('elevator.html?grade=' + assignId, '_blank'); return; }

  var student = students.find(function (s) { return s.id === gradingAssignment.studentId; });
  var a = gradingAssignment;
  var el = document.getElementById('gradePanelContent');

  // Header
  var h = '<div class="grade-header">';
  h += '<h2>' + getAssignEmoji(a) + ' ' + esc(a.title) + '</h2>';
  h += '<div class="grade-meta">';
  h += '<strong>' + esc(student ? student.name : 'Unknown') + '</strong>';
  h += ' &bull; ' + (a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : '');
  h += ' &bull; <span class="ac-status ' + statusClass(a.status) + '">' + statusLabel(a.status) + '</span>';
  if (a.score !== null && a.score !== undefined) h += ' &bull; <span class="ac-score">' + a.score + '%</span>';
  h += '</div>';
  if (a.instructions) h += '<div class="grade-instructions"><strong>Instructions:</strong> ' + esc(a.instructions) + '</div>';
  if (a.feedback) h += '<div class="grade-instructions gw-prev-feedback"><strong>Previous Feedback:</strong> ' + esc(a.feedback) + '</div>';
  h += '</div>';

  // Student work — delegate to focused helpers
  if (a.studentResponse) {
    var pitchParsed = null;
    try { pitchParsed = JSON.parse(a.studentResponse); } catch (e) { }
    if (pitchParsed && pitchParsed.businessName) {
      h += renderPitchWork(pitchParsed);
    } else if (pitchParsed && pitchParsed.answers) {
      h += renderElevatorWork(pitchParsed);
    } else {
      h += '<div class="grade-work" style="white-space:pre-wrap">' + esc(a.studentResponse) + '</div>';
    }
  }

  // File attachments
  if (a.fileUrl || a.fileData) h += renderFileAttachments(a);

  if (a.linkUrl) {
    h += '<div style="margin-bottom:18px"><a href="' + esc(a.linkUrl) + '" target="_blank" class="btn btn-blue btn-sm">Open Link &#x1F517;</a></div>';
  }

  // Grading section
  if (a.status === 'submitted' || a.status === 'pending' || a.status === 'returned') {
    h += renderGradingForm(a);
  }

  h += '<div class="grade-footer">';
  if (a.status === 'pending') h += '<button class="btn btn-accent btn-sm" onclick="markCompleteFromPanel()">Mark Complete</button>';
  else h += '<div></div>';
  h += '<button class="btn btn-red btn-sm" onclick="deleteFromPanel()">Delete</button>';
  h += '</div>';

  el.innerHTML = h;
  var gm = document.getElementById('gradePanel'); gm.classList.add('show');
  if (window.odaTrapFocus) _odaFocusTraps.gradePanel = window.odaTrapFocus(gm);
}
window.openGradePanel = openGradePanel;

function closeGradePanel() {
  document.getElementById('gradePanel').classList.remove('show');
  gradingAssignment = null;
  if (_odaFocusTraps.gradePanel) { _odaFocusTraps.gradePanel(); _odaFocusTraps.gradePanel = null; }
}
window.closeGradePanel = closeGradePanel;

function openFileBlob(assignId) {
  var a = allAssignments.find(function (x) { return x.id === assignId; });
  if (!a || !a.fileData) return;
  window.open(dataUriToBlobUrl(a.id, a.fileData), '_blank');
}
window.openFileBlob = openFileBlob;

// ============================================
// Grading Actions
// ============================================

/** Grade an assignment with score and feedback */
async function gradeAssignment() {
  if (!gradingAssignment) return;
  var score = parseInt(document.getElementById('gradeScore').value);
  var feedback = document.getElementById('gradeFeedback').value.trim();
  if (isNaN(score) || score < 0 || score > 100) { odaToast('Enter a valid score (0-100)', 'warning'); return; }
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'assignments', gradingAssignment.id), { status: 'graded', score: score, feedback: feedback, gradedAt: new Date().toISOString() });
    closeGradePanel();
    odaToast('Assignment graded: ' + score + '%', 'success');
    await loadStudents();
    renderAssignmentsList();
    if (selectedStudent) renderProfileAssignments();
  } catch (e) { console.error(e); odaToast('Error grading', 'error'); }
}
window.gradeAssignment = gradeAssignment;

/** Return an assignment to the student for revision */
async function returnForRevision() {
  if (!gradingAssignment) return;
  var feedback = document.getElementById('gradeFeedback').value.trim();
  if (!feedback) { odaToast('Please enter feedback for the student', 'warning'); return; }
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'assignments', gradingAssignment.id), { status: 'returned', feedback: feedback });
    closeGradePanel();
    await loadStudents();
    renderAssignmentsList();
    if (selectedStudent) renderProfileAssignments();
  } catch (e) { console.error(e); odaToast('Error: ' + e.message, 'error'); }
}
window.returnForRevision = returnForRevision;

/** Mark assignment complete from grade panel */
async function markCompleteFromPanel() {
  if (!gradingAssignment) return;
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'assignments', gradingAssignment.id), { status: 'completed', completedAt: new Date().toISOString() });
    closeGradePanel();
    await loadStudents();
    renderAssignmentsList();
    if (selectedStudent) renderProfileAssignments();
  } catch (e) { console.error(e); odaToast('Error: ' + e.message, 'error'); }
}
window.markCompleteFromPanel = markCompleteFromPanel;

/** Delete assignment from grade panel */
async function deleteFromPanel() {
  if (!gradingAssignment || !confirm('Delete this assignment?')) return;
  try {
    await window.fbDeleteDoc(window.fbDoc(window.fbDb, 'assignments', gradingAssignment.id));
    closeGradePanel();
    await loadStudents();
    renderAssignmentsList();
    if (selectedStudent) renderProfileAssignments();
  } catch (e) { console.error(e); odaToast('Error: ' + e.message, 'error'); }
}
window.deleteFromPanel = deleteFromPanel;

/** Use AI to suggest a grade and feedback */
async function aiSuggestGrade() {
  if (!gradingAssignment) return;
  var a = gradingAssignment;
  var btn = document.getElementById('aiGradeBtn');
  btn.textContent = 'Thinking...'; btn.disabled = true;
  var prompt = 'Grade this student submission on a scale of 0-100. The assignment was: "' +
    (a.title || '') + '" with instructions: "' + (a.instructions || 'None') + '". The student submitted: "' +
    (a.studentResponse || 'No text response') + '". Respond with ONLY a JSON object: {"score": number, "feedback": "string"}';
  try {
    var text = await odaAI(prompt);
    var match = text.match(/\{[\s\S]*\}/);
    if (match) {
      var parsed = JSON.parse(match[0]);
      document.getElementById('gradeScore').value = parsed.score || '';
      document.getElementById('gradeFeedback').value = parsed.feedback || '';
      await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'assignments', a.id), { aiSuggestedScore: parsed.score || null, aiSuggestedFeedback: parsed.feedback || null });
    } else { odaToast('AI response was not in expected format', 'error'); }
  } catch (e) { console.error(e); odaToast('AI grading failed: ' + e.message, 'error'); }
  btn.textContent = '\u{1F916} AI Suggest'; btn.disabled = false;
}
window.aiSuggestGrade = aiSuggestGrade;

// ============================================
// Templates
// ============================================

var toolLabels = {
  'spelling-k2': 'Spelling Bee K-2', 'spelling-34': 'Spelling Bee 3-4', 'spelling-58': 'Spelling Bee 5-8',
  'vocab-k2': 'Vocab K-2', 'vocab-34': 'Vocab 3-4', 'vocab-58': 'Vocab 5-8',
  'pitch-challenge': 'Pitch Challenge', 'elevator-pitch': 'Elevator Pitch', 'lemonade-day': 'Lemonade Day'
};

/** Load saved assignment templates */
async function loadTemplates() {
  var list = document.getElementById('templateList');
  if (!list) return;
  try {
    var q = window.fbQuery(window.fbCollection(window.fbDb, 'templates'), window.fbWhere('teacherId', '==', window.currentTeacher.uid));
    var snap = await window.fbGetDocs(q);
    templates = []; snap.forEach(function (d) { templates.push({ id: d.id, ...d.data() }); });
    if (!templates.length) {
      list.innerHTML = '<div class="tmpl-empty"><div class="tmpl-empty-icon">\u{1F4C1}</div><div class="tmpl-empty-text">No templates yet.<br>Create an assignment and check "Save as Template" to save one here.</div></div>';
      return;
    }
    var h = '';
    templates.forEach(function (t) {
      var ct = t.createType || t.type || 'tool';
      var isTool = ct === 'tool';
      var icon = isTool ? '\u{1F6E0}\uFE0F' : '\u{1F4CB}';
      var tagClass = isTool ? 'tag-tool' : 'tag-assign';
      var tagLabel = isTool ? (toolLabels[t.toolType] || t.toolType || 'Tool') : 'Assignment';
      var meta = t.gradingType === 'completion' ? 'Completion' : 'Teacher Graded';
      var date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      h += '<div class="tmpl-card" onclick="loadTemplate(\'' + t.id + '\')">';
      h += '<div class="tmpl-card-icon">' + icon + '</div>';
      h += '<div class="tmpl-card-info">';
      h += '<div class="tmpl-card-title">' + esc(t.title || tagLabel) + '</div>';
      h += '<div class="tmpl-card-meta"><span class="tag ' + tagClass + '">' + tagLabel + '</span>';
      if (!isTool) h += '<span>' + meta + '</span>';
      if (date) h += '<span>' + date + '</span>';
      h += '</div></div>';
      h += '<button class="tmpl-card-del" onclick="event.stopPropagation();deleteTemplate(\'' + t.id + '\')" title="Delete template">\u{1F5D1}</button>';
      h += '</div>';
    });
    list.innerHTML = h;
  } catch (e) { console.error(e); list.innerHTML = '<div class="tmpl-empty"><div class="tmpl-empty-text">Failed to load templates.</div></div>'; }
}

/** Delete a saved template */
async function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  try {
    await window.fbDeleteDoc(window.fbDoc(window.fbDb, 'templates', id));
    templates = templates.filter(function (t) { return t.id !== id; });
    loadTemplates();
  } catch (e) { console.error(e); odaToast('Failed to delete template', 'error'); }
}
window.deleteTemplate = deleteTemplate;

/** Load a template into the create assignment form */
function loadTemplate(id) {
  var t = templates.find(function (x) { return x.id === id; });
  if (!t) return;
  var ct = t.createType || t.type || 'tool';
  if (ct === 'worksheet' || ct === 'link' || ct === 'custom') ct = 'assignment';
  switchCreateTab(ct);
  if (ct === 'tool' && t.toolType) document.getElementById('createToolSelect').value = t.toolType;
  if (ct === 'assignment') {
    document.getElementById('createAssignTitle').value = t.title || '';
    document.getElementById('createAssignInstructions').value = t.instructions || '';
    document.getElementById('createAssignLink').value = t.linkUrl || '';
    document.getElementById('createAssignGrading').value = t.gradingType || 'teacher';
  }
  odaToast('Template loaded! Set due date and select students.', 'info');
}
window.loadTemplate = loadTemplate;

// Cross-module exports
window.renderAssignmentsList = renderAssignmentsList;
window.populateClassFilters = populateClassFilters;

console.log('[ODA] Teacher assignments module loaded');

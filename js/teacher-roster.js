/**
 * ODA Hub - Teacher Roster Module
 * Handles classes, student CRUD, profiles, and student work display.
 * Dependencies: teacher.js (shared state & helpers), oda-core.js
 */

// ============================================
// Classes
// ============================================

/** Load and render class tabs from teacher data */
function loadClasses() {
  var classes = window.teacherData && window.teacherData.classes
    ? window.teacherData.classes.filter(function (c) { return c !== 'All Students'; })
    : [];
  renderClassTabs(classes);
}

/** Render the class tab bar */
function renderClassTabs(classes) {
  var el = document.getElementById('classTabs');
  var h = '<button class="class-tab' + (currentClass === 'All Students' ? ' active' : '') + '" onclick="filterClass(\'All Students\')">All Students</button>';
  for (var i = 0; i < classes.length; i++) {
    h += '<button class="class-tab' + (classes[i] === currentClass ? ' active' : '') + '" onclick="filterClass(\'' + esc(classes[i]) + '\')">';
    h += esc(classes[i]);
    h += ' <span onclick="event.stopPropagation();deleteClass(\'' + esc(classes[i]) + '\')" style="margin-left:4px;opacity:.5;cursor:pointer">&times;</span>';
    h += '</button>';
  }
  el.innerHTML = h;
}

/** Filter student list by class name */
function filterClass(name) {
  currentClass = name;
  loadClasses();
  renderStudentList();
}
window.filterClass = filterClass;

// ============================================
// Class Modal
// ============================================

/** Open the new-class modal with focus trap */
function openClassModal() {
  var m = document.getElementById('classModal');
  m.classList.add('show');
  if (window.odaTrapFocus) _odaFocusTraps.classModal = window.odaTrapFocus(m);
}
/** Close the new-class modal and clear input */
function closeClassModal() {
  document.getElementById('classModal').classList.remove('show');
  document.getElementById('className').value = '';
  if (_odaFocusTraps.classModal) { _odaFocusTraps.classModal(); _odaFocusTraps.classModal = null; }
}
window.openClassModal = openClassModal;
window.closeClassModal = closeClassModal;

// ============================================
// Add Student Modal
// ============================================

/** Open the add-student modal, pre-selecting current class in dropdown */
function openAddStudentModal() {
  var sel = document.getElementById('addStudentClass');
  var classes = window.teacherData && window.teacherData.classes
    ? window.teacherData.classes.filter(function (c) { return c !== 'All Students'; })
    : [];
  if (!classes.length) { odaToast('Create a class first before adding students.', 'warning'); openClassModal(); return; }
  var h = '<option value="">Choose a class...</option>';
  for (var i = 0; i < classes.length; i++) {
    var isSelected = currentClass !== 'All Students' && classes[i] === currentClass;
    h += '<option value="' + esc(classes[i]) + '"' + (isSelected ? ' selected' : '') + '>' + esc(classes[i]) + '</option>';
  }
  sel.innerHTML = h;
  var m = document.getElementById('addStudentModal'); m.classList.add('show');
  if (window.odaTrapFocus) _odaFocusTraps.addStudentModal = window.odaTrapFocus(m);
}

/** Close the add-student modal and reset all fields */
function closeAddStudentModal() {
  document.getElementById('addStudentModal').classList.remove('show');
  if (_odaFocusTraps.addStudentModal) { _odaFocusTraps.addStudentModal(); _odaFocusTraps.addStudentModal = null; }
  document.getElementById('addStudentName').value = '';
  document.getElementById('addStudentGrade').value = '';
  document.getElementById('addStudentGradeCustom').value = '';
  document.getElementById('addStudentGradeCustom').style.display = 'none';
}
window.openAddStudentModal = openAddStudentModal;
window.closeAddStudentModal = closeAddStudentModal;

/** Delete a class (does not delete students in the class) */
async function deleteClass(name) {
  if (!confirm('Delete class "' + name + '"? Students in this class won\'t be deleted.')) return;
  var classes = window.teacherData.classes || [];
  var idx = classes.indexOf(name);
  if (idx >= 0) classes.splice(idx, 1);
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'teachers', window.currentTeacher.uid), { classes: classes });
    window.teacherData.classes = classes;
    if (currentClass === name) currentClass = 'All Students';
    loadClasses();
    renderStudentList();
  } catch (e) { console.error(e); }
}
window.deleteClass = deleteClass;

// ============================================
// Settings
// ============================================

/** Populate settings form from teacher data */
function populateSettings() {
  if (!window.teacherData) return;
  var td = window.teacherData;
  document.getElementById('setName').value = td.name || '';
  document.getElementById('setDistrict').value = td.district || '';
  document.getElementById('setSchool').value = td.school || '';
  document.getElementById('setGrades').value = td.gradeLevels || '';
  document.getElementById('setTeam').value = td.team || '';
  document.getElementById('setProgram').value = td.program || '';
  document.getElementById('settingsClassCode').textContent = td.classCode || '------';
}

/** Update a toggle button's visual state (ON/OFF) */
function updateToggleBtn(id, on) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.textContent = on ? 'ON' : 'OFF';
  btn.style.background = on ? 'var(--accent)' : '';
  btn.style.color = on ? 'var(--bg)' : '';
  btn.style.borderColor = on ? 'var(--accent)' : '';
}

/** Save teacher profile settings */
async function saveProfile() {
  var name = document.getElementById('setName').value.trim();
  var district = document.getElementById('setDistrict').value;
  var school = document.getElementById('setSchool').value;
  var grades = document.getElementById('setGrades').value.trim();
  var team = document.getElementById('setTeam').value;
  var program = document.getElementById('setProgram').value;
  if (!name) { odaToast('Name is required', 'warning'); return; }
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'teachers', window.currentTeacher.uid), { name: name, district: district, school: school, gradeLevels: grades, team: team, program: program });
    window.teacherData.name = name;
    window.teacherData.district = district;
    window.teacherData.school = school;
    window.teacherData.gradeLevels = grades;
    window.teacherData.team = team;
    window.teacherData.program = program;
    document.getElementById('teacherName').textContent = name;
    document.getElementById('welcomeName').textContent = name.split(' ')[0];
    var msg = document.getElementById('profileSaveMsg'); msg.style.display = 'block'; setTimeout(function () { msg.style.display = 'none'; }, 2000);
  } catch (e) { console.error(e); odaToast('Error saving', 'error'); }
}
window.saveProfile = saveProfile;

/** Generate a unique 6-digit class code */
async function generateUniqueClassCode() {
  for (var attempts = 0; attempts < 10; attempts++) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var q = window.fbQuery(window.fbCollection(window.fbDb, 'teachers'), window.fbWhere('classCode', '==', code));
    var snap = await window.fbGetDocs(q);
    var taken = false;
    snap.forEach(function (d) { if (d.id !== window.currentTeacher.uid) taken = true; });
    if (!taken) return code;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Regenerate and save a new class code */
async function regenerateClassCode() {
  try {
    var code = await generateUniqueClassCode();
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'teachers', window.currentTeacher.uid), { classCode: code });
    window.teacherData.classCode = code;
    document.getElementById('classCodeDisplay').textContent = code;
    document.getElementById('settingsClassCode').textContent = code;
    var msg = document.getElementById('codeSaveMsg'); msg.style.display = 'block'; setTimeout(function () { msg.style.display = 'none'; }, 2000);
  } catch (e) { console.error(e); odaToast('Error: ' + e.message, 'error'); }
}
window.regenerateClassCode = regenerateClassCode;

/** Copy class code to clipboard */
function copyClassCode() {
  var code = window.teacherData && window.teacherData.classCode ? window.teacherData.classCode : '';
  if (!code) return;
  navigator.clipboard.writeText(code).then(function () { odaToast('Class code copied!', 'success'); }).catch(function () {
    var ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); odaToast('Class code copied!', 'success');
  });
}
window.copyClassCode = copyClassCode;

/** Create a new class */
async function createClass() {
  var name = document.getElementById('className').value.trim();
  if (!name) return;
  var classes = (window.teacherData.classes || []).filter(function (c) { return c !== 'All Students'; });
  if (classes.indexOf(name) === -1) classes.push(name);
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'teachers', window.currentTeacher.uid), { classes: classes });
    window.teacherData.classes = classes;
    currentClass = name;
    loadClasses();
    closeClassModal();
  } catch (e) { console.error(e); }
}
window.createClass = createClass;

// ============================================
// Students
// ============================================

/** Load all students and assignments from Firestore */
async function loadStudents() {
  try {
    var q = window.fbQuery(window.fbCollection(window.fbDb, 'students'), window.fbWhere('teacherId', '==', window.currentTeacher.uid));
    var snap = await window.fbGetDocs(q);
    students = []; snap.forEach(function (d) { students.push({ id: d.id, ...d.data() }); });

    // Backfill parentCode for any students missing one
    students.forEach(function (s) {
      if (!s.parentCode) {
        var pc = String(Math.floor(1000 + Math.random() * 9000));
        s.parentCode = pc;
        window.fbSetDoc(window.fbDoc(window.fbDb, 'students', s.id), { parentCode: pc }, { merge: true }).catch(function (e) { console.error('parentCode backfill:', e); });
      }
    });

    // If no real-time listener yet, do a one-time load of assignments
    if (!window._assignListenerActive) {
      var aq = window.fbQuery(window.fbCollection(window.fbDb, 'assignments'), window.fbWhere('teacherId', '==', window.currentTeacher.uid));
      var asnap = await window.fbGetDocs(aq);
      allAssignments = []; asnap.forEach(function (d) { allAssignments.push({ id: d.id, ...d.data() }); });
    }

    renderStudentList();
    updateStats();
    updateAnalytics();
    updateNotifBadge();
    renderAssignmentsList();
    populateClassFilters();
  } catch (e) {
    console.error(e);
    document.getElementById('studentList').innerHTML = '<div class="empty-state"><span class="emoji">&#x26A0;&#xFE0F;</span><p>Error loading.</p></div>';
  }
}

/** Set up real-time Firestore listener for assignments */
function setupAssignmentListener() {
  if (!window.currentTeacher) return;
  var aq = window.fbQuery(window.fbCollection(window.fbDb, 'assignments'), window.fbWhere('teacherId', '==', window.currentTeacher.uid));
  window.fbOnSnapshot(aq, function (snap) {
    allAssignments = []; snap.forEach(function (d) { allAssignments.push({ id: d.id, ...d.data() }); });
    window._assignListenerActive = true;
    updateStats();
    updateAnalytics();
    updateNotifBadge();
    renderAssignmentsList();
    if (selectedStudent) renderProfileAssignments();
  });
}
window.setupAssignmentListener = setupAssignmentListener;

/** Update dashboard stat counters */
function updateStats() {
  document.getElementById('statStudents').textContent = students.length;
  var pending = 0, done = 0, overdue = 0, review = 0;
  var today = new Date().toISOString().split('T')[0];
  allAssignments.forEach(function (a) {
    if (a.status === 'completed' || a.status === 'graded') done++;
    else if (a.status === 'submitted') { review++; pending++; }
    else { pending++; if (a.dueDate && a.dueDate < today) overdue++; }
  });
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statReview').textContent = review;
  document.getElementById('statDone').textContent = done;
  document.getElementById('statOverdue').textContent = overdue;
}

/** Render the student roster list */
function renderStudentList() {
  var el = document.getElementById('studentList');
  var filtered = currentClass === 'All Students' ? students : students.filter(function (s) { return s.className === currentClass; });
  document.getElementById('rosterCount').textContent = '(' + filtered.length + ')';

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><span class="emoji">&#x1F393;</span><p>No students' + (currentClass !== 'All Students' ? ' in this class' : ' yet. Create a class and add students to get started!') + '</p></div>';
    return;
  }
  filtered.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });

  var h = '';
  for (var i = 0; i < filtered.length; i++) {
    var s = filtered[i];
    var init = (s.name || '?').charAt(0).toUpperCase();
    var sAssigns = allAssignments.filter(function (a) { return a.studentId === s.id; });
    var pending = sAssigns.filter(function (a) { return a.status === 'pending'; }).length;
    var completed = sAssigns.filter(function (a) { return a.status === 'completed'; }).length;
    var badge, badgeClass;
    if (pending > 0) { badge = pending + ' pending'; badgeClass = 'badge-pending'; }
    else if (completed > 0) { badge = 'All done'; badgeClass = 'badge-done'; }
    else { badge = 'No tasks'; badgeClass = 'badge-idle'; }
    var checked = _selectedStudentIds.indexOf(s.id) >= 0;
    h += '<div class="s-row' + (checked ? ' selected-row' : '') + '" role="button" tabindex="0" onclick="openProfile(\'' + s.id + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openProfile(\'' + s.id + '\')}">';
    h += '<input type="checkbox" class="s-check" data-sid="' + s.id + '"' + (checked ? ' checked' : '') + ' onclick="event.stopPropagation();toggleStudentCheck(\'' + s.id + '\',this)">';
    h += '<div class="s-info"><div class="s-avatar">' + init + '</div><div><div class="s-name">' + esc(s.name) + '</div><div class="s-meta">Grade ' + esc(s.grade || '?') + (s.className ? ' • ' + esc(s.className) : '') + '</div></div></div>';
    h += '<div class="s-right"><span class="s-badge ' + badgeClass + '">' + badge + '</span></div>';
    h += '</div>';
  }
  el.innerHTML = h;
  updateRosterBulkBar();
}

// Grade select: show custom input when "Other" is chosen
document.getElementById('addStudentGrade').addEventListener('change', function () {
  var custom = document.getElementById('addStudentGradeCustom');
  custom.style.display = this.value === 'Other' ? '' : 'none';
  if (this.value !== 'Other') custom.value = '';
});

var _addingStudent = false;

/** Add a new student to the roster */
async function addStudent() {
  if (_addingStudent) return;
  var name = document.getElementById('addStudentName').value.trim();
  var gradeSelect = document.getElementById('addStudentGrade').value;
  var grade = gradeSelect === 'Other' ? document.getElementById('addStudentGradeCustom').value.trim() : gradeSelect;
  var className = document.getElementById('addStudentClass').value;
  if (!name) return;
  if (!grade) { odaToast('Please select a grade.', 'warning'); return; }
  if (!className) { odaToast('Please select a class for this student.', 'warning'); return; }
  _addingStudent = true;
  var btn = document.querySelector('#addStudentModal .btn-accent');
  if (btn) { btn.textContent = 'Adding...'; btn.disabled = true; }
  try {
    var parentCode = String(Math.floor(1000 + Math.random() * 9000));
    await window.fbAddDoc(window.fbCollection(window.fbDb, 'students'), {
      name: name, nameLower: name.toLowerCase(), grade: grade,
      teacherId: window.currentTeacher.uid,
      school: window.teacherData ? window.teacherData.school : '',
      className: className, parentCode: parentCode,
      createdAt: new Date().toISOString()
    });
    closeAddStudentModal();
    loadStudents();
  } catch (e) { console.error(e); odaToast('Error: ' + e.message, 'error'); }
  finally { _addingStudent = false; if (btn) { btn.textContent = 'Add Student'; btn.disabled = false; } }
}
window.addStudent = addStudent;

// ============================================
// Student Profile
// ============================================

/** Open a student's profile panel */
function openProfile(id) {
  selectedStudent = students.find(function (s) { return s.id === id; });
  if (!selectedStudent) return;
  document.getElementById('rosterView').style.display = 'none';
  document.getElementById('profilePanel').classList.add('show');
  document.getElementById('profileAvatar').textContent = (selectedStudent.name || '?').charAt(0).toUpperCase();
  document.getElementById('profileName').textContent = selectedStudent.name;
  document.getElementById('profileDetail').textContent = 'Grade ' + (selectedStudent.grade || '?') + (selectedStudent.className ? ' \u2022 ' + selectedStudent.className : '') + (selectedStudent.parentCode ? ' \u2022 Parent Code: ' + selectedStudent.parentCode : '');
  var arcLocked = selectedStudent.arcadeLocked || false;
  var abtn = document.getElementById('arcadeToggleBtn');
  abtn.textContent = arcLocked ? '\u{1F3AE} Unlock Arcade' : '\u{1F512} Lock Arcade';
  abtn.style.background = arcLocked ? '' : 'var(--accent3)';
  abtn.style.borderColor = arcLocked ? '' : 'var(--accent3)';
  renderProfileAssignments();
  loadStudentWork();
}
window.openProfile = openProfile;

/** Close the student profile panel */
function closeProfile() {
  document.getElementById('profilePanel').classList.remove('show');
  document.getElementById('rosterView').style.display = '';
  selectedStudent = null;
}
window.closeProfile = closeProfile;

/** Delete a student and all their assignments */
async function deleteStudent() {
  if (!selectedStudent) return;
  if (!confirm('Delete "' + selectedStudent.name + '"? This will also delete all their assignments. This cannot be undone.')) return;
  var sName = selectedStudent.name;
  var sId = selectedStudent.id;
  try {
    var aq = window.fbQuery(window.fbCollection(window.fbDb, 'assignments'), window.fbWhere('studentId', '==', sId));
    var asnap = await window.fbGetDocs(aq);
    var deletes = [];
    asnap.forEach(function (d) { deletes.push(window.fbDeleteDoc(window.fbDoc(window.fbDb, 'assignments', d.id))); });
    await Promise.all(deletes);
    await window.fbDeleteDoc(window.fbDoc(window.fbDb, 'students', sId));
    closeProfile();
    await loadStudents();
    odaToast('"' + sName + '" deleted', 'success');
  } catch (e) { console.error(e); odaToast('Error deleting student: ' + e.message, 'error'); }
}
window.deleteStudent = deleteStudent;

// ============================================
// Multi-Select Delete
// ============================================

/** Toggle a student checkbox for bulk selection */
function toggleStudentCheck(sid, cb) {
  var idx = _selectedStudentIds.indexOf(sid);
  if (cb.checked && idx < 0) _selectedStudentIds.push(sid);
  else if (!cb.checked && idx >= 0) _selectedStudentIds.splice(idx, 1);
  var row = cb.closest('.s-row');
  if (row) row.classList.toggle('selected-row', cb.checked);
  updateRosterBulkBar();
}
window.toggleStudentCheck = toggleStudentCheck;

/** Show or hide the roster bulk-action bar based on selection count */
function updateRosterBulkBar() {
  var bar = document.getElementById('rosterBulkBar');
  var count = _selectedStudentIds.length;
  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('rosterBulkCount').textContent = count + ' student' + (count !== 1 ? 's' : '') + ' selected';
  } else {
    bar.style.display = 'none';
  }
}

/** Select all visible students for bulk operations */
function selectAllStudents() {
  var boxes = document.querySelectorAll('#studentList .s-check');
  _selectedStudentIds = [];
  boxes.forEach(function (cb) {
    cb.checked = true;
    _selectedStudentIds.push(cb.getAttribute('data-sid'));
    var row = cb.closest('.s-row'); if (row) row.classList.add('selected-row');
  });
  updateRosterBulkBar();
}
window.selectAllStudents = selectAllStudents;

/** Clear all student selections and hide the bulk bar */
function clearStudentSelection() {
  _selectedStudentIds = [];
  var boxes = document.querySelectorAll('#studentList .s-check');
  boxes.forEach(function (cb) {
    cb.checked = false;
    var row = cb.closest('.s-row'); if (row) row.classList.remove('selected-row');
  });
  updateRosterBulkBar();
}
window.clearStudentSelection = clearStudentSelection;

/** Delete all selected students and their assignments */
async function deleteSelectedStudents() {
  var count = _selectedStudentIds.length;
  if (!count) return;
  if (!confirm('Delete ' + count + ' student' + (count !== 1 ? 's' : '') + '? This will also delete all their assignments. This cannot be undone.')) return;
  try {
    for (var i = 0; i < _selectedStudentIds.length; i++) {
      var sid = _selectedStudentIds[i];
      var aq = window.fbQuery(window.fbCollection(window.fbDb, 'assignments'), window.fbWhere('studentId', '==', sid));
      var asnap = await window.fbGetDocs(aq);
      var dels = [];
      asnap.forEach(function (d) { dels.push(window.fbDeleteDoc(window.fbDoc(window.fbDb, 'assignments', d.id))); });
      await Promise.all(dels);
      await window.fbDeleteDoc(window.fbDoc(window.fbDb, 'students', sid));
    }
    _selectedStudentIds = [];
    updateRosterBulkBar();
    await loadStudents();
    odaToast(count + ' student' + (count !== 1 ? 's' : '') + ' deleted', 'success');
  } catch (e) { console.error(e); odaToast('Error deleting students: ' + e.message, 'error'); }
}
window.deleteSelectedStudents = deleteSelectedStudents;

// ============================================
// Student Work Display
// ============================================

/** Load and render all saved work for the selected student */
async function loadStudentWork() {
  if (!selectedStudent) return;
  var el = document.getElementById('profileWork');
  el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px">Loading student work...</div>';
  var sid = selectedStudent.id;
  var h = '';
  try {
    var _work = await Promise.all([
      window.fbGetDoc(window.fbDoc(window.fbDb, 'elevatorPitches', sid)),
      window.fbGetDoc(window.fbDoc(window.fbDb, 'pitchChallenges', sid)),
      window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb, 'lemonadeGroups'), window.fbWhere('memberIds', 'array-contains', sid))),
      window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb, 'spellingResults'), window.fbWhere('studentId', '==', sid)))
    ]);
    var epDoc = _work[0], pcDoc = _work[1], lemSnap = _work[2], srSnap = _work[3];

    // Elevator Pitch
    if (epDoc.exists()) {
      var ep = epDoc.data();
      h += '<div class="work-card"><div class="work-header"><span class="work-type wt-elevator">\u{1F3A4} Elevator Pitch</span><div style="display:flex;align-items:center;gap:8px"><span class="work-date">' + (ep.savedAt ? new Date(ep.savedAt).toLocaleDateString() : '') + '</span><button class="btn btn-red btn-sm" onclick="deleteStudentWork(\'elevatorPitches\',\'' + sid + '\')" style="padding:2px 7px;font-size:11px" title="Delete">&times;</button></div></div>';
      h += '<div class="work-body">';
      if (ep.answers) {
        if (ep.answers.name) h += '<div class="wl"><span class="wl-label">Name:</span> <span class="wl-value">' + esc(ep.answers.name) + '</span></div>';
        if (ep.answers.dream) h += '<div class="wl"><span class="wl-label">Dream Job:</span> <span class="wl-value">' + esc(ep.answers.dream) + '</span></div>';
        if (ep.answers.why) h += '<div class="wl"><span class="wl-label">Why:</span> <span class="wl-value">' + esc(ep.answers.why) + '</span></div>';
        if (ep.answers.hobby) h += '<div class="wl"><span class="wl-label">Hobbies:</span> <span class="wl-value">' + esc(ep.answers.hobby) + '</span></div>';
        if (ep.answers.fact) h += '<div class="wl"><span class="wl-label">Fun Fact:</span> <span class="wl-value">' + esc(ep.answers.fact) + '</span></div>';
      }
      if (ep.pitch) h += '<div class="pitch-text">' + esc(ep.pitch) + '</div>';
      h += '</div></div>';
    }

    // Pitch Challenge
    if (pcDoc.exists()) {
      var pc = pcDoc.data();
      h += '<div class="work-card"><div class="work-header"><span class="work-type wt-pitch">\u{1F4A1} Pitch Challenge</span><div style="display:flex;align-items:center;gap:8px"><span class="work-date">' + (pc.savedAt ? new Date(pc.savedAt).toLocaleDateString() : '') + '</span><button class="btn btn-red btn-sm" onclick="deleteStudentWork(\'pitchChallenges\',\'' + sid + '\')" style="padding:2px 7px;font-size:11px" title="Delete">&times;</button></div></div>';
      h += '<div class="work-body">';
      if (pc.studentName) h += '<div class="wl"><span class="wl-label">Student:</span> <span class="wl-value">' + esc(pc.studentName) + '</span></div>';
      if (pc.businessName) h += '<div class="wl"><span class="wl-label">Business:</span> <span class="wl-value">' + esc(pc.businessName) + (pc.businessDesc ? ' — ' + esc(pc.businessDesc) : '') + '</span></div>';
      if (pc.problem) h += '<div class="wl"><span class="wl-label">Problem:</span> <span class="wl-value">' + esc(pc.problem) + '</span></div>';
      if (pc.customers && pc.customers.length) h += '<div class="wl"><span class="wl-label">Customers:</span> <span class="wl-value">' + esc(pc.customers.join(', ')) + '</span></div>';
      if (pc.advantages && pc.advantages.length) h += '<div class="wl"><span class="wl-label">Advantages:</span> <span class="wl-value">' + esc(pc.advantages.join(' • ')) + '</span></div>';
      if (pc.hook) h += '<div class="pitch-text">' + esc(pc.hook) + '</div>';
      h += '</div></div>';
    }

    // Lemonade Day Groups
    if (!lemSnap.empty) {
      lemSnap.forEach(function (d) {
        var lg = d.data();
        h += '<div class="work-card"><div class="work-header"><span class="work-type" style="background:rgba(245,158,11,.12);color:#F59E0B">&#x1F34B; Lemonade Day</span><span class="work-date">' + (lg.createdAt ? new Date(lg.createdAt).toLocaleDateString() : '') + '</span></div>';
        h += '<div class="work-body">';
        h += '<div class="wl"><span class="wl-label">Company:</span> <span class="wl-value">' + esc(lg.companyName || '') + '</span></div>';
        h += '<div class="wl"><span class="wl-label">Group:</span> <span class="wl-value">' + esc(lg.groupName || '') + ' (' + ((lg.members || []).length) + ' members)</span></div>';
        h += '<div class="wl"><span class="wl-label">Status:</span> <span class="wl-value">' + (lg.status || '?') + '</span></div>';
        if (lg.score !== undefined && lg.score !== null) h += '<div class="wl"><span class="wl-label">Score:</span> <span class="wl-value" style="color:var(--gold)">' + lg.score + '%</span></div>';
        h += '</div></div>';
      });
    }

    // Spelling Results
    if (!srSnap.empty) {
      var results = []; srSnap.forEach(function (d) { results.push(d.data()); });
      results.sort(function (a, b) { return (b.savedAt || '').localeCompare(a.savedAt || ''); });
      h += '<div class="work-card"><div class="work-header"><span class="work-type wt-spelling">\u{1F41D} Spelling Bee</span><div style="display:flex;align-items:center;gap:8px"><span class="work-date">' + results.length + ' attempt' + (results.length !== 1 ? 's' : '') + '</span><button class="btn btn-red btn-sm" onclick="deleteStudentWork(\'spellingResults\',\'' + sid + '\')" style="padding:2px 7px;font-size:11px" title="Delete">&times;</button></div></div>';
      h += '<div class="work-body"><div class="spelling-scores">';
      results.forEach(function (r) {
        var cls = r.score >= 80 ? 'spell-good' : r.score >= 60 ? 'spell-ok' : 'spell-low';
        h += '<span class="spell-score ' + cls + '">' + (r.grade || '?') + ': ' + r.score + '%</span>';
      });
      h += '</div>';
      var latest = results[0];
      if (latest.words && latest.results) {
        h += '<div style="margin-top:10px;font-size:12px;color:var(--text2)">Latest attempt (' + esc(latest.grade || '') + '):</div>';
        h += '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">';
        for (var wi = 0; wi < latest.words.length; wi++) {
          var ok = latest.results[wi];
          h += '<span style="padding:2px 8px;border-radius:4px;font-size:11px;font-family:Space Mono,monospace;' + (ok ? 'background:rgba(6,214,160,.1);color:var(--accent)' : 'background:rgba(239,71,111,.1);color:var(--accent3)') + '">' + esc(latest.words[wi]) + '</span>';
        }
        h += '</div>';
      }
      h += '</div></div>';
    }

    if (!h) h = '<div class="empty-state"><span class="emoji">\u{1F4AD}</span><p>No saved work yet. Assign something and have the student complete it!</p></div>';
    el.innerHTML = h;
  } catch (e) {
    console.error('Error loading student work:', e);
    el.innerHTML = '<div class="empty-state"><span class="emoji">\u{26A0}\uFE0F</span><p>Error loading work. Try refreshing.</p></div>';
  }
}
window.loadStudentWork = loadStudentWork;

/** Render active and completed assignments for the selected student */
function renderProfileAssignments() {
  if (!selectedStudent) return;
  var sAssigns = allAssignments.filter(function (a) { return a.studentId === selectedStudent.id; });
  var active = sAssigns.filter(function (a) { return a.status === 'pending' || a.status === 'submitted' || a.status === 'returned'; });
  var finished = sAssigns.filter(function (a) { return a.status === 'completed' || a.status === 'graded'; });

  var el = document.getElementById('profileAssignments');
  if (!active.length) { el.innerHTML = '<div class="empty-state"><span class="emoji">&#x2705;</span><p>No pending assignments</p></div>'; }
  else {
    var h = '';
    active.forEach(function (a) {
      var t = ASSIGN_TYPES[a.toolType] || ASSIGN_TYPES[a.type] || { title: a.title || a.type, emoji: '\u{1F4CB}' };
      var due = a.dueDate ? 'Due: ' + a.dueDate : 'No due date';
      var today = new Date().toISOString().split('T')[0];
      var overdue = a.status === 'pending' && a.dueDate && a.dueDate < today;
      var sLabel = a.status === 'submitted' ? ' \u2022 Needs Review' : a.status === 'returned' ? ' \u2022 Returned' : '';
      h += '<div class="a-item"' + (a.status === 'submitted' ? ' style="border-color:var(--accent3)"' : '') + '>';
      h += '<div class="a-info"><div class="a-title">' + t.emoji + ' ' + (a.title || t.title) + '</div><div class="a-detail"' + (overdue ? ' style="color:var(--accent3)"' : '') + '>' + due + (overdue ? ' \u{26A0}\uFE0F OVERDUE' : '') + sLabel + '</div></div>';
      h += '<div style="display:flex;gap:6px">';
      if (a.status === 'submitted') h += '<button class="btn btn-blue btn-sm" onclick="openGradePanel(\'' + a.id + '\')">Review</button>';
      else h += '<button class="btn btn-accent btn-sm" onclick="markComplete(\'' + a.id + '\')">Done</button>';
      h += '<button class="btn btn-red btn-sm" onclick="deleteAssignment(\'' + a.id + '\')">&times;</button></div>';
      h += '</div>';
    });
    el.innerHTML = h;
  }

  var hel = document.getElementById('profileHistory');
  if (!finished.length) { hel.innerHTML = '<div class="empty-state"><span class="emoji">&#x1F4AD;</span><p>No completed work yet</p></div>'; }
  else {
    var h2 = '';
    finished.sort(function (a, b) { return (b.completedAt || b.gradedAt || '').localeCompare(a.completedAt || a.gradedAt || ''); });
    finished.forEach(function (a) {
      var t = ASSIGN_TYPES[a.toolType] || ASSIGN_TYPES[a.type] || { title: a.title || a.type, emoji: '\u{1F4CB}' };
      var when = a.completedAt ? new Date(a.completedAt).toLocaleDateString() : a.gradedAt ? new Date(a.gradedAt).toLocaleDateString() : '';
      var scoreStr = (a.score !== null && a.score !== undefined) ? (' \u2022 ' + a.score + '%') : '';
      var label = a.status === 'graded' ? 'Graded' : 'Completed';
      h2 += '<div class="a-item">';
      h2 += '<div class="a-info"><div class="a-title">' + t.emoji + ' ' + (a.title || t.title) + '</div><div class="a-detail">' + label + ' ' + when + scoreStr + '</div></div>';
      h2 += '<div style="display:flex;gap:6px;align-items:center"><span class="a-status" style="background:rgba(6,214,160,.1);color:var(--accent)">\u2705</span><button class="btn btn-red btn-sm" onclick="deleteAssignment(\'' + a.id + '\')" style="padding:3px 8px;font-size:11px">&times;</button></div>';
      h2 += '</div>';
    });
    hel.innerHTML = h2;
  }
}

// ============================================
// Profile Actions
// ============================================

/** Open the assignment creator for the currently selected student */
function openAssignModal() {
  if (!selectedStudent) return;
  openCreateAssignment(selectedStudent.id);
}
/** Close the legacy assign modal */
function closeAssignModal() { document.getElementById('assignModal').classList.remove('show'); }
window.openAssignModal = openAssignModal;
window.closeAssignModal = closeAssignModal;

/** Toggle arcade lock for the selected student */
async function toggleArcade() {
  if (!selectedStudent) return;
  var lock = !(selectedStudent.arcadeLocked);
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'students', selectedStudent.id), { arcadeLocked: lock });
    selectedStudent.arcadeLocked = lock;
    var abtn = document.getElementById('arcadeToggleBtn');
    abtn.textContent = lock ? '\u{1F3AE} Unlock Arcade' : '\u{1F512} Lock Arcade';
    abtn.style.background = lock ? '' : 'var(--accent3)';
    abtn.style.borderColor = lock ? '' : 'var(--accent3)';
    loadStudents();
  } catch (e) { console.error(e); }
}
window.toggleArcade = toggleArcade;

/** Mark a single assignment as complete */
async function markComplete(assignId) {
  try {
    await window.fbUpdateDoc(window.fbDoc(window.fbDb, 'assignments', assignId), { status: 'completed', completedAt: new Date().toISOString() });
    await loadStudents(); renderProfileAssignments();
  } catch (e) { console.error(e); }
}
window.markComplete = markComplete;

/** Delete a single assignment */
async function deleteAssignment(assignId) {
  if (!confirm('Remove this assignment?')) return;
  try { await window.fbDeleteDoc(window.fbDoc(window.fbDb, 'assignments', assignId)); await loadStudents(); renderProfileAssignments(); } catch (e) { console.error(e); }
}
window.deleteAssignment = deleteAssignment;

/** Delete student work from a specific collection */
async function deleteStudentWork(collectionName, studentId) {
  if (!confirm('Delete this student work? This cannot be undone.')) return;
  try {
    if (collectionName === 'spellingResults') {
      var q = window.fbQuery(window.fbCollection(window.fbDb, 'spellingResults'), window.fbWhere('studentId', '==', studentId));
      var snap = await window.fbGetDocs(q);
      var deletes = []; snap.forEach(function (d) { deletes.push(window.fbDeleteDoc(window.fbDoc(window.fbDb, 'spellingResults', d.id))); });
      await Promise.all(deletes);
    } else {
      await window.fbDeleteDoc(window.fbDoc(window.fbDb, collectionName, studentId));
    }
    await loadStudentWork();
  } catch (e) { console.error('Error deleting student work:', e); }
}
window.deleteStudentWork = deleteStudentWork;

// Cross-module exports
window.loadClasses = loadClasses;
window.loadStudents = loadStudents;
window.populateSettings = populateSettings;
window.renderStudentList = renderStudentList;
window.renderProfileAssignments = renderProfileAssignments;
window.updateStats = updateStats;

console.log('[ODA] Teacher roster module loaded');

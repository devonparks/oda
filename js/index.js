/**
 * ODA Hub - Login / Landing Page
 * Handles student, teacher, and parent authentication flows.
 * Dependencies: oda-core.js (for esc, getFirebaseDB), Firebase (module import in HTML)
 */

// ============================================
// Hard Refresh (clear SW + reload)
// ============================================
window.hardRefresh = async function () {
  if ('caches' in window) {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
  }
  if (navigator.serviceWorker) {
    var regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(function (r) { return r.unregister(); }));
  }
  location.href = location.pathname + '?v=' + Date.now();
};

// ============================================
// Panel Navigation
// ============================================
function showDoors() {
  document.getElementById('doors').style.display = '';
  document.getElementById('features').style.display = '';
  var panels = document.querySelectorAll('.login-panel');
  for (var i = 0; i < panels.length; i++) panels[i].classList.remove('show');
}

function showPanel(id) {
  document.getElementById('doors').style.display = 'none';
  document.getElementById('features').style.display = 'none';
  var panels = document.querySelectorAll('.login-panel');
  for (var i = 0; i < panels.length; i++) panels[i].classList.remove('show');
  var p = document.getElementById('panel-' + id);
  if (p) {
    p.classList.add('show');
    setTimeout(function () {
      var focusable = p.querySelectorAll('input:not([type=hidden]),button,select,textarea,a[href],[tabindex]:not([tabindex="-1"])');
      if (focusable.length) focusable[0].focus();
    }, 100);
  }
}
window.showPanel = showPanel;

// ============================================
// Error / Success Helpers
// ============================================
function showError(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg; el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, 4000);
}

function showSuccess(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg; el.classList.add('show');
}

// ============================================
// Student Login (3-step: Code → Grade → Name)
// ============================================
var stuStep = 1, stuStudents = [], stuTeacherData = null;

function studentBack() {
  if (stuStep <= 1) { showDoors(); return; }
  stuStep--;
  showStuStep();
}
window.studentBack = studentBack;

function showStuStep() {
  document.getElementById('stuStep1').style.display = stuStep === 1 ? '' : 'none';
  document.getElementById('stuStep2').style.display = stuStep === 2 ? '' : 'none';
  document.getElementById('stuStep3').style.display = stuStep === 3 ? '' : 'none';
  var titles = {
    1: ['&#x1F393;', 'Student Login', 'Enter your class code from your teacher'],
    2: ['&#x1F4DA;', 'Pick Your Grade', 'What grade are you in?'],
    3: ['&#x1F44B;', 'Find Your Name', 'Tap your name below']
  };
  var t = titles[stuStep];
  document.getElementById('stuEmoji').innerHTML = t[0];
  document.getElementById('stuTitle').textContent = t[1];
  document.getElementById('stuDesc').textContent = t[2];
  setTimeout(function () {
    var stepEl = document.getElementById('stuStep' + stuStep);
    if (stepEl) {
      var f = stepEl.querySelectorAll('input,button,[tabindex]:not([tabindex="-1"])');
      if (f.length) f[0].focus();
    }
  }, 100);
}

window.checkClassCode = async function () {
  var code = document.getElementById('classCodeInput').value.trim();
  if (!/^\d{6}$/.test(code)) { showError('studentError', 'Enter a 6-digit class code!'); return; }
  var btn = document.getElementById('codeSubmit');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    var q = window.fbQuery(window.fbCollection(window.firebaseDb, 'teachers'), window.fbWhere('classCode', '==', code));
    var snap = await window.fbGetDocs(q);
    if (snap.empty) { btn.textContent = 'Enter \u2192'; btn.disabled = false; showError('studentError', 'Class code not found. Ask your teacher!'); return; }
    stuTeacherData = { id: snap.docs[0].id, ...snap.docs[0].data() };
    var sq = window.fbQuery(window.fbCollection(window.firebaseDb, 'students'), window.fbWhere('teacherId', '==', stuTeacherData.id));
    var sSnap = await window.fbGetDocs(sq);
    stuStudents = []; sSnap.forEach(function (d) { stuStudents.push({ id: d.id, ...d.data() }); });
    if (!stuStudents.length) { btn.textContent = 'Enter \u2192'; btn.disabled = false; showError('studentError', 'No students in this class yet.'); return; }
    btn.textContent = 'Enter \u2192'; btn.disabled = false;
    var grades = {};
    stuStudents.forEach(function (s) { var g = s.grade || 'Other'; if (!grades[g]) grades[g] = []; grades[g].push(s); });
    var gk = Object.keys(grades).sort(function (a, b) {
      var na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (a === 'K') return -1; if (b === 'K') return 1;
      return a.localeCompare(b);
    });
    var h = '';
    gk.forEach(function (g) { h += '<button class="grade-pick" onclick="pickGrade(\'' + esc(g) + '\')">' + esc(g) + '</button>'; });
    document.getElementById('gradeButtons').innerHTML = h;
    stuStep = 2; showStuStep();
  } catch (e) { btn.textContent = 'Enter \u2192'; btn.disabled = false; showError('studentError', 'Something went wrong.'); console.error(e); }
};

window.pickGrade = function (grade) {
  var filtered = stuStudents.filter(function (s) { return (s.grade || 'Other') === grade; });
  filtered.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var h = '';
  filtered.forEach(function (s) {
    h += '<button class="name-pick" onclick="pickStudent(\'' + s.id + '\')">' + esc(s.name) + '</button>';
  });
  document.getElementById('nameButtons').innerHTML = h;
  stuStep = 3; showStuStep();
};

window.pickStudent = function (id) {
  var student = stuStudents.find(function (s) { return s.id === id; });
  if (!student) return;
  localStorage.setItem('studentId', student.id);
  localStorage.setItem('studentName', student.name);
  window.location.href = 'student.html';
};

// ============================================
// Teacher Login
// ============================================
window.resetPassword = async function () {
  var email = document.getElementById('teacherEmail').value.trim();
  if (!email) { showError('teacherError', 'Enter your email first, then click Forgot password'); return; }
  try {
    await window.sendPasswordResetEmail(window.firebaseAuth, email);
    var el = document.getElementById('teacherSuccess');
    el.textContent = 'Password reset email sent! Check your inbox.';
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 6000);
  } catch (e) {
    var msg = e.code === 'auth/user-not-found' ? 'No account found with that email' : 'Error: ' + e.message;
    showError('teacherError', msg);
  }
};

window.teacherLogin = async function () {
  var email = document.getElementById('teacherEmail').value.trim();
  var pass = document.getElementById('teacherPass').value;
  if (!email || !pass) { showError('teacherError', 'Enter email and password!'); return; }
  var btn = document.getElementById('teacherSubmit');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    await window.signInWithEmailAndPassword(window.firebaseAuth, email, pass);
    window.location.href = 'teacher.html';
  } catch (e) {
    btn.textContent = 'Sign In'; btn.disabled = false;
    var msg = e.code === 'auth/invalid-credential' ? 'Wrong email or password' : 'Error: ' + e.message;
    showError('teacherError', msg);
  }
};

// ============================================
// Google Login (popup on desktop, redirect on mobile/CrOS)
// ============================================
window.googleLogin = async function () {
  var isMobile = /Mobi|Android|CrOS/i.test(navigator.userAgent);
  var inIframe = window !== window.top;
  if (isMobile || inIframe) {
    try { await window.signInWithRedirect(window.firebaseAuth, window.googleProvider); }
    catch (e) { showError('teacherError', 'Sign-in failed: ' + e.message); }
    return;
  }
  try {
    var result = await window.signInWithPopup(window.firebaseAuth, window.googleProvider);
    var user = result.user;
    var teacherRef = window.fbDoc(window.firebaseDb, 'teachers', user.uid);
    var teacherSnap = await window.fbGetDoc(teacherRef);
    if (!teacherSnap.exists()) {
      var classCode;
      for (var cc = 0; cc < 10; cc++) {
        classCode = String(Math.floor(100000 + Math.random() * 900000));
        var ccQ = window.fbQuery(window.fbCollection(window.firebaseDb, 'teachers'), window.fbWhere('classCode', '==', classCode));
        var ccSnap = await window.fbGetDocs(ccQ);
        if (ccSnap.empty) break;
      }
      await window.fbSetDoc(teacherRef, {
        name: user.displayName || '', email: user.email || '',
        district: '', school: '', team: '', program: '', gradeLevels: '',
        classCode: classCode, classes: ['All Students'],
        createdAt: new Date().toISOString()
      });
    } else if (!teacherSnap.data().classCode) {
      var code = String(Math.floor(100000 + Math.random() * 900000));
      await window.fbSetDoc(teacherRef, { classCode: code }, { merge: true });
    }
    window.location.href = 'teacher.html';
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-browser' || e.code === 'auth/cancelled-popup-request') {
      try { await window.signInWithRedirect(window.firebaseAuth, window.googleProvider); }
      catch (e2) { showError('teacherError', 'Sign-in failed: ' + e2.message); }
    } else {
      showError('teacherError', 'Google sign-in failed: ' + e.message);
    }
  }
};

// ============================================
// Teacher Signup
// ============================================
window.teacherSignup = async function () {
  var name = document.getElementById('signupName').value.trim();
  var email = document.getElementById('signupEmail').value.trim();
  var district = document.getElementById('signupDistrict').value;
  var school = document.getElementById('signupSchool').value;
  var grades = document.getElementById('signupGrades').value.trim();
  var team = document.getElementById('signupTeam').value;
  var program = document.getElementById('signupProgram').value;
  var pass = document.getElementById('signupPass').value;

  if (!name || !email || !pass) { showError('signupError', 'Fill in name, email and password!'); return; }
  if (pass.length < 6) { showError('signupError', 'Password needs at least 6 characters'); return; }

  var sbtn = document.getElementById('signupSubmit');
  sbtn.innerHTML = '<span class="spinner"></span>'; sbtn.disabled = true;

  try {
    var classCode;
    for (var cc = 0; cc < 10; cc++) {
      classCode = String(Math.floor(100000 + Math.random() * 900000));
      var ccQ = window.fbQuery(window.fbCollection(window.firebaseDb, 'teachers'), window.fbWhere('classCode', '==', classCode));
      var ccSnap = await window.fbGetDocs(ccQ);
      if (ccSnap.empty) break;
    }
    var cred = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, pass);
    await window.fbSetDoc(window.fbDoc(window.firebaseDb, 'teachers', cred.user.uid), {
      name: name, email: email, district: district, school: school,
      team: team, program: program, gradeLevels: grades,
      classCode: classCode, classes: ['All Students'],
      createdAt: new Date().toISOString()
    });
    try { await window.sendEmailVerification(cred.user); } catch (ev) { console.warn('Verification email:', ev); }
    window.location.href = 'teacher.html';
  } catch (e) {
    sbtn.textContent = 'Create Account \u{1F680}'; sbtn.disabled = false;
    var msg = e.code === 'auth/email-already-in-use' ? 'Email already has an account' : 'Error: ' + e.message;
    showError('signupError', msg);
  }
};

// ============================================
// Parent Login
// ============================================
window.parentLogin = async function () {
  var name = document.getElementById('parentChildName').value.trim();
  var code = document.getElementById('parentCode').value.trim();
  if (!name || !code) { showError('parentError', 'Enter your child\'s name and code!'); return; }

  var pbtn = document.getElementById('parentSubmit');
  pbtn.innerHTML = '<span class="spinner"></span>'; pbtn.disabled = true;

  try {
    var q = window.fbQuery(
      window.fbCollection(window.firebaseDb, 'students'),
      window.fbWhere('nameLower', '==', name.toLowerCase()),
      window.fbWhere('parentCode', '==', code)
    );
    var snap = await window.fbGetDocs(q);
    if (snap.empty) {
      pbtn.textContent = 'View Progress'; pbtn.disabled = false;
      showError('parentError', 'Not found. Check with your child\'s teacher.');
      return;
    }
    localStorage.setItem('parentStudentId', snap.docs[0].id);
    localStorage.setItem('parentStudentName', snap.docs[0].data().name);
    window.location.href = 'parent.html';
  } catch (e) {
    pbtn.textContent = 'View Progress'; pbtn.disabled = false;
    console.error('Parent login error:', e);
    if (e.message && e.message.includes('index')) { showError('parentError', 'Database setup needed. Tell your teacher to check the console.'); }
    else { showError('parentError', 'Something went wrong. Try again.'); }
  }
};

// ============================================
// Keyboard Navigation (Enter key support)
// ============================================
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var active = document.activeElement;
  if (!active) return;
  if (active.id === 'classCodeInput') window.checkClassCode();
  else if (active.id === 'teacherEmail' || active.id === 'teacherPass') window.teacherLogin();
  else if (active.id === 'signupPass' || active.id === 'signupEmail' || active.id === 'signupName' || active.id === 'signupSchool' || active.id === 'signupGrades') window.teacherSignup();
  else if (active.id === 'parentCode' || active.id === 'parentChildName') window.parentLogin();
});

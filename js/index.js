/**
 * AMG Hub - Landing / Login Page
 * Handles kid, guardian (parent/teacher), and quick-check authentication flows.
 * Dependencies: oda-core.js (for esc, getFirebaseDB), oda-games.js (marquee), Firebase (module import in HTML)
 */

// ============================================
// SECURITY: Brute-force protection (OWASP A07 / MITRE T1110)
// Prevents rapid-fire family/class code guessing and parent code guessing
// ============================================
var _loginAttempts = { count: 0, lockUntil: 0 };
var MAX_LOGIN_ATTEMPTS = 8;
var LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute lockout

function checkLoginThrottle(errorElId) {
  if (Date.now() < _loginAttempts.lockUntil) {
    var secsLeft = Math.ceil((_loginAttempts.lockUntil - Date.now()) / 1000);
    showError(errorElId, 'Too many attempts. Try again in ' + secsLeft + ' seconds.');
    return false;
  }
  if (_loginAttempts.count >= MAX_LOGIN_ATTEMPTS) {
    _loginAttempts.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
    _loginAttempts.count = 0;
    showError(errorElId, 'Too many attempts. Locked for 1 minute.');
    return false;
  }
  return true;
}
function recordLoginAttempt() { _loginAttempts.count++; }
function resetLoginAttempts() { _loginAttempts.count = 0; }

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
// Panel Navigation (landing <-> login panels)
// ============================================
function showDoors() {
  var landing = document.getElementById('landing');
  if (landing) landing.style.display = '';
  var panels = document.querySelectorAll('.login-panel');
  for (var i = 0; i < panels.length; i++) panels[i].classList.remove('show');
  window.scrollTo({ top: 0 });
}
window.showDoors = showDoors;

function showPanel(id) {
  var landing = document.getElementById('landing');
  if (landing) landing.style.display = 'none';
  var panels = document.querySelectorAll('.login-panel');
  for (var i = 0; i < panels.length; i++) panels[i].classList.remove('show');
  var p = document.getElementById('panel-' + id);
  if (p) {
    p.classList.add('show');
    window.scrollTo({ top: 0 });
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
// Kid Login (3-step: Family/Class Code → Grade → Name)
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
    1: ['&#x1F3AE;', "Let's Play!", 'Enter your 6-digit Family Code (class codes work too)'],
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
  if (!checkLoginThrottle('studentError')) return;
  var code = document.getElementById('classCodeInput').value.trim();
  if (!/^\d{6}$/.test(code)) { showError('studentError', 'Enter a 6-digit code!'); return; }
  recordLoginAttempt();
  var btn = document.getElementById('codeSubmit');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    // Primary lookup: thin public classCodes/{code} doc (no guardian PII exposed).
    // Fallback: legacy direct query on the guardians collection (pre-migration).
    var candidates = [];
    try {
      var ccSnap = await window.fbGetDoc(window.fbDoc(window.firebaseDb, 'classCodes', code));
      if (ccSnap.exists() && ccSnap.data().ownerId) {
        candidates = [{ id: ccSnap.data().ownerId, classCode: code }];
      }
    } catch (e) { /* collection may not exist yet */ }
    if (!candidates.length) {
      // Legacy fallback: direct guardians query. Under rules v2 this is
      // auth-gated, so unauthenticated lookups throw permission-denied —
      // treat that the same as "no match" (the classCodes lookup above is
      // the real path for all post-v2 accounts).
      var snap = null;
      try {
        var q = window.fbQuery(window.fbCollection(window.firebaseDb, 'teachers'), window.fbWhere('classCode', '==', code));
        snap = await window.fbGetDocs(q);
      } catch (permErr) { snap = null; }
      if (!snap || snap.empty) { btn.textContent = 'Enter →'; btn.disabled = false; showError('studentError', 'Code not found. Ask your parent (or teacher) to check it!'); return; }
      // Duplicate-code safety: prefer the doc that actually has students
      candidates = snap.docs.map(function (d) { return { id: d.id, ...d.data() }; });
    }
    stuTeacherData = candidates[0];
    stuStudents = [];
    for (var c = 0; c < candidates.length; c++) {
      var sq = window.fbQuery(window.fbCollection(window.firebaseDb, 'students'), window.fbWhere('teacherId', '==', candidates[c].id));
      var sSnap = await window.fbGetDocs(sq);
      if (!sSnap.empty) {
        stuTeacherData = candidates[c];
        stuStudents = []; sSnap.forEach(function (d) { stuStudents.push({ id: d.id, ...d.data() }); });
        break;
      }
    }
    if (!stuStudents.length) { btn.textContent = 'Enter →'; btn.disabled = false; showError('studentError', 'No players in this family yet. A grown-up needs to add you first!'); return; }
    btn.textContent = 'Enter →'; btn.disabled = false;
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
    resetLoginAttempts();
    // Skip the grade step entirely for small rosters (families) — go straight to names
    if (stuStudents.length <= 8) {
      renderNameButtons(stuStudents);
      stuStep = 3; showStuStep();
    } else {
      stuStep = 2; showStuStep();
    }
  } catch (e) { btn.textContent = 'Enter →'; btn.disabled = false; showError('studentError', 'Something went wrong.'); console.error(e); }
};

function renderNameButtons(list) {
  var sorted = list.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var h = '';
  sorted.forEach(function (s) {
    h += '<button class="name-pick" onclick="pickStudent(\'' + s.id + '\')">' + esc(s.name) + '</button>';
  });
  document.getElementById('nameButtons').innerHTML = h;
}

window.pickGrade = function (grade) {
  var filtered = stuStudents.filter(function (s) { return (s.grade || 'Other') === grade; });
  renderNameButtons(filtered);
  stuStep = 3; showStuStep();
};

window.pickStudent = async function (id) {
  var student = stuStudents.find(function (s) { return s.id === id; });
  if (!student) return;
  // Clear any stale guardian session data first
  localStorage.removeItem('userRole');
  localStorage.removeItem('odaUserRole');
  localStorage.removeItem('teacherId');
  localStorage.setItem('studentId', student.id);
  localStorage.setItem('studentName', student.name);
  // Best-effort anonymous auth so progress writes pass the hardened rules
  if (window.amgEnsureAnonAuth) { try { await window.amgEnsureAnonAuth(); } catch (e) {} }
  window.location.href = 'student.html';
};

// ============================================
// Guardian Login (parents + teachers, same account system)
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
    clearKidSession();
    window.location.href = 'teacher.html';
  } catch (e) {
    btn.textContent = 'Sign In'; btn.disabled = false;
    var msg = e.code === 'auth/invalid-credential' ? 'Wrong email or password' : 'Error: ' + e.message;
    showError('teacherError', msg);
  }
};

function clearKidSession() {
  localStorage.removeItem('studentId');
  localStorage.removeItem('studentName');
  localStorage.removeItem('classCode');
  localStorage.removeItem('parentStudentId');
  localStorage.removeItem('parentStudentName');
}

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
      var classCode = await window.odaGenerateClassCode();
      await window.fbSetDoc(teacherRef, {
        name: user.displayName || '', email: user.email || '',
        accountType: 'parent',
        district: '', school: '', team: '', program: '', gradeLevels: '',
        classCode: classCode, classes: ['My Kids'],
        createdAt: new Date().toISOString()
      });
    } else if (!teacherSnap.data().classCode) {
      var code = String(Math.floor(100000 + Math.random() * 900000));
      await window.fbSetDoc(teacherRef, { classCode: code }, { merge: true });
    }
    clearKidSession();
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
// Guardian Signup (family account — parent by default, teacher optional)
// ============================================
window.guardianSignup = async function () {
  var name = document.getElementById('signupName').value.trim();
  var email = document.getElementById('signupEmail').value.trim();
  var pass = document.getElementById('signupPass').value;
  var roleEl = document.getElementById('signupRole');
  var role = roleEl ? roleEl.value : 'parent';

  if (!name || !email || !pass) { showError('signupError', 'Fill in name, email and password!'); return; }
  if (pass.length < 6) { showError('signupError', 'Password needs at least 6 characters'); return; }

  var sbtn = document.getElementById('signupSubmit');
  sbtn.innerHTML = '<span class="spinner"></span>'; sbtn.disabled = true;

  try {
    var classCode = await window.odaGenerateClassCode();
    var cred = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, pass);
    await window.fbSetDoc(window.fbDoc(window.firebaseDb, 'teachers', cred.user.uid), {
      name: name, email: email,
      accountType: role,
      district: '', school: '', team: '', program: '', gradeLevels: '',
      classCode: classCode, classes: [role === 'teacher' ? 'All Students' : 'My Kids'],
      createdAt: new Date().toISOString()
    });
    try { await window.sendEmailVerification(cred.user); } catch (ev) { console.warn('Verification email:', ev); }
    clearKidSession();
    window.location.href = 'teacher.html';
  } catch (e) {
    sbtn.textContent = 'Create Account \u{1F680}'; sbtn.disabled = false;
    var msg = e.code === 'auth/email-already-in-use' ? 'Email already has an account' : 'Error: ' + e.message;
    showError('signupError', msg);
  }
};
// Back-compat alias (old inline handlers)
window.teacherSignup = window.guardianSignup;

// ============================================
// Quick Progress Check (kid name + parent code, no account)
// ============================================
window.parentLogin = async function () {
  if (!checkLoginThrottle('parentError')) return;
  var name = document.getElementById('parentChildName').value.trim();
  var code = document.getElementById('parentCode').value.trim();
  if (!name || !code) { showError('parentError', 'Enter your child\'s name and code!'); return; }
  recordLoginAttempt();

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
      showError('parentError', 'Not found. Check the name spelling and code.');
      return;
    }
    localStorage.setItem('parentStudentId', snap.docs[0].id);
    localStorage.setItem('parentStudentName', snap.docs[0].data().name);
    window.location.href = 'parent.html';
  } catch (e) {
    pbtn.textContent = 'View Progress'; pbtn.disabled = false;
    console.error('Parent login error:', e);
    if (e.message && e.message.includes('index')) { showError('parentError', 'Database setup needed. Contact support.'); }
    else { showError('parentError', 'Something went wrong. Try again.'); }
  }
};

// ============================================
// Game Marquee (registry-driven visual discovery)
// ============================================
(function () {
  var games = window.ODA_GAMES || [];
  if (!games.length) return;
  function chipRow(list) {
    var h = '';
    list.forEach(function (g) {
      h += '<div class="gm-chip" style="--c1:' + g.colors[0] + ';--c2:' + g.colors[1] + '">';
      h += '<span class="gm-emoji">' + g.emoji + '</span><span class="gm-title">' + esc(g.title) + '</span></div>';
    });
    return h;
  }
  function fillRow(elId, list) {
    var el = document.getElementById(elId);
    if (!el) return;
    // Duplicate content for a seamless CSS loop
    el.innerHTML = '<div class="gm-track">' + chipRow(list) + chipRow(list) + '</div>';
  }
  var half = Math.ceil(games.length / 2);
  fillRow('gmRow1', games.slice(0, half));
  fillRow('gmRow2', games.slice(half));
})();

// ============================================
// Scroll-reveal: sections rise into view as you scroll.
// Cheap (one IntersectionObserver), respects reduced-motion, no jank.
// ============================================
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (reduce || !('IntersectionObserver' in window)) {
    for (var i = 0; i < els.length; i++) els[i].classList.add('in');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

// ============================================
// Keyboard Navigation (Enter key support)
// ============================================
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var active = document.activeElement;
  if (!active) return;
  if (active.id === 'classCodeInput') window.checkClassCode();
  else if (active.id === 'teacherEmail' || active.id === 'teacherPass') window.teacherLogin();
  else if (active.id === 'signupPass' || active.id === 'signupEmail' || active.id === 'signupName') window.guardianSignup();
  else if (active.id === 'parentCode' || active.id === 'parentChildName') window.parentLogin();
});

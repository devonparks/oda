/**
 * ODA Core - Shared configuration and utilities
 * Used by all ODA Hub pages to eliminate code duplication
 *
 * SECURITY: This file is loaded on every page and handles:
 *   - XSS protection (esc function)
 *   - Clickjacking protection (framebusting)
 *   - Session timeout (auto-logout after inactivity)
 *   - Input sanitization and validation
 *   - Security meta tag injection (CSP, Referrer-Policy, Permissions-Policy)
 */

// ============================================
// SECURITY: Anti-clickjacking (MITRE T1557)
// Prevent the site from being iframed by malicious sites
// ============================================
(function() {
  if (window.self !== window.top) {
    // Allow same-origin iframes (e.g., file preview embeds)
    try { if (window.top.location.hostname === window.location.hostname) return; } catch(e) {}
    // Block cross-origin iframing
    document.body && (document.body.innerHTML = '');
    window.top.location = window.self.location;
  }
})();

// ============================================
// SECURITY: Inject security meta tags (CSP, headers)
// GitHub Pages can't set HTTP headers, so we use meta tags
// OWASP A05 Security Misconfiguration
// ============================================
(function() {
  var head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;

  // Content-Security-Policy: restrict script/style sources
  var csp = document.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com https://us-central1-oda-hub-d4bef.cloudfunctions.net https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://us-central1-oda-hub-d4bef.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com wss://*.firebaseio.com https://www.google.com/recaptcha/",
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://docs.google.com https://www.youtube.com https://youtube.com https://www.google.com/recaptcha/ https://recaptcha.google.com/",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; '));
  head.insertBefore(csp, head.firstChild);

  // Referrer-Policy: don't leak URLs to third parties
  var rp = document.createElement('meta');
  rp.setAttribute('name', 'referrer');
  rp.setAttribute('content', 'strict-origin-when-cross-origin');
  head.appendChild(rp);

  // Permissions-Policy: disable unnecessary browser APIs
  var pp = document.createElement('meta');
  pp.setAttribute('http-equiv', 'Permissions-Policy');
  pp.setAttribute('content', 'geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
  head.appendChild(pp);
})();

// Firebase Configuration (single source of truth)
window.ODA_CONFIG = {
  firebase: {
    apiKey: "AIzaSyAAHwgxErk_M53tYXAMZmgA78m9AiRsEPk",
    authDomain: "oda-hub-d4bef.firebaseapp.com",
    projectId: "oda-hub-d4bef",
    storageBucket: "oda-hub-d4bef.firebasestorage.app",
    messagingSenderId: "632797371461",
    appId: "1:632797371461:web:5ec619138d64c0cbc3d72c"
  },
  aiEndpoint: "https://us-central1-oda-hub-d4bef.cloudfunctions.net/ai",
  firebaseVersion: "11.8.1"
};

// ============================================
// HTML Escape (XSS protection — OWASP A03 Injection)
// ============================================
window.esc = function(s) {
  if (s === null || s === undefined) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

// ============================================
// SECURITY: Input validation helpers
// ============================================
window.odaSanitize = function(input, maxLen) {
  if (typeof input !== 'string') return '';
  var s = input.trim();
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  // Strip null bytes and control characters (OWASP A03)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return s;
};

// Validate URL to prevent javascript: protocol injection (OWASP A03)
window.odaSafeUrl = function(url) {
  if (!url || typeof url !== 'string') return '';
  var trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '';
};

// ============================================
// SECURITY: Session timeout (OWASP A07 / MITRE T1078)
// Auto-expire student sessions after 4 hours of inactivity
// ============================================
(function() {
  var SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
  var ACTIVITY_KEY = 'odaLastActivity';

  function updateActivity() {
    try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch(e) {}
  }

  function checkSession() {
    var last = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
    if (last && (Date.now() - last > SESSION_TIMEOUT_MS)) {
      // Session expired — clear all auth data
      localStorage.removeItem('studentId');
      localStorage.removeItem('studentName');
      localStorage.removeItem('classCode');
      localStorage.removeItem('parentStudentId');
      localStorage.removeItem('parentStudentName');
      localStorage.removeItem(ACTIVITY_KEY);
      localStorage.removeItem('encourageShown');
      // Redirect to login if on a protected page
      var page = location.pathname.split('/').pop();
      var protectedPages = ['student.html', 'parent.html'];
      if (protectedPages.indexOf(page) >= 0) {
        window.location.href = 'index.html';
      }
    }
  }

  // Check on page load
  checkSession();
  // Update on user interaction
  ['click', 'keydown', 'scroll', 'touchstart'].forEach(function(evt) {
    document.addEventListener(evt, updateActivity, { passive: true, capture: false });
  });
  // Record initial activity
  updateActivity();
  // Periodic check every 5 minutes
  setInterval(checkSession, 5 * 60 * 1000);
})();

// ============================================
// Firebase Lazy Loader (for tool pages)
// ============================================
var _odaFbCache = null;
var _odaFbApp = null;
var _odaAppCheckInit = false;

// SECURITY: Initialize App Check (OWASP A01 / MITRE T1190)
// Verifies requests come from our real app, not scrapers/bots
async function _initAppCheck(app) {
  if (_odaAppCheckInit) return;
  _odaAppCheckInit = true;
  try {
    var cdnBase = 'https://www.gstatic.com/firebasejs/' + ODA_CONFIG.firebaseVersion + '/';
    var appCheckMod = await import(cdnBase + 'firebase-app-check.js');
    appCheckMod.initializeAppCheck(app, {
      provider: new appCheckMod.ReCaptchaV3Provider('6LcZII0sAAAAAEhbfDWiwP4-l9DTJIQOwFa2CzD_'),
      isTokenAutoRefreshEnabled: true
    });
  } catch(e) { console.warn('App Check init:', e); }
}

window.getFirebaseDB = async function() {
  if (_odaFbCache) return _odaFbCache;
  var cdnBase = 'https://www.gstatic.com/firebasejs/' + ODA_CONFIG.firebaseVersion + '/';
  var appMod = await import(cdnBase + 'firebase-app.js');
  var fsMod = await import(cdnBase + 'firebase-firestore.js');
  try { _odaFbApp = appMod.getApp(); } catch(e) { _odaFbApp = appMod.initializeApp(ODA_CONFIG.firebase); }
  await _initAppCheck(_odaFbApp);
  var db = fsMod.getFirestore(_odaFbApp);
  _odaFbCache = { app: _odaFbApp, db: db, fsMod: fsMod };
  return _odaFbCache;
};

window.getFirebaseAuth = async function() {
  var cdnBase = 'https://www.gstatic.com/firebasejs/' + ODA_CONFIG.firebaseVersion + '/';
  var appMod = await import(cdnBase + 'firebase-app.js');
  var authMod = await import(cdnBase + 'firebase-auth.js');
  var app;
  try { app = appMod.getApp(); } catch(e) { app = appMod.initializeApp(ODA_CONFIG.firebase); }
  await _initAppCheck(app);
  var auth = authMod.getAuth(app);
  return { app: app, auth: auth, authMod: authMod };
};

window.getFirebaseStorage = async function() {
  var cdnBase = 'https://www.gstatic.com/firebasejs/' + ODA_CONFIG.firebaseVersion + '/';
  var appMod = await import(cdnBase + 'firebase-app.js');
  var storageMod = await import(cdnBase + 'firebase-storage.js');
  var app;
  try { app = appMod.getApp(); } catch(e) { app = appMod.initializeApp(ODA_CONFIG.firebase); }
  await _initAppCheck(app);
  var storage = storageMod.getStorage(app);
  return { app: app, storage: storage, storageMod: storageMod };
};

// ============================================
// AI Helper (calls Cloud Function with auth)
// ============================================
window.odaAI = async function(prompt, options) {
  options = options || {};
  var headers = { 'Content-Type': 'application/json' };

  // Try to get Firebase Auth token for authenticated requests
  try {
    var authData = await window.getFirebaseAuth();
    var user = authData.auth.currentUser;
    if (user) {
      var token = await user.getIdToken();
      headers['Authorization'] = 'Bearer ' + token;
    }
  } catch(e) { /* student users may not have Firebase Auth */ }

  var resp = await fetch(ODA_CONFIG.aiEndpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      prompt: prompt,
      max_tokens: options.max_tokens || 1000,
      temperature: options.temperature || 0.9,
      system: options.system || undefined,
      model: options.model || undefined  // "sonnet" (default) or "opus" (teacher-only)
    })
  });

  if (!resp.ok) throw new Error('AI request failed (' + resp.status + ')');
  var data = await resp.json();

  // Extract text from response (handles different response formats)
  if (data.content && data.content[0] && data.content[0].text) return data.content[0].text;
  if (data.response) return data.response;
  if (data.text) return data.text;
  if (data.result) return data.result;
  return 'Unable to generate response.';
};

// ============================================
// Unique Class Code Generator
// ============================================
window.odaGenerateClassCode = async function() {
  var db, fsMod;
  try {
    var fb = await window.getFirebaseDB();
    db = fb.db; fsMod = fb.fsMod;
  } catch(e) { return String(Math.floor(100000 + Math.random() * 900000)); }
  for (var i = 0; i < 10; i++) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var q = fsMod.query(fsMod.collection(db, 'teachers'), fsMod.where('classCode', '==', code));
    var snap = await fsMod.getDocs(q);
    if (snap.empty) return code;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
};

// ============================================
// UI Helpers
// ============================================

// Loading state for buttons
window.btnLoading = function(btn, text) {
  btn.dataset.originalText = btn.textContent;
  btn.innerHTML = text ? text : '<span style="display:inline-block;width:16px;height:16px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:odaSpin .6s linear infinite;vertical-align:middle;margin-right:6px"></span> Loading...';
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';
};

window.btnReset = function(btn, text) {
  btn.innerHTML = text || btn.dataset.originalText || 'Submit';
  btn.disabled = false;
  btn.style.opacity = '';
  btn.style.pointerEvents = '';
};

// Toast notifications
window.odaToast = function(message, type) {
  type = type || 'info';
  var colors = { info: '#118ab2', success: '#06d6a0', error: '#ef476f', warning: '#ffd166' };
  var textColors = { info: '#fff', success: '#0a0e1a', error: '#fff', warning: '#0a0e1a' };
  var toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:' + (colors[type] || colors.info) + ';color:' + (textColors[type] || '#fff') + ';padding:12px 24px;border-radius:12px;font-family:Outfit,sans-serif;font-weight:600;font-size:14px;z-index:10000;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:odaFadeIn .3s ease;max-width:90vw;text-align:center';
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.animation = 'odaFadeOut .3s ease forwards';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
};

// Confetti celebration
window.odaConfetti = function() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var colors = ['#06d6a0', '#ffd166', '#118ab2', '#ef476f', '#f0f4ff'];
  for (var i = 0; i < 40; i++) {
    var c = document.createElement('div');
    c.style.cssText = 'position:fixed;width:' + (6 + Math.random() * 6) + 'px;height:' + (6 + Math.random() * 6) + 'px;background:' + colors[Math.floor(Math.random() * colors.length)] + ';left:' + Math.random() * 100 + 'vw;top:-10px;z-index:10000;border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';pointer-events:none';
    document.body.appendChild(c);
    var duration = 1500 + Math.random() * 2000;
    c.animate([
      { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
      { transform: 'translateY(' + (window.innerHeight + 50) + 'px) rotate(' + (360 + Math.random() * 720) + 'deg)', opacity: 0 }
    ], { duration: duration, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' });
    setTimeout((function(el) { return function() { el.remove(); }; })(c), duration);
  }
};

// ============================================
// Accessibility Helpers
// ============================================

// Focus trap for modals — call on open, returns cleanup function
window.odaTrapFocus = function(modalEl) {
  var focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var previousFocus = document.activeElement;
  function handler(e) {
    if (e.key !== 'Tab') return;
    var els = modalEl.querySelectorAll(focusable);
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  modalEl.addEventListener('keydown', handler);
  // Focus first focusable element
  setTimeout(function() {
    var els = modalEl.querySelectorAll(focusable);
    if (els.length) els[0].focus();
  }, 50);
  // Return cleanup function
  return function() {
    modalEl.removeEventListener('keydown', handler);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  };
};

// Screen-reader live announcer
window.odaAnnounce = function(message) {
  var el = document.getElementById('oda-sr-announce');
  if (!el) {
    el = document.createElement('div');
    el.id = 'oda-sr-announce';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0';
    document.body.appendChild(el);
  }
  el.textContent = '';
  setTimeout(function() { el.textContent = message; }, 100);
};

// Add global animations CSS
(function() {
  var style = document.createElement('style');
  style.textContent = '@keyframes odaSpin{to{transform:rotate(360deg)}}@keyframes odaFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes odaFadeOut{to{opacity:0;transform:translateX(-50%) translateY(-10px)}}';
  document.head.appendChild(style);
})();

// ============================================
// File Blob Helpers (shared by teacher + student)
// ============================================
var _blobCache = {};
window.dataUriToBlobUrl = function(id, dataUri) {
  if (_blobCache[id]) return _blobCache[id];
  try {
    var parts = dataUri.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var raw = atob(parts[1]);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    var blob = new Blob([arr], { type: mime });
    _blobCache[id] = URL.createObjectURL(blob);
    return _blobCache[id];
  } catch(e) { console.error('Blob conversion failed:', e); return dataUri; }
};
// Revoke blob URLs on page unload to free memory
window.addEventListener('beforeunload', function() {
  for (var id in _blobCache) { try { URL.revokeObjectURL(_blobCache[id]); } catch(e){} }
});

// ============================================
// Cosmetics Loader
// ============================================
window.loadCosmetics = async function(studentId) {
  if (!studentId) return {};
  try {
    var fb = await window.getFirebaseDB();
    var snap = await fb.fsMod.getDoc(fb.fsMod.doc(fb.db, 'students', studentId));
    if (!snap.exists()) return {};
    var d = snap.data();
    return d.equipped || {};
  } catch(e) { console.warn('[ODA] Cosmetics load error:', e); return {}; }
};

// Win celebration with cosmetic effects
window.odaCelebrate = function(effectType) {
  effectType = effectType || 'confetti';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (effectType === 'confetti' || effectType === 'default') {
    window.odaConfetti();
    return;
  }

  var colors, count, shape;
  switch(effectType) {
    case 'stars':
      colors = ['#fbbf24', '#fcd34d', '#fef3c7', '#f59e0b', '#ffffff'];
      count = 35;
      _spawnParticles(colors, count, '★');
      break;
    case 'snow':
      colors = ['#e2e8f0', '#f1f5f9', '#cbd5e1', '#ffffff', '#dbeafe'];
      count = 50;
      _spawnParticles(colors, count, '❄');
      break;
    case 'fireworks':
      _fireworksBurst();
      break;
    case 'lightning':
      _lightningFlash();
      window.odaConfetti();
      break;
    case 'meteors':
      colors = ['#ef4444', '#f97316', '#fbbf24', '#ff6b35', '#ffd166'];
      count = 20;
      _spawnParticles(colors, count, '☄');
      break;
    case 'bubbles':
      colors = ['rgba(59,130,246,0.6)', 'rgba(34,211,238,0.6)', 'rgba(168,85,247,0.6)', 'rgba(6,214,160,0.6)', 'rgba(236,72,153,0.6)'];
      count = 30;
      _spawnBubbles(colors, count);
      break;
    case 'nuclear':
      _nuclearFlash();
      setTimeout(function(){ window.odaConfetti(); }, 300);
      setTimeout(function(){ window.odaConfetti(); }, 600);
      break;
    case 'aurora':
      _auroraWave();
      break;
    default:
      window.odaConfetti();
  }
};

function _spawnParticles(colors, count, char) {
  for (var i = 0; i < count; i++) {
    var p = document.createElement('div');
    p.textContent = char;
    p.style.cssText = 'position:fixed;font-size:' + (14 + Math.random() * 14) + 'px;left:' + (Math.random() * 100) + 'vw;top:-20px;z-index:10000;pointer-events:none;color:' + colors[Math.floor(Math.random() * colors.length)];
    document.body.appendChild(p);
    var dur = 1500 + Math.random() * 2000;
    p.animate([
      { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: 'translateY(' + (window.innerHeight + 50) + 'px) rotate(' + (180 + Math.random() * 540) + 'deg) scale(0.3)', opacity: 0 }
    ], { duration: dur, easing: 'ease-in' });
    setTimeout((function(el) { return function() { el.remove(); }; })(p), dur);
  }
}

function _spawnBubbles(colors, count) {
  for (var i = 0; i < count; i++) {
    var size = 10 + Math.random() * 30;
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;width:' + size + 'px;height:' + size + 'px;border-radius:50%;left:' + (Math.random() * 100) + 'vw;bottom:-30px;z-index:10000;pointer-events:none;background:' + colors[Math.floor(Math.random() * colors.length)] + ';border:1px solid rgba(255,255,255,0.3)';
    document.body.appendChild(b);
    var dur = 2000 + Math.random() * 2000;
    b.animate([
      { transform: 'translateY(0) scale(1)', opacity: 0.8 },
      { transform: 'translateY(-' + (window.innerHeight + 50) + 'px) scale(0.5)', opacity: 0 }
    ], { duration: dur, easing: 'ease-out' });
    setTimeout((function(el) { return function() { el.remove(); }; })(b), dur);
  }
}

function _fireworksBurst() {
  var burstColors = [['#ef4444','#f97316','#fbbf24'], ['#3b82f6','#22d3ee','#a855f7'], ['#06d6a0','#ffd166','#118ab2']];
  for (var b = 0; b < 3; b++) {
    setTimeout((function(colors, delay) {
      return function() {
        var cx = 20 + Math.random() * 60;
        var cy = 20 + Math.random() * 40;
        for (var i = 0; i < 15; i++) {
          var p = document.createElement('div');
          var angle = (i / 15) * Math.PI * 2;
          var dist = 80 + Math.random() * 120;
          p.style.cssText = 'position:fixed;width:6px;height:6px;border-radius:50%;left:' + cx + 'vw;top:' + cy + 'vh;z-index:10000;pointer-events:none;background:' + colors[i % colors.length];
          document.body.appendChild(p);
          p.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: 'translate(' + (Math.cos(angle) * dist) + 'px,' + (Math.sin(angle) * dist) + 'px) scale(0)', opacity: 0 }
          ], { duration: 800 + Math.random() * 400, easing: 'ease-out' });
          setTimeout((function(el) { return function() { el.remove(); }; })(p), 1200);
        }
      };
    })(burstColors[b], b * 400), b * 400);
  }
}

function _lightningFlash() {
  var flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;background:rgba(251,191,36,0.15)';
  document.body.appendChild(flash);
  flash.animate([{opacity:0},{opacity:1},{opacity:0},{opacity:0.7},{opacity:0}], {duration:400});
  setTimeout(function(){ flash.remove(); }, 400);
}

function _nuclearFlash() {
  var flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.8),rgba(239,68,68,0.3),transparent)';
  document.body.appendChild(flash);
  flash.animate([{opacity:0,transform:'scale(0.3)'},{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.5)'}], {duration:800, easing:'ease-out'});
  setTimeout(function(){ flash.remove(); }, 800);
}

function _auroraWave() {
  var aurora = document.createElement('div');
  aurora.style.cssText = 'position:fixed;top:0;left:0;right:0;height:40vh;z-index:9999;pointer-events:none;background:linear-gradient(180deg,rgba(6,214,160,0.3),rgba(59,130,246,0.2),rgba(168,85,247,0.15),transparent);filter:blur(20px)';
  document.body.appendChild(aurora);
  aurora.animate([{opacity:0,transform:'translateY(-100%)'},{opacity:1,transform:'translateY(0)'},{opacity:0.5,transform:'translateY(10%)'},{opacity:0,transform:'translateY(20%)'}], {duration:2500, easing:'ease-in-out'});
  setTimeout(function(){ aurora.remove(); }, 2500);
  // Also do regular confetti
  setTimeout(function(){ window.odaConfetti(); }, 500);
}

console.log('[ODA] Core loaded v1.3');

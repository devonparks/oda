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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com https://us-central1-oda-hub-d4bef.cloudfunctions.net https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://cdn.jsdelivr.net",
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
      var protectedPages = ['student.html', 'parent.html', 'shop.html'];
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

// ============================================
// In-Game Shop System (shared across all games)
// ============================================
window.odaShop = (function() {
  var _cache = {}; // { studentId: { coins, inventory, gameCosmetics } }
  var _studentId = null;

  function _getSid() {
    if (_studentId) return _studentId;
    _studentId = localStorage.getItem('studentId') || '';
    return _studentId;
  }

  /** Load student shop data from Firestore (coins, inventory, gameCosmetics) */
  async function loadShopData() {
    var sid = _getSid();
    if (!sid || sid.startsWith('anon_')) return { coins: 0, inventory: [], gameCosmetics: {} };
    if (_cache[sid]) return _cache[sid];
    try {
      var fb = await window.getFirebaseDB();
      var snap = await fb.fsMod.getDoc(fb.fsMod.doc(fb.db, 'students', sid));
      if (snap.exists()) {
        var d = snap.data();
        _cache[sid] = {
          coins: d.coins || 0,
          inventory: d.inventory || [],
          gameCosmetics: d.gameCosmetics || {}
        };
      } else {
        _cache[sid] = { coins: 0, inventory: [], gameCosmetics: {} };
      }
    } catch(e) {
      console.warn('[odaShop] Load failed:', e);
      _cache[sid] = { coins: 0, inventory: [], gameCosmetics: {} };
    }
    return _cache[sid];
  }

  /** Check if player owns an item */
  function owns(itemId) {
    var sid = _getSid();
    var data = _cache[sid];
    if (!data) return false;
    // Check global inventory
    if (data.inventory && data.inventory.indexOf(itemId) >= 0) return true;
    // Check all game cosmetics inventories
    if (data.gameCosmetics) {
      for (var g in data.gameCosmetics) {
        var gc = data.gameCosmetics[g];
        if (gc && gc.owned && gc.owned.indexOf(itemId) >= 0) return true;
      }
    }
    return false;
  }

  /** Buy an item for a specific game */
  async function buy(gameId, itemId, cost) {
    var sid = _getSid();
    if (!sid || sid.startsWith('anon_')) return false;
    var data = _cache[sid] || await loadShopData();
    if (data.coins < cost) return false;
    try {
      var fb = await window.getFirebaseDB();
      var ref = fb.fsMod.doc(fb.db, 'students', sid);
      // Build the update — add to gameCosmetics.{gameId}.owned array
      var ownedKey = 'gameCosmetics.' + gameId + '.owned';
      var update = {};
      update.coins = fb.fsMod.increment(-cost);
      update[ownedKey] = fb.fsMod.arrayUnion(itemId);
      await fb.fsMod.setDoc(ref, update, { merge: true });
      // Update local cache
      data.coins -= cost;
      if (!data.gameCosmetics[gameId]) data.gameCosmetics[gameId] = { owned: [], equipped: {} };
      if (data.gameCosmetics[gameId].owned.indexOf(itemId) < 0) {
        data.gameCosmetics[gameId].owned.push(itemId);
      }
      return true;
    } catch(e) {
      console.error('[odaShop] Buy failed:', e);
      return false;
    }
  }

  /** Equip an item for a specific game + slot */
  async function equip(gameId, slot, itemData) {
    var sid = _getSid();
    if (!sid || sid.startsWith('anon_')) return false;
    var data = _cache[sid] || await loadShopData();
    try {
      var fb = await window.getFirebaseDB();
      var ref = fb.fsMod.doc(fb.db, 'students', sid);
      var equipKey = 'gameCosmetics.' + gameId + '.equipped.' + slot;
      var update = {};
      update[equipKey] = itemData;
      await fb.fsMod.setDoc(ref, update, { merge: true });
      // Update local cache
      if (!data.gameCosmetics[gameId]) data.gameCosmetics[gameId] = { owned: [], equipped: {} };
      data.gameCosmetics[gameId].equipped[slot] = itemData;
      return true;
    } catch(e) {
      console.error('[odaShop] Equip failed:', e);
      return false;
    }
  }

  /** Get equipped item for a game + slot */
  function getEquipped(gameId, slot) {
    var sid = _getSid();
    var data = _cache[sid];
    if (!data || !data.gameCosmetics || !data.gameCosmetics[gameId]) return null;
    return data.gameCosmetics[gameId].equipped ? data.gameCosmetics[gameId].equipped[slot] : null;
  }

  /** Get all owned items for a game */
  function getOwned(gameId) {
    var sid = _getSid();
    var data = _cache[sid];
    if (!data || !data.gameCosmetics || !data.gameCosmetics[gameId]) return [];
    return data.gameCosmetics[gameId].owned || [];
  }

  /** Get coin balance */
  function getCoins() {
    var sid = _getSid();
    var data = _cache[sid];
    return data ? data.coins : 0;
  }

  /** Invalidate cache (call after coin changes from gameplay) */
  function invalidate() {
    _cache = {};
  }

  /**
   * Render a shop panel into a container element.
   * @param {string} gameId - unique game identifier (e.g., 'snake', 'checkers')
   * @param {Array} catalog - array of items: { id, name, icon/emoji, cost, slot, desc?, rarity? }
   * @param {string} containerId - DOM element ID to render into
   * @param {object} opts - { onEquip?: function(item), onBuy?: function(item) }
   */
  async function renderShopPanel(gameId, catalog, containerId, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) return;
    var data = await loadShopData();
    var coins = data.coins;
    var owned = getOwned(gameId);
    var isTeacher = localStorage.getItem('userRole') === 'teacher' || localStorage.getItem('odaUserRole') === 'teacher';

    var h = '<div class="oda-shop-header">';
    h += '<h3 class="oda-shop-title">\u{1F6CD}\uFE0F Customize</h3>';
    h += '<div class="oda-shop-coins">\u{1FA99} ' + (isTeacher ? '\u221E' : coins) + '</div>';
    h += '</div>';

    // Group by slot
    var slots = {};
    catalog.forEach(function(item) {
      var s = item.slot || 'default';
      if (!slots[s]) slots[s] = [];
      slots[s].push(item);
    });

    for (var slotName in slots) {
      var items = slots[slotName];
      h += '<div class="oda-shop-section">';
      h += '<div class="oda-shop-section-title">' + esc(slotName) + '</div>';
      h += '<div class="oda-shop-grid">';
      items.forEach(function(item) {
        var isOwned = isTeacher || owned.indexOf(item.id) >= 0 || item.cost === 0;
        var isEquipped = false;
        var eq = getEquipped(gameId, item.slot || 'default');
        if (eq && eq.id === item.id) isEquipped = true;
        var canAfford = isTeacher || coins >= item.cost;

        var cls = 'oda-shop-item';
        if (isEquipped) cls += ' equipped';
        else if (isOwned) cls += ' owned';
        else if (!canAfford) cls += ' locked';

        h += '<button class="' + cls + '" onclick="odaShop._handleClick(\'' + gameId + '\',\'' + esc(item.id) + '\')">';
        h += '<div class="oda-shop-item-icon">' + (item.emoji || item.icon || '\u2728') + '</div>';
        h += '<div class="oda-shop-item-name">' + esc(item.name) + '</div>';
        if (isEquipped) {
          h += '<div class="oda-shop-item-status equipped">\u2705 Equipped</div>';
        } else if (isOwned) {
          h += '<div class="oda-shop-item-status owned">Tap to equip</div>';
        } else {
          h += '<div class="oda-shop-item-cost' + (canAfford ? '' : ' cant-afford') + '">\u{1FA99} ' + item.cost + '</div>';
        }
        h += '</button>';
      });
      h += '</div></div>';
    }

    container.innerHTML = h;

    // Inject styles if not already present
    if (!document.getElementById('odaShopStyles')) {
      var style = document.createElement('style');
      style.id = 'odaShopStyles';
      style.textContent = [
        '.oda-shop-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:0 4px}',
        '.oda-shop-title{font-family:Fredoka,sans-serif;font-size:20px;font-weight:700;color:var(--text,#f0f4ff)}',
        '.oda-shop-coins{background:rgba(255,209,102,.15);border:1px solid rgba(255,209,102,.3);border-radius:20px;padding:6px 14px;font-size:14px;font-weight:700;color:var(--gold,#ffd166);font-family:Fredoka,sans-serif}',
        '.oda-shop-section{margin-bottom:16px}',
        '.oda-shop-section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text2,#a8b2c8);margin-bottom:8px;padding:0 4px}',
        '.oda-shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px}',
        '.oda-shop-item{background:var(--surface,#111827);border:2px solid var(--border,#2a3450);border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;transition:all .15s;font-family:Outfit,sans-serif}',
        '.oda-shop-item:hover{border-color:var(--accent,#06d6a0);transform:translateY(-2px)}',
        '.oda-shop-item:active{transform:scale(.96)}',
        '.oda-shop-item.equipped{border-color:var(--accent,#06d6a0);background:rgba(6,214,160,.08)}',
        '.oda-shop-item.locked{opacity:.5;cursor:not-allowed}',
        '.oda-shop-item-icon{font-size:32px;margin-bottom:4px}',
        '.oda-shop-item-name{font-size:11px;font-weight:700;color:var(--text,#f0f4ff);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.oda-shop-item-status{font-size:10px;font-weight:700}',
        '.oda-shop-item-status.equipped{color:var(--accent,#06d6a0)}',
        '.oda-shop-item-status.owned{color:var(--text2,#a8b2c8)}',
        '.oda-shop-item-cost{font-size:11px;font-weight:700;color:var(--gold,#ffd166)}',
        '.oda-shop-item-cost.cant-afford{color:var(--accent3,#ef476f)}',
        '@media(min-width:768px){.oda-shop-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}}'
      ].join('\n');
      document.head.appendChild(style);
    }

    // Store catalog + opts for click handler
    if (!window._odaShopCatalogs) window._odaShopCatalogs = {};
    window._odaShopCatalogs[gameId] = { catalog: catalog, containerId: containerId, opts: opts };
  }

  /** Internal click handler */
  async function _handleClick(gameId, itemId) {
    var info = window._odaShopCatalogs && window._odaShopCatalogs[gameId];
    if (!info) return;
    var item = info.catalog.find(function(i) { return i.id === itemId; });
    if (!item) return;

    var isTeacher = localStorage.getItem('userRole') === 'teacher' || localStorage.getItem('odaUserRole') === 'teacher';
    var isOwned = isTeacher || owns(itemId) || item.cost === 0;
    var eq = getEquipped(gameId, item.slot || 'default');
    var isEquipped = eq && eq.id === item.id;

    if (isEquipped) {
      // Already equipped — do nothing or unequip
      if (typeof odaToast === 'function') odaToast('Already equipped!', 'info');
      return;
    }

    if (isOwned) {
      // Equip it
      var eqData = { id: item.id };
      // Copy relevant item properties
      if (item.emoji) eqData.emoji = item.emoji;
      if (item.value) eqData.value = item.value;
      if (item.color) eqData.color = item.color;
      if (item.style) eqData.style = item.style;
      await equip(gameId, item.slot || 'default', eqData);
      if (typeof odaToast === 'function') odaToast('Equipped ' + item.name + '!', 'success');
      if (info.opts.onEquip) info.opts.onEquip(item);
      // Re-render
      await renderShopPanel(gameId, info.catalog, info.containerId, info.opts);
      return;
    }

    // Not owned — try to buy
    var data = _cache[_getSid()];
    if (!isTeacher && data && data.coins < item.cost) {
      if (typeof odaToast === 'function') odaToast('Need ' + (item.cost - data.coins) + ' more coins!', 'error');
      return;
    }

    // Confirm purchase
    if (!confirm('Buy ' + item.name + ' for ' + item.cost + ' coins?')) return;

    var success = await buy(gameId, item.id, item.cost);
    if (success) {
      // Auto-equip
      var eqData2 = { id: item.id };
      if (item.emoji) eqData2.emoji = item.emoji;
      if (item.value) eqData2.value = item.value;
      if (item.color) eqData2.color = item.color;
      if (item.style) eqData2.style = item.style;
      await equip(gameId, item.slot || 'default', eqData2);
      if (typeof odaToast === 'function') odaToast('Purchased & equipped ' + item.name + '!', 'success');
      if (typeof odaConfetti === 'function') odaConfetti();
      if (info.opts.onBuy) info.opts.onBuy(item);
      // Re-render
      await renderShopPanel(gameId, info.catalog, info.containerId, info.opts);
    } else {
      if (typeof odaToast === 'function') odaToast('Purchase failed. Try again.', 'error');
    }
  }

  return {
    loadShopData: loadShopData,
    owns: owns,
    buy: buy,
    equip: equip,
    getEquipped: getEquipped,
    getOwned: getOwned,
    getCoins: getCoins,
    invalidate: invalidate,
    renderShopPanel: renderShopPanel,
    _handleClick: _handleClick
  };
})();

/* ============================================
   Help / Tutorial System
   ============================================ */
window.odaHelp = (function() {
  var _injected = false;

  function injectStyles() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = 'odaHelpStyles';
    s.textContent = [
      '.oda-help-btn{position:fixed;bottom:16px;right:16px;width:44px;height:44px;border-radius:50%;background:var(--surface,#111827);border:2px solid var(--border,#2a3450);color:var(--accent,#06d6a0);font-size:22px;font-weight:800;font-family:Fredoka,sans-serif;cursor:pointer;z-index:90;display:flex;align-items:center;justify-content:center;transition:all .2s;box-shadow:0 4px 16px rgba(0,0,0,.3)}',
      '.oda-help-btn:hover{border-color:var(--accent,#06d6a0);transform:scale(1.1);box-shadow:0 0 20px rgba(6,214,160,.3)}',
      '.oda-help-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;animation:odaHelpFadeIn .25s ease;padding:16px}',
      '@keyframes odaHelpFadeIn{from{opacity:0}to{opacity:1}}',
      '.oda-help-modal{background:var(--surface,#111827);border:2px solid var(--border,#2a3450);border-radius:20px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;padding:28px 24px;position:relative;animation:odaHelpSlideUp .3s ease}',
      '@keyframes odaHelpSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
      '.oda-help-modal::-webkit-scrollbar{width:5px}',
      '.oda-help-modal::-webkit-scrollbar-thumb{background:var(--border,#2a3450);border-radius:3px}',
      '.oda-help-close{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text2,#a8b2c8);font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px;transition:all .15s}',
      '.oda-help-close:hover{color:var(--text,#f0f4ff);background:rgba(255,255,255,.05)}',
      '.oda-help-title{font-family:Fredoka,sans-serif;font-size:24px;font-weight:700;color:var(--accent,#06d6a0);margin-bottom:4px;padding-right:30px}',
      '.oda-help-sub{font-size:13px;color:var(--text2,#a8b2c8);margin-bottom:20px}',
      '.oda-help-section{margin-bottom:18px}',
      '.oda-help-section-title{font-family:Fredoka,sans-serif;font-size:14px;font-weight:700;color:var(--text,#f0f4ff);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;display:flex;align-items:center;gap:8px}',
      '.oda-help-section-title .hs-icon{font-size:18px}',
      '.oda-help-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}',
      '.oda-help-list li{font-size:13px;color:var(--text2,#a8b2c8);line-height:1.5;padding-left:16px;position:relative}',
      '.oda-help-list li::before{content:"\\2022";position:absolute;left:0;color:var(--accent,#06d6a0);font-weight:700}',
      '.oda-help-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
      '.oda-help-key{background:var(--bg,#0a0e1a);border:1px solid var(--border,#2a3450);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;color:var(--text,#f0f4ff);font-family:Outfit,sans-serif;display:inline-flex;align-items:center;gap:6px}',
      '.oda-help-key .hk-label{color:var(--text2,#a8b2c8);font-weight:500;font-size:12px}',
      '.oda-help-tip{background:rgba(6,214,160,.06);border:1px solid rgba(6,214,160,.15);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--text2,#a8b2c8);line-height:1.5}',
      '.oda-help-tip strong{color:var(--accent,#06d6a0)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /**
   * Add a floating "?" help button + modal to the page.
   * @param {Object} config
   * @param {string} config.title - Game name (e.g. "Chess")
   * @param {string} [config.emoji] - Title emoji
   * @param {string} [config.subtitle] - Short tagline
   * @param {Array}  config.sections - Array of {title, icon, items} or {title, icon, html}
   *   items: array of strings (rendered as bullet list)
   *   html: raw HTML string
   * @param {Array}  [config.controls] - Array of {key, action} for controls section
   * @param {string} [config.tip] - Pro tip text (supports <strong>)
   */
  function init(config) {
    injectStyles();

    // Create floating button
    var btn = document.createElement('button');
    btn.className = 'oda-help-btn';
    btn.textContent = '?';
    btn.title = 'How to Play';
    btn.onclick = function() { show(config); };
    document.body.appendChild(btn);
  }

  function show(config) {
    // Remove existing overlay
    var existing = document.getElementById('odaHelpOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'oda-help-overlay';
    overlay.id = 'odaHelpOverlay';

    var modal = document.createElement('div');
    modal.className = 'oda-help-modal';

    var h = '<button class="oda-help-close" onclick="document.getElementById(\'odaHelpOverlay\').remove()">&times;</button>';
    h += '<div class="oda-help-title">' + (config.emoji ? config.emoji + ' ' : '') + esc(config.title || 'How to Play') + '</div>';
    if (config.subtitle) h += '<div class="oda-help-sub">' + esc(config.subtitle) + '</div>';

    // Sections
    if (config.sections) {
      config.sections.forEach(function(sec) {
        h += '<div class="oda-help-section">';
        h += '<div class="oda-help-section-title">' + (sec.icon ? '<span class="hs-icon">' + sec.icon + '</span>' : '') + esc(sec.title) + '</div>';
        if (sec.items) {
          h += '<ul class="oda-help-list">';
          sec.items.forEach(function(item) { h += '<li>' + esc(item) + '</li>'; });
          h += '</ul>';
        }
        if (sec.html) h += sec.html;
        h += '</div>';
      });
    }

    // Controls
    if (config.controls) {
      h += '<div class="oda-help-section">';
      h += '<div class="oda-help-section-title"><span class="hs-icon">\u{1F3AE}</span>Controls</div>';
      h += '<div class="oda-help-controls">';
      config.controls.forEach(function(c) {
        h += '<div class="oda-help-key">' + esc(c.key) + ' <span class="hk-label">' + esc(c.action) + '</span></div>';
      });
      h += '</div></div>';
    }

    // Tip
    if (config.tip) {
      h += '<div class="oda-help-section">';
      h += '<div class="oda-help-section-title"><span class="hs-icon">\u{1F4A1}</span>Pro Tip</div>';
      h += '<div class="oda-help-tip">' + config.tip + '</div>';
      h += '</div>';
    }

    modal.innerHTML = h;
    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  /** Generate a How to Play HTML block for home screens */
  function homeSection(config) {
    injectStyles();
    var h = '<div style="max-width:420px;width:90%;margin:0 auto;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px 24px">';
    h += '<h3 style="font-size:13px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">How to Play</h3>';
    h += '<p style="font-size:13px;color:var(--text2);line-height:1.7;margin:0">' + esc(config.summary || '') + '</p>';
    if (config.controls) {
      h += '<div style="display:inline-flex;gap:6px;margin-top:10px;flex-wrap:wrap;justify-content:center">';
      config.controls.forEach(function(c) {
        h += '<span class="oda-help-key">' + esc(c.key) + '</span>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { init: init, show: show, homeSection: homeSection };
})();

console.log('[ODA] Core loaded v1.5');

/**
 * ODA Core - Shared configuration and utilities
 * Used by all ODA Hub pages to eliminate code duplication
 */

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
// HTML Escape (XSS protection)
// ============================================
window.esc = function(s) {
  if (s === null || s === undefined) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

// ============================================
// Firebase Lazy Loader (for tool pages)
// ============================================
var _odaFbCache = null;
var _odaFbApp = null;

window.getFirebaseDB = async function() {
  if (_odaFbCache) return _odaFbCache;
  var cdnBase = 'https://www.gstatic.com/firebasejs/' + ODA_CONFIG.firebaseVersion + '/';
  var appMod = await import(cdnBase + 'firebase-app.js');
  var fsMod = await import(cdnBase + 'firebase-firestore.js');
  try { _odaFbApp = appMod.getApp(); } catch(e) { _odaFbApp = appMod.initializeApp(ODA_CONFIG.firebase); }
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
  var auth = authMod.getAuth(app);
  return { app: app, auth: auth, authMod: authMod };
};

window.getFirebaseStorage = async function() {
  var cdnBase = 'https://www.gstatic.com/firebasejs/' + ODA_CONFIG.firebaseVersion + '/';
  var appMod = await import(cdnBase + 'firebase-app.js');
  var storageMod = await import(cdnBase + 'firebase-storage.js');
  var app;
  try { app = appMod.getApp(); } catch(e) { app = appMod.initializeApp(ODA_CONFIG.firebase); }
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

// Add global animations CSS
(function() {
  var style = document.createElement('style');
  style.textContent = '@keyframes odaSpin{to{transform:rotate(360deg)}}@keyframes odaFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes odaFadeOut{to{opacity:0;transform:translateX(-50%) translateY(-10px)}}';
  document.head.appendChild(style);
})();

console.log('[ODA] Core loaded v1.0');

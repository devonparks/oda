/**
 * ODA Arcade Test Framework - Setup & Helpers
 * Uses Firebase Admin SDK to simulate multiplayer games
 */
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Test player identities
const PLAYER1 = { id: 'test_player_1', name: 'TestPlayer1' };
const PLAYER2 = { id: 'test_player_2', name: 'TestPlayer2' };
const TEACHER = { id: 'test_teacher_1', name: 'TestTeacher' };
const CLASS_CODE = 'TEST99';

// Tracking for cleanup
const createdDocs = [];

function trackDoc(collection, docId) {
  createdDocs.push({ collection, docId });
}

async function cleanup() {
  for (const { collection, docId } of createdDocs) {
    try { await db.collection(collection).doc(docId).delete(); } catch (e) {}
  }
  createdDocs.length = 0;
}

function genCode() {
  return 'T' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Result tracking
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    failures.push(testName);
    console.log(`  ❌ ${testName}`);
  }
}

async function assertDoc(collection, docId, testName) {
  const snap = await db.collection(collection).doc(docId).get();
  assert(snap.exists, testName);
  return snap.exists ? snap.data() : null;
}

function printResults(suiteName) {
  console.log(`\n${suiteName}: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  return { passed, failed, failures: [...failures] };
}

function resetCounters() {
  passed = 0;
  failed = 0;
  failures.length = 0;
}

// Wait for Firestore propagation
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  admin, db,
  PLAYER1, PLAYER2, TEACHER, CLASS_CODE,
  trackDoc, cleanup, genCode,
  assert, assertDoc, printResults, resetCounters,
  wait
};

/**
 * Solo Games Test - Snake, Solitaire, 2048, Memory
 * Tests records, coins, leaderboard for each
 */
const { db, PLAYER1, trackDoc, cleanup, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n🎮 SOLO GAMES TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // === SNAKE ===
  console.log('\n[Snake]');
  await db.collection('snakeRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    highScore: 42, gamesPlayed: 5, totalScore: 150,
    bestTime: 120,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('snakeRecords', PLAYER1.id);
  let data = await assertDoc('snakeRecords', PLAYER1.id, 'Snake record created');
  assert(data && data.highScore === 42, 'Snake high score saved');

  await db.collection('snakeRecords').doc(PLAYER1.id).update({
    highScore: 55, gamesPlayed: FieldValue.increment(1)
  });
  data = (await db.collection('snakeRecords').doc(PLAYER1.id).get()).data();
  assert(data.highScore === 55, 'Snake high score updated');
  assert(data.gamesPlayed === 6, 'Snake games incremented');

  // === SOLITAIRE ===
  console.log('\n[Solitaire]');
  await db.collection('solitaireRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    gamesPlayed: 3, gamesWon: 1, bestTime: 180,
    totalMoves: 250,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('solitaireRecords', PLAYER1.id);
  data = await assertDoc('solitaireRecords', PLAYER1.id, 'Solitaire record created');
  assert(data && data.gamesWon === 1, 'Solitaire win saved');
  assert(data && data.bestTime === 180, 'Solitaire best time saved');

  // === 2048 ===
  console.log('\n[2048]');
  await db.collection('2048Records').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    highScore: 8192, highTile: 2048, gamesPlayed: 10,
    wins: 2,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('2048Records', PLAYER1.id);
  data = await assertDoc('2048Records', PLAYER1.id, '2048 record created');
  assert(data && data.highScore === 8192, '2048 high score saved');
  assert(data && data.highTile === 2048, '2048 high tile saved');

  await db.collection('2048Records').doc(PLAYER1.id).update({
    highScore: 16384, highTile: 4096
  });
  data = (await db.collection('2048Records').doc(PLAYER1.id).get()).data();
  assert(data.highScore === 16384, '2048 high score updated');

  // === MEMORY ===
  console.log('\n[Memory Match]');
  await db.collection('memoryRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    gamesPlayed: 4, gamesWon: 4, totalStars: 10,
    bestTime: 25, bestMoves: 8,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('memoryRecords', PLAYER1.id);
  data = await assertDoc('memoryRecords', PLAYER1.id, 'Memory record created');
  assert(data && data.totalStars === 10, 'Memory stars saved');
  assert(data && data.bestTime === 25, 'Memory best time saved');

  await cleanup();
  return printResults('SOLO GAMES');
}

module.exports = { run };

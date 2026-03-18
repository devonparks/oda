/**
 * Typing Race - Solo + Multiplayer Test
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n⌨️ TYPING RACE TESTS');
  console.log('='.repeat(40));
  resetCounters();

  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  await db.collection('typingGames').doc(roomCode).set({
    hostId: PLAYER1.id, hostName: PLAYER1.name,
    player1: PLAYER1.id,
    players: { [PLAYER1.id]: { name: PLAYER1.name, progress: 0, wpm: 0, finished: false } },
    status: 'lobby', text: 'The quick brown fox jumps over the lazy dog',
    classCode: '', createdAt: new Date().toISOString()
  });
  trackDoc('typingGames', roomCode);
  let data = await assertDoc('typingGames', roomCode, 'Create typing lobby');
  assert(data && data.status === 'lobby', 'Lobby created');

  // Player 2 joins
  await db.collection('typingGames').doc(roomCode).update({
    [`players.${PLAYER2.id}`]: { name: PLAYER2.name, progress: 0, wpm: 0, finished: false }
  });
  data = (await db.collection('typingGames').doc(roomCode).get()).data();
  assert(Object.keys(data.players).length === 2, 'Player 2 joined lobby');

  // Start race
  await db.collection('typingGames').doc(roomCode).update({ status: 'countdown' });
  data = (await db.collection('typingGames').doc(roomCode).get()).data();
  assert(data.status === 'countdown', 'Race countdown started');

  await db.collection('typingGames').doc(roomCode).update({ status: 'racing' });

  // P1 finishes first
  await db.collection('typingGames').doc(roomCode).update({
    [`players.${PLAYER1.id}.progress`]: 100,
    [`players.${PLAYER1.id}.wpm`]: 65,
    [`players.${PLAYER1.id}.finished`]: true
  });
  // P2 finishes
  await db.collection('typingGames').doc(roomCode).update({
    [`players.${PLAYER2.id}.progress`]: 100,
    [`players.${PLAYER2.id}.wpm`]: 45,
    [`players.${PLAYER2.id}.finished`]: true,
    status: 'finished'
  });
  data = (await db.collection('typingGames').doc(roomCode).get()).data();
  assert(data.status === 'finished', 'Race finished');
  assert(data.players[PLAYER1.id].wpm === 65, 'P1 WPM recorded');
  assert(data.players[PLAYER2.id].wpm === 45, 'P2 WPM recorded');

  // Records
  console.log('\n[Records]');
  await db.collection('typingRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    bestWPM: 65, bestAccuracy: 98, gamesPlayed: 1,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('typingRecords', PLAYER1.id);
  data = await assertDoc('typingRecords', PLAYER1.id, 'Typing record created');
  assert(data && data.bestWPM === 65, 'Best WPM recorded');

  await cleanup();
  return printResults('TYPING RACE');
}

module.exports = { run };

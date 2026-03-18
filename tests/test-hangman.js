/**
 * Hangman - Solo + Multiplayer Test
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n😴 HANGMAN TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // --- Multiplayer ---
  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  await db.collection('hangmanGames').doc(roomCode).set({
    hostId: PLAYER1.id, hostName: PLAYER1.name,
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    guestId: null, guestName: null,
    status: 'waiting',
    word: null, guesses: [], wrongCount: 0,
    picker: 1, round: 1,
    p1Score: 0, p2Score: 0,
    bestOf: 3, winner: null
  });
  trackDoc('hangmanGames', roomCode);
  let data = await assertDoc('hangmanGames', roomCode, 'Create hangman room');
  assert(data && data.status === 'waiting', 'Room waiting');

  // Guest joins
  await db.collection('hangmanGames').doc(roomCode).update({
    guestId: PLAYER2.id, guestName: PLAYER2.name, status: 'picking'
  });
  data = (await db.collection('hangmanGames').doc(roomCode).get()).data();
  assert(data.status === 'picking', 'Status is picking');
  assert(data.guestId === PLAYER2.id, 'Guest joined');

  // Host picks word
  await db.collection('hangmanGames').doc(roomCode).update({
    word: 'ELEPHANT', status: 'playing'
  });
  data = (await db.collection('hangmanGames').doc(roomCode).get()).data();
  assert(data.word === 'ELEPHANT', 'Word set');
  assert(data.status === 'playing', 'Game playing');

  // Simulate guesses
  await db.collection('hangmanGames').doc(roomCode).update({
    guesses: ['E', 'L', 'P', 'H', 'A', 'N', 'T'],
    status: 'finished', winner: 2, p2Score: 1
  });
  data = (await db.collection('hangmanGames').doc(roomCode).get()).data();
  assert(data.winner === 2, 'Guesser wins');
  assert(data.guesses.length === 7, 'All guesses recorded');

  // --- Records ---
  console.log('\n[Records]');
  await db.collection('hangmanRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    gamesPlayed: 1, gamesWon: 1, totalScore: 100,
    bestStreak: 1, currentStreak: 1,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('hangmanRecords', PLAYER1.id);
  data = await assertDoc('hangmanRecords', PLAYER1.id, 'Record created');
  assert(data && data.gamesWon === 1, 'Win recorded');

  await cleanup();
  return printResults('HANGMAN');
}

module.exports = { run };

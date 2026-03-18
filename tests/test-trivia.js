/**
 * Trivia Race - Solo + Multiplayer Test
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n🏁 TRIVIA RACE TESTS');
  console.log('='.repeat(40));
  resetCounters();

  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  await db.collection('triviaGames').doc(roomCode).set({
    code: roomCode, hostId: PLAYER1.id, hostName: PLAYER1.name,
    classCode: '',
    players: { [PLAYER1.id]: { name: PLAYER1.name, score: 0 } },
    status: 'lobby',
    questions: [
      { question: 'What is 2+2?', options: ['3', '4', '5', '6'], answer: 1 },
      { question: 'Capital of France?', options: ['London', 'Paris', 'Berlin', 'Madrid'], answer: 1 }
    ],
    currentQuestion: 0,
    createdAt: new Date().toISOString()
  });
  trackDoc('triviaGames', roomCode);
  let data = await assertDoc('triviaGames', roomCode, 'Create trivia lobby');
  assert(data && data.status === 'lobby', 'Lobby created');

  // Player 2 joins
  await db.collection('triviaGames').doc(roomCode).update({
    [`players.${PLAYER2.id}`]: { name: PLAYER2.name, score: 0 }
  });
  data = (await db.collection('triviaGames').doc(roomCode).get()).data();
  assert(Object.keys(data.players).length === 2, 'Player 2 joined');

  // Start game
  await db.collection('triviaGames').doc(roomCode).update({ status: 'playing' });

  // Players answer Q1
  await db.collection('triviaGames').doc(roomCode).update({
    [`players.${PLAYER1.id}.score`]: 100,
    [`players.${PLAYER2.id}.score`]: 80,
    currentQuestion: 1
  });

  // Players answer Q2
  await db.collection('triviaGames').doc(roomCode).update({
    [`players.${PLAYER1.id}.score`]: 200,
    [`players.${PLAYER2.id}.score`]: 160,
    status: 'finished'
  });
  data = (await db.collection('triviaGames').doc(roomCode).get()).data();
  assert(data.status === 'finished', 'Game finished');
  assert(data.players[PLAYER1.id].score === 200, 'P1 score correct');
  assert(data.players[PLAYER2.id].score === 160, 'P2 score correct');

  // Records
  console.log('\n[Records]');
  await db.collection('triviaRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    gamesPlayed: 1, totalScore: 200, bestScore: 200,
    wins: 1, losses: 0,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('triviaRecords', PLAYER1.id);
  data = await assertDoc('triviaRecords', PLAYER1.id, 'Trivia record created');
  assert(data && data.bestScore === 200, 'Best score recorded');

  await cleanup();
  return printResults('TRIVIA RACE');
}

module.exports = { run };

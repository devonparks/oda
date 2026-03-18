/**
 * Checkers - Multiplayer + Tournament Test
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n⛀ CHECKERS TESTS');
  console.log('='.repeat(40));
  resetCounters();

  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  await db.collection('checkersGames').doc(roomCode).set({
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    player2: null, player2Name: null,
    board: '[]', turn: 1, status: 'waiting', winner: null,
    seriesFormat: 1, seriesScore: [0, 0], seriesGame: 1, seriesWinner: null
  });
  trackDoc('checkersGames', roomCode);
  let data = await assertDoc('checkersGames', roomCode, 'Create checkers room');
  assert(data && data.status === 'waiting', 'Room waiting');

  await db.collection('checkersGames').doc(roomCode).update({
    player2: PLAYER2.id, player2Name: PLAYER2.name, status: 'playing'
  });
  data = (await db.collection('checkersGames').doc(roomCode).get()).data();
  assert(data.status === 'playing', 'Game started');

  // Finish game
  await db.collection('checkersGames').doc(roomCode).update({
    winner: 1, status: 'finished', seriesScore: [1, 0]
  });
  data = (await db.collection('checkersGames').doc(roomCode).get()).data();
  assert(data.winner === 1, 'Player 1 wins');

  // Tournament
  console.log('\n[Tournament]');
  const tourneyCode = genCode();
  await db.collection('checkersTournaments').doc(tourneyCode).set({
    code: tourneyCode, teacherId: PLAYER1.id, classCode: '',
    status: 'lobby', players: {}, bracket: {},
    currentRound: 0, totalRounds: 0,
    settings: { timeLimit: 0 }, results: {},
    createdAt: new Date().toISOString()
  });
  trackDoc('checkersTournaments', tourneyCode);
  data = await assertDoc('checkersTournaments', tourneyCode, 'Checkers tournament created');
  assert(data && data.status === 'lobby', 'Tournament in lobby');

  // Records
  console.log('\n[Records]');
  await db.collection('checkersRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    wins: 1, losses: 0, gamesPlayed: 1,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('checkersRecords', PLAYER1.id);
  data = await assertDoc('checkersRecords', PLAYER1.id, 'Record created');
  assert(data && data.wins === 1, 'Win recorded');

  await cleanup();
  return printResults('CHECKERS');
}

module.exports = { run };

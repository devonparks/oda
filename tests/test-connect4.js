/**
 * Connect 4 - Multiplayer + Tournament Test
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

function emptyBoard() {
  return Array.from({ length: 6 }, () => Array(7).fill(0));
}

async function run() {
  console.log('\n🔴 CONNECT 4 TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // --- Multiplayer ---
  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  await db.collection('connect4games').doc(roomCode).set({
    board: JSON.stringify(emptyBoard()),
    turn: 1,
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    player2: null, player2Name: null,
    status: 'waiting', winner: null,
    seriesFormat: 1, seriesScore: [0, 0], seriesGame: 1, seriesWinner: null
  });
  trackDoc('connect4games', roomCode);
  let data = await assertDoc('connect4games', roomCode, 'Create game room');
  assert(data && data.status === 'waiting', 'Room waiting');

  // Player 2 joins
  await db.collection('connect4games').doc(roomCode).update({
    player2: PLAYER2.id, player2Name: PLAYER2.name, status: 'playing'
  });
  data = (await db.collection('connect4games').doc(roomCode).get()).data();
  assert(data.status === 'playing', 'Game started');

  // Simulate a win (4 in a row on bottom)
  const board = emptyBoard();
  board[5][0] = 1; board[5][1] = 1; board[5][2] = 1; board[5][3] = 1;
  board[4][0] = 2; board[4][1] = 2; board[4][2] = 2;
  await db.collection('connect4games').doc(roomCode).update({
    board: JSON.stringify(board), winner: 1, status: 'finished'
  });
  data = (await db.collection('connect4games').doc(roomCode).get()).data();
  assert(data.winner === 1, 'Player 1 wins');
  assert(data.status === 'finished', 'Game finished');

  // --- Tournament ---
  console.log('\n[Tournament]');
  const tourneyCode = genCode();
  await db.collection('connect4Tournaments').doc(tourneyCode).set({
    code: tourneyCode, classCode: '', createdBy: PLAYER1.id,
    status: 'lobby', currentRound: 0, totalRounds: 1,
    players: {
      [PLAYER1.id]: { name: PLAYER1.name, seed: 1 },
      [PLAYER2.id]: { name: PLAYER2.name, seed: 2 }
    },
    bracket: {}, results: {},
    settings: { timeLimit: 0 },
    createdAt: new Date().toISOString()
  });
  trackDoc('connect4Tournaments', tourneyCode);
  data = await assertDoc('connect4Tournaments', tourneyCode, 'Tournament created');
  assert(data && data.status === 'lobby', 'Tournament in lobby');
  assert(data && Object.keys(data.players).length === 2, '2 players joined');

  // Start tournament
  await db.collection('connect4Tournaments').doc(tourneyCode).update({
    status: 'playing', currentRound: 1, totalRounds: 1,
    bracket: { 'r1_m1': { p1: PLAYER1.id, p2: PLAYER2.id, winner: null, gameCode: roomCode } }
  });
  data = (await db.collection('connect4Tournaments').doc(tourneyCode).get()).data();
  assert(data.status === 'playing', 'Tournament started');

  // Record winner
  await db.collection('connect4Tournaments').doc(tourneyCode).update({
    'bracket.r1_m1.winner': PLAYER1.id, status: 'finished'
  });
  data = (await db.collection('connect4Tournaments').doc(tourneyCode).get()).data();
  assert(data.bracket.r1_m1.winner === PLAYER1.id, 'Tournament winner recorded');

  // --- Records ---
  console.log('\n[Records]');
  await db.collection('connect4Records').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    wins: 1, losses: 0, draws: 0, gamesPlayed: 1,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('connect4Records', PLAYER1.id);
  data = await assertDoc('connect4Records', PLAYER1.id, 'Record created');
  assert(data && data.wins === 1, 'Win recorded');

  await cleanup();
  return printResults('CONNECT 4');
}

module.exports = { run };

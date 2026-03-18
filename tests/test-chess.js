/**
 * Chess - Multiplayer Test
 * Tests: create room, join, make moves, resign, records, series
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n♚ CHESS TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // --- Create game room ---
  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  await db.collection('chessGames').doc(roomCode).set({
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    player2: null, player2Name: null,
    playerColor1: 'white', playerColor2: 'black',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    status: 'waiting', winner: null, result: null,
    seriesFormat: 3, seriesScore: [0, 0], seriesGame: 1, seriesWinner: null,
    myPlayerNum: 1
  });
  trackDoc('chessGames', roomCode);
  let data = await assertDoc('chessGames', roomCode, 'Create chess game room');
  assert(data && data.status === 'waiting', 'Room status is waiting');

  // --- Player 2 joins ---
  await db.collection('chessGames').doc(roomCode).update({
    player2: PLAYER2.id, player2Name: PLAYER2.name, status: 'playing'
  });
  data = (await db.collection('chessGames').doc(roomCode).get()).data();
  assert(data.status === 'playing', 'Status changes to playing');
  assert(data.player2 === PLAYER2.id, 'Player 2 joined');

  // --- Make a move (e2 to e4) ---
  await db.collection('chessGames').doc(roomCode).update({
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    lastMove: { from: 'e2', to: 'e4' }
  });
  data = (await db.collection('chessGames').doc(roomCode).get()).data();
  assert(data.fen.includes('4P3'), 'Move recorded in FEN');
  assert(data.lastMove.from === 'e2' && data.lastMove.to === 'e4', 'Last move tracked');

  // --- Resign (player 2 resigns) ---
  await db.collection('chessGames').doc(roomCode).update({
    status: 'finished', result: 'white', winner: 'white',
    seriesScore: [1, 0]
  });
  data = (await db.collection('chessGames').doc(roomCode).get()).data();
  assert(data.status === 'finished', 'Game finished after resign');
  assert(data.result === 'white', 'White wins by resignation');
  assert(data.seriesScore[0] === 1, 'Series score updated');

  // --- Series rematch ---
  console.log('\n[Series Rematch]');
  const rematchCode = genCode();
  await db.collection('chessGames').doc(rematchCode).set({
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    player2: PLAYER2.id, player2Name: PLAYER2.name,
    playerColor1: 'black', playerColor2: 'white',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    status: 'playing', winner: null, result: null,
    seriesFormat: 3, seriesScore: [1, 0], seriesGame: 2, seriesWinner: null,
    rematchFrom: roomCode
  });
  trackDoc('chessGames', rematchCode);
  data = await assertDoc('chessGames', rematchCode, 'Rematch game created');
  assert(data && data.seriesGame === 2, 'Series game 2');
  assert(data && data.playerColor1 === 'black', 'Colors swapped for rematch');
  assert(data && data.seriesScore[0] === 1, 'Series score carried over');

  // --- Records ---
  console.log('\n[Records]');
  await db.collection('chessRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    wins: 1, losses: 0, draws: 0, gamesPlayed: 1,
    aiWins: { easy: 0, medium: 0, hard: 0 },
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('chessRecords', PLAYER1.id);
  data = await assertDoc('chessRecords', PLAYER1.id, 'Chess record created');
  assert(data && data.wins === 1, 'Win recorded');

  await db.collection('chessRecords').doc(PLAYER1.id).update({
    wins: FieldValue.increment(1), gamesPlayed: FieldValue.increment(1)
  });
  data = (await db.collection('chessRecords').doc(PLAYER1.id).get()).data();
  assert(data.wins === 2, 'Wins incremented');

  await cleanup();
  return printResults('CHESS');
}

module.exports = { run };

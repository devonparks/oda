/**
 * Tic Tac Toe - Multiplayer Test
 * Tests: create room, join, make moves, win detection, records, coins, tournament
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters, wait } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

function emptyBoard() {
  return [[null,null,null],[null,null,null],[null,null,null]];
}

async function run() {
  console.log('\n🎮 TIC TAC TOE TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // --- Test 1: Create a game room ---
  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  const board = emptyBoard();
  await db.collection('tttGames').doc(roomCode).set({
    board: JSON.stringify(board),
    turn: 'X',
    player1: PLAYER1.id,
    player1Name: PLAYER1.name,
    player2: null,
    player2Name: null,
    status: 'waiting',
    winner: null,
    seriesFormat: 1,
    seriesScore: [0, 0],
    seriesGame: 1,
    seriesWinner: null
  });
  trackDoc('tttGames', roomCode);
  let data = await assertDoc('tttGames', roomCode, 'Create game room');
  assert(data && data.status === 'waiting', 'Room status is waiting');
  assert(data && data.player1 === PLAYER1.id, 'Player 1 set correctly');

  // --- Test 2: Player 2 joins ---
  await db.collection('tttGames').doc(roomCode).update({
    player2: PLAYER2.id,
    player2Name: PLAYER2.name,
    status: 'playing'
  });
  data = (await db.collection('tttGames').doc(roomCode).get()).data();
  assert(data.status === 'playing', 'Status changes to playing on join');
  assert(data.player2 === PLAYER2.id, 'Player 2 joined correctly');

  // --- Test 3: Make moves (X wins with top row) ---
  // X plays (0,0)
  board[0][0] = 'X';
  await db.collection('tttGames').doc(roomCode).update({
    board: JSON.stringify(board), turn: 'O'
  });
  // O plays (1,0)
  board[1][0] = 'O';
  await db.collection('tttGames').doc(roomCode).update({
    board: JSON.stringify(board), turn: 'X'
  });
  // X plays (0,1)
  board[0][1] = 'X';
  await db.collection('tttGames').doc(roomCode).update({
    board: JSON.stringify(board), turn: 'O'
  });
  // O plays (1,1)
  board[1][1] = 'O';
  await db.collection('tttGames').doc(roomCode).update({
    board: JSON.stringify(board), turn: 'X'
  });
  // X plays (0,2) — wins!
  board[0][2] = 'X';
  await db.collection('tttGames').doc(roomCode).update({
    board: JSON.stringify(board), turn: 'O', winner: 'X', status: 'finished'
  });
  data = (await db.collection('tttGames').doc(roomCode).get()).data();
  assert(data.winner === 'X', 'X wins with top row');
  assert(data.status === 'finished', 'Game status is finished');
  assert(JSON.parse(data.board)[0].every(c => c === 'X'), 'Board shows winning row');

  // --- Test 4: Save records ---
  console.log('\n[Records]');
  await db.collection('tttRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id,
    studentName: PLAYER1.name,
    classCode: '',
    wins: 1, losses: 0, draws: 0,
    gamesPlayed: 1, winStreak: 1, bestStreak: 1,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('tttRecords', PLAYER1.id);
  data = await assertDoc('tttRecords', PLAYER1.id, 'Player 1 record created');
  assert(data && data.wins === 1, 'Win count is 1');

  // --- Test 5: Update records (increment) ---
  await db.collection('tttRecords').doc(PLAYER1.id).update({
    wins: FieldValue.increment(1),
    gamesPlayed: FieldValue.increment(1),
    winStreak: FieldValue.increment(1)
  });
  data = (await db.collection('tttRecords').doc(PLAYER1.id).get()).data();
  assert(data.wins === 2, 'Win count incremented to 2');
  assert(data.gamesPlayed === 2, 'Games played incremented to 2');

  // --- Test 6: Tournament ---
  console.log('\n[Tournament]');
  const tourneyCode = genCode();
  await db.collection('tttTournaments').doc(tourneyCode).set({
    code: tourneyCode,
    host: PLAYER1.id,
    classCode: '',
    createdBy: PLAYER1.id,
    status: 'lobby',
    players: [
      { id: PLAYER1.id, name: PLAYER1.name },
      { id: PLAYER2.id, name: PLAYER2.name }
    ],
    bracket: '[]',
    createdAt: new Date().toISOString()
  });
  trackDoc('tttTournaments', tourneyCode);
  data = await assertDoc('tttTournaments', tourneyCode, 'Tournament created');
  assert(data && data.status === 'lobby', 'Tournament status is lobby');
  assert(data && data.players.length === 2, 'Tournament has 2 players');

  // Start tournament
  const bracket = [[{
    p1: { id: PLAYER1.id, name: PLAYER1.name },
    p2: { id: PLAYER2.id, name: PLAYER2.name },
    winner: null, gameCode: null
  }]];
  await db.collection('tttTournaments').doc(tourneyCode).update({
    status: 'playing',
    bracket: JSON.stringify(bracket)
  });
  data = (await db.collection('tttTournaments').doc(tourneyCode).get()).data();
  assert(data.status === 'playing', 'Tournament started');

  // Simulate match result
  bracket[0][0].winner = PLAYER1.id;
  bracket[0][0].gameCode = roomCode;
  await db.collection('tttTournaments').doc(tourneyCode).update({
    bracket: JSON.stringify(bracket),
    status: 'finished'
  });
  data = (await db.collection('tttTournaments').doc(tourneyCode).get()).data();
  const finalBracket = JSON.parse(data.bracket);
  assert(finalBracket[0][0].winner === PLAYER1.id, 'Tournament winner recorded');

  // --- Test 7: Coins ---
  console.log('\n[Coins]');
  await db.collection('students').doc('ttt_coin_test').set({
    studentId: 'ttt_coin_test', name: 'CoinTest', teacherId: 'test', coins: 100
  });
  trackDoc('students', 'ttt_coin_test');
  await db.collection('students').doc('ttt_coin_test').update({
    coins: FieldValue.increment(15)
  });
  data = (await db.collection('students').doc('ttt_coin_test').get()).data();
  assert(data.coins === 115, 'Coins awarded correctly (100 + 15 = 115)');

  await cleanup();
  return printResults('TIC TAC TOE');
}

module.exports = { run };

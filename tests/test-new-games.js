/**
 * New Games Test - Block Blast, Battleship, Wordle, Uno
 * Tests: Firestore records, coins, multiplayer flows
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n🆕 NEW GAMES TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // ===========================
  // BLOCK BLAST
  // ===========================
  console.log('\n[Block Blast - Records]');
  await db.collection('blockblastRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    highScore: 1250, gamesPlayed: 5, totalLinesCleared: 42, bestCombo: 4,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('blockblastRecords', PLAYER1.id);
  let data = await assertDoc('blockblastRecords', PLAYER1.id, 'Block Blast record created');
  assert(data && data.highScore === 1250, 'High score saved');
  assert(data && data.bestCombo === 4, 'Best combo saved');

  // Update high score
  await db.collection('blockblastRecords').doc(PLAYER1.id).update({
    highScore: 2000, gamesPlayed: FieldValue.increment(1), totalLinesCleared: FieldValue.increment(8)
  });
  data = (await db.collection('blockblastRecords').doc(PLAYER1.id).get()).data();
  assert(data.highScore === 2000, 'High score updated');
  assert(data.gamesPlayed === 6, 'Games played incremented');
  assert(data.totalLinesCleared === 50, 'Total lines incremented');

  // ===========================
  // BATTLESHIP
  // ===========================
  console.log('\n[Battleship - Multiplayer]');
  const bsRoom = genCode();
  await db.collection('battleshipGames').doc(bsRoom).set({
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    player2: null, player2Name: null,
    p1Board: JSON.stringify(Array(10).fill(null).map(() => Array(10).fill(0))),
    p2Board: JSON.stringify(Array(10).fill(null).map(() => Array(10).fill(0))),
    p1Attacks: JSON.stringify(Array(10).fill(null).map(() => Array(10).fill(0))),
    p2Attacks: JSON.stringify(Array(10).fill(null).map(() => Array(10).fill(0))),
    p1Ships: [], p2Ships: [],
    turn: 1, status: 'waiting', winner: null,
    p1Ready: false, p2Ready: false
  });
  trackDoc('battleshipGames', bsRoom);
  data = await assertDoc('battleshipGames', bsRoom, 'Battleship room created');
  assert(data && data.status === 'waiting', 'Status is waiting');

  // Player 2 joins
  await db.collection('battleshipGames').doc(bsRoom).update({
    player2: PLAYER2.id, player2Name: PLAYER2.name, status: 'setup'
  });
  data = (await db.collection('battleshipGames').doc(bsRoom).get()).data();
  assert(data.status === 'setup', 'Status changes to setup');
  assert(data.player2 === PLAYER2.id, 'Player 2 joined');

  // Both ready
  await db.collection('battleshipGames').doc(bsRoom).update({
    p1Ready: true, p2Ready: true, status: 'playing'
  });
  data = (await db.collection('battleshipGames').doc(bsRoom).get()).data();
  assert(data.status === 'playing', 'Game started after both ready');

  // Attack and finish
  await db.collection('battleshipGames').doc(bsRoom).update({
    winner: 1, status: 'finished'
  });
  data = (await db.collection('battleshipGames').doc(bsRoom).get()).data();
  assert(data.winner === 1, 'Player 1 wins');
  assert(data.status === 'finished', 'Game finished');

  // Records
  console.log('\n[Battleship - Records]');
  await db.collection('battleshipRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    wins: 1, losses: 0, gamesPlayed: 1, shipsSunk: 5,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('battleshipRecords', PLAYER1.id);
  data = await assertDoc('battleshipRecords', PLAYER1.id, 'Battleship record created');
  assert(data && data.wins === 1, 'Win recorded');
  assert(data && data.shipsSunk === 5, 'Ships sunk tracked');

  // ===========================
  // WORDLE
  // ===========================
  console.log('\n[Wordle - Records]');
  await db.collection('wordleRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    gamesPlayed: 10, gamesWon: 8, currentStreak: 5, maxStreak: 7,
    guessDistribution: [0, 1, 3, 2, 1, 1],
    lastPlayedDate: '2026-03-18',
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('wordleRecords', PLAYER1.id);
  data = await assertDoc('wordleRecords', PLAYER1.id, 'Wordle record created');
  assert(data && data.gamesWon === 8, 'Wins saved');
  assert(data && data.currentStreak === 5, 'Streak saved');
  assert(data && data.guessDistribution.length === 6, 'Guess distribution has 6 entries');
  assert(data && data.guessDistribution[2] === 3, 'Most common: 3 guesses');

  // Update streak
  await db.collection('wordleRecords').doc(PLAYER1.id).update({
    gamesPlayed: FieldValue.increment(1),
    gamesWon: FieldValue.increment(1),
    currentStreak: FieldValue.increment(1)
  });
  data = (await db.collection('wordleRecords').doc(PLAYER1.id).get()).data();
  assert(data.currentStreak === 6, 'Streak incremented');
  assert(data.gamesWon === 9, 'Wins incremented');

  // ===========================
  // UNO
  // ===========================
  console.log('\n[Uno - Multiplayer]');
  const unoRoom = genCode();
  await db.collection('unoGames').doc(unoRoom).set({
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    player2: null, player2Name: null,
    p1Hand: JSON.stringify([{color:'red',value:'5'},{color:'blue',value:'3'}]),
    p2Hand: JSON.stringify([]),
    deck: JSON.stringify([]),
    discard: JSON.stringify([{color:'red',value:'7'}]),
    turn: 1, direction: 1,
    currentColor: 'red',
    status: 'waiting', winner: null,
    lastAction: null
  });
  trackDoc('unoGames', unoRoom);
  data = await assertDoc('unoGames', unoRoom, 'Uno room created');
  assert(data && data.status === 'waiting', 'Status is waiting');

  // Join
  await db.collection('unoGames').doc(unoRoom).update({
    player2: PLAYER2.id, player2Name: PLAYER2.name,
    p2Hand: JSON.stringify([{color:'green',value:'2'},{color:'yellow',value:'9'}]),
    status: 'playing'
  });
  data = (await db.collection('unoGames').doc(unoRoom).get()).data();
  assert(data.status === 'playing', 'Game started');

  // Play a card
  await db.collection('unoGames').doc(unoRoom).update({
    p1Hand: JSON.stringify([{color:'blue',value:'3'}]),
    discard: JSON.stringify([{color:'red',value:'5'},{color:'red',value:'7'}]),
    turn: 2, lastAction: 'play'
  });
  data = (await db.collection('unoGames').doc(unoRoom).get()).data();
  assert(data.turn === 2, 'Turn passed to P2');
  assert(JSON.parse(data.p1Hand).length === 1, 'P1 has 1 card left');

  // P1 wins (empty hand)
  await db.collection('unoGames').doc(unoRoom).update({
    p1Hand: JSON.stringify([]),
    winner: 1, status: 'finished'
  });
  data = (await db.collection('unoGames').doc(unoRoom).get()).data();
  assert(data.winner === 1, 'P1 wins');
  assert(JSON.parse(data.p1Hand).length === 0, 'P1 hand empty');

  // Records
  console.log('\n[Uno - Records]');
  await db.collection('unoRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    wins: 1, losses: 0, gamesPlayed: 1,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('unoRecords', PLAYER1.id);
  data = await assertDoc('unoRecords', PLAYER1.id, 'Uno record created');
  assert(data && data.wins === 1, 'Win recorded');

  // ===========================
  // COINS (shared test)
  // ===========================
  console.log('\n[Coins - All New Games]');
  await db.collection('students').doc('new_games_coin_test').set({
    studentId: 'new_games_coin_test', name: 'CoinTest', teacherId: 'test', coins: 0
  });
  trackDoc('students', 'new_games_coin_test');

  // Block Blast coins
  await db.collection('students').doc('new_games_coin_test').update({ coins: FieldValue.increment(10) });
  data = (await db.collection('students').doc('new_games_coin_test').get()).data();
  assert(data.coins === 10, 'Block Blast coins awarded');

  // Battleship coins
  await db.collection('students').doc('new_games_coin_test').update({ coins: FieldValue.increment(15) });
  data = (await db.collection('students').doc('new_games_coin_test').get()).data();
  assert(data.coins === 25, 'Battleship coins awarded');

  // Wordle coins
  await db.collection('students').doc('new_games_coin_test').update({ coins: FieldValue.increment(8) });
  data = (await db.collection('students').doc('new_games_coin_test').get()).data();
  assert(data.coins === 33, 'Wordle coins awarded');

  // Uno coins
  await db.collection('students').doc('new_games_coin_test').update({ coins: FieldValue.increment(10) });
  data = (await db.collection('students').doc('new_games_coin_test').get()).data();
  assert(data.coins === 43, 'Uno coins awarded');

  await cleanup();
  return printResults('NEW GAMES');
}

module.exports = { run };

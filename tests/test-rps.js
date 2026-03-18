/**
 * Rock Paper Scissors - Multiplayer + Tournament Test
 */
const { db, PLAYER1, PLAYER2, trackDoc, cleanup, genCode, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n✊ ROCK PAPER SCISSORS TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // --- Multiplayer ---
  console.log('\n[Multiplayer Flow]');
  const roomCode = genCode();
  await db.collection('rpsGames').doc(roomCode).set({
    player1: PLAYER1.id, player1Name: PLAYER1.name,
    player2: null, player2Name: null,
    status: 'waiting',
    p1Choice: null, p2Choice: null,
    round: 1, p1Score: 0, p2Score: 0,
    bestOf: 3, winner: null,
    seriesFormat: 1, seriesScore: [0, 0], seriesGame: 1, seriesWinner: null
  });
  trackDoc('rpsGames', roomCode);
  let data = await assertDoc('rpsGames', roomCode, 'Create RPS room');
  assert(data && data.status === 'waiting', 'Room waiting');

  // Join
  await db.collection('rpsGames').doc(roomCode).update({
    player2: PLAYER2.id, player2Name: PLAYER2.name, status: 'playing'
  });
  data = (await db.collection('rpsGames').doc(roomCode).get()).data();
  assert(data.status === 'playing', 'Game started');

  // Round 1: P1=rock, P2=scissors → P1 wins
  await db.collection('rpsGames').doc(roomCode).update({ p1Choice: 'rock' });
  await db.collection('rpsGames').doc(roomCode).update({ p2Choice: 'scissors' });
  await db.collection('rpsGames').doc(roomCode).update({
    p1Score: 1, round: 2, p1Choice: null, p2Choice: null
  });
  data = (await db.collection('rpsGames').doc(roomCode).get()).data();
  assert(data.p1Score === 1, 'P1 wins round 1');

  // Round 2: P1=paper, P2=rock → P1 wins (2-0, best of 3)
  await db.collection('rpsGames').doc(roomCode).update({
    p1Choice: 'paper', p2Choice: 'rock', p1Score: 2, winner: 1, status: 'finished'
  });
  data = (await db.collection('rpsGames').doc(roomCode).get()).data();
  assert(data.winner === 1, 'P1 wins best of 3');
  assert(data.status === 'finished', 'Game finished');

  // --- Tournament ---
  console.log('\n[Tournament]');
  const tourneyCode = genCode();
  await db.collection('rpsTournaments').doc(tourneyCode).set({
    code: tourneyCode, host: PLAYER1.id, classCode: '',
    createdBy: PLAYER1.id, status: 'lobby',
    players: [
      { id: PLAYER1.id, name: PLAYER1.name },
      { id: PLAYER2.id, name: PLAYER2.name }
    ],
    bracket: '[]', createdAt: new Date().toISOString()
  });
  trackDoc('rpsTournaments', tourneyCode);
  data = await assertDoc('rpsTournaments', tourneyCode, 'RPS tournament created');
  assert(data && data.players.length === 2, 'Tournament has 2 players');

  // --- Records ---
  console.log('\n[Records]');
  await db.collection('rpsRecords').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, studentName: PLAYER1.name, classCode: '',
    wins: 1, losses: 0, gamesPlayed: 1,
    lastPlayed: FieldValue.serverTimestamp()
  });
  trackDoc('rpsRecords', PLAYER1.id);
  data = await assertDoc('rpsRecords', PLAYER1.id, 'RPS record created');
  assert(data && data.wins === 1, 'Win recorded');

  await cleanup();
  return printResults('ROCK PAPER SCISSORS');
}

module.exports = { run };

/**
 * ODA Arcade - Master Test Runner
 * Run: node tests/run-all.js
 */
const ttt = require('./test-tictactoe');
const chess = require('./test-chess');
const connect4 = require('./test-connect4');
const rps = require('./test-rps');
const checkers = require('./test-checkers');
const hangman = require('./test-hangman');
const typing = require('./test-typing');
const trivia = require('./test-trivia');
const soloGames = require('./test-solo-games');
const shop = require('./test-shop');

async function runAll() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║    ODA ARCADE - FULL TEST SUITE      ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  const results = [];
  const suites = [
    { name: 'Tic Tac Toe', fn: ttt.run },
    { name: 'Chess', fn: chess.run },
    { name: 'Connect 4', fn: connect4.run },
    { name: 'RPS', fn: rps.run },
    { name: 'Checkers', fn: checkers.run },
    { name: 'Hangman', fn: hangman.run },
    { name: 'Typing Race', fn: typing.run },
    { name: 'Trivia Race', fn: trivia.run },
    { name: 'Solo Games', fn: soloGames.run },
    { name: 'Shop', fn: shop.run }
  ];

  for (const suite of suites) {
    try {
      const result = await suite.fn();
      results.push({ name: suite.name, ...result });
    } catch (err) {
      console.error(`\n💥 ${suite.name} CRASHED: ${err.message}`);
      results.push({ name: suite.name, passed: 0, failed: 1, failures: [err.message] });
    }
  }

  // Summary
  console.log('\n\n╔══════════════════════════════════════╗');
  console.log('║         FINAL RESULTS                ║');
  console.log('╚══════════════════════════════════════╝\n');

  let totalPassed = 0, totalFailed = 0;
  const allFailures = [];

  results.forEach(r => {
    const status = r.failed === 0 ? '✅' : '❌';
    console.log(`${status} ${r.name}: ${r.passed} passed, ${r.failed} failed`);
    totalPassed += r.passed;
    totalFailed += r.failed;
    if (r.failures && r.failures.length > 0) {
      r.failures.forEach(f => allFailures.push(`[${r.name}] ${f}`));
    }
  });

  console.log(`\n${'='.repeat(40)}`);
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed === 0) {
    console.log('\n🏆 ALL TESTS PASSED! Grade: A+');
    console.log('All games are verified working.');
  } else {
    console.log('\n⚠️ SOME TESTS FAILED:');
    allFailures.forEach(f => console.log(`  - ${f}`));
    const pct = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);
    const grade = pct >= 95 ? 'A' : pct >= 90 ? 'A-' : pct >= 85 ? 'B+' : pct >= 80 ? 'B' : 'C';
    console.log(`\nGrade: ${grade} (${pct}%)`);
  }

  console.log(`\nFinished: ${new Date().toLocaleString()}`);
  process.exit(totalFailed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

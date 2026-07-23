/**
 * Drop4 Hub — engine + AI unit tests. Zero dependencies; run with `node`.
 * Proves the ported pure brain (engine.js / ai.js) behaves identically to the
 * Drop4 store version before any UI is built. Explicit pass/fail counting and
 * a non-zero exit on any failure — no test runner, so nothing can be masked.
 */
import {
  EMPTY, WALL, RAINBOW, ROWS, COLS,
  createEmptyBoard, getLandingRow, getLowestEmptyRow, checkWin, isBoardFull,
  getValidCols, applyDrop, applyBomb, applyRainbow, applyHeavy,
} from '../engine.js';
import { getAIMove } from '../ai.js';

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name) {
  if (cond) { pass++; } else { fail++; fails.push(name); console.log('  ✗ FAIL:', name); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// Helper: fresh board, set cells via [col,row,val] triples.
function board(cols = COLS, rows = ROWS, cells = []) {
  const b = createEmptyBoard(cols, rows);
  for (const [c, r, v] of cells) b[c][r] = v;
  return b;
}

// ── constants ────────────────────────────────────────────────────────────
ok(EMPTY === 0 && WALL === 3 && RAINBOW === 4, 'cell sentinels 0/3/4');
ok(ROWS === 6 && COLS === 7, 'default dims 7x6');

// ── createEmptyBoard ───────────────────────────────────────────────────────
{
  const b = createEmptyBoard();
  ok(b.length === 7 && b.every((c) => c.length === 6), 'createEmptyBoard shape 7x6 column-major');
  ok(b.every((c) => c.every((v) => v === 0)), 'createEmptyBoard all empty');
}

// ── getLandingRow ──────────────────────────────────────────────────────────
eq(getLandingRow(createEmptyBoard(), 3), 5, 'landing empty col → bottom row 5 (gravityDown)');
eq(getLandingRow(board(7, 6, [[3, 5, 1]]), 3), 4, 'landing stacks above occupied bottom');
eq(getLandingRow(board(7, 6, [[3, 5, WALL]]), 3), 4, 'landing skips nothing but treats WALL as occupied');
eq(getLandingRow(board(7, 6, [[3, 5, 1], [3, 4, 1], [3, 3, 1], [3, 2, 1], [3, 1, 1], [3, 0, 1]]), 3), -1, 'landing full col → -1');
eq(getLandingRow(createEmptyBoard(), 99), -1, 'landing out-of-bounds col → -1');
eq(getLandingRow(createEmptyBoard(), 1.5), -1, 'landing non-integer col → -1');
eq(getLandingRow(createEmptyBoard(), 3, 6, false), 0, 'landing gravityUp → top row 0');
eq(getLandingRow(board(7, 6, [[3, 0, 1]]), 3, 6, false), 1, 'landing gravityUp stacks below occupied top');

// ── checkWin ───────────────────────────────────────────────────────────────
eq(checkWin(board(7, 6, [[0, 5, 1], [1, 5, 1], [2, 5, 1], [3, 5, 1]]), 3, 5, 1).length, 4, 'checkWin horizontal 4');
eq(checkWin(board(7, 6, [[0, 5, 1], [0, 4, 1], [0, 3, 1], [0, 2, 1]]), 0, 2, 1).length, 4, 'checkWin vertical 4');
eq(checkWin(board(7, 6, [[0, 2, 1], [1, 3, 1], [2, 4, 1], [3, 5, 1]]), 3, 5, 1).length, 4, 'checkWin diagonal down-right 4');
ok(checkWin(board(7, 6, [[0, 5, 1], [1, 5, 1], [2, 5, 1]]), 2, 5, 1) === null, 'checkWin 3-in-row is not a connect-4');
ok(checkWin(board(7, 6, [[0, 5, 1], [1, 5, 2], [2, 5, 1], [3, 5, 1]]), 3, 5, 1) === null, 'checkWin broken by opponent piece');
// rainbow wildcard
eq(checkWin(board(7, 6, [[0, 5, 1], [1, 5, 1], [2, 5, 1], [3, 5, RAINBOW]]), 3, 5, 1).length, 4, 'checkWin rainbow completes player 1');
eq(checkWin(board(7, 6, [[0, 5, 2], [1, 5, 2], [2, 5, 2], [3, 5, RAINBOW]]), 3, 5, 2).length, 4, 'checkWin rainbow completes player 2 too (wildcard)');

// ── isBoardFull / getValidCols ─────────────────────────────────────────────
{
  const full = createEmptyBoard(2, 2);
  full[0] = [1, 2]; full[1] = [2, 1];
  ok(isBoardFull(full), 'isBoardFull true when all occupied');
  ok(!isBoardFull(board(7, 6, [[0, 5, 1]])), 'isBoardFull false with empties');
  eq(getValidCols(board(2, 1, [[0, 0, 1]])).length, 1, 'getValidCols excludes full columns');
}

// ── applyDrop ──────────────────────────────────────────────────────────────
{
  const r = applyDrop(createEmptyBoard(), 3, 1);
  ok(r.ok && r.status === 'continue' && r.row === 5 && r.board[3][5] === 1, 'applyDrop places + continues');
  ok(applyDrop(board(7, 6, [[3, 5, 1], [3, 4, 1], [3, 3, 1], [3, 2, 1], [3, 1, 1], [3, 0, 1]]), 3, 1).ok === false, 'applyDrop full column → ok:false');
  const win = applyDrop(board(7, 6, [[0, 5, 1], [1, 5, 1], [2, 5, 1]]), 3, 1);
  ok(win.ok && win.status === 'won' && win.winner === 1 && win.winCells.length >= 4, 'applyDrop winning move → won');
  // draw on a 2x2 connect-4-impossible board
  const drawB = createEmptyBoard(2, 2); drawB[0] = [1, 2]; drawB[1] = [0, 1];
  const draw = applyDrop(drawB, 1, 2, { cols: 2, rows: 2, connectCount: 4 });
  ok(draw.ok && draw.status === 'draw', 'applyDrop filling last cell with no win → draw');
  // immutability: original board untouched
  const orig = createEmptyBoard();
  applyDrop(orig, 3, 1);
  ok(orig[3][5] === 0, 'applyDrop does not mutate input board');
}

// ── applyBomb ──────────────────────────────────────────────────────────────
{
  const b = board(7, 6, [[2, 5, 2], [3, 5, 2], [4, 5, 2]]);
  const r = applyBomb(b, 3, 1); // lands (3,4), clears 3x3 rows3-5 cols2-4
  ok(r.ok, 'applyBomb ok');
  ok(r.board[2][5] === 0 && r.board[3][5] === 0 && r.board[4][5] === 0, 'applyBomb clears the 3x3 neighborhood');
  ok(r.cleared.length === 3, 'applyBomb reports cleared cells for FX');
  // settle: a floating piece falls to the gravity end after the blast
  const fb = board(7, 6, [[3, 5, 1], [3, 2, 1]]); // (3,5) occupied, (3,2) floats
  const rs = applyBomb(fb, 3, 1); // lands (3,4); clears rows3-5 → removes (3,5); (3,2) then settles
  ok(rs.board[3][5] === 1 && rs.board[3][2] === 0, 'applyBomb settles floating pieces toward gravity');
}

// ── applyRainbow ───────────────────────────────────────────────────────────
{
  const win = applyRainbow(board(7, 6, [[0, 5, 1], [1, 5, 1], [2, 5, 1]]), 3, 1);
  ok(win.ok && win.status === 'won' && win.winner === 1 && win.board[3][5] === RAINBOW, 'applyRainbow completes own connect');
  const hand = applyRainbow(board(7, 6, [[0, 5, 2], [1, 5, 2], [2, 5, 2]]), 3, 1); // p1 drops, hands p2 the win
  ok(hand.ok && hand.status === 'won' && hand.winner === 2, 'applyRainbow can hand the opponent the win (hedged-bet downside)');
}

// ── applyHeavy ─────────────────────────────────────────────────────────────
{
  // col2 opponent at row4 floating above empty row5; heavy lands col3 at row4, pushes col2 opp down to row5.
  const b = board(7, 6, [[3, 5, 1], [2, 4, 2], [2, 3, WALL]]);
  const r = applyHeavy(b, 3, 1); // lands (3,4); neighbor (2,4)=opp, (2,5)=empty → push to (2,5)
  ok(r.ok && r.board[3][4] === 1, 'applyHeavy places the heavy piece');
  ok(r.board[2][5] === 2 && r.board[2][4] === 0, 'applyHeavy pushes adjacent opponent down one row');
  ok(r.pushed.some((p) => p.c === 2 && p.r === 5), 'applyHeavy reports pushed cells for FX');
}

// ── AI ─────────────────────────────────────────────────────────────────────
{
  eq(getAIMove(createEmptyBoard(), 'hard'), 3, 'AI opens center on empty board');
  eq(getAIMove(board(7, 6, [[0, 5, 2], [1, 5, 2], [2, 5, 2]]), 'hard'), 3, 'AI (p2) takes the immediate win');
  eq(getAIMove(board(7, 6, [[0, 5, 1], [1, 5, 1], [2, 5, 1]]), 'hard'), 3, 'AI blocks the immediate human threat');
  // sanity: always returns an in-range valid column across many random easy calls
  let allValid = true;
  for (let i = 0; i < 200; i++) {
    const m = getAIMove(board(7, 6, [[0, 5, 1]]), 'easy');
    if (!Number.isInteger(m) || m < 0 || m >= 7) { allValid = false; break; }
  }
  ok(allValid, 'AI always returns an in-range column (200 easy samples)');
  // connect-5 on a larger board does not throw and returns a valid col
  const big = createEmptyBoard(9, 9);
  const mv = getAIMove(big, 'legendary', 5);
  ok(Number.isInteger(mv) && mv >= 0 && mv < 9, 'AI handles 9x9 connect-5 without stalling/throwing');
}

// ── report ─────────────────────────────────────────────────────────────────
console.log(`\nDrop4 Hub engine tests: ${pass} passed, ${fail} failed.`);
if (fail > 0) { console.log('FAILED:', fails.join(' | ')); process.exit(1); }
console.log('ALL GREEN ✓');

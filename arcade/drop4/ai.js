/**
 * Drop4 — AI engine (minimax + alpha-beta), pure & framework-free.
 *
 * Ported verbatim from Drop4/src/engine/aiEngine.ts. Its only dependency is
 * getLowestEmptyRow from the rules engine. Player 2 is the AI, player 1 the
 * human. Difficulty tuning (depths, random/miss chances, the early-level mercy
 * ramp) is preserved exactly — the career curve was balanced against it.
 *
 * The AI always reasons in NORMAL (downward-gravity) orientation. Under Sal's
 * gravity flip the driver reorients the board before calling getAIMove and
 * maps the returned column back, so this module needs no gravity awareness.
 */

import { getLowestEmptyRow } from './engine.js';

const AI = 2;
const HUMAN = 1;

const DIFFICULTY_CONFIG = {
  easy:      { depth: 1, randomChance: 0.5 },
  medium:    { depth: 3, randomChance: 0.12 },
  hard:      { depth: 5, randomChance: 0 },
  legendary: { depth: 7, randomChance: 0 },
};

// Early-level mercy ramp (career levels 1-3 pass mercyBoost=true).
export const MERCY_EASY = { missWinChance: 0.40, missBlockChance: 0.60 };
export const STANDARD_EASY = { missWinChance: 0.30, missBlockChance: 0.45 };

function getEffectiveDepth(baseDepth, cols, rows, connectN) {
  if (cols * rows > 42 || connectN >= 5) return Math.max(3, baseDepth - 2);
  return baseDepth;
}

function getBoardDims(board) {
  const cols = board.length;
  const rows = cols > 0 ? board[0].length : 0;
  return { cols, rows };
}

function scoreWindow(window, player, connectN) {
  const opponent = player === 1 ? 2 : 1;
  const playerCount = window.filter((c) => c === player).length;
  const opponentCount = window.filter((c) => c === opponent).length;
  const emptyCount = window.filter((c) => c === 0).length;
  if (playerCount === connectN) return 100;
  if (playerCount === connectN - 1 && emptyCount === 1) return 5;
  if (playerCount === connectN - 2 && emptyCount === 2) return 2;
  if (opponentCount === connectN - 1 && emptyCount === 1) return -4;
  return 0;
}

function evaluateBoard(board, player, connectN) {
  const { cols, rows } = getBoardDims(board);
  let score = 0;
  const centerCol = Math.floor(cols / 2);
  const centerCount = board[centerCol].filter((c) => c === player).length;
  score += centerCount * 3;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= cols - connectN; col++) {
      const window = [];
      for (let i = 0; i < connectN; i++) window.push(board[col + i][row]);
      score += scoreWindow(window, player, connectN);
    }
  }
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row <= rows - connectN; row++) {
      const window = [];
      for (let i = 0; i < connectN; i++) window.push(board[col][row + i]);
      score += scoreWindow(window, player, connectN);
    }
  }
  for (let col = 0; col <= cols - connectN; col++) {
    for (let row = 0; row <= rows - connectN; row++) {
      const window = [];
      for (let i = 0; i < connectN; i++) window.push(board[col + i][row + i]);
      score += scoreWindow(window, player, connectN);
    }
  }
  for (let col = 0; col <= cols - connectN; col++) {
    for (let row = connectN - 1; row < rows; row++) {
      const window = [];
      for (let i = 0; i < connectN; i++) window.push(board[col + i][row - i]);
      score += scoreWindow(window, player, connectN);
    }
  }
  return score;
}

function isWinningMove(board, col, row, player, connectN) {
  const { cols, rows } = getBoardDims(board);
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const matches = (v) => v === player || v === 4;
  for (const [dc, dr] of directions) {
    let count = 1;
    for (let i = 1; i < connectN; i++) {
      const c = col + dc * i, r = row + dr * i;
      if (c >= 0 && c < cols && r >= 0 && r < rows && matches(board[c][r])) count++;
      else break;
    }
    for (let i = 1; i < connectN; i++) {
      const c = col - dc * i, r = row - dr * i;
      if (c >= 0 && c < cols && r >= 0 && r < rows && matches(board[c][r])) count++;
      else break;
    }
    if (count >= connectN) return true;
  }
  return false;
}

function getValidCols(board) {
  const { cols } = getBoardDims(board);
  const validCols = [];
  for (let col = 0; col < cols; col++) {
    if (board[col].some((cell) => cell === 0)) validCols.push(col);
  }
  return validCols;
}

function isTerminal(board, connectN) {
  const { cols, rows } = getBoardDims(board);
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const v = board[col][row];
      if (v === 1 || v === 2) {
        if (isWinningMove(board, col, row, v, connectN)) return true;
      }
    }
  }
  return getValidCols(board).length === 0;
}

function minimax(board, depth, alpha, beta, isMaximizing, connectN) {
  const { cols } = getBoardDims(board);
  const rawCols = getValidCols(board);
  const mid = Math.floor(cols / 2);
  const validCols = [...rawCols].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  const terminal = isTerminal(board, connectN);

  if (depth === 0 || terminal) {
    if (terminal) {
      const { rows } = getBoardDims(board);
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          if (board[col][row] === AI && isWinningMove(board, col, row, AI, connectN)) return [null, 100000];
          if (board[col][row] === HUMAN && isWinningMove(board, col, row, HUMAN, connectN)) return [null, -100000];
        }
      }
      return [null, 0];
    }
    return [null, evaluateBoard(board, AI, connectN)];
  }

  if (isMaximizing) {
    let bestScore = -Infinity;
    let bestCol = validCols[Math.floor(Math.random() * validCols.length)];
    for (const col of validCols) {
      const row = getLowestEmptyRow(board, col, board[col].length);
      const newBoard = board.map((c) => [...c]);
      newBoard[col][row] = AI;
      const [, score] = minimax(newBoard, depth - 1, alpha, beta, false, connectN);
      if (score > bestScore) { bestScore = score; bestCol = col; }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return [bestCol, bestScore];
  } else {
    let bestScore = Infinity;
    let bestCol = validCols[Math.floor(Math.random() * validCols.length)];
    for (const col of validCols) {
      const row = getLowestEmptyRow(board, col, board[col].length);
      const newBoard = board.map((c) => [...c]);
      newBoard[col][row] = HUMAN;
      const [, score] = minimax(newBoard, depth - 1, alpha, beta, true, connectN);
      if (score < bestScore) { bestScore = score; bestCol = col; }
      beta = Math.min(beta, score);
      if (alpha >= beta) break;
    }
    return [bestCol, bestScore];
  }
}

/**
 * The AI's chosen column. difficulty ∈ easy|medium|hard|legendary.
 * mercyBoost only affects 'easy' (career levels 1-3).
 */
export function getAIMove(board, difficulty, connectCount = 4, mercyBoost = false) {
  const config = DIFFICULTY_CONFIG[difficulty];
  const connectN = connectCount;
  const { cols, rows } = getBoardDims(board);

  const totalPieces = board.reduce((sum, col) => sum + col.filter((c) => c !== 0).length, 0);
  if (totalPieces <= 1) {
    const centerCol = Math.floor(cols / 2);
    if (board[centerCol][0] === 0) {
      if (difficulty !== 'easy' || Math.random() > 0.4) return centerCol;
    }
  }

  const isRandom = Math.random() < config.randomChance;
  if (isRandom) {
    const validCols = getValidCols(board);
    return validCols[Math.floor(Math.random() * validCols.length)];
  }

  const easyTuning = mercyBoost ? MERCY_EASY : STANDARD_EASY;
  const validCols = getValidCols(board);
  const shouldTakeWin = difficulty === 'easy' ? Math.random() > easyTuning.missWinChance : true;
  if (shouldTakeWin) {
    for (const col of validCols) {
      const row = getLowestEmptyRow(board, col, board[col].length);
      const testBoard = board.map((c) => [...c]);
      testBoard[col][row] = AI;
      if (isWinningMove(testBoard, col, row, AI, connectN)) return col;
    }
  }

  const shouldBlock = difficulty === 'easy' ? Math.random() > easyTuning.missBlockChance : true;
  if (shouldBlock) {
    for (const col of validCols) {
      const row = getLowestEmptyRow(board, col, board[col].length);
      const testBoard = board.map((c) => [...c]);
      testBoard[col][row] = HUMAN;
      if (isWinningMove(testBoard, col, row, HUMAN, connectN)) return col;
    }
  }

  const centerCol = Math.floor(cols / 2);
  const orderedCols = [...validCols].sort((a, b) => Math.abs(a - centerCol) - Math.abs(b - centerCol));
  const effectiveDepth = getEffectiveDepth(config.depth, cols, rows, connectN);
  const [bestCol] = minimax(board, effectiveDepth, -Infinity, Infinity, true, connectN);
  return bestCol ?? orderedCols[0] ?? validCols[0];
}

export { DIFFICULTY_CONFIG };

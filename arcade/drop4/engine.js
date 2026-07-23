/**
 * Drop4 — connect-N rules engine (pure, framework-free).
 *
 * Ported verbatim (logic-for-logic) from the store version that ships in the
 * commercial Drop4 app: Drop4/src/stores/gameStore.ts. The zustand store +
 * AsyncStorage wiring is stripped; what remains is the pure rules brain the
 * career campaign was sim-tuned against. The four "drop" resolvers return a
 * NEW immutable board + an outcome object instead of mutating store state —
 * the match driver owns currentPlayer / scores / streak / history.
 *
 * Board representation (unchanged from Drop4):
 *   board = Cell[cols][rows]  — COLUMN-MAJOR. board[col][row].
 *   Cell: 0 = empty, 1 = player 1, 2 = player 2, WALL = 3 (immovable
 *   obstacle), RAINBOW = 4 (wildcard — counts as EITHER player in checkWin).
 *   Default board is 7 cols x 6 rows. gravityDown=true stacks from the bottom
 *   (row = rows-1 fills first); false (Sal boss flip) stacks from the top.
 *
 * No imports. No side effects. Safe to run in Node or the browser.
 */

export const EMPTY = 0;
/** Immovable concrete obstacle. Skipped by landing (=== 0 check), ignored by
 *  checkWin (only matches === player), counted as occupied by isBoardFull. */
export const WALL = 3;
/** Rainbow power piece — wildcard. checkWin treats it as either player. */
export const RAINBOW = 4;

export const ROWS = 6;
export const COLS = 7;

export function createEmptyBoard(cols = COLS, rows = ROWS) {
  return Array.from({ length: cols }, () => Array(rows).fill(0));
}

/** Deep-clone a board (columns are independent arrays). */
export function cloneBoard(board) {
  return board.map((c) => [...c]);
}

/** Find the row a new piece would land on if dropped in `col`. gravityDown
 *  true → scan bottom (rows-1) up; false → scan top (0) down. Returns -1 if
 *  the column has no empty cell (or col is out of bounds / non-integer). */
export function getLandingRow(board, col, rows = ROWS, gravityDown = true) {
  if (!Number.isInteger(col) || col < 0 || col >= board.length) return -1;
  if (gravityDown) {
    for (let row = rows - 1; row >= 0; row--) {
      if (board[col][row] === 0) return row;
    }
  } else {
    for (let row = 0; row < rows; row++) {
      if (board[col][row] === 0) return row;
    }
  }
  return -1;
}

/** Back-compat alias — downward gravity. Used by the AI (which always reasons
 *  in normal orientation; the driver reorients the board for Sal). */
export function getLowestEmptyRow(board, col, rows = ROWS) {
  return getLandingRow(board, col, rows, true);
}

/** Return the connect-N winning cells through (col,row) for `player`, or null.
 *  RAINBOW (4) counts as part of the chain for either player. */
export function checkWin(board, col, row, player, connectCount = 4, cols = COLS, rows = ROWS) {
  const directions = [
    [0, 1],   // vertical
    [1, 0],   // horizontal
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal up-right
  ];
  const matchesPlayer = (v) => v === player || v === RAINBOW;

  for (const [dc, dr] of directions) {
    const cells = [[col, row]];
    for (let i = 1; i < connectCount; i++) {
      const c = col + dc * i;
      const r = row + dr * i;
      if (c >= 0 && c < cols && r >= 0 && r < rows && matchesPlayer(board[c][r])) cells.push([c, r]);
      else break;
    }
    for (let i = 1; i < connectCount; i++) {
      const c = col - dc * i;
      const r = row - dr * i;
      if (c >= 0 && c < cols && r >= 0 && r < rows && matchesPlayer(board[c][r])) cells.push([c, r]);
      else break;
    }
    if (cells.length >= connectCount) return cells;
  }
  return null;
}

/** A board is full when every cell is occupied (gravity-agnostic). */
export function isBoardFull(board) {
  return board.every((col) => col.every((cell) => cell !== 0));
}

/** Columns that still have at least one empty cell (gravity-agnostic). */
export function getValidCols(board) {
  const out = [];
  for (let col = 0; col < board.length; col++) {
    if (board[col].some((cell) => cell === 0)) out.push(col);
  }
  return out;
}

function boardDims(board, opts) {
  const cols = opts?.cols ?? board.length;
  const rows = opts?.rows ?? (board.length ? board[0].length : ROWS);
  const connectCount = opts?.connectCount ?? 4;
  const gravityDown = opts?.gravityDown ?? true;
  return { cols, rows, connectCount, gravityDown };
}

/**
 * Standard drop. Returns:
 *   { ok:false }                                             — column full / invalid
 *   { ok:true, board, col, row, status, winner, winCells }
 * status ∈ 'won' | 'draw' | 'continue'. winner is the piece's player on a win.
 */
export function applyDrop(board, col, player, opts = {}) {
  const { cols, rows, connectCount, gravityDown } = boardDims(board, opts);
  const row = getLandingRow(board, col, rows, gravityDown);
  if (row === -1) return { ok: false };

  const newBoard = cloneBoard(board);
  newBoard[col][row] = player;

  const winCells = checkWin(newBoard, col, row, player, connectCount, cols, rows);
  if (winCells) return { ok: true, board: newBoard, col, row, status: 'won', winner: player, winCells };
  if (isBoardFull(newBoard)) return { ok: true, board: newBoard, col, row, status: 'draw', winner: null, winCells: null };
  return { ok: true, board: newBoard, col, row, status: 'continue', winner: null, winCells: null };
}

/**
 * Bomb power piece. Lands like a normal drop, then clears the 3x3 around the
 * landing cell (walls included), settles each touched column inside its
 * wall-bounded segments (respecting gravity), then scans the touched columns
 * for any formed connect — mover first, then opponent. Never draws (it frees
 * cells). Extra field: `cleared` = [[c,r],...] cells wiped, for the FX layer.
 */
export function applyBomb(board, col, player, opts = {}) {
  const { cols, rows, connectCount, gravityDown } = boardDims(board, opts);
  const row = getLandingRow(board, col, rows, gravityDown);
  if (row === -1) return { ok: false };

  const opp = player === 1 ? 2 : 1;
  const newBoard = cloneBoard(board);
  const cleared = [];

  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const c = col + dc;
      const r = row + dr;
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        if (newBoard[c][r] !== 0) cleared.push([c, r]);
        newBoard[c][r] = 0;
      }
    }
  }

  // Settle each touched column inside wall-bounded segments so walls outside
  // the blast stay put and pieces fall toward the live gravity end.
  for (let dc = -1; dc <= 1; dc++) {
    const c = col + dc;
    if (c < 0 || c >= cols) continue;
    let segStart = 0;
    for (let r = 0; r <= rows; r++) {
      if (r === rows || newBoard[c][r] === 3) {
        const seg = [];
        for (let i = segStart; i < r; i++) if (newBoard[c][i] !== 0) seg.push(newBoard[c][i]);
        for (let i = segStart; i < r; i++) newBoard[c][i] = 0;
        if (gravityDown) {
          for (let k = 0; k < seg.length; k++) newBoard[c][r - seg.length + k] = seg[k];
        } else {
          for (let k = 0; k < seg.length; k++) newBoard[c][segStart + k] = seg[k];
        }
        segStart = r + 1;
      }
    }
  }

  const findSettledWin = (p) => {
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      if (c < 0 || c >= cols) continue;
      for (let r = 0; r < rows; r++) {
        const cell = newBoard[c][r];
        if (cell !== p && cell !== RAINBOW) continue;
        const win = checkWin(newBoard, c, r, p, connectCount, cols, rows);
        if (win) return win;
      }
    }
    return null;
  };
  for (const p of [player, opp]) {
    const win = findSettledWin(p);
    if (win) return { ok: true, board: newBoard, col, row, status: 'won', winner: p, winCells: win, cleared };
  }
  return { ok: true, board: newBoard, col, row, status: 'continue', winner: null, winCells: null, cleared };
}

/**
 * Rainbow power piece. Lands as cell value RAINBOW. Wildcard: can complete
 * EITHER player's connect. Checks the mover first (credit), then the opponent
 * (the hedged-bet downside), then draw. status/winner as computed.
 */
export function applyRainbow(board, col, player, opts = {}) {
  const { cols, rows, connectCount, gravityDown } = boardDims(board, opts);
  const row = getLandingRow(board, col, rows, gravityDown);
  if (row === -1) return { ok: false };

  const opp = player === 1 ? 2 : 1;
  const newBoard = cloneBoard(board);
  newBoard[col][row] = RAINBOW;

  const winSelf = checkWin(newBoard, col, row, player, connectCount, cols, rows);
  if (winSelf) return { ok: true, board: newBoard, col, row, status: 'won', winner: player, winCells: winSelf };
  const winOpp = checkWin(newBoard, col, row, opp, connectCount, cols, rows);
  if (winOpp) return { ok: true, board: newBoard, col, row, status: 'won', winner: opp, winCells: winOpp };
  if (isBoardFull(newBoard)) return { ok: true, board: newBoard, col, row, status: 'draw', winner: null, winCells: null };
  return { ok: true, board: newBoard, col, row, status: 'continue', winner: null, winCells: null };
}

/**
 * Heavy power piece. Lands as the player's piece, then pushes adjacent
 * OPPONENT pieces (col-1, col+1 same row) one row in the gravity direction
 * when that cell is empty. Wins checked at landing (mover) then at each pushed
 * cell (opponent). Extra field: `pushed` = [{c,r},...] for the FX slide.
 */
export function applyHeavy(board, col, player, opts = {}) {
  const { cols, rows, connectCount, gravityDown } = boardDims(board, opts);
  const row = getLandingRow(board, col, rows, gravityDown);
  if (row === -1) return { ok: false };

  const opp = player === 1 ? 2 : 1;
  const newBoard = cloneBoard(board);
  newBoard[col][row] = player;

  const pushDir = gravityDown ? 1 : -1;
  const pushed = [];
  const target = row + pushDir;
  if (target >= 0 && target < rows) {
    for (const dc of [-1, 1]) {
      const c = col + dc;
      if (c < 0 || c >= cols) continue;
      if (newBoard[c][row] === opp && newBoard[c][target] === 0) {
        newBoard[c][target] = opp;
        newBoard[c][row] = 0;
        pushed.push({ c, r: target });
      }
    }
  }

  const winSelf = checkWin(newBoard, col, row, player, connectCount, cols, rows);
  if (winSelf) return { ok: true, board: newBoard, col, row, status: 'won', winner: player, winCells: winSelf, pushed };
  for (const p of pushed) {
    const winOpp = checkWin(newBoard, p.c, p.r, opp, connectCount, cols, rows);
    if (winOpp) return { ok: true, board: newBoard, col, row, status: 'won', winner: opp, winCells: winOpp, pushed };
  }
  if (isBoardFull(newBoard)) return { ok: true, board: newBoard, col, row, status: 'draw', winner: null, winCells: null, pushed };
  return { ok: true, board: newBoard, col, row, status: 'continue', winner: null, winCells: null, pushed };
}

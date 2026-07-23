/**
 * Drop4 Hub — the match driver.
 *
 * Wraps the pure engine (engine.js) + AI (ai.js) + visuals (visuals.js) into a
 * playable, animated Connect-N match on a Canvas. Re-implements the RULES that
 * Drop4's GameScreen.tsx orchestrates around the pure engine (recon 03): turn
 * loop, AI scheduling, the three boss scripts (tommy/sal/warden), per-turn
 * timer, moves-limit loss, power pieces, star math — without porting the RN
 * screen. The driver reports terminal results via onResult; the shell owns
 * coins/records/Firebase.
 */

import {
  createEmptyBoard, cloneBoard, getLandingRow, getValidCols, WALL,
  applyDrop, applyBomb, applyRainbow, applyHeavy,
} from './engine.js';
import { getAIMove } from './ai.js';
import {
  boardLayout, drawBoardFrame, drawPiece, drawScene, getThemeScene,
  PIECE_SKINS, PIECE_RARITY, BOARD_RARITY,
} from './visuals.js';
import { normalizeRarity, FINISH_TIER } from './rarity.js';

const AI_THINK_DELAY = { easy: 600, medium: 800, hard: 1200, legendary: 1400 };

export function createMatch(canvas, opts) {
  const o = Object.assign({
    rows: 6, cols: 7, connectCount: 4, difficulty: 'medium', mercyBoost: false,
    timerSeconds: 0, playerGoesFirst: true, bossScript: null, obstacleCells: null,
    presetBoard: null, movesLimit: null, rewardMultiplier: 1, gameSpeed: 'normal',
    theme: 'default', pieceSkinId: 'classic', opponentSkinId: 'classic',
    powerPieces: { bomb: false, rainbow: false, heavy: false },
    starThresholds: null, sfx: null, onResult: () => {}, onState: () => {},
    intro: false,
  }, opts);

  const ctx = canvas.getContext('2d');
  const rows = o.rows, cols = o.cols, connectCount = o.connectCount;
  const engineOpts = () => ({ rows, cols, connectCount, gravityDown });
  const scene = getThemeScene(o.theme);
  const boardTier = FINISH_TIER[normalizeRarity(BOARD_RARITY[o.theme] || 'common')] ?? 0;
  const p1c = (PIECE_SKINS[o.pieceSkinId] || PIECE_SKINS.classic).p1;
  const p2c = (PIECE_SKINS[o.opponentSkinId] || PIECE_SKINS.classic).p2;
  const p1finish = PIECE_RARITY[o.pieceSkinId] || 'epic';
  const rainbowColor = { main: '#ff4081', dark: '#4a2050', light: '#ffd54f', glow: 'rgba(255,120,200,0.7)', gradient: ['#ff4081', '#ff8c42', '#ffd54f', '#4caf50', '#3498db', '#9b59b6'] };

  // ── state ──
  let board = createEmptyBoard(cols, rows);
  let currentPlayer = o.playerGoesFirst ? 1 : 2;
  let status = 'playing';   // playing | won | draw
  let winner = null, winCells = null, winStart = 0;
  let moveCount = 0;
  let gravityDown = true;
  let isAiThinking = false;
  let armed = null;         // 'bomb'|'rainbow'|'heavy'|null
  const ammo = { bomb: 1, rainbow: 1, heavy: 1 };
  let introDone = !o.intro;
  let hoverCol = -1;
  let turnTimer = o.timerSeconds || 0;
  let timerId = null;
  let destroyed = false;
  let awarded = false;

  // animation registries
  const drops = [];   // {col,row,player,start,fallDur}
  const fx = [];      // power-piece bursts {type,col,row,start}
  const flashes = []; // land flashes {col,row,start}
  let banner = null;  // {text,start,dur}

  // ── setup: stamp preset board + obstacles ──
  if (o.presetBoard) {
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      if (o.presetBoard[c] && o.presetBoard[c][r] != null) board[c][r] = o.presetBoard[c][r];
    }
  }
  if (o.obstacleCells) {
    for (const cell of o.obstacleCells) {
      if (cell.col >= 0 && cell.col < cols && cell.row >= 0 && cell.row < rows) board[cell.col][cell.row] = WALL;
    }
  }

  // ── layout (recomputed on resize) ──
  let layout = boardLayout(cols, rows, 100);
  let boardX = 0, boardY = 0, sceneW = 0, sceneH = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 360, cssH = canvas.clientHeight || 560;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sceneW = cssW; sceneH = cssH;
    const maxW = Math.min(cssW - 16, 560, (cssH - 160) * cols / rows + 40);
    layout = boardLayout(cols, rows, Math.max(200, maxW));
    boardX = (cssW - layout.w) / 2;
    boardY = Math.max(70, (cssH - layout.h) / 2 + 10);
  }

  const sfxPlay = (n) => { try { o.sfx && o.sfx.play(n); } catch (e) {} };
  const emitState = () => o.onState({ currentPlayer, status, moveCount, isAiThinking, armed, ammo, turnTimer, gravityDown });

  // ── result handling ──
  function finish() {
    if (awarded) return;
    awarded = true;
    stopTimer();
    winStart = performance.now();
    let stars = null, playerMoves = Math.ceil(moveCount / 2);
    if (status === 'won' && winner === 1) {
      const th = o.starThresholds || { three: 14, two: 24 };
      stars = playerMoves <= th.three ? 3 : playerMoves <= th.two ? 2 : 1;
      sfxPlay('win');
    } else if (status === 'won') { sfxPlay('lose'); }
    else { sfxPlay('coin'); }
    setTimeout(() => o.onResult({
      result: status === 'draw' ? 'draw' : winner === 1 ? 'win' : 'loss',
      winner, moveCount, playerMoves, stars,
      difficulty: o.difficulty, rewardMultiplier: o.rewardMultiplier,
    }), status === 'draw' ? 400 : 900);
    emitState();
  }

  function applyResult(res, who) {
    board = res.board;
    moveCount++;
    if (res.status === 'won') { status = 'won'; winner = res.winner; winCells = res.winCells; finish(); }
    else if (res.status === 'draw') { status = 'draw'; finish(); }
    else { currentPlayer = who === 1 ? 2 : 1; afterMove(); }
    emitState();
  }

  // ── a normal drop by `player` at `col` ──
  function doDrop(col, player) {
    const res = applyDrop(board, col, player, engineOpts());
    if (!res.ok) return false;
    drops.push({ col, row: res.row, player, start: performance.now(), fallDur: 230 + res.row * 42 });
    flashes.push({ col, row: res.row, start: performance.now() + res.fallDur });
    sfxPlay('place');
    applyResult(res, player);
    return true;
  }

  function doPower(kind, col, player) {
    const fn = kind === 'bomb' ? applyBomb : kind === 'rainbow' ? applyRainbow : applyHeavy;
    const res = fn(board, col, player, engineOpts());
    if (!res.ok) return false;
    drops.push({ col, row: res.row, player: kind === 'rainbow' ? 'rainbow' : player, start: performance.now(), fallDur: 210 + res.row * 42 });
    fx.push({ type: kind, col: res.col, row: res.row, start: performance.now() + res.fallDur * 0.5 });
    sfxPlay(kind === 'bomb' ? 'hit' : kind === 'heavy' ? 'hit' : 'powerup');
    if (kind === 'bomb') banner = { text: 'BOOM!', start: performance.now(), dur: 600 };
    applyResult(res, player);
    return true;
  }

  // ── player input ──
  function columnAt(px) {
    const rel = px - boardX;
    if (rel < 0 || rel > layout.w) return -1;
    const c = Math.floor((rel - 6) / (layout.cell + 6));
    return c >= 0 && c < cols ? c : -1;
  }

  function inputLocked() {
    return status !== 'playing' || isAiThinking || !introDone || anyDropAnimating();
  }
  function anyDropAnimating() {
    const now = performance.now();
    return drops.some((d) => now < d.start + d.fallDur);
  }

  function tryPlayerMove(col) {
    if (inputLocked()) return;
    if (currentPlayer !== 1) return;
    if (col < 0 || col >= cols) return;
    if (getLandingRow(board, col, rows, gravityDown) === -1) return;

    // Tommy parity gate
    if (o.bossScript === 'tommy') {
      const turn = moveCount + 1;
      if ((col % 2) !== (turn % 2)) {
        sfxPlay('error');
        banner = { text: (turn % 2 ? 'ODD' : 'EVEN') + ' columns only!', start: performance.now(), dur: 1000 };
        return;
      }
    }
    if (armed && ammo[armed] > 0) {
      const kind = armed;
      if (doPower(kind, col, 1)) { ammo[kind]--; armed = null; scheduleAI(); }
      else armed = null;
      return;
    }
    if (doDrop(col, 1)) scheduleAI();
  }

  // ── AI ──
  function scheduleAI() {
    if (status !== 'playing' || currentPlayer !== 2) return;
    isAiThinking = true; emitState();
    const base = AI_THINK_DELAY[o.difficulty] || 800;
    const think = o.gameSpeed === 'instant' ? 60 : o.gameSpeed === 'fast' ? Math.round(base * 0.3) : base;
    setTimeout(() => {
      if (destroyed || status !== 'playing' || currentPlayer !== 2) { isAiThinking = false; return; }
      // Sal: AI reasons in normal orientation; reverse columns when gravity is flipped.
      const aiBoard = gravityDown ? board : board.map((c) => [...c].reverse());
      let aiCol = getAIMove(aiBoard, o.difficulty, connectCount, o.mercyBoost);
      if (o.bossScript === 'tommy') {
        const turn = moveCount + 1;
        if ((aiCol % 2) !== (turn % 2)) {
          for (let c = 0; c < cols; c++) if ((c % 2) === (turn % 2) && getLandingRow(board, c, rows, gravityDown) !== -1) { aiCol = c; break; }
        }
      }
      isAiThinking = false;
      if (getLandingRow(board, aiCol, rows, gravityDown) === -1) {
        const valid = getValidCols(board); if (!valid.length) return; aiCol = valid[0];
      }
      doDrop(aiCol, 2);
    }, think);
  }

  // Sal flip + moves-limit run after every committed move.
  function afterMove() {
    if (status !== 'playing') return;
    if (o.bossScript === 'sal' && moveCount > 0 && moveCount % 4 === 0) {
      gravityDown = !gravityDown;
      sfxPlay('whoosh');
      banner = { text: 'GRAVITY FLIP!', start: performance.now(), dur: 900 };
    }
    if (o.movesLimit) {
      const pm = o.playerGoesFirst ? Math.ceil(moveCount / 2) : Math.floor(moveCount / 2);
      if (pm > o.movesLimit) { status = 'won'; winner = 2; finish(); }
    }
    startTimer();
  }

  // ── per-turn timer ──
  function startTimer() {
    stopTimer();
    if (!o.timerSeconds || status !== 'playing' || !introDone) return;
    turnTimer = o.timerSeconds;
    timerId = setInterval(() => {
      if (status !== 'playing') { stopTimer(); return; }
      if (turnTimer <= Math.min(6, o.timerSeconds)) sfxPlay('tick');
      if (turnTimer <= 1) {
        const valid = getValidCols(board);
        if (valid.length) {
          const center = (cols - 1) / 2;
          const autoCol = valid.reduce((a, b) => Math.abs(b - center) < Math.abs(a - center) ? b : a, valid[0]);
          const mover = currentPlayer;
          if (doDrop(autoCol, mover)) { sfxPlay('error'); if (mover === 1) scheduleAI(); }
        }
        turnTimer = o.timerSeconds;
      } else turnTimer--;
      emitState();
    }, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  // ── public: arm a power piece ──
  function armPower(kind) {
    if (!o.powerPieces[kind] || ammo[kind] <= 0) return;
    if (currentPlayer !== 1 || status !== 'playing' || isAiThinking) return;
    armed = armed === kind ? null : kind;
    sfxPlay('select');
    emitState();
  }

  function dismissIntro() { if (!introDone) { introDone = true; startTimer(); if (currentPlayer === 2) scheduleAI(); emitState(); } }

  // ── pointer handlers ──
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    hoverCol = columnAt((e.clientX ?? (e.touches && e.touches[0].clientX)) - rect.left);
  }
  function onLeave() { hoverCol = -1; }
  function onClick(e) {
    if (!introDone) { dismissIntro(); return; }
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX ?? (e.changedTouches && e.changedTouches[0].clientX)) - rect.left;
    const col = columnAt(px);
    if (col >= 0) tryPlayerMove(col);
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onClick);

  // ── render loop ──
  function renderPieceAt(col, row, who, now) {
    const { x, y } = layout.cellCenter(col, row);
    const drawY = gravityDown ? y : layout.h - y; // Y-mirror for Sal
    const cx = boardX + x, cy = boardY + drawY;
    const d = drops.find((dr) => dr.col === col && dr.row === row);
    let py = cy, squash = 1;
    if (d) {
      const el = now - d.start;
      if (el < d.fallDur) {
        const p = el / d.fallDur, eased = p * p; // ease-in (accelerating fall)
        const startY = boardY - 40;
        py = startY + (cy - startY) * eased;
      } else if (el < d.fallDur + 130) {
        const sp = (el - d.fallDur) / 130; squash = 1 - 0.18 * Math.sin(sp * Math.PI); // squash on impact
      }
    }
    const r = layout.piece / 2;
    let pc, finish;
    if (who === 'rainbow') { pc = rainbowColor; finish = 'legendary'; }
    else if (who === 1) { pc = p1c; finish = p1finish; }
    else { pc = p2c; finish = 'common'; }
    ctx.save(); ctx.translate(cx, py); ctx.scale(1 / squash, squash); ctx.translate(-cx, -py);
    drawPiece(ctx, cx, py, r, pc, finish, now, true);
    ctx.restore();
  }

  function render(now) {
    if (destroyed) return;
    ctx.clearRect(0, 0, sceneW, sceneH);
    drawScene(ctx, sceneW, sceneH, scene, boardTier, now);

    ctx.save();
    ctx.translate(boardX, boardY);
    drawBoardFrame(ctx, layout, cols, rows, o.theme);
    ctx.restore();

    // hover preview arrow
    if (hoverCol >= 0 && !inputLocked() && currentPlayer === 1) {
      const { x } = layout.cellCenter(hoverCol, 0);
      ctx.fillStyle = armed ? '#ffd166' : p1c.main;
      ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(now / 300));
      ctx.beginPath();
      const ax = boardX + x, ay = boardY - 22;
      ctx.moveTo(ax - 10, ay); ctx.lineTo(ax + 10, ay); ctx.lineTo(ax, ay + 12); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // pieces (skip walls; walls drawn as slabs)
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const v = board[c][r];
      if (v === 0) continue;
      if (v === WALL) {
        const { x, y } = layout.cellCenter(c, r);
        const drawY = gravityDown ? y : layout.h - y;
        const s = layout.piece;
        ctx.fillStyle = '#3a3f4a'; ctx.strokeStyle = '#20242c'; ctx.lineWidth = 2;
        ctx.fillRect(boardX + x - s / 2, boardY + drawY - s / 2, s, s);
        ctx.strokeRect(boardX + x - s / 2, boardY + drawY - s / 2, s, s);
        continue;
      }
      renderPieceAt(c, r, v === 4 ? 'rainbow' : v, now);
    }

    // land flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; const el = now - f.start;
      if (el < 0) continue; if (el > 200) { flashes.splice(i, 1); continue; }
      const { x, y } = layout.cellCenter(f.col, f.row);
      const drawY = gravityDown ? y : layout.h - y;
      const p = el / 200;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - p)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(boardX + x, boardY + drawY, layout.piece / 2 * (1 + p * 0.5), 0, Math.PI * 2); ctx.stroke();
    }

    // power fx bursts
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; const el = now - f.start;
      if (el < 0) continue; if (el > 700) { fx.splice(i, 1); continue; }
      const { x, y } = layout.cellCenter(f.col, f.row);
      const drawY = gravityDown ? y : layout.h - y;
      const p = el / 700;
      const color = f.type === 'bomb' ? '#ff4444' : f.type === 'heavy' ? '#3b82f6' : '#a855f7';
      ctx.strokeStyle = `rgba(${f.type === 'bomb' ? '255,68,68' : f.type === 'heavy' ? '59,130,246' : '168,85,247'},${0.9 * (1 - p)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(boardX + x, boardY + drawY, layout.piece * (0.3 + p * 1.5), 0, Math.PI * 2); ctx.stroke();
    }

    // win highlight cascade
    if (status === 'won' && winCells) {
      winCells.forEach((cell, idx) => {
        const el = now - winStart - idx * 120;
        if (el < 0) return;
        const { x, y } = layout.cellCenter(cell[0], cell[1]);
        const drawY = gravityDown ? y : layout.h - y;
        const pulse = 1 + 0.08 * Math.sin(now / 300);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(255,215,0,0.9)'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(boardX + x, boardY + drawY, layout.piece / 2 * pulse + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        if (el < 350) {
          ctx.fillStyle = `rgba(255,245,210,${0.85 * (1 - el / 350)})`;
          ctx.beginPath(); ctx.arc(boardX + x, boardY + drawY, layout.piece / 2 + 6, 0, Math.PI * 2); ctx.fill();
        }
      });
    }

    // banner (boss hints / power labels)
    if (banner) {
      const el = now - banner.start;
      if (el > banner.dur) banner = null;
      else {
        ctx.save();
        ctx.globalAlpha = el < 150 ? el / 150 : el > banner.dur - 200 ? (banner.dur - el) / 200 : 1;
        ctx.font = '900 30px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12;
        ctx.fillText(banner.text, sceneW / 2, boardY - 44);
        ctx.restore();
      }
    }

    // intro card
    if (!introDone && o.intro) {
      ctx.fillStyle = 'rgba(6,10,26,0.72)'; ctx.fillRect(0, 0, sceneW, sceneH);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 24px Fredoka, sans-serif';
      ctx.fillText(o.intro.label || 'GET READY', sceneW / 2, sceneH / 2 - 16);
      ctx.font = '500 15px Outfit, sans-serif'; ctx.fillStyle = '#a7a2cc';
      ctx.fillText(o.intro.rule || 'Tap to start', sceneW / 2, sceneH / 2 + 16);
    }

    raf = requestAnimationFrame(render);
  }

  // auto-dismiss intro after 1.8s
  if (o.intro) setTimeout(() => dismissIntro(), 1800);

  let raf = 0;
  function start() {
    resize();
    window.addEventListener('resize', resize);
    if (introDone && currentPlayer === 2) scheduleAI();
    if (introDone) startTimer();
    raf = requestAnimationFrame(render);
    emitState();
  }
  function destroy() {
    destroyed = true;
    cancelAnimationFrame(raf); stopTimer();
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('pointerdown', onClick);
  }

  return { start, destroy, armPower, dismissIntro, getState: () => ({ status, winner, moveCount }) };
}

/**
 * Drop4 Hub — Canvas 2D visual system (piece orbs + board + scene backdrops).
 *
 * Re-expresses Drop4's code-drawn board/piece system (RN-Animated + palettes)
 * on a plain Canvas 2D context — no shaders, no images, Chromebook-cheap.
 * Ported from Drop4/src/components/effects/PieceVisual.tsx,
 * components/board/GameBoard.tsx, components/ui/PremiumBoardThumbnail.tsx and
 * the palette data files. All colors/formulas are exact from source.
 *
 * The single highest-impact deliverable is drawPiece() — the finish ramp that
 * makes every rarity read as premium (matte → foil → living). RULE from the
 * Drop4 project memory: NO white oval/blob shine. The tight top-left sheen is
 * the ONLY white highlight; the dark outline ring gives the sphere its read.
 */

import {
  parseColor, mixColor, darken, lighten, withAlpha, luminance, toHex6,
  FINISH_TIER, HALO_BY_TIER,
} from './rarity.js';

// ── Board frame palettes (subset of BOARD_THEME_VISUALS) ────────────────────
// { frame:[hi,mid,lo], border, hole, holeBorder, base:[hi,mid,lo] }
// The load-bearing colors for the slab board are frame[1] (fill), border
// (border + hole glow), hole, holeBorder. base drives scene derivation.
export const BOARD_THEMES = {
  default:       { frame:['#2a5bce','#1a3a8a','#0d2060'], border:'#3668d4', hole:'#091440', holeBorder:'#071030', base:['#1a3a8a','#0d2060','#091540'] },
  wood:          { frame:['#a0724a','#8B5E3C','#6b4226'], border:'#b8845a', hole:'#3a2010', holeBorder:'#2a1508', base:['#8B5E3C','#6b4226','#4a2d18'] },
  neon:          { frame:['#0e5c22','#0a3a16','#06220c'], border:'#00ff88', hole:'#020a02', holeBorder:'#00ff4433', base:['#0a3a16','#06220c','#020a02'] },
  galaxy:        { frame:['#3a1a6b','#2a0e50','#1a0630'], border:'#6b3ab8', hole:'#0a0318', holeBorder:'#150828', base:['#2a0e50','#1a0630','#0a0318'] },
  gold:          { frame:['#c8a030','#a08020','#786010'], border:'#e8c848', hole:'#1a1508', holeBorder:'#2d250e', base:['#a08020','#786010','#584808'] },
  ice:           { frame:['#4a8ab8','#2a6a98','#1a4a78'], border:'#6aacda', hole:'#081828', holeBorder:'#0c2238', base:['#2a6a98','#1a4a78','#0a3058'] },
  lava:          { frame:['#8a2a1a','#6a1a0a','#4a0a00'], border:'#c84020', hole:'#1a0500', holeBorder:'#300a00', base:['#6a1a0a','#4a0a00','#2a0500'] },
  darkmatter:    { frame:['#2a0a55','#1e0740','#14052c'], border:'#bf5fff', hole:'#06030f', holeBorder:'#bf5fff55', base:['#2a0a48','#16062a','#0a0518'] },
  midnight:      { frame:['#1a1a2e','#0e0e1a','#060610'], border:'#8892b0', hole:'#030308', holeBorder:'#8892b022', base:['#0e0e1a','#060610','#020206'] },
  candy:         { frame:['#e88aaf','#d15a8a','#a83a6a'], border:'#ffb6d5', hole:'#3d0a20', holeBorder:'#5a1530', base:['#d15a8a','#a83a6a','#801a4a'] },
  matrix:        { frame:['#0e5216','#08340e','#041c06'], border:'#00ff41', hole:'#010800', holeBorder:'#00ff4122', base:['#08340e','#041c06','#010800'] },
  sunset:        { frame:['#e86830','#c84820','#8a2a10'], border:'#ff9060', hole:'#1a0800', holeBorder:'#301208', base:['#c84820','#8a2a10','#5a1a08'] },
  crystal:       { frame:['#6ac8e8','#3a98c8','#1a6898'], border:'#a0e8ff', hole:'#081a28', holeBorder:'#a0e8ff22', base:['#3a98c8','#1a6898','#0a4868'] },
  void:          { frame:['#2a0848','#180430','#0a0018'], border:'#8a40c8', hole:'#02000a', holeBorder:'#8a40c833', base:['#180430','#0a0018','#02000a'] },
  rainbow:       { frame:['#6a2a8a','#2a4a8a','#2a6a4a'], border:'#c840e8', hole:'#0a0810', holeBorder:'#c840e833', base:['#2a4a8a','#2a6a4a','#6a6a2a'] },
  forest:        { frame:['#2a4a2a','#1e381e','#142814'], border:'#4a8a4a', hole:'#0a160a', holeBorder:'#0e1e0e', base:['#1e381e','#142814','#0c1a0c'] },
  ocean:         { frame:['#1a5a6a','#0e4452','#063038'], border:'#3a9aaa', hole:'#04181e', holeBorder:'#062028', base:['#0e4452','#063038','#041e26'] },
  nebula:        { frame:['#2a1a5a','#1a1248','#120a30'], border:'#a060ff', hole:'#08041a', holeBorder:'#ff60c044', base:['#1a1248','#120a30','#0a0520'] },
  royal:         { frame:['#3a1a6a','#2a1250','#1a0a38'], border:'#e8c048', hole:'#0a0420', holeBorder:'#e8c04833', base:['#2a1250','#1a0a38','#100624'] },
  aurora:        { frame:['#0a3a3a','#0e2a4a','#1a1a4a'], border:'#40ffb0', hole:'#04101a', holeBorder:'#40ffb033', base:['#0e2a4a','#1a1a4a','#0a0a2a'] },
  inferno:       { frame:['#6a1a08','#4a1004','#2a0800'], border:'#ff6020', hole:'#180400', holeBorder:'#ff602044', base:['#4a1004','#2a0800','#180400'] },
  steel:         { frame:['#4a5460','#363e48','#242a32'], border:'#8a98a8', hole:'#0e1216', holeBorder:'#161c22', base:['#363e48','#242a32','#161a20'] },
  sakura:        { frame:['#e8a8c0','#d488a8','#b06888'], border:'#ffd0e0', hole:'#3a1828', holeBorder:'#5a2840', base:['#d488a8','#b06888','#8a4868'] },
  desert_dawn:   { frame:['#c8884a','#a86a30','#7a4a1c'], border:'#e0a860', hole:'#2a1808', holeBorder:'#3a2410', base:['#a86a30','#7a4a1c','#542f12'] },
  lake_effect:   { frame:['#5a7a92','#3e5a72','#2a4254'], border:'#8ab0c8', hole:'#0c1820', holeBorder:'#16242e', base:['#3e5a72','#2a4254','#1a2c38'] },
  crown_court:   { frame:['#c8a83c','#a8842a','#7a5e18'], border:'#e8c850', hole:'#1a1206', holeBorder:'#2a200c', base:['#a8842a','#7a5e18','#564010'] },
};

// Board rarity (for the shop card glow + scene tier). Free/starter → common.
export const BOARD_RARITY = {
  default: 'common', wood: 'common', midnight: 'common', forest: 'uncommon', steel: 'uncommon',
  neon: 'rare', ice: 'rare', ocean: 'rare', lake_effect: 'rare', desert_dawn: 'uncommon',
  galaxy: 'epic', sunset: 'epic', candy: 'epic', matrix: 'epic', crystal: 'epic', sakura: 'epic',
  gold: 'legendary', lava: 'legendary', royal: 'legendary', aurora: 'legendary', inferno: 'legendary', crown_court: 'legendary',
  darkmatter: 'mythic', void: 'mythic', rainbow: 'mythic', nebula: 'mythic',
};

// ── Scene backdrops (getThemeScene subset + derive) ─────────────────────────
const SCENES = {
  default: { sky:['#1e3a8a','#1a3a8a','#0d2060'], atm:'glow',    glow:'rgba(120,180,255,0.35)', accent:'#6aacda' },
  neon:    { sky:['#000810','#001a10','#002008'], atm:'stripes', glow:'rgba(0,255,136,0.45)',   accent:'#00ff88' },
  galaxy:  { sky:['#0a0318','#1a0540','#3a1a6b'], atm:'stars',   glow:'rgba(138,43,226,0.5)',   accent:'#9d4edd' },
  gold:    { sky:['#3d2a00','#786010','#c89830'], atm:'rays',    glow:'rgba(255,215,0,0.55)',   accent:'#ffd700' },
  ice:     { sky:['#0a2040','#1a4a78','#4a8ab8'], atm:'snow',    glow:'rgba(180,220,255,0.5)',  accent:'#a8d8ff' },
  lava:    { sky:['#1a0000','#4a0a00','#c83a10'], atm:'flames',  glow:'rgba(255,90,20,0.6)',    accent:'#ff6b35' },
  darkmatter:{ sky:['#0a0518','#1a0533','#2a0a55'], atm:'swirl', glow:'rgba(191,95,255,0.65)',  accent:'#bf5fff' },
  midnight:{ sky:['#05050f','#0e0e1a','#1a1a2e'], atm:'stars',   glow:'rgba(120,140,180,0.35)', accent:'#8892b0' },
  candy:   { sky:['#ffb3e6','#ff6ec7','#e94560'], atm:'dots',    glow:'rgba(255,200,240,0.55)', accent:'#ff8ad8' },
  matrix:  { sky:['#000800','#002010','#003a18'], atm:'stripes', glow:'rgba(0,255,80,0.5)',     accent:'#00ff41' },
  sunset:  { sky:['#ff6b9d','#ff8c42','#ffd166'], atm:'rays',    glow:'rgba(255,180,80,0.6)',   accent:'#ffd166' },
  crystal: { sky:['#081828','#1a4058','#3a7898'], atm:'snow',    glow:'rgba(200,240,255,0.55)', accent:'#c8f0ff' },
  void:    { sky:['#000000','#0c0020','#200540'], atm:'stars',   glow:'rgba(160,60,255,0.6)',   accent:'#a03cff' },
  rainbow: { sky:['#ff006e','#fb5607','#ffbe0b'], atm:'rays',    glow:'rgba(255,255,255,0.6)',  accent:'#ffffff' },
  nebula:  { sky:['#0a0520','#2a1a5a','#1a1248'], atm:'stars',   glow:'rgba(160,96,255,0.55)',  accent:'#a060ff' },
  royal:   { sky:['#1a0a38','#2a1250','#3a1a6a'], atm:'rays',    glow:'rgba(232,192,72,0.5)',   accent:'#e8c048' },
  forest:  { sky:['#0c1a0c','#1e381e','#2a4a2a'], atm:'glow',    glow:'rgba(120,200,110,0.4)',  accent:'#4a8a4a' },
  wood:    { sky:['#c89060','#8B5E3C','#4a2d18'], atm:'glow',    glow:'rgba(255,180,100,0.4)',  accent:'#d4a373' },
};

export function getThemeScene(id) {
  if (SCENES[id]) return SCENES[id];
  const v = BOARD_THEMES[id] || BOARD_THEMES.default;
  const accent = toHex6(v.border);
  const dark = luminance(v.base[2]) < 0.16;
  return {
    sky: [lighten(v.base[0], 0.04), v.base[1], darken(v.base[2], 0.2)],
    atm: dark ? 'stars' : 'glow',
    glow: withAlpha(accent, 0.5),
    accent,
  };
}

// ── Piece color palettes (subset of PIECE_SKIN_VISUALS) ─────────────────────
// { p1:{main,dark,light,glow,gradient?}, p2:{...} }. In-game the player's skin
// colors p1; the opponent is ALWAYS classic.p2.
export const PIECE_SKINS = {
  classic:      { p1:{main:'#e63946',dark:'#b82d38',light:'#ff6b7a',glow:'rgba(230,57,70,0.6)'},   p2:{main:'#f4a623',dark:'#c4841a',light:'#ffc247',glow:'rgba(244,166,35,0.6)'} },
  chrome:       { p1:{main:'#c0c0c0',dark:'#888888',light:'#e8e8e8',glow:'rgba(192,192,192,0.5)'}, p2:{main:'#f4a623',dark:'#c4841a',light:'#ffc247',glow:'rgba(244,166,35,0.6)'} },
  fire_ice:     { p1:{main:'#ff4500',dark:'#cc3700',light:'#ff7040',glow:'rgba(255,69,0,0.6)'},    p2:{main:'#00bfff',dark:'#0090c0',light:'#60d8ff',glow:'rgba(0,191,255,0.6)'} },
  neon:         { p1:{main:'#ff00ff',dark:'#cc00cc',light:'#ff66ff',glow:'rgba(255,0,255,0.7)'},   p2:{main:'#00ff88',dark:'#00cc66',light:'#66ffbb',glow:'rgba(0,255,136,0.7)'} },
  holo:         { p1:{main:'#ff69b4',dark:'#cc5490',light:'#ff99cc',glow:'rgba(255,105,180,0.6)'}, p2:{main:'#7b68ee',dark:'#5a4bc0',light:'#a99cff',glow:'rgba(123,104,238,0.6)'} },
  mint_coral:   { p1:{main:'#3eb489',dark:'#2e8865',light:'#6fd6ac',glow:'rgba(62,180,137,0.6)'},  p2:{main:'#ff7f7f',dark:'#cc6060',light:'#ffa8a8',glow:'rgba(255,127,127,0.6)'} },
  monochrome:   { p1:{main:'#e0e0e0',dark:'#a8a8a8',light:'#ffffff',glow:'rgba(224,224,224,0.5)'}, p2:{main:'#2a2a2a',dark:'#141414',light:'#4a4a4a',glow:'rgba(42,42,42,0.6)'} },
  sapphire_ruby:{ p1:{main:'#1a53ff',dark:'#1440c0',light:'#5a84ff',glow:'rgba(26,83,255,0.6)'},   p2:{main:'#dc143c',dark:'#a80f2d',light:'#ff506e',glow:'rgba(220,20,60,0.6)'} },
  electric:     { p1:{main:'#00c8ff',dark:'#0098c0',light:'#66e0ff',glow:'rgba(0,200,255,0.7)'},   p2:{main:'#ffe600',dark:'#c0ac00',light:'#fff066',glow:'rgba(255,230,0,0.7)'} },
  toxic:        { p1:{main:'#39ff14',dark:'#28c00d',light:'#7dff5c',glow:'rgba(57,255,20,0.7)'},   p2:{main:'#9b30ff',dark:'#7420c0',light:'#c070ff',glow:'rgba(155,48,255,0.7)'} },
  gold_diamond: { p1:{main:'#ffd700',dark:'#c0a200',light:'#ffe866',glow:'rgba(255,215,0,0.7)'},   p2:{main:'#b9f2ff',dark:'#8ac0d0',light:'#e0faff',glow:'rgba(185,242,255,0.6)'} },
  ember_frost:  { p1:{main:'#ff6a2a',dark:'#cc5020',light:'#ff9060',glow:'rgba(255,106,42,0.6)'},  p2:{main:'#6ad0ff',dark:'#4a9cc0',light:'#a0e4ff',glow:'rgba(106,208,255,0.6)'} },
  darkmatter:   { p1:{main:'#7a1ac0',dark:'#1a0533',light:'#ff60c0',glow:'rgba(191,95,255,0.9)',gradient:['#0a0518','#6b1a8a','#e94560','#1a5ae9','#0a0518']}, p2:{main:'#f4a623',dark:'#c4841a',light:'#ffc247',glow:'rgba(244,166,35,0.6)'} },
  nebula:       { p1:{main:'#a940dd',dark:'#65188b',light:'#cf9be9',glow:'rgba(246,40,246,0.75)',gradient:['#110740','#280cb6','#f943f9','#230b98','#0a0524']}, p2:{main:'#f4a623',dark:'#c4841a',light:'#ffc247',glow:'rgba(244,166,35,0.6)'} },
  aurora:       { p1:{main:'#0cb667',dark:'#074026',light:'#5fe29a',glow:'rgba(12,182,103,0.75)',gradient:['#074026','#0cb667','#bc43f9','#0b9856','#052415']}, p2:{main:'#f4a623',dark:'#c4841a',light:'#ffc247',glow:'rgba(244,166,35,0.6)'} },
};

export const PIECE_RARITY = {
  classic: 'common', monochrome: 'common', chrome: 'uncommon', mint_coral: 'uncommon',
  fire_ice: 'rare', electric: 'rare', ember_frost: 'rare', sapphire_ruby: 'rare',
  neon: 'epic', holo: 'epic', toxic: 'epic',
  gold_diamond: 'legendary',
  darkmatter: 'mythic', nebula: 'mythic', aurora: 'mythic',
};

// ── Animation clocks ────────────────────────────────────────────────────────
const pingpong = (t, period) => { const x = (t % (period * 2)) / period; return x <= 1 ? x : 2 - x; };
const ease = (x) => x * x * (3 - 2 * x); // smoothstep

// ── drawPiece — the premium orb (PieceVisual.tsx finish ramp) ───────────────
/**
 * @param ctx     CanvasRenderingContext2D
 * @param cx,cy   center
 * @param r       radius (piece size = 2r)
 * @param pc      PieceColor {main,dark,light,glow,gradient?}
 * @param finish  rarity tier name (common..mythic) | 'darkmatter'
 * @param t       animation time ms (0 for static)
 * @param animated draw motion (false = one frozen frame, for shop grids)
 */
export function drawPiece(ctx, cx, cy, r, pc, finish = 'epic', t = 0, animated = true) {
  const tier = FINISH_TIER[finish] ?? 3;
  const size = r * 2;
  const sheen = tier >= 1, glint = tier >= 2, glowPulse = tier >= 3, metallic = tier >= 4, living = tier >= 5;
  const halo = HALO_BY_TIER[Math.min(tier, 5)];

  const angle = animated ? (t % 2800) / 2800 : 0.12;
  const a = angle * Math.PI * 2;
  const pulse = animated ? ease(pingpong(t, 1700)) : 0.5;
  const spin = animated ? (t % 9000) / 9000 * Math.PI * 2 : 0;

  ctx.save();

  // 1. Outer halo (behind the disc)
  if (halo > 0) {
    const hp = glowPulse ? 0.7 + pulse * 0.3 : 1;
    const hr = r + Math.max(6, size * (0.14 + tier * 0.03));
    const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, hr);
    g.addColorStop(0, withAlpha(pc.glow, halo * hp));
    g.addColorStop(0.6, withAlpha(pc.glow, halo * hp * 0.5));
    g.addColorStop(1, withAlpha(pc.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2); ctx.fill();
  }

  // clip to the disc for all surface layers
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();

  // 2. Base fill (rotates for living/mythic)
  ctx.save();
  if (living) { ctx.translate(cx, cy); ctx.rotate(spin); ctx.translate(-cx, -cy); }
  const bb = r * 1.05;
  let grad;
  if (pc.gradient) {
    grad = ctx.createLinearGradient(cx - bb, cy - bb, cx + bb, cy + bb);
    pc.gradient.forEach((c, i) => grad.addColorStop(i / (pc.gradient.length - 1), c));
  } else if (metallic) {
    grad = ctx.createLinearGradient(cx - bb * 0.9, cy - bb * 0.8, cx + bb * 0.9, cy + bb * 0.8);
    [pc.light, pc.main, pc.dark, pc.main, pc.light].forEach((c, i) => grad.addColorStop(i / 4, c));
  } else if (tier === 0) {
    grad = ctx.createLinearGradient(cx - bb * 0.44, cy - bb * 0.9, cx + bb * 0.44, cy + bb);
    grad.addColorStop(0, pc.main); grad.addColorStop(1, pc.dark);
  } else if (tier >= 3) {
    grad = ctx.createLinearGradient(cx - bb * 0.44, cy - bb * 0.9, cx + bb * 0.44, cy + bb);
    [pc.light, pc.glow && toHex6(pc.glow) !== '#000000' ? pc.main : pc.light, pc.main, pc.dark].forEach((c, i, arr) => grad.addColorStop(i / (arr.length - 1), c));
  } else {
    grad = ctx.createLinearGradient(cx - bb * 0.44, cy - bb * 0.9, cx + bb * 0.44, cy + bb);
    [pc.light, pc.main, pc.dark].forEach((c, i) => grad.addColorStop(i / 2, c));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);
  ctx.restore();

  // 3. Lower-right depth shadow (gives the sphere its shaded side)
  const ds = ctx.createLinearGradient(cx - r * 0.4, cy - r * 0.4, cx + r, cy + r);
  ds.addColorStop(0, 'rgba(0,0,0,0)'); ds.addColorStop(0.55, 'rgba(0,0,0,0)'); ds.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = ds; ctx.fillRect(cx - r, cy - r, size, size);

  // 4. Inner glow (epic+, breathes)
  if (glowPulse) {
    const gx = cx - r * 0.26, gy = cy - r * 0.26;
    const gr = r * (0.52 + pulse * 0.08);
    const ig = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    ig.addColorStop(0, withAlpha(pc.glow, 0.16 + pulse * 0.28));
    ig.addColorStop(1, withAlpha(pc.glow, 0));
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
  }

  // 5. Tight top-left sheen (uncommon+) — the ONLY white highlight, kept small
  if (sheen) {
    const sx = cx - r * 0.42, sy = cy - r * 0.5;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.62);
    sg.addColorStop(0, 'rgba(255,255,255,0.22)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, r * 0.62, 0, Math.PI * 2); ctx.fill();
  }

  // 6. Orbiting specular glint (rare+)
  if (glint) {
    const glintOpacity = [0, 0, 0.18, 0.24, 0.32, 0.36][Math.min(tier, 5)];
    const orbitR = r * 0.4;
    const px = cx + Math.cos(a) * orbitR, py = cy + Math.sin(a) * orbitR * 0.82;
    const gsz = r * (0.28 + tier * 0.025);
    const gg = ctx.createRadialGradient(px, py, 0, px, py, gsz);
    gg.addColorStop(0, `rgba(255,255,255,${glintOpacity + 0.15})`);
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, gsz, 0, Math.PI * 2); ctx.fill();
  }

  // 7. Rim catch (legendary+) — turning-foil vertical arc
  if (metallic) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a); ctx.translate(-cx, -cy);
    const rc = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    const op = 0.35 + Math.abs(Math.sin(a)) * 0.4;
    rc.addColorStop(0, 'rgba(0,0,0,0)'); rc.addColorStop(0.5, withAlpha(pc.light, op)); rc.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rc; ctx.fillRect(cx - r, cy - r, size, size);
    ctx.restore();
  }

  // 9b. Orbiting sparkle flecks (mythic/living)
  if (living) {
    const SP = [{ x: 0.32, y: 0.28, s: 0.10, d: 0 }, { x: 0.68, y: 0.38, s: 0.07, d: 650 }, { x: 0.44, y: 0.70, s: 0.085, d: 1250 }, { x: 0.72, y: 0.66, s: 0.06, d: 400 }];
    for (const sp of SP) {
      const k = animated ? pingpong(t + sp.d, 1300) : 0.6;
      const fx = cx - r + sp.x * size, fy = cy - r + sp.y * size, fd = size * sp.s * (0.5 + k * 0.8);
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fd);
      fg.addColorStop(0, `rgba(255,255,255,${0.1 + k * 0.85})`);
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy, fd, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore(); // unclip

  // 7b. Inner rim light (all but flat)
  if (tier >= 1) {
    const ringW = Math.max(1, size * 0.02);
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + tier * 0.03})`;
    ctx.lineWidth = ringW;
    ctx.beginPath(); ctx.arc(cx, cy, r - Math.max(1.5, size * 0.05), 0, Math.PI * 2); ctx.stroke();
  }

  // 8. Signature dark outline ring (ALWAYS)
  ctx.strokeStyle = 'rgba(9,12,24,0.88)';
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.beginPath(); ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();

  ctx.restore();
}

// Rounded-rect path helper.
function roundRect(ctx, x, y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Board geometry + frame (GameBoard.tsx) ──────────────────────────────────
export const CELL_GAP = 6;
export const BOARD_PADDING = 12;

/** Compute cell/piece sizing + hole centers for a cols×rows board fit to maxW. */
export function boardLayout(cols, rows, maxW) {
  const cell = Math.floor((maxW - BOARD_PADDING * 2 - CELL_GAP * (cols - 1)) / cols);
  const w = cell * cols + CELL_GAP * (cols - 1) + BOARD_PADDING * 2;
  const h = cell * rows + CELL_GAP * (rows - 1) + BOARD_PADDING * 2;
  const piece = cell - 6;
  const cellCenter = (col, row) => ({
    x: BOARD_PADDING + col * (cell + CELL_GAP) + cell / 2,
    y: BOARD_PADDING + row * (cell + CELL_GAP) + cell / 2,
  });
  return { cell, piece, w, h, cellCenter };
}

/** Draw the solid slab board frame + empty holes for theme `id`. */
export function drawBoardFrame(ctx, layout, cols, rows, themeId) {
  const th = BOARD_THEMES[themeId] || BOARD_THEMES.default;
  const { w, h, cell, cellCenter } = layout;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.fillStyle = th.frame[1];
  roundRect(ctx, 0, 0, w, h, 28); ctx.fill();
  ctx.restore();

  ctx.lineWidth = 2; ctx.strokeStyle = th.border;
  roundRect(ctx, 1, 1, w - 2, h - 2, 27); ctx.stroke();

  const hr = (cell - 4) / 2;
  for (let c = 0; c < cols; c++) {
    for (let rr = 0; rr < rows; rr++) {
      const { x, y } = cellCenter(c, rr);
      ctx.save();
      ctx.shadowColor = withAlpha(th.border, 0.4); ctx.shadowBlur = 3;
      ctx.fillStyle = th.hole;
      ctx.beginPath(); ctx.arc(x, y, hr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.lineWidth = 1.5; ctx.strokeStyle = th.holeBorder;
      ctx.beginPath(); ctx.arc(x, y, hr, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

// ── Staged scene backdrop (skyGradient + spotlights + atmosphere + fade) ─────
/** Deterministic pseudo-position (no RNG → no flicker). */
const pp = (i, prime) => ((i * prime) % 100) / 100;

export function drawScene(ctx, w, h, scene, tier = 3, t = 0) {
  // 1. Vertical sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, scene.sky[0]); sky.addColorStop(0.5, scene.sky[1]); sky.addColorStop(1, scene.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  // 2. Two soft top spotlights
  const strength = 0.14 + Math.min(tier, 5) * 0.03;
  for (const fx of [0.32, 0.68]) {
    const x = w * fx, y = -h * 0.05, rad = Math.max(40, w * 0.28);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, withAlpha(scene.accent, strength)); g.addColorStop(1, withAlpha(scene.accent, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.6);
  }

  // 3. Atmosphere motif
  drawAtmosphere(ctx, w, h, scene, t);

  // 4. Ground fade
  const gf = ctx.createLinearGradient(0, h * 0.58, 0, h);
  gf.addColorStop(0, 'rgba(0,0,0,0)'); gf.addColorStop(0.5, 'rgba(0,0,0,0.32)'); gf.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = gf; ctx.fillRect(0, h * 0.58, w, h * 0.42);
}

function drawAtmosphere(ctx, w, h, scene, t) {
  const accent = scene.accent;
  switch (scene.atm) {
    case 'stars': {
      for (let i = 0; i < 40; i++) {
        const x = pp(i, 37) * w, y = pp(i, 53) * h * 0.72;
        const hero = i % 7 === 0;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t / 900 + i));
        ctx.fillStyle = hero ? `rgba(255,255,255,${0.95 * tw})` : `rgba(255,255,255,${(0.4 + pp(i, 17) * 0.6) * tw})`;
        ctx.beginPath(); ctx.arc(x, y, hero ? 2.8 : 1 + pp(i, 11) * 2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'rays': {
      const cx = w / 2, cy = -h * 0.05;
      for (const ang of [-30, -10, 10, 30]) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang * Math.PI / 180);
        ctx.fillStyle = withAlpha(accent, 0.22); ctx.fillRect(-3, 0, 6, h * 0.9); ctx.restore();
      }
      const sd = ctx.createRadialGradient(cx, cy + h * 0.02, 0, cx, cy + h * 0.02, 40);
      sd.addColorStop(0, withAlpha(accent, 0.9)); sd.addColorStop(1, withAlpha(accent, 0));
      ctx.fillStyle = sd; ctx.beginPath(); ctx.arc(cx, cy + h * 0.02, 40, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'snow': {
      for (let i = 0; i < 18; i++) {
        const x = (pp(i, 41) * w + t / 40) % w, y = (pp(i, 23) * h + t / 30) % h;
        ctx.fillStyle = 'rgba(232,246,255,0.75)';
        ctx.beginPath(); ctx.arc(x, y, 1.5 + pp(i, 7), 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'flames': {
      for (let i = 0; i < 5; i++) {
        const x = w * (0.1 + i * 0.2), fh = h * (0.22 + Math.abs(Math.sin(t / 400 + i)) * 0.33);
        const g = ctx.createLinearGradient(0, h, 0, h - fh);
        g.addColorStop(0, withAlpha(accent, 0.6)); g.addColorStop(1, withAlpha(accent, 0));
        ctx.fillStyle = g; ctx.fillRect(x - 8, h - fh, 16, fh);
      }
      break;
    }
    case 'stripes': {
      for (const fy of [0.15, 0.35, 0.55]) {
        ctx.strokeStyle = withAlpha(accent, 0.45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, h * fy); ctx.lineTo(w, h * fy); ctx.stroke();
      }
      break;
    }
    case 'swirl': {
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = withAlpha(accent, 0.25 + i * 0.08); ctx.lineWidth = 1.5;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t / 3000); ctx.scale(1, 0.6);
        ctx.beginPath(); ctx.arc(0, 0, (0.2 + i * 0.13) * w * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      break;
    }
    case 'dots': {
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(pp(i, 31) * w, pp(i, 19) * h, 2 + pp(i, 5) * 2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    default: { // glow
      const g = ctx.createRadialGradient(w / 2, h * 0.28, 0, w / 2, h * 0.28, w * 0.6);
      g.addColorStop(0, withAlpha(scene.glow || accent, 0.13)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
}

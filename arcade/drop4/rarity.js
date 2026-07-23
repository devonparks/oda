/**
 * Drop4 Hub — canonical rarity system + color helpers.
 *
 * Ported from Drop4/src/data/rarity.ts (+ utils/color.ts). This is THE single
 * source of rarity tiers/colors/labels; visuals.js, shop.js and career-data
 * all read from here. Six tiers ascending: common < uncommon < rare < epic <
 * legendary < mythic. Framework-free; safe in Node or the browser.
 */

// ── Color helpers (utils/color.ts) ─────────────────────────────────────────

/** Parse #rgb / #rrggbb / #rrggbbaa / rgb() / rgba() → {r,g,b,a}. */
export function parseColor(input) {
  if (typeof input !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
  let s = input.trim();
  if (s[0] === '#') {
    s = s.slice(1);
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    if (s.length === 6 || s.length === 8) {
      const r = parseInt(s.slice(0, 2), 16);
      const g = parseInt(s.slice(2, 4), 16);
      const b = parseInt(s.slice(4, 6), 16);
      const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p[3] == null ? 1 : p[3] };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toHex2 = (n) => clamp255(n).toString(16).padStart(2, '0');

/** Linear lerp between two colors; t=0→a, t=1→b. Returns #rrggbb. */
export function mixColor(a, b, t) {
  const ca = parseColor(a), cb = parseColor(b);
  return '#' + toHex2(ca.r + (cb.r - ca.r) * t) + toHex2(ca.g + (cb.g - ca.g) * t) + toHex2(ca.b + (cb.b - ca.b) * t);
}

export const darken = (color, t) => mixColor(color, '#000000', t);
export const lighten = (color, t) => mixColor(color, '#ffffff', t);

/** color + alpha → 'rgba(r,g,b,a)'. */
export function withAlpha(color, a) {
  const c = parseColor(color);
  return `rgba(${clamp255(c.r)},${clamp255(c.g)},${clamp255(c.b)},${a})`;
}

/** Perceived luminance 0..1. */
export function luminance(color) {
  const c = parseColor(color);
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

/** Drop the alpha → '#rrggbb'. */
export function toHex6(color) {
  const c = parseColor(color);
  return '#' + toHex2(c.r) + toHex2(c.g) + toHex2(c.b);
}

export const hexToRgba = (hex, alpha) => withAlpha(hex, alpha);

// ── Canonical rarity (rarity.ts) ────────────────────────────────────────────

export const RARITY_TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

export const RARITY_COLORS = {
  common: '#8892b0',    // slate
  uncommon: '#2ecc71',  // green
  rare: '#3498db',      // blue
  epic: '#9b59b6',      // purple
  legendary: '#f1c40f', // gold
  mythic: '#ff5d6c',    // red
};

export const RARITY_LABELS = {
  common: 'COMMON', uncommon: 'UNCOMMON', rare: 'RARE',
  epic: 'EPIC', legendary: 'LEGENDARY', mythic: 'MYTHIC',
};

export const RARITY_TREATMENT = {
  common:    { border: 1.5, glow: 0,  glowAlpha: 0,    wash: 0.05, animated: false },
  uncommon:  { border: 2,   glow: 14, glowAlpha: 0.28, wash: 0.09, animated: false },
  rare:      { border: 2.5, glow: 20, glowAlpha: 0.40, wash: 0.11, animated: false },
  epic:      { border: 3,   glow: 24, glowAlpha: 0.50, wash: 0.13, animated: true  },
  legendary: { border: 3,   glow: 30, glowAlpha: 0.55, wash: 0.15, animated: true  },
  mythic:    { border: 3.5, glow: 34, glowAlpha: 0.60, wash: 0.17, animated: true  },
};

/** Fold legacy tags / junk into a canonical tier. */
export function normalizeRarity(r) {
  if (r === 'starter') return 'common';
  if (r === 'darkmatter') return 'mythic';
  if (RARITY_ORDER[r] != null) return r;
  return 'common';
}

/** darkmatter tag gets an "Exclusive" ribbon on top of mythic styling. */
export const isExclusiveTag = (r) => r === 'darkmatter';

export const FINISH_TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, darkmatter: 5 };

/** Outer-halo strength per tier (drawPiece). common barely glows → mythic blazes. */
export const HALO_BY_TIER = [0.12, 0.32, 0.5, 0.72, 0.95, 1.15];

/** Board card-glow ladder [blurPx, alpha] by tier 0..5. */
export const BOARD_GLOW = [[0, 0], [5, 0.34], [9, 0.5], [13, 0.66], [18, 0.85], [26, 1]];

export function rarityGlow(r) {
  const t = normalizeRarity(r);
  return withAlpha(RARITY_COLORS[t], RARITY_TREATMENT[t].glowAlpha);
}

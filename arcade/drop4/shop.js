/**
 * Drop4 Hub — economy + cosmetics shop (identity #2: learn-to-earn coin).
 *
 * ONE shared AMG Hub coin (students/{id}.coins via oda-core). NO gems, NO ads,
 * NO IAP — by construction (Drop4's gem/ad/IAP stores are simply not ported).
 * Cosmetics (boards + piece skins) are coin-priced via odaShop; characters are
 * the third cosmetic axis (handled in characters.js, shared cross-game).
 *
 * Learn-to-earn: coins are earned by playing AND by completing assignments in
 * the hub. Every "not enough coins" moment nudges the kid to go learn & earn —
 * there is nothing to buy with real money and no ad to watch.
 */

import { BOARD_THEMES, BOARD_RARITY, PIECE_SKINS, PIECE_RARITY } from './visuals.js';
import { RARITY_COLORS, RARITY_LABELS } from './rarity.js';

// ── Coin economy (replaces Drop4 COIN_REWARDS; tuned for the hub) ───────────
export const ECONOMY = {
  win:  { easy: 15, medium: 30, hard: 60, legendary: 100 },
  draw: 8,
  loss: 4,                 // small consolation so a kid never leaves with nothing
  streakBonusPer: 5,       // + per current win-streak…
  streakBonusMax: 40,      // …capped
};

/** Coins for a finished match. rewardMultiplier is the jeopardy triple, etc. */
export function computeCoins(result, { difficulty = 'medium', streak = 0, rewardMultiplier = 1 } = {}) {
  if (result === 'draw') return ECONOMY.draw;
  if (result === 'loss') return ECONOMY.loss;
  const base = ECONOMY.win[difficulty] || ECONOMY.win.medium;
  const streakBonus = Math.min(streak * ECONOMY.streakBonusPer, ECONOMY.streakBonusMax);
  return Math.round((base + streakBonus) * (rewardMultiplier >= 2 ? rewardMultiplier : 1));
}

// ── Cosmetic pricing by rarity ──────────────────────────────────────────────
const PRICE_BY_RARITY = { common: 0, uncommon: 150, rare: 350, epic: 700, legendary: 1200, mythic: 2000 };

const prettify = (id) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const BOARD_EMOJI = {
  default: '🔵', wood: '🪵', neon: '💚', galaxy: '🌌', gold: '🏆', ice: '🧊', lava: '🌋',
  darkmatter: '🟣', midnight: '🌙', candy: '🍬', matrix: '🟢', sunset: '🌅', crystal: '💎',
  void: '🕳️', rainbow: '🌈', forest: '🌲', ocean: '🌊', nebula: '✨', royal: '👑', aurora: '🌠',
  inferno: '🔥', steel: '⚙️', sakura: '🌸', desert_dawn: '🏜️', lake_effect: '🏞️', crown_court: '👑',
};
const PIECE_EMOJI = {
  classic: '🔴', chrome: '⚪', fire_ice: '🔥', neon: '💗', holo: '🌈', mint_coral: '🌿',
  monochrome: '⚫', sapphire_ruby: '💙', electric: '⚡', toxic: '☢️', gold_diamond: '💛',
  ember_frost: '❄️', darkmatter: '🟣', nebula: '✨', aurora: '🌠',
};

/** Build an odaShop catalog for a palette map keyed by rarity. */
function buildCatalog(themes, rarityMap, slot, emojiMap, valueKey) {
  return Object.keys(themes).map((id) => {
    const rarity = rarityMap[id] || 'common';
    return {
      id: 'd4_' + valueKey + '_' + id,
      name: prettify(id),
      emoji: emojiMap[id] || '🎨',
      cost: PRICE_BY_RARITY[rarity],
      slot,
      rarity,
      value: { [valueKey]: id, rarity },
    };
  }).sort((a, b) => a.cost - b.cost);
}

export const BOARD_SHOP = buildCatalog(BOARD_THEMES, BOARD_RARITY, 'Board Theme', BOARD_EMOJI, 'theme');
export const PIECE_SHOP = buildCatalog(PIECE_SKINS, PIECE_RARITY, 'Piece Style', PIECE_EMOJI, 'skin');
export const SHOP_CATALOG = BOARD_SHOP.concat(PIECE_SHOP);

// ── Equipped-cosmetic reads (odaShop with localStorage fallback) ────────────
export function getEquippedTheme(gameId) {
  try {
    const it = window.odaShop && window.odaShop.getEquipped(gameId, 'Board Theme');
    if (it && it.value && it.value.theme) return it.value.theme;
  } catch (e) {}
  return 'default';
}
export function getEquippedPieceSkin(gameId) {
  try {
    const it = window.odaShop && window.odaShop.getEquipped(gameId, 'Piece Style');
    if (it && it.value && it.value.skin) return it.value.skin;
  } catch (e) {}
  return 'classic';
}

/** Render the board+piece shop into a container via odaShop. */
export function mountShop(gameId, containerId, opts = {}) {
  if (!window.odaShop) return;
  window.odaShop.renderShopPanel(gameId, SHOP_CATALOG, containerId, {
    onEquip: opts.onEquip || (() => {}),
    onBuy: opts.onBuy || (() => {}),
  });
}

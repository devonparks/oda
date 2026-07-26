/**
 * AMG World — hotbar + inventory.
 *
 * A park where you find a fishing rod at the pond and a hoop on the lawn should
 * let you CARRY them. Before this, every activity was welded to the one spot
 * that triggered it: the rod only existed inside the fishing zone, the hula
 * only at the hoop rack. The hotbar turns those into things you own.
 *
 * Shape is deliberately Minecraft's, because every kid already knows it: a row
 * of numbered slots along the bottom, 1-8 or the scroll wheel to pick one, a
 * backpack grid behind it. Stacks merge; the first free slot takes the rest.
 *
 * This module is PURE — no THREE, no DOM. It holds slots and fires onChange, so
 * it can be reasoned about (and tested) without a park attached. The UI lives in
 * main.js and the item behaviours in useItem().
 */

/**
 * The catalogue. `use` names a behaviour main.js implements; items without one
 * are keepsakes — the fish you caught, sitting in the backpack being yours.
 *
 * Kid-appropriate by construction: tools and toys, nothing to buy, nothing to
 * trade, nothing that can be lost to another player.
 */
export const ITEMS = {
  rod: {
    name: 'Fishing Rod', icon: '🎣', stack: 1, use: 'fish',
    hint: 'Stand by the water and click to cast',
  },
  // (the Hula Hoop item lived here — removed with the hoops themselves, see
  // docs/REMOVED_FOR_LATER.md. _load() drops unknown ids, so a hoop saved in
  // a kid's localStorage from the old build disappears cleanly.)
  ball: {
    name: 'Playground Ball', icon: '⚽', stack: 1, use: 'ball',
    hint: 'Click to throw it — then go kick it',
  },
};

/** Fish and junk from the pond become stackable keepsakes. */
export function registerCatches(table) {
  for (const c of table) {
    if (ITEMS[c.id]) continue;
    ITEMS[c.id] = { name: c.name, icon: c.icon, stack: 99, keepsake: true };
  }
}

export const HOTBAR = 8;
export const BACKPACK = 16;
const KEY = 'amgwInv';

export class Inventory {
  /** @param {(inv:Inventory)=>void} [onChange] */
  constructor(onChange) {
    this.size = HOTBAR + BACKPACK;
    /** @type {({id:string,n:number}|null)[]} slot 0..7 = hotbar, 8+ = backpack */
    this.slots = new Array(this.size).fill(null);
    this.selected = 0;
    this.onChange = onChange || null;
    this._load();
  }

  // ── queries ──────────────────────────────────────────────────────────────
  item(i) { return this.slots[i]; }
  def(i) { const s = this.slots[i]; return s ? ITEMS[s.id] : null; }
  held() { return this.slots[this.selected]; }
  heldDef() { return this.def(this.selected); }
  count(id) { return this.slots.reduce((t, s) => t + (s && s.id === id ? s.n : 0), 0); }
  has(id) { return this.count(id) > 0; }
  get filled() { return this.slots.filter(Boolean).length; }

  // ── mutations ────────────────────────────────────────────────────────────
  /**
   * Top up existing stacks first, then take free slots — hotbar before
   * backpack, so a thing you just picked up is immediately in your hand's
   * reach rather than buried.
   * @returns {number} how many did NOT fit
   */
  add(id, n = 1) {
    const def = ITEMS[id];
    if (!def) return n;
    let left = n;
    for (let i = 0; i < this.size && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.n < def.stack) {
        const take = Math.min(left, def.stack - s.n);
        s.n += take; left -= take;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (this.slots[i]) continue;
      const take = Math.min(left, def.stack);
      this.slots[i] = { id, n: take }; left -= take;
    }
    if (left < n) this._changed();
    return left;
  }

  removeAt(i, n = 1) {
    const s = this.slots[i];
    if (!s) return 0;
    const took = Math.min(n, s.n);
    s.n -= took;
    if (s.n <= 0) this.slots[i] = null;
    this._changed();
    return took;
  }

  remove(id, n = 1) {
    let left = n;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      if (this.slots[i] && this.slots[i].id === id) left -= this.removeAt(i, left);
    }
    return n - left;
  }

  /** Swap two slots, or merge if they're the same stackable item. */
  swap(a, b) {
    if (a === b || a < 0 || b < 0 || a >= this.size || b >= this.size) return;
    const A = this.slots[a], B = this.slots[b];
    if (A && B && A.id === B.id) {
      const def = ITEMS[A.id];
      const move = Math.min(A.n, def.stack - B.n);
      if (move > 0) {
        B.n += move; A.n -= move;
        if (A.n <= 0) this.slots[a] = null;
        this._changed();
        return;
      }
    }
    this.slots[a] = B; this.slots[b] = A;
    this._changed();
  }

  select(i) {
    const n = ((i % HOTBAR) + HOTBAR) % HOTBAR;
    if (n === this.selected) return;
    this.selected = n;
    this._changed();
  }
  scroll(dir) { this.select(this.selected + (dir > 0 ? 1 : -1)); }

  /** Put `id` in the player's hand if they own it. Used by pickups. */
  equip(id) {
    const i = this.slots.findIndex((s) => s && s.id === id);
    if (i < 0) return false;
    if (i >= HOTBAR) {
      // pull it down into the selected hotbar slot so it's actually usable
      this.swap(i, this.selected);
    } else this.select(i);
    return true;
  }

  // ── persistence ──────────────────────────────────────────────────────────
  _changed() { this._save(); if (this.onChange) this.onChange(this); }

  _save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 1, sel: this.selected,
        s: this.slots.map((s) => (s ? [s.id, s.n] : 0)),
      }));
    } catch (e) { /* private mode: the park still works, it just forgets */ }
  }

  _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || raw.v !== 1 || !Array.isArray(raw.s)) return;
      raw.s.forEach((e, i) => {
        if (!e || i >= this.size) return;
        const [id, n] = e;
        // Drop anything the catalogue no longer knows, so a renamed item can
        // never wedge a save file.
        if (ITEMS[id] && n > 0) this.slots[i] = { id, n: Math.min(n, ITEMS[id].stack) };
      });
      this.selected = Math.min(HOTBAR - 1, Math.max(0, raw.sel | 0));
    } catch (e) { /* corrupt save: start clean rather than refuse to load */ }
  }
}

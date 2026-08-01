/**
 * AMG World Engine — the prop library.
 *
 * Devon: *"eventually I want every item from the Synty POLYGON packs in one
 * library the engine can browse, with thumbnails."* This is that library for
 * everything the park ships today: every prototype in prop_db.json, with the
 * thumbnails rendered by tools/engine/gen_thumbs.mjs, searchable, showing
 * each prop's kind, placement count, and — for mounts — its clip and whether
 * that clip is bespoke or a placeholder (the honesty field, surfaced).
 *
 * P toggles it. Click a card to fly the camera to that prop's first
 * placement in the park. Read-only by design: browsing is safe for
 * students; editing stays on the object layer (O).
 */

export class Library {
  constructor(scene, park, player, db) {
    this.scene = scene;
    this.park = park;
    this.player = player;
    this.db = db;
    this.open = false;
    this.el = null;
    this._built = false;
  }

  toggle() {
    if (!this.el) this._build();
    this.open = !this.open;
    this.el.classList.toggle('hidden', !this.open);
    if (this.open) {
      document.exitPointerLock?.();
      this.el.querySelector('input').focus();
    }
    return this.open;
  }

  /** Fly the free camera to look at a placement of this prototype. */
  goTo(proto) {
    const it = this.park.items.find((i) => i.proto === proto && !i.hidden);
    if (!it) return false;
    const e = window.__engine;
    const d = Math.max(2.5, Math.max(...(this.db[proto]?.dims || [2])) * 1.6);
    e.look([it.pos[0] + d, it.pos[1] + d * 0.8, it.pos[2] + d], [it.pos[0], it.pos[1] + 0.5, it.pos[2]]);
    return true;
  }

  _build() {
    const counts = new Map();
    for (const it of this.park.items) counts.set(it.proto, (counts.get(it.proto) || 0) + 1);

    // Only prototypes that actually stand in the park. The shop inventory
    // (map_edits.json drops it at load) must not browse as if it were here —
    // a card that flies the camera to nothing is a broken promise.
    const rows = Object.entries(this.db)
      .filter(([k, v]) => k !== '_meta' && v && v.dims && counts.get(k))
      .sort(([a], [b]) => a.localeCompare(b));

    const card = ([proto, e]) => {
      const thumb = 'assets/thumbs/' + proto.replace(/#/g, '~') + '.png';
      const mount = e.seat
        ? `<span class="lib-clip ${e.clipStatus}">${e.clip}${e.clipStatus === 'placeholder' ? ' *' : ''}</span>`
        : '';
      return `<figure class="lib-card" data-proto="${proto}" data-hay="${(proto + ' ' + e.kind).toLowerCase()}">
        <img loading="lazy" src="${thumb}" alt="">
        <figcaption><b>${proto.replace(/^SM_(Env|Prop|Veh|Wep|Generic)_/, '')}</b>
        <span class="lib-kind">${e.kind}</span> ×${counts.get(proto) || 0} ${mount}</figcaption>
      </figure>`;
    };

    const mounts = rows.filter(([, e]) => e.seat).length;
    const wrap = document.createElement('div');
    wrap.id = 'library';
    wrap.className = 'library hidden';
    wrap.innerHTML = `
      <div class="lib-head">
        <b>PROP LIBRARY</b>
        <span class="lib-sub">${rows.length} prototypes · ${mounts} rideable · * = placeholder clip</span>
        <input type="search" placeholder="search props… (bench, swing, kart)" spellcheck="false">
        <button class="lib-close" title="close">✕</button>
      </div>
      <div class="lib-grid">${rows.map(card).join('')}</div>`;
    document.body.appendChild(wrap);
    this.el = wrap;

    const grid = wrap.querySelector('.lib-grid');
    wrap.querySelector('input').addEventListener('input', (ev) => {
      const q = ev.target.value.trim().toLowerCase();
      for (const c of grid.children) {
        c.style.display = !q || c.dataset.hay.includes(q) ? '' : 'none';
      }
    });
    wrap.querySelector('.lib-close').addEventListener('click', () => this.toggle());
    grid.addEventListener('click', (ev) => {
      const c = ev.target.closest('.lib-card');
      if (c && this.goTo(c.dataset.proto)) this.toggle();
    });
    // keys typed into the search box must not drive the kid around
    wrap.addEventListener('keydown', (ev) => { if (ev.code !== 'KeyP' && ev.code !== 'Escape') ev.stopPropagation(); });
  }
}

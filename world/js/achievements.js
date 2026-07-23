/**
 * AMG World — achievements & progress.
 *
 * A park you can wander is nice; a park that notices what you do is a reason to
 * come back. This layers the shared hub achievement system (`odaAchievements`
 * in oda-core) over world events — coins, zones, emotes, distance — so a kid
 * gets the same badge-unlock reward here as in any arcade game, against the same
 * `students/{id}.achievements` record.
 *
 * Progress counters persist in localStorage (world-scoped) so lifetime goals
 * accumulate across visits. Everything degrades gracefully if oda-core isn't
 * present — the world just doesn't award badges.
 */

export const WORLD_ACHIEVEMENTS = [
  { id: 'firstSteps', name: 'First Steps',  icon: '\u{1F6DD}', desc: 'Step into Recess Park' },
  { id: 'coinRush',   name: 'Coin Rush',    icon: '\u{1FA99}', desc: 'Grab 25 coins in one visit' },
  { id: 'coinHoard',  name: 'Coin Hoard',   icon: '\u{1F4B0}', desc: 'Collect 250 park coins all-time' },
  { id: 'explorer',   name: 'Explorer',     icon: '\u{1F5FA}️', desc: 'Visit all six zones' },
  { id: 'socialite',  name: 'Socialite',    icon: '\u{1F44B}', desc: 'Play 10 emotes' },
  { id: 'showoff',    name: 'Show-off',     icon: '\u{1F31F}', desc: 'Try every emote at least once' },
  { id: 'wanderer',   name: 'Wanderer',     icon: '\u{1F45F}', desc: 'Walk 500 metres in the park' },
  { id: 'thrillride', name: 'Thrill Ride',  icon: '\u{1F3A0}', desc: 'Take a coin ride' },
  { id: 'starHunter', name: 'Star Hunter',  icon: '⭐', desc: 'Find all 5 hidden stars' },
];

const LS = {
  coinsTotal: 'amgw_coins_total',
  zones: 'amgw_zones_seen',
  emotes: 'amgw_emotes_used',
  emoteSet: 'amgw_emote_set',
  distance: 'amgw_distance',
};

export class WorldProgress {
  /** @param {number} totalEmoteTypes how many distinct emotes exist (for Show-off) */
  constructor(totalEmoteTypes) {
    this.totalEmoteTypes = totalEmoteTypes || 8;
    this.ach = window.odaAchievements || null;
    this.coinsSession = 0;
    this.coinsTotal = this._num(LS.coinsTotal);
    this.distance = this._num(LS.distance);
    this.zones = new Set(this._arr(LS.zones));
    this.emotesUsed = this._num(LS.emotes);
    this.emoteSet = new Set(this._arr(LS.emoteSet));
    this._distAccum = 0;
  }

  _num(k) { return parseInt(localStorage.getItem(k) || '0', 10) || 0; }
  _arr(k) { try { const a = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

  init() {
    if (this.ach) this.ach.init('amgworld', WORLD_ACHIEVEMENTS);
    // firstSteps fires the moment you're in the park
    this.ach?.unlock('firstSteps');
    // re-check lifetime goals that may already be met from prior visits
    this.ach?.check('coinHoard', this.coinsTotal >= 250);
    this.ach?.check('explorer', this.zones.size >= 6);
    this.ach?.check('socialite', this.emotesUsed >= 10);
    this.ach?.check('showoff', this.emoteSet.size >= this.totalEmoteTypes);
    this.ach?.check('wanderer', this.distance >= 500);
  }

  addCoins(n) {
    if (n <= 0) return;
    this.coinsSession += n;
    this.coinsTotal += n;
    localStorage.setItem(LS.coinsTotal, String(this.coinsTotal));
    this.ach?.check('coinRush', this.coinsSession >= 25);
    this.ach?.check('coinHoard', this.coinsTotal >= 250);
  }

  visitZone(id) {
    if (this.zones.has(id)) return;
    this.zones.add(id);
    localStorage.setItem(LS.zones, JSON.stringify([...this.zones]));
    this.ach?.check('explorer', this.zones.size >= 6);
  }

  usedEmote(id) {
    this.emotesUsed++;
    localStorage.setItem(LS.emotes, String(this.emotesUsed));
    if (!this.emoteSet.has(id)) {
      this.emoteSet.add(id);
      localStorage.setItem(LS.emoteSet, JSON.stringify([...this.emoteSet]));
    }
    this.ach?.check('socialite', this.emotesUsed >= 10);
    this.ach?.check('showoff', this.emoteSet.size >= this.totalEmoteTypes);
  }

  /** Called each frame with distance walked; batched so we don't write every tick. */
  addDistance(metres) {
    this.distance += metres;
    this._distAccum += metres;
    if (this._distAccum >= 5) {
      this._distAccum = 0;
      localStorage.setItem(LS.distance, String(Math.round(this.distance)));
      this.ach?.check('wanderer', this.distance >= 500);
    }
  }

  activity(id) {
    if (id === 'coinride') this.ach?.unlock('thrillride');
  }

  /** @returns true if this was the 5th (final) star */
  foundStar(index, total) {
    const found = new Set(this._arr('amgw_stars'));
    if (found.has(index)) return false;
    found.add(index);
    localStorage.setItem('amgw_stars', JSON.stringify([...found]));
    const done = found.size >= total;
    if (done) this.ach?.unlock('starHunter');
    return { count: found.size, done };
  }

  starsFound() { return this._arr('amgw_stars'); }

  progress() {
    return this.ach ? this.ach.progress() : { unlocked: 0, total: WORLD_ACHIEVEMENTS.length };
  }

  renderGrid(container) {
    if (this.ach) this.ach.renderGrid(container);
  }
}

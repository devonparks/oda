/**
 * AMG World — zones, portals and activities.
 *
 * Coordinates come from clustering the Synty demo park's props (see
 * tools/world/README.md), so each portal actually sits in the part of the park
 * it's named after.
 *
 * Portals deliberately open a CATEGORY rather than one hard-coded game: the hub
 * has 49 games and grows, and "walk to the sports field, pick a sports game"
 * keeps working as the catalogue changes. Nothing here needs editing when a
 * game is added — only when a new place is built.
 */

export const ZONES = [
  {
    id: 'playground',
    name: 'The Playground',
    blurb: 'Play head-to-head with your classmates.',
    icon: '🛝',
    color: 0x38bdf8,
    pos: [0.5, -2.4],
    radius: 3.4,
    categories: ['Multiplayer'],
  },
  {
    id: 'skatepark',
    name: 'Skate Park',
    blurb: 'Fast reflexes only. Arcade high scores.',
    icon: '🛹',
    color: 0xf472b6,
    pos: [1.7, 25.4],
    radius: 4.0,
    categories: ['Action'],
  },
  {
    id: 'sportsfield',
    name: 'Sports Field',
    blurb: 'Hoops, goals and rallies.',
    icon: '🏀',
    color: 0xfb923c,
    pos: [20.2, 18.7],
    radius: 3.6,
    categories: ['Sports'],
  },
  {
    id: 'sandpit',
    name: 'The Sandpit',
    blurb: 'Sit down and solve something.',
    icon: '🧩',
    color: 0xfbbf24,
    pos: [7.2, -7.8],
    radius: 3.2,
    categories: ['Puzzle'],
  },
  {
    id: 'storytent',
    name: 'Story Tent',
    blurb: 'Words, trivia and brain training.',
    icon: '📚',
    color: 0xa78bfa,
    pos: [6.9, 7.3],
    radius: 3.0,
    categories: ['Word'],
  },
  {
    id: 'strategylawn',
    name: 'Strategy Lawn',
    blurb: 'Chess, checkers and long games.',
    icon: '♟️',
    color: 0x34d399,
    pos: [13.0, 8.4],
    radius: 3.0,
    categories: ['Strategy'],
  },
];

/**
 * Standing activities that live in the world rather than launching a game.
 * Each is a small reason to walk somewhere, which is what a hub world is for.
 */
export const ACTIVITIES = [
  {
    id: 'tag',
    name: 'Freeze Tag',
    icon: '🏃',
    // Open ground by the spawn path (the NW coin trail runs through here).
    pos: [-1.5, 20.5],
    radius: 3.4,
    prompt: 'Start freeze tag',
  },
  {
    id: 'coinride',
    name: 'Coin Rides',
    icon: '🎠',
    pos: [16.8, 15.5],
    radius: 2.6,
    prompt: 'Take a ride',
    // handled in main.js: costs coins, plays an emote, small chance of a bonus
  },
  {
    id: 'pond',
    name: 'The Pond',
    icon: '🦆',
    // On the pond's west bank. The old spot (-9.5, -4) pointed at grass — the
    // actual water (SM_Env_Park_Pond_01) is the big pond at (21, 0), and the
    // ducks live on it now.
    pos: [12.6, -0.4],
    radius: 3.6,
    prompt: 'Feed the ducks',
  },
  {
    id: 'bikerack',
    name: 'Bike Rack',
    icon: '🚲',
    pos: [11.4, 10.2],
    radius: 3.0,
    prompt: 'Ring the bell',
  },
];

/** Where new arrivals land. Just inside the main gate, facing the park. */
export const SPAWN = { x: 4.0, z: 14.0, yaw: Math.PI };

/**
 * Coin pickups. Hand-placed along the paths so collecting them walks a player
 * past every zone at least once — the tutorial is the level design.
 */
export const COIN_SPOTS = [
  [4, 11], [2.5, 7.5], [1, 3.5], [0.5, 0], [-2, -3], [-6, -1],
  [4, -6], [8, -7], [10, -3], [9, 2], [8.5, 6], [12, 9],
  [15, 12], [18, 15], [20, 18], [17, 21], [12, 22], [7, 24],
  [2, 26], [-2, 23], [-5, 19], [-8, 14], [-11, 9], [-13, 4],
  [-10, -2], [-6, 6], [-1, 12], [3, 18], [14, 5], [19, 10],
];

export function nearestZone(x, z, list = ZONES) {
  let best = null, bestD = Infinity;
  for (const z0 of list) {
    const d = Math.hypot(x - z0.pos[0], z - z0.pos[1]);
    if (d < z0.radius && d < bestD) { bestD = d; best = z0; }
  }
  return best;
}

/** Games in the hub catalogue matching a zone's categories. */
export function gamesForZone(zone, catalogue) {
  if (!catalogue) return [];
  return catalogue.filter((g) =>
    (g.categories || []).some((c) => zone.categories.includes(c)));
}

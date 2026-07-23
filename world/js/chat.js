/**
 * AMG World — safe chat.
 *
 * There is no free-text chat and there never should be. AMG Hub is used by real
 * 9–13 year olds in classrooms, which means any open text field is a moderation
 * obligation Devon cannot staff. This is the Club Penguin "Ultimate Safe Chat"
 * model: a fixed phrase book, and the wire only ever carries an INDEX into it.
 *
 * That property is what makes it safe, so keep it: presence.js sends `m` as a
 * number, and renderPhrase() is the only thing that turns a number into words.
 * A malicious client can at worst make someone say "Nice one!".
 *
 * Adding phrases is fine. APPEND ONLY — inserting in the middle would change
 * what every already-in-flight index means.
 */

export const PHRASE_BOOK = [
  { g: 'Hello', items: ['Hi!', 'Hey there!', 'Good morning!', 'Welcome!', 'Nice to meet you'] },
  { g: 'Play', items: ['Want to play?', 'Race you!', 'Follow me!', 'Over here!', 'Let\'s team up', 'One more game?'] },
  { g: 'Nice', items: ['Nice one!', 'Good game!', 'You\'re really good', 'Great job!', 'Cool outfit!', 'Thanks!'] },
  { g: 'Feelings', items: ['That was fun', 'So close!', 'Oops!', 'I did it!', 'Whoa!', 'Yay!'] },
  { g: 'School', items: ['I finished my work', 'That question was hard', 'I got a new best score', 'Almost done'] },
  { g: 'Bye', items: ['See you later!', 'Got to go', 'Bye!', 'Good luck!'] },
];

/** Flattened, index-stable list. Index == what goes on the wire. */
export const PHRASES = PHRASE_BOOK.flatMap((g) => g.items);

/** Group boundaries, for building the picker without re-flattening. */
export const PHRASE_GROUPS = (() => {
  let i = 0;
  return PHRASE_BOOK.map((g) => {
    const start = i;
    i += g.items.length;
    return { name: g.g, start, end: i };
  });
})();

/** The ONLY index -> text conversion. Out-of-range is silently dropped. */
export function renderPhrase(index) {
  if (typeof index !== 'number' || !Number.isInteger(index)) return null;
  if (index < 0 || index >= PHRASES.length) return null;
  return PHRASES[index];
}

/**
 * Names are the one place a kid's own words reach other kids, and they come
 * from the teacher-managed roster rather than being typed here. Still worth
 * defending: strip anything that isn't a letter, digit, space or hyphen, and
 * cap the length so nobody can smuggle markup or a URL into a nametag.
 */
export function safeName(name) {
  return String(name || 'Player')
    .replace(/[^\p{L}\p{N} \-']/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16) || 'Player';
}

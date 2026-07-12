/**
 * READ-ONLY analytics: which games did kids actually play?
 * Aggregates every per-game records collection: unique players (doc count)
 * and total plays (sum of gamesPlayed/plays/wins+losses where present).
 * Run BEFORE any data wipe — this is the historical record.
 *   cd tools && node analytics-most-played.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('../tests/node_modules/firebase-admin');
const serviceAccount = require('../tests/serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const collections = await db.listCollections();
const rows = [];
let studentsCount = 0, teachersCount = 0, assignmentsCount = 0;

for (const col of collections) {
  const snap = await col.get();
  if (col.id === 'students') { studentsCount = snap.size; continue; }
  if (col.id === 'teachers') { teachersCount = snap.size; continue; }
  if (col.id === 'assignments') { assignmentsCount = snap.size; continue; }

  // Records-style collections: one doc per player
  const looksLikeRecords = /Records$|Stats$|Saves$|Leaderboard$|^odaRacers$|^lemonadeGame$/.test(col.id);
  if (!looksLikeRecords) continue;

  let players = snap.size, plays = 0, wins = 0;
  snap.forEach(d => {
    const v = d.data();
    plays += v.gamesPlayed || v.plays || v.totalGames || v.gamesStarted || 0;
    wins += v.gamesWon || v.wins || 0;
    // fall back: wins+losses as plays when no counter exists
    if (!v.gamesPlayed && !v.plays && !v.totalGames && (v.wins !== undefined || v.losses !== undefined)) {
      plays += (v.wins || 0) + (v.losses || 0) + (v.draws || 0);
    }
  });
  rows.push({ collection: col.id, players, plays, wins });
}

rows.sort((a, b) => b.plays - a.plays || b.players - a.players);

console.log(`\nPlatform totals: ${studentsCount} students, ${teachersCount} guardians/teachers, ${assignmentsCount} assignments\n`);
console.log('GAME ENGAGEMENT (sorted by total plays, then unique players):');
console.log('collection'.padEnd(28) + 'players'.padStart(8) + 'plays'.padStart(9) + 'wins'.padStart(8));
for (const r of rows) {
  console.log(r.collection.padEnd(28) + String(r.players).padStart(8) + String(r.plays).padStart(9) + String(r.wins).padStart(8));
}
process.exit(0);

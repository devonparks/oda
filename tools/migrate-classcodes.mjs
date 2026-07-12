/**
 * One-time migration: backfill the thin public /classCodes lookup collection
 * from every guardian (teachers collection) doc.
 *
 * Why: firestore.rules v2 locks guardian PII behind auth, so kid login resolves
 * family/class codes via /classCodes/{code} -> { ownerId } instead of querying
 * the guardians collection. Guardians who log in after the rebrand self-heal
 * their own doc (teacher.html), but guardians who never log in again (e.g.
 * former ODA teachers) need this backfill or their students can't log in
 * after the rules deploy.
 *
 * Run BEFORE deploying firestore.rules v2:
 *   cd tools && node migrate-classcodes.mjs
 * Requires ../tests/serviceAccountKey.json (already used by the test suite).
 * Idempotent — safe to run repeatedly. Writes are additive; nothing is deleted.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('../tests/node_modules/firebase-admin');
const serviceAccount = require('../tests/serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection('teachers').get();
console.log(`Found ${snap.size} guardian docs`);

let written = 0, skipped = 0, collisions = [];
const seen = new Map(); // code -> ownerId

for (const doc of snap.docs) {
  const d = doc.data();
  const code = d.classCode;
  if (!code || !/^\d{6}$/.test(String(code))) { skipped++; continue; }
  if (seen.has(code) && seen.get(code) !== doc.id) {
    collisions.push({ code, a: seen.get(code), b: doc.id });
    continue; // first writer wins; collisions reported for manual review
  }
  seen.set(code, doc.id);
  await db.collection('classCodes').doc(String(code)).set({
    ownerId: doc.id,
    ownerName: (d.name || '').split(' ')[0] || '',
    accountType: d.accountType || 'teacher',
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  written++;
}

console.log(`classCodes written: ${written}, skipped (no/invalid code): ${skipped}`);
if (collisions.length) {
  console.warn('DUPLICATE CODES NEED MANUAL REVIEW (regenerate one side):');
  collisions.forEach(c => console.warn(`  code ${c.code}: kept ${c.a}, conflicting ${c.b}`));
} else {
  console.log('No duplicate codes found.');
}
process.exit(0);

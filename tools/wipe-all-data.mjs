/**
 * FRESH START WIPE — permanently deletes ALL platform data.
 *
 * Devon authorized this 2026-07-12: AMG Hub launches clean, no ODA-era
 * students/teachers/classrooms/records carried over.
 *
 * THIS IS IRREVERSIBLE. It is deliberately NOT run automatically — run it
 * yourself when you're ready:
 *
 *   cd tools
 *   node wipe-all-data.mjs --confirm-wipe-everything            # wipe all Firestore data
 *   node wipe-all-data.mjs --confirm-wipe-everything --also-auth-users   # + delete all sign-in accounts
 *
 * Notes:
 * - Wipes EVERY root collection (students, teachers, assignments, all
 *   *Records/*Games/*Tournaments, galleries, feedback, classCodes, ...).
 * - --also-auth-users additionally deletes every Firebase Auth user
 *   (teacher/parent logins). They can re-sign-up fresh. Your own admin
 *   Google account is an Auth user too — you'll just sign in again.
 * - After wiping, migrate-classcodes.mjs is unnecessary (nothing to migrate).
 * - Requires ../tests/serviceAccountKey.json.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('../tests/node_modules/firebase-admin');
const serviceAccount = require('../tests/serviceAccountKey.json');

const args = process.argv.slice(2);
if (!args.includes('--confirm-wipe-everything')) {
  console.log('Refusing to run without --confirm-wipe-everything');
  console.log('This permanently deletes ALL data in project ' + serviceAccount.project_id);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

console.log('Project:', serviceAccount.project_id);
const collections = await db.listCollections();
console.log(`Found ${collections.length} root collections`);

for (const col of collections) {
  let count = 0;
  // recursiveDelete handles subcollections too
  const snap = await col.get();
  count = snap.size;
  await db.recursiveDelete(col);
  console.log(`  wiped ${col.id} (${count} docs)`);
}

if (args.includes('--also-auth-users')) {
  let deleted = 0, pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    if (page.users.length) {
      const result = await admin.auth().deleteUsers(page.users.map(u => u.uid));
      deleted += result.successCount;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`Deleted ${deleted} Firebase Auth users`);
} else {
  console.log('Auth users kept (pass --also-auth-users to delete sign-in accounts too)');
}

console.log('FRESH START COMPLETE.');
process.exit(0);

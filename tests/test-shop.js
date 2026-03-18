/**
 * Shop Test - Buy, equip, unequip, coins
 */
const { db, PLAYER1, trackDoc, cleanup, assert, assertDoc, printResults, resetCounters } = require('./setup');
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  console.log('\n🛍️ SHOP TESTS');
  console.log('='.repeat(40));
  resetCounters();

  // Create test student with coins
  console.log('\n[Setup]');
  await db.collection('students').doc(PLAYER1.id).set({
    studentId: PLAYER1.id, name: PLAYER1.name, teacherId: 'test_teacher',
    coins: 500, inventory: [], equipped: {}, achievements: [],
    grade: '5th'
  });
  trackDoc('students', PLAYER1.id);
  let data = await assertDoc('students', PLAYER1.id, 'Test student created');
  assert(data && data.coins === 500, 'Starting coins: 500');

  // --- Buy an item ---
  console.log('\n[Purchase Flow]');
  // Buy "Cool Cat" avatar (cost: 50)
  await db.collection('students').doc(PLAYER1.id).update({
    coins: FieldValue.increment(-50),
    inventory: FieldValue.arrayUnion('avatar_cat')
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.coins === 450, 'Coins deducted (500 - 50 = 450)');
  assert(data.inventory.includes('avatar_cat'), 'avatar_cat in inventory');

  // Buy "Red" name color (cost: 75)
  await db.collection('students').doc(PLAYER1.id).update({
    coins: FieldValue.increment(-75),
    inventory: FieldValue.arrayUnion('color_red')
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.coins === 375, 'Coins deducted (450 - 75 = 375)');
  assert(data.inventory.includes('color_red'), 'color_red in inventory');

  // Buy "Rookie" title (cost: 100)
  await db.collection('students').doc(PLAYER1.id).update({
    coins: FieldValue.increment(-100),
    inventory: FieldValue.arrayUnion('title_rookie')
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.coins === 275, 'Coins deducted (375 - 100 = 275)');
  assert(data.inventory.length === 3, 'Inventory has 3 items');

  // --- Equip items ---
  console.log('\n[Equip]');
  await db.collection('students').doc(PLAYER1.id).update({
    'equipped.avatar': { id: 'avatar_cat', emoji: '🐱' }
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.equipped.avatar.id === 'avatar_cat', 'Avatar equipped');
  assert(data.equipped.avatar.emoji === '🐱', 'Avatar emoji correct');

  await db.collection('students').doc(PLAYER1.id).update({
    'equipped.nameColor': { id: 'color_red', value: '#ef4444' }
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.equipped.nameColor.id === 'color_red', 'Name color equipped');
  assert(data.equipped.nameColor.value === '#ef4444', 'Color value correct');

  await db.collection('students').doc(PLAYER1.id).update({
    'equipped.title': { id: 'title_rookie', value: 'Rookie' }
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.equipped.title.value === 'Rookie', 'Title equipped');

  // --- Unequip ---
  console.log('\n[Unequip]');
  await db.collection('students').doc(PLAYER1.id).update({
    'equipped.title': { id: 'title_none', value: '' }
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.equipped.title.id === 'title_none', 'Title unequipped');

  // --- Duplicate purchase prevention ---
  console.log('\n[Edge Cases]');
  await db.collection('students').doc(PLAYER1.id).update({
    inventory: FieldValue.arrayUnion('avatar_cat')  // Already owned
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.inventory.filter(i => i === 'avatar_cat').length === 1, 'No duplicate in inventory');

  // --- Coin awarding from games ---
  console.log('\n[Coin Awards]');
  await db.collection('students').doc(PLAYER1.id).update({
    coins: FieldValue.increment(15)  // Win a game
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.coins === 290, 'Game coins awarded (275 + 15 = 290)');

  await db.collection('students').doc(PLAYER1.id).update({
    coins: FieldValue.increment(75)  // Win a tournament
  });
  data = (await db.collection('students').doc(PLAYER1.id).get()).data();
  assert(data.coins === 365, 'Tournament coins awarded (290 + 75 = 365)');

  // --- Teacher shop (read teacher doc) ---
  console.log('\n[Teacher Shop]');
  await db.collection('teachers').doc('test_teacher').set({
    displayName: 'TestTeacher', email: 'test@test.com',
    classCode: 'TEST99',
    equipped: {
      avatar: { id: 'avatar_dragon', emoji: '🐲' },
      nameColor: { id: 'color_prismatic', value: 'linear-gradient(...)' },
      border: { id: 'border_diamond', value: '...' }
    }
  }, { merge: true });
  trackDoc('teachers', 'test_teacher');
  data = (await db.collection('teachers').doc('test_teacher').get()).data();
  assert(data.equipped.avatar.id === 'avatar_dragon', 'Teacher equipped avatar loads');
  assert(data.equipped.nameColor.id === 'color_prismatic', 'Teacher equipped color loads');

  // Teacher equips new item
  await db.collection('teachers').doc('test_teacher').update({
    'equipped.avatar': { id: 'avatar_crown', emoji: '👑' }
  });
  data = (await db.collection('teachers').doc('test_teacher').get()).data();
  assert(data.equipped.avatar.id === 'avatar_crown', 'Teacher can equip items');

  await cleanup();
  return printResults('SHOP');
}

module.exports = { run };

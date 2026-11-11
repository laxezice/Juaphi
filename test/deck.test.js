const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDeck, makeRng, HAND_SIZE } = require('../game/deck');

const count = (cards, kind) => cards.filter((c) => c.kind === kind).length;
const all = (r) => r.hands.flat().concat(r.deck);

test('4 players: each hand has 1 talisman + 7 others and no ghost', () => {
  const r = buildDeck(4, makeRng(1));
  assert.equal(HAND_SIZE, 7);
  assert.equal(r.hands.length, 4);
  for (const h of r.hands) {
    assert.equal(h.length, 8);
    assert.equal(count(h, 'talisman'), 1);
    assert.equal(count(h, 'ghost'), 0);
  }
  assert.equal(count(r.deck, 'ghost'), 3);
  assert.equal(count(r.deck, 'talisman'), 2);
  // ชุดหลัก 56 ใบ + ยันต์ในมือ 4 + ผี 3 + ยันต์สำรอง 2 กองจั่วเหลือ 56 - 28 + 5 = 33
  assert.equal(all(r).length, 56 + 4 + 3 + 2);
  assert.equal(r.deck.length, 33);
});

test('7 players use the doubled table', () => {
  const r = buildDeck(7, makeRng(2));
  assert.equal(count(r.deck, 'ghost'), 6);
  assert.equal(count(r.deck, 'talisman'), 3);
  assert.equal(count(all(r), 'nope'), 12);
  assert.equal(count(all(r), 'imp3'), 10);
});

test('2 players get one ghost', () => {
  const r = buildDeck(2, makeRng(3));
  assert.equal(count(r.deck, 'ghost'), 1);
});

test('same seed gives the same deal, different seed a different order', () => {
  const a = buildDeck(4, makeRng(42));
  const b = buildDeck(4, makeRng(42));
  const c = buildDeck(4, makeRng(43));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.deck.map((x) => x.kind), c.deck.map((x) => x.kind));
});

test('every card uid is unique', () => {
  const cards = all(buildDeck(8, makeRng(5)));
  assert.equal(new Set(cards.map((c) => c.uid)).size, cards.length);
});

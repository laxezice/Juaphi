const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDeck, makeRng, HAND_SIZE, DECK_AFTER_DEAL, deckAfterDeal, poolCounts } = require('../game/deck');

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
  // (user, 2026-11-16) กองหลังแจกเหลือ 30 ใบ: การ์ด 53 ใบ + ยันต์ในมือ 4 + ผี 3 + ยันต์สำรอง 2 แจก 28 เหลือ 30
  assert.equal(DECK_AFTER_DEAL, 30);
  assert.equal(all(r).length, 53 + 4 + 3 + 2);
  assert.equal(r.deck.length, 30);
});

test('the deck after the deal is 30 cards up to 4 players, then 5 more per extra player, extra cards or not', () => {
  // (user, 2026-11-16) เกินสี่คน เพิ่มคนละ 5 ใบ
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(deckAfterDeal), [30, 30, 30, 35, 40, 45, 50]);
  for (const extras of [false, true]) {
    for (let n = 2; n <= 8; n++) {
      const r = buildDeck(n, makeRng(n), { extras });
      assert.equal(r.deck.length, deckAfterDeal(n), `${n} players, extras ${extras}`);
      // ทุกแบบยังมีอย่างน้อย 1 ใบ
      for (const [k, c] of Object.entries(poolCounts(n, { extras }))) assert.ok(c >= 1, `${k} ${n}`);
    }
  }
});

test('7 players get more cards to deal from, in the same proportions', () => {
  const r = buildDeck(7, makeRng(2));
  assert.equal(count(r.deck, 'ghost'), 6);
  assert.equal(count(r.deck, 'talisman'), 3);
  const p = poolCounts(7);
  assert.equal(count(all(r), 'nope'), p.nope);
  assert.ok(p.nope > poolCounts(4).nope);
  assert.ok(p.nope > p.imp3 && p.imp3 > p.curse2);
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

test('pool rounding: every imp kind equal, every extra card equal, and no card shrinks as players are added', () => {
  for (const extras of [false, true]) {
    let prev = null;
    for (let n = 2; n <= 8; n++) {
      const p = poolCounts(n, { extras });
      assert.equal(new Set(['imp1', 'imp2', 'imp3', 'imp4', 'imp5'].map((k) => p[k])).size, 1, `imps ${n} ${extras}`);
      if (extras) assert.equal(new Set(['blackout', 'possess', 'grave', 'fate', 'reverse', 'bottom'].map((k) => p[k])).size, 1, `extras ${n}`);
      assert.ok(p.curse2 >= 1 && p.curse2 <= 2, `curse2 ${n}`);   // ใบหายาก: 1 ใบ กองใหญ่มาก (8 คน) ได้ 2
      if (prev) for (const k of Object.keys(p)) assert.ok(p[k] >= prev[k], `${k} drops from ${n - 1} to ${n} players (extras ${extras})`);
      prev = p;
    }
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../game/game');
const { viewFor } = require('../game/view');
const { makeRng } = require('../game/deck');

test('createGame deals and starts with the first player', () => {
  const g = createGame(['A', 'B', 'C'], makeRng(1));
  assert.equal(g.current, 'A');
  assert.equal(g.turnsLeft, 1);
  assert.equal(g.cursed, false);
  assert.equal(g.pending, null);
  assert.equal(g.winner, null);
  for (const p of g.players) {
    assert.equal(p.hand.length, 8);
    assert.equal(p.alive, true);
    assert.equal(p.grudge, false);
  }
});

test('a player sees their own hand and only counts for others', () => {
  const g = createGame(['A', 'B', 'C'], makeRng(2));
  const v = viewFor(g, 'A');
  assert.deepEqual(v.me.hand, g.players[0].hand);
  const b = v.players.find((p) => p.id === 'B');
  assert.equal(b.handCount, 8);
  assert.equal(b.hand, undefined);
  assert.equal(v.deckCount, g.deck.length);
  assert.equal(v.current, 'A');
  assert.equal(v.turnsLeft, 1);
  assert.equal(v.discardTop, null);

  const json = JSON.stringify(v);
  for (const card of g.players[1].hand) assert.ok(!json.includes(`"${card.uid}"`), 'B card leaked');
  for (const card of g.deck) assert.ok(!json.includes(`"${card.uid}"`), 'deck card leaked');
});

test('a watcher view has no hand', () => {
  const g = createGame(['A', 'B'], makeRng(3));
  const v = viewFor(g, null);
  assert.equal(v.me, undefined);
  assert.equal(v.players.length, 2);
});

test('pending insert is shown publicly without the index', () => {
  const g = createGame(['A', 'B'], makeRng(4));
  g.pending = { kind: 'insert', player: 'A' };
  assert.deepEqual(viewFor(g, 'B').pending, { kind: 'insert', player: 'A' });
});

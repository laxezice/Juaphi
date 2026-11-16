const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMatch, beginRound, recordRoundWin } = require('../game/match');

test('a new room has a first-to-three match with no rounds played', () => {
  const m = createMatch();
  assert.deepEqual(m, { target: 3, round: 0, scores: {}, winner: null, roundWinner: null });
  assert.equal(recordRoundWin(m, 'A'), false);
});

test('each completed round awards exactly one point, even after repeated updates', () => {
  const m = createMatch();
  beginRound(m, ['A', 'B']);
  assert.deepEqual(m.scores, { A: 0, B: 0 });
  assert.equal(recordRoundWin(m, 'watcher'), false);
  assert.equal(recordRoundWin(m, 'A'), true);
  assert.equal(recordRoundWin(m, 'A'), false);
  assert.equal(recordRoundWin(m, 'B'), false);
  assert.deepEqual(m.scores, { A: 1, B: 0 });
  assert.equal(m.winner, null);
});

test('three round wins finish a match; the next match starts from zero', () => {
  const m = createMatch();
  for (const id of ['A', 'B', 'A', 'B', 'A']) {
    beginRound(m, ['A', 'B']);
    assert.equal(recordRoundWin(m, id), true);
  }
  assert.deepEqual(m.scores, { A: 3, B: 2 });
  assert.equal(m.round, 5);
  assert.equal(m.winner, 'A');
  assert.equal(recordRoundWin(m, 'B'), false);
  beginRound(m, ['A', 'C']);
  assert.equal(m.round, 1);
  assert.equal(m.winner, null);
  assert.equal(m.roundWinner, null);
  assert.deepEqual(m.scores, { A: 0, C: 0 });
});

test('arrivals start at zero and departed players keep their history until the next match', () => {
  const m = createMatch();
  beginRound(m, ['A', 'B']);
  recordRoundWin(m, 'B');
  beginRound(m, ['A', 'C']);
  assert.equal(m.round, 2);
  assert.deepEqual(m.scores, { A: 0, B: 1, C: 0 });
  recordRoundWin(m, 'C');
  assert.deepEqual(m.scores, { A: 0, B: 1, C: 1 });
});

test('rooms do not share their score records', () => {
  const a = createMatch(), b = createMatch();
  beginRound(a, ['A', 'B']);
  recordRoundWin(a, 'A');
  assert.deepEqual(b.scores, {});
  assert.equal(b.round, 0);
});

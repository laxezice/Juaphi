const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarizeRooms } = require('../admin');

test('summarizeRooms lists every room with counts only, no names', () => {
  const now = 10 * 60000;
  const rooms = new Map([
    ['ABCD', { code: 'ABCD', game: null, lastActive: now - 3 * 60000, players: [{ name: 'ต้น', online: true }, { name: 'บี', online: false }] }],
    ['WXYZ', { code: 'WXYZ', game: { winner: null }, lastActive: now, players: [{ name: 'ก', online: true }, { name: 'ข', online: true }, { name: 'ค', online: true }] }],
    ['DONE', { code: 'DONE', game: { winner: 'x' }, lastActive: now - 30 * 60000, players: [{ name: 'ง', online: false }] }],
  ]);
  const out = summarizeRooms(rooms, now);
  assert.deepEqual(out, [
    { code: 'ABCD', state: 'waiting', players: 2, online: 1, idleMin: 3 },
    { code: 'WXYZ', state: 'playing', players: 3, online: 3, idleMin: 0 },
    { code: 'DONE', state: 'waiting', players: 1, online: 0, idleMin: 30 },
  ]);
  assert.ok(!JSON.stringify(out).includes('ต้น'));
});

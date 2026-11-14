// จำนวนการ์ดที่หน้าเว็บแสดงในรายการการ์ด ต้องตรงกับกติกาจริงใน game/deck.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DECK_TABLE, EXTRA_TABLE, SPARE_TALISMANS } = require('../game/deck');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'public', 'cards.js')).href);

test('deckCount matches the rules for every player count', async () => {
  const { deckCount, KIND_ORDER } = await load();
  for (let n = 2; n <= 8; n++) {
    const col = n >= 6 ? 1 : 0;
    for (const [k, v] of Object.entries({ ...DECK_TABLE, ...EXTRA_TABLE })) assert.equal(deckCount(k, n), v[col], `${k} ${n}`);
    assert.equal(deckCount('ghost', n), n - 1);
    assert.equal(deckCount('evil', n), 0);
    assert.equal(deckCount('ghost', n, { evil: true }), n - 2);   // ผีร้ายแทนผี 1 ใบ
    assert.equal(deckCount('evil', n, { evil: true }), 1);
    assert.equal(deckCount('talisman', n), n + SPARE_TALISMANS[col]);
  }
  for (const k of KIND_ORDER) assert.ok(deckCount(k, 4, { evil: true }) > 0, k);
});

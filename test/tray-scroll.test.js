const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'public', 'tray-scroll.js')).href);

function fixture(width = 500, content = 1600) {
  const row = Object.assign(new EventTarget(), { clientWidth: width, scrollWidth: content, scrollLeft: 0, children: [] });
  const prev = new EventTarget();
  const next = new EventTarget();
  const wheel = (dy, dx = 0, extra = {}) => {
    const e = new Event('wheel', { cancelable: true });
    Object.assign(e, { deltaY: dy, deltaX: dx, deltaMode: 0, ...extra });
    row.dispatchEvent(e);
    return e;
  };
  return { row, prev, next, wheel };
}

test('vertical mouse wheel moves an overflowing card row in both directions', async () => {
  const { attachTrayScroll } = await load();
  const { row, prev, next, wheel } = fixture();
  attachTrayScroll(row, { prev, next });
  assert.equal(wheel(120).defaultPrevented, true);
  assert.equal(row.scrollLeft, 120);
  wheel(-40);
  assert.equal(row.scrollLeft, 80);
});

test('native horizontal trackpad input and browser zoom are not intercepted', async () => {
  const { attachTrayScroll } = await load();
  const { row, prev, next, wheel } = fixture();
  attachTrayScroll(row, { prev, next });
  for (const e of [wheel(3, 100), wheel(120, 0, { ctrlKey: true }), wheel(0)]) assert.equal(e.defaultPrevented, false);
  assert.equal(row.scrollLeft, 0);
});

test('line and page wheel units work and scrolling stays within row bounds', async () => {
  const { attachTrayScroll } = await load();
  const { row, prev, next, wheel } = fixture();
  attachTrayScroll(row, { prev, next });
  wheel(3, 0, { deltaMode: 1 });
  assert.ok(row.scrollLeft > 3);
  wheel(3, 0, { deltaMode: 2 });
  assert.equal(row.scrollLeft, 1100);
  assert.equal(wheel(120).defaultPrevented, false);
  wheel(-99999);
  assert.equal(row.scrollLeft, 0);
});

test('navigation reaches the last card, disables boundary buttons, and resets for the next tray', async () => {
  const { attachTrayScroll } = await load();
  const { row, prev, next } = fixture();
  const nav = attachTrayScroll(row, { prev, next });
  assert.equal(prev.disabled, true);
  assert.equal(next.disabled, false);
  for (let i = 0; i < 10; i++) next.dispatchEvent(new Event('click'));
  assert.equal(row.scrollLeft, 1100);
  assert.equal(next.disabled, true);
  prev.dispatchEvent(new Event('click'));
  assert.ok(row.scrollLeft < 1100);
  nav.reset();
  assert.equal(row.scrollLeft, 0);
  assert.equal(prev.disabled, true);
});

test('non-overflowing trays do not consume wheel input and reattaching does not double-scroll', async () => {
  const { attachTrayScroll } = await load();
  const { row, prev, next, wheel } = fixture(500, 400);
  const nav = attachTrayScroll(row, { prev, next });
  assert.equal(next.hidden, true);
  assert.equal(prev.hidden, true);
  assert.equal(wheel(120).defaultPrevented, false);
  row.scrollWidth = 1600;
  nav.refresh();
  attachTrayScroll(row, { prev, next });
  wheel(120);
  assert.equal(row.scrollLeft, 120);
});

test('keyboard users can reach either end of a long tray without selecting a card', async () => {
  const { attachTrayScroll } = await load();
  const { row, prev, next } = fixture();
  attachTrayScroll(row, { prev, next });
  for (const key of ['End', 'Home']) {
    const e = new Event('keydown', { cancelable: true });
    Object.assign(e, { key });
    row.dispatchEvent(e);
    assert.equal(e.defaultPrevented, true);
    assert.equal(row.scrollLeft, key === 'End' ? 1100 : 0);
  }
});

test('Home and End keep the first and last focused cards clear of the navigation buttons', async () => {
  const { attachTrayScroll } = await load();
  const { row, prev, next } = fixture();
  row.children = Array.from({ length: 3 }, () => ({ focus() { this.focused = true; }, scrollIntoView() {} }));
  attachTrayScroll(row, { prev, next });
  for (const [key, left, index] of [['End', 1100, 2], ['Home', 0, 0]]) {
    const e = new Event('keydown', { cancelable: true });
    Object.assign(e, { key });
    row.dispatchEvent(e);
    assert.equal(row.scrollLeft, left);
    assert.equal(row.children[index].focused, true);
  }
});

// จั่วผี: จัดชุดการ์ดตามจำนวนคน แจกไพ่ และสับกอง
// deck[0] คือการ์ดใบบนสุดของกอง

const HAND_SIZE = 7;

// จำนวนการ์ดแต่ละแบบ [2-5 คน, 6-8 คน] แก้ตัวเลขกติกาตรงนี้ได้
const DECK_TABLE = {
  nope: [5, 10],
  sneak: [4, 8],
  curse: [3, 6],
  curse2: [1, 2],
  mirror: [5, 10],
  wind: [4, 8],
  beg: [4, 8],
  imp1: [4, 8],
  imp2: [4, 8],
  imp3: [4, 8],
  imp4: [4, 8],
  imp5: [4, 8],
};
const SPARE_TALISMANS = [2, 3];

/** ตัวสุ่มที่กำหนดผลได้ (mulberry32) ใช้ในเทสต์ */
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates สับในที่ คืน array เดิม */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * แจกการ์ดตอนเริ่มเกม ทุกคนได้ยันต์ 1 ใบ + การ์ด HAND_SIZE ใบจากกองที่ยังไม่มีผี/ยันต์
 * แล้วค่อยใส่ผี (จำนวนคน - 1) กับยันต์สำรองลงกองแล้วสับ
 * @returns {{ hands: {uid:string,kind:string}[][], deck: {uid:string,kind:string}[] }}
 */
function buildDeck(playerCount, rng) {
  const col = playerCount >= 6 ? 1 : 0;
  let n = 0;
  const card = (kind) => ({ uid: 'c' + (++n), kind });
  const pool = [];
  for (const [kind, counts] of Object.entries(DECK_TABLE)) {
    for (let i = 0; i < counts[col]; i++) pool.push(card(kind));
  }
  shuffle(pool, rng);
  const hands = [];
  for (let p = 0; p < playerCount; p++) {
    hands.push([card('talisman'), ...pool.splice(0, HAND_SIZE)]);
  }
  for (let i = 0; i < playerCount - 1; i++) pool.push(card('ghost'));
  for (let i = 0; i < SPARE_TALISMANS[col]; i++) pool.push(card('talisman'));
  shuffle(pool, rng);
  return { hands, deck: pool };
}

module.exports = { HAND_SIZE, DECK_TABLE, SPARE_TALISMANS, makeRng, shuffle, buildDeck };

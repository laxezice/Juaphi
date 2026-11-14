// จั่วผี: จัดชุดการ์ดตามจำนวนคน แจกไพ่ และสับกอง
// deck[0] คือการ์ดใบบนสุดของกอง

const HAND_SIZE = 7;

// จำนวนการ์ดแต่ละแบบ [2-5 คน, 6-8 คน] แก้ตัวเลขกติกาตรงนี้ได้
// ชุดหลักรวม 56 ใบ (2-5 คน) / 112 ใบ (6-8 คน) ก่อนแจก ไม่นับผีกับยันต์
const DECK_TABLE = {
  nope: [7, 14],
  sneak: [5, 10],
  curse: [4, 8],
  curse2: [1, 2],
  mirror: [6, 12],
  wind: [5, 10],
  beg: [5, 10],
  imp1: [4, 8],
  imp2: [4, 8],
  imp3: [4, 8],
  imp4: [4, 8],
  imp5: [4, 8],
  wild: [3, 6],   // ผีน้อยแปลงร่าง: นับเป็นผีน้อยแบบไหนก็ได้
};
// การ์ดเสริม: ใส่เพิ่มเมื่อหัวห้องเปิดตัวเลือก "การ์ดเสริม"
const EXTRA_TABLE = {
  blackout: [2, 4],  // ไฟดับ
  possess: [2, 4],   // ผีเข้า
  grave: [2, 4],     // ขุดหลุมศพ
  fate: [2, 4],      // ผูกดวง
  reverse: [2, 4],   // เดินถอยหลัง
  bottom: [2, 4],    // จั่วก้นกอง
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
 * evil = ห้องเปิด "ผีร้าย": ผีใบหนึ่งในนั้นเป็นผีร้าย (จำนวนผีรวมเท่าเดิม)
 * @returns {{ hands: {uid:string,kind:string}[][], deck: {uid:string,kind:string}[] }}
 */
function buildDeck(playerCount, rng, { extras = false, evil = false } = {}) {
  const col = playerCount >= 6 ? 1 : 0;
  let n = 0;
  const card = (kind) => ({ uid: 'c' + (++n), kind });
  const pool = [];
  const table = extras ? { ...DECK_TABLE, ...EXTRA_TABLE } : DECK_TABLE;
  for (const [kind, counts] of Object.entries(table)) {
    for (let i = 0; i < counts[col]; i++) pool.push(card(kind));
  }
  shuffle(pool, rng);
  const hands = [];
  for (let p = 0; p < playerCount; p++) {
    hands.push([card('talisman'), ...pool.splice(0, HAND_SIZE)]);
  }
  for (let i = 0; i < playerCount - 1; i++) pool.push(card(evil && i === 0 ? 'evil' : 'ghost'));
  for (let i = 0; i < SPARE_TALISMANS[col]; i++) pool.push(card('talisman'));
  shuffle(pool, rng);
  return { hands, deck: pool };
}

module.exports = { HAND_SIZE, DECK_TABLE, EXTRA_TABLE, SPARE_TALISMANS, makeRng, shuffle, buildDeck };

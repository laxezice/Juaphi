// ฉากเปิดการ์ดผีเต็มจอ: หลังการ์ดขยายกลางจอ พลิกเป็นผีพร้อมแสงแดงวาบ จอสั่น เสียง
// ถ้ามียันต์ การ์ดยันต์พุ่งเข้ามาปัดเป่า ไม่มีก็ตกรอบ ค้างไว้สักครู่แล้วหาย
import { cardFaceUrl, drawCardBack } from './cards.js';
import * as sound from './sound.js';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 250) : ms));
let backUrl = null;
let queue = Promise.resolve();

async function back() {
  if (!backUrl) backUrl = drawCardBack().then((c) => c.toDataURL('image/webp', 0.88));
  return backUrl;
}

/** who: ชื่อคนที่จั่ว ('คุณ' ถ้าเป็นเรา) saved: มียันต์ปัดเป่า */
export function revealGhost(who, saved) {
  queue = queue.then(() => run(who, saved)).catch(() => {});
  return queue;
}

async function run(who, saved) {
  const box = $('reveal');
  const card = $('reveal-card');
  const tal = $('reveal-talisman');
  const [ghostUrl, backSrc, talUrl] = await Promise.all([cardFaceUrl('ghost'), back(), cardFaceUrl('talisman')]);
  $('reveal-face').src = ghostUrl;
  $('reveal-back').src = backSrc;
  tal.querySelector('img').src = talUrl;
  $('reveal-text').textContent = '';
  $('reveal-sub').textContent = '';
  box.className = 'reveal';
  box.hidden = false;
  box.getBoundingClientRect();

  box.classList.add('in');                 // หลังการ์ดขยายขึ้นกลางจอ
  await wait(420);
  box.classList.add('flip');               // พลิกเป็นหน้าผี
  await wait(260);
  if (!saved) sound.play('ghost');         // มียันต์ ไม่ต้องหัวเราะ เดี๋ยวมีเสียง holy
  box.classList.add('scare');              // แสงแดงวาบ จอสั่น
  document.body.classList.add('shake');
  $('reveal-text').textContent = who === 'คุณ' ? 'คุณจั่วได้ผี!' : `${who} จั่วได้ผี!`;
  await wait(650);
  document.body.classList.remove('shake');
  if (saved) {
    box.classList.add('saved');            // ยันต์พุ่งเข้ามาปัดเป่า
    sound.play('talisman');
    $('reveal-sub').textContent = 'แต่ยันต์ช่วยไว้ทัน';
  } else {
    box.classList.add('dead');
    $('reveal-sub').textContent = 'โดนผีหลอก ตกรอบ!';
  }
  await wait(1500);
  box.classList.add('out');
  await wait(320);
  box.hidden = true;
  box.className = 'reveal';
}

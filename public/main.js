// จุดเริ่มของหน้าเว็บ: เปิดหน้าจอ HTML ทันที แล้วค่อยโหลดกระดาน 2D
// ระหว่างรอหรือถ้าโหลดกระดานไม่ได้ ใช้การ์ดแบบ HTML แทน
import { initUI, attachScene, sceneHooks } from './ui.js';

initUI();

try {
  const { createBoard } = await import('./board2d.js');
  const api = await createBoard(document.getElementById('board2d'), sceneHooks);
  window.__juaphi = api;   // ไว้ตรวจสอบจาก console
  attachScene(api);
} catch (err) {
  console.warn('board unavailable, using HTML hand', err);
}

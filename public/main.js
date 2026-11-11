// จุดเริ่มของหน้าเว็บ: เปิดหน้าจอ HTML ทันที แล้วค่อยโหลดกระดาน (ภาพการ์ดใหญ่ ใช้เวลาโหลด)
// กระดานมีสองแบบ: 2D (HTML ล้วน, ค่าเริ่มต้น) กับ 3D (three.js) สลับได้ในเมนู จำไว้ในเครื่อง
// ระหว่างรอหรือถ้าโหลดกระดานไม่ได้ ใช้การ์ดแบบ HTML แทน
import { initUI, attachScene, sceneHooks } from './ui.js';

const KEY = 'juaphi:board';
let mode = '2d';
try { if (localStorage.getItem(KEY) === '3d') mode = '3d'; } catch {}

initUI();

const toggle = document.getElementById('board-toggle');
toggle.textContent = mode === '2d' ? 'เปลี่ยนเป็นกระดาน 3D' : 'เปลี่ยนเป็นกระดาน 2D';
toggle.onclick = () => {
  try { localStorage.setItem(KEY, mode === '2d' ? '3d' : '2d'); } catch {}
  location.reload();
};

try {
  let api;
  if (mode === '2d') {
    document.getElementById('scene').hidden = true;
    const { createBoard } = await import('./board2d.js');
    api = await createBoard(document.getElementById('board2d'), sceneHooks);
  } else {
    const { createScene } = await import('./scene.js');
    api = await createScene(document.getElementById('scene'), sceneHooks);
  }
  window.__juaphi = api;   // ไว้ตรวจสอบจาก console
  attachScene(api);
} catch (err) {
  console.warn(`${mode} board unavailable, using HTML hand`, err);
}

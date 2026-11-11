// จุดเริ่มของหน้าเว็บ: เปิดหน้าจอ HTML ทันที แล้วค่อยโหลดฉาก 3 มิติ (ภาพการ์ดใหญ่ ใช้เวลาโหลด)
// ระหว่างรอหรือถ้าเครื่องไม่รองรับ WebGL ใช้การ์ดแบบ HTML แทน
import { initUI, attachScene, sceneHooks } from './ui.js';

initUI();
try {
  const { createScene } = await import('./scene.js');
  const api = await createScene(document.getElementById('scene'), sceneHooks);
  window.__juaphi = api;   // ไว้ตรวจสอบจาก console
  attachScene(api);
} catch (err) {
  console.warn('3D scene unavailable, using HTML hand', err);
}

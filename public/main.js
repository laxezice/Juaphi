// จุดเริ่มของหน้าเว็บ: ลองเปิดฉาก 3 มิติ ถ้าเครื่องไม่รองรับ ใช้การ์ดแบบ HTML แทน
import { initUI, sceneHooks } from './ui.js';

let sceneApi = null;
try {
  const { createScene } = await import('./scene.js');
  sceneApi = await createScene(document.getElementById('scene'), sceneHooks);
} catch (err) {
  console.warn('3D scene unavailable, using HTML hand', err);
}
initUI(sceneApi);

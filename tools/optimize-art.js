// ย่อภาพการ์ดสำหรับเว็บ: art/<id>.png (ไฟล์ต้นฉบับจาก Codex) -> public/cards/<id>.webp ขนาด 500x700
// ใช้: npm run art   (ต้องมี ffmpeg ในเครื่อง)
// ภาพต้นฉบับอยู่ใน art/ ไม่ได้ขึ้น git หน้าเว็บโหลดแค่ไฟล์ .webp ที่ย่อแล้ว
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'art');
const out = path.join(root, 'public', 'cards');
const WIDTH = 500;
const HEIGHT = 700;   // 5:7
const QUALITY = 82;

if (!fs.existsSync(src)) {
  console.log('ไม่มีโฟลเดอร์ art/ วางไฟล์ <id>.png ไว้ในนั้นก่อน');
  process.exit(1);
}
const files = fs.readdirSync(src).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!files.length) {
  console.log('ไม่มีภาพใน art/');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
let before = 0;
let after = 0;
for (const f of files) {
  const id = path.parse(f).name;
  const input = path.join(src, f);
  const output = path.join(out, `${id}.webp`);
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
    '-c:v', 'libwebp', '-quality', String(QUALITY), output,
  ]);
  // ถ้ายังมี .png ชื่อเดียวกันค้างใน public/cards ลบทิ้ง จะได้ไม่ถูกส่งขึ้นเว็บโดยไม่ตั้งใจ
  fs.rmSync(path.join(out, `${id}.png`), { force: true });
  const a = fs.statSync(input).size;
  const b = fs.statSync(output).size;
  before += a;
  after += b;
  console.log(`${id}: ${(a / 1024).toFixed(0)} KB -> ${(b / 1024).toFixed(0)} KB`);
}
console.log(`รวม ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(2)} MB`);

// ย่อภาพสำหรับเว็บ (ภาพต้นฉบับอยู่ใน art/ ไม่ได้ขึ้น git หน้าเว็บโหลดแค่ไฟล์ .webp ที่ย่อแล้ว)
//   art/<id>.png          ภาพการ์ด  -> public/cards/<id>.webp    500x700 (5:7)
//   art/buttons/<id>.png  ภาพปุ่ม   -> public/buttons/<id>.webp  256x256 พื้นโปร่งใสคงไว้
// ใช้: npm run art   (ต้องมี ffmpeg ในเครื่อง)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const IMAGE = /\.(png|jpe?g|webp)$/i;

const jobs = [
  {
    src: path.join(root, 'art'),
    out: path.join(root, 'public', 'cards'),
    vf: 'scale=500:700:force_original_aspect_ratio=increase,crop=500:700',
    quality: 82,
  },
  {
    src: path.join(root, 'art', 'buttons'),
    out: path.join(root, 'public', 'buttons'),
    // ย่อให้พอดี 256x256 แล้วเติมขอบโปร่งใส (ไม่ครอป)
    vf: 'scale=256:256:force_original_aspect_ratio=decrease,format=rgba,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
    quality: 88,
    alpha: true,
  },
];

let before = 0;
let after = 0;
let count = 0;
for (const job of jobs) {
  if (!fs.existsSync(job.src)) continue;
  const files = fs.readdirSync(job.src).filter((f) => IMAGE.test(f) && fs.statSync(path.join(job.src, f)).isFile());
  if (!files.length) continue;
  fs.mkdirSync(job.out, { recursive: true });
  for (const f of files) {
    const id = path.parse(f).name;
    const input = path.join(job.src, f);
    const output = path.join(job.out, `${id}.webp`);
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-vf', job.vf,
      '-c:v', 'libwebp', '-quality', String(job.quality), ...(job.alpha ? ['-pix_fmt', 'yuva420p'] : []), output,
    ]);
    // ถ้ายังมี .png ชื่อเดียวกันค้างใน public ลบทิ้ง จะได้ไม่ถูกส่งขึ้นเว็บโดยไม่ตั้งใจ
    fs.rmSync(path.join(job.out, `${id}.png`), { force: true });
    const a = fs.statSync(input).size;
    const b = fs.statSync(output).size;
    before += a;
    after += b;
    count++;
    console.log(`${path.relative(root, output)}: ${(a / 1024).toFixed(0)} KB -> ${(b / 1024).toFixed(0)} KB`);
  }
}
if (!count) {
  console.log('ไม่มีภาพใน art/ หรือ art/buttons/ วางไฟล์ <id>.png ไว้ก่อน');
  process.exit(1);
}
console.log(`รวม ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(2)} MB`);

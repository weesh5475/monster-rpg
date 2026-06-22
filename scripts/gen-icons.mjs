// ────────────────────────────────────────────────────────────
// PWA 앱 아이콘 생성기 (19단계, placeholder).
//   외부 이미지 없이 Node 의 zlib 로 PNG 를 직접 인코딩한다.
//   주황 배경 + 흰 캡처볼 도형. 나중에 진짜 아이콘으로 교체 예정.
//   실행: node scripts/gen-icons.mjs  → public/ 에 PNG 저장
// ────────────────────────────────────────────────────────────
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// ── PNG 인코딩 (RGB, 8bit) ──
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 3;
      const di = y * (1 + w * 3) + 1 + x * 3;
      raw[di] = rgb[si];
      raw[di + 1] = rgb[si + 1];
      raw[di + 2] = rgb[si + 2];
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── 아이콘 도형 그리기 ──
// bg 주황 + 흰 캡처볼(가운데 주황 띠 + 버튼 + 흰 점). ballF: 공 반지름 비율.
const ORANGE = [0xe8, 0x73, 0x2b];
const DARK = [0xb9, 0x57, 0x1c];
const WHITE = [0xff, 0xff, 0xff];

function drawIcon(size, ballF) {
  const rgb = new Uint8Array(size * size * 3);
  const c = size / 2;
  const R = size * ballF;
  const band = size * 0.06; // 적도 띠 반높이
  const buttonR = size * 0.11; // 가운데 버튼
  const dotR = size * 0.05; // 버튼 안 흰 점
  const put = (x, y, col) => {
    const i = (y * size + x) * 3;
    rgb[i] = col[0];
    rgb[i + 1] = col[1];
    rgb[i + 2] = col[2];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let col = ORANGE; // 배경
      if (dist <= R) col = WHITE; // 공
      if (dist <= R && dist > R - size * 0.018) col = DARK; // 공 테두리
      if (dist <= R && Math.abs(dy) <= band) col = ORANGE; // 적도 띠
      if (dist <= buttonR) col = ORANGE; // 버튼
      if (dist <= buttonR && dist > buttonR - size * 0.015) col = DARK; // 버튼 테두리
      if (dist <= dotR) col = WHITE; // 가운데 점
      put(x, y, col);
    }
  }
  return encodePNG(size, size, rgb);
}

mkdirSync(PUBLIC, { recursive: true });
const targets = [
  ['icon-192.png', 192, 0.34],
  ['icon-512.png', 512, 0.34],
  ['icon-maskable-512.png', 512, 0.26], // maskable: 여백(안전영역) 넉넉히
  ['apple-touch-icon.png', 180, 0.34],
];
for (const [name, size, ballF] of targets) {
  writeFileSync(join(PUBLIC, name), drawIcon(size, ballF));
  console.log('wrote public/' + name + ' (' + size + 'x' + size + ')');
}

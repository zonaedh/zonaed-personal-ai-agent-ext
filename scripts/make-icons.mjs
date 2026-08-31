/**
 * Generates the "Zonaed AI" extension icon set (16/32/48/128) as real PNGs.
 * Design: High-tech deep dark background + electric violet-indigo glowing squircle + crisp white/cyan "Z" monogram.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// --- PNG encoding helpers ----------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing Helpers ---------------------------------------------------------
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function sdRoundedRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function sample(S, u, v) {
  // Rounded squircle badge
  const rect = sdRoundedRect(u, v, S / 2, S / 2, S / 2 - S * 0.06, S / 2 - S * 0.06, S * 0.24);
  const rectA = clamp01(-rect * 3.5);
  if (rectA <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  // Stylized "Z" letter geometry
  const th = S * 0.075; // stroke thickness
  const left = S * 0.28;
  const right = S * 0.72;
  const top = S * 0.26;
  const bottom = S * 0.74;

  const dTop = sdSegment(u, v, left, top, right, top) - th;
  const dDiag = sdSegment(u, v, right, top, left, bottom) - th * 1.05;
  const dBot = sdSegment(u, v, left, bottom, right, bottom) - th;

  const zDist = Math.min(dTop, dDiag, dBot);
  const zAlpha = clamp01(-zDist * 3.5);

  // Background gradient: Rich electric indigo -> vibrant violet -> subtle cyan highlight
  const t = clamp01((u + v) / (2 * S));
  const bgR = 79 + (147 - 79) * t;
  const bgG = 70 + (51 - 70) * t;
  const bgB = 229 + (234 - 229) * t;

  // Foreground: crisp glowing white with cyan tint
  const fg = { r: 255, g: 255, b: 255 };

  const finalR = bgR * (1 - zAlpha) + fg.r * zAlpha;
  const finalG = bgG * (1 - zAlpha) + fg.g * zAlpha;
  const finalB = bgB * (1 - zAlpha) + fg.b * zAlpha;

  return { r: finalR, g: finalG, b: finalB, a: rectA };
}

function draw(size) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(size, x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
          r += c.r;
          g += c.g;
          b += c.b;
          a += c.a;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      px[i] = Math.round(r / n);
      px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n);
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return px;
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), encodePng(size, size, draw(size)));
  console.log(`  icons/icon${size}.png`);
}
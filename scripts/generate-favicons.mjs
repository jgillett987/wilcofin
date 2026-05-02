#!/usr/bin/env node
/**
 * Builds the full favicon set from logo-symbol-white.png composited on
 * the brand navy. Outputs:
 *   public/favicon.ico             — multi-resolution (16, 32, 48)
 *   public/favicon-16.png
 *   public/favicon-32.png
 *   public/favicon.svg             — square version (replaces the
 *                                    horizontal wordmark that was here)
 *   public/apple-touch-icon.png    — 180×180 for iOS home screens
 *   public/icon-192.png            — Android / PWA
 *   public/icon-512.png            — Android / PWA / high-DPI
 *
 * Run with:  node scripts/generate-favicons.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const SRC = path.join(PUB, 'logo-symbol-white.png');

const NAVY = '#011342';

// Padding ratio: how much margin around the symbol so it doesn't crowd
// the tile edges. Browsers shrink favicons aggressively, and a padded
// glyph stays legible at 16px.
const PAD = 0.10;

async function makeIcon(outPath, size) {
  const symbolSize = Math.round(size * (1 - PAD * 2));
  const symbolBuf = await sharp(SRC)
    .resize(symbolSize, symbolSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((size - symbolSize) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: symbolBuf, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function makeSvgFromPng(outPath, size = 256) {
  // Inline the rendered PNG inside an SVG container so the favicon link
  // pointing at /favicon.svg keeps working — but it now displays the
  // square symbol instead of the horizontal wordmark.
  const symbolSize = Math.round(size * (1 - PAD * 2));
  const symbolBuf = await sharp(SRC)
    .resize(symbolSize, symbolSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const symbolBase64 = symbolBuf.toString('base64');
  const offset = Math.round((size - symbolSize) / 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${NAVY}"/>
  <image href="data:image/png;base64,${symbolBase64}" x="${offset}" y="${offset}" width="${symbolSize}" height="${symbolSize}"/>
</svg>
`;
  await fs.writeFile(outPath, svg, 'utf8');
}

async function makeIco(outPath) {
  // Minimal ICO writer: header + entries for 16, 32, 48 each pointing at
  // their PNG payload. Modern browsers happily read PNG-encoded ICOs.
  const sizes = [16, 32, 48];
  const pngBufs = await Promise.all(
    sizes.map(async (s) => {
      const symbolSize = Math.round(s * (1 - PAD * 2));
      const symbolBuf = await sharp(SRC)
        .resize(symbolSize, symbolSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const offset = Math.round((s - symbolSize) / 2);
      return sharp({
        create: { width: s, height: s, channels: 4, background: NAVY },
      })
        .composite([{ input: symbolBuf, top: offset, left: offset }])
        .png()
        .toBuffer();
    }),
  );

  const headerSize = 6 + 16 * sizes.length;
  let dataOffset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(sizes.length, 4); // image count

  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const buf = pngBufs[i];
    const off = 6 + 16 * i;
    header.writeUInt8(s === 256 ? 0 : s, off + 0); // width (0 means 256)
    header.writeUInt8(s === 256 ? 0 : s, off + 1); // height
    header.writeUInt8(0, off + 2); // palette
    header.writeUInt8(0, off + 3); // reserved
    header.writeUInt16LE(1, off + 4); // color planes
    header.writeUInt16LE(32, off + 6); // bits per pixel
    header.writeUInt32LE(buf.length, off + 8); // image size
    header.writeUInt32LE(dataOffset, off + 12); // offset
    dataOffset += buf.length;
  }

  const ico = Buffer.concat([header, ...pngBufs]);
  await fs.writeFile(outPath, ico);
}

async function main() {
  // Confirm source exists
  await fs.access(SRC);

  await Promise.all([
    makeIcon(path.join(PUB, 'favicon-16.png'), 16),
    makeIcon(path.join(PUB, 'favicon-32.png'), 32),
    makeIcon(path.join(PUB, 'apple-touch-icon.png'), 180),
    makeIcon(path.join(PUB, 'icon-192.png'), 192),
    makeIcon(path.join(PUB, 'icon-512.png'), 512),
    makeSvgFromPng(path.join(PUB, 'favicon.svg'), 256),
    makeIco(path.join(PUB, 'favicon.ico')),
  ]);

  // Replace the legacy public/favicon.png with the 32px version so any
  // older references that point at it also get the right square icon.
  await fs.copyFile(path.join(PUB, 'favicon-32.png'), path.join(PUB, 'favicon.png'));

  const files = await fs.readdir(PUB);
  const generated = ['favicon.ico', 'favicon.png', 'favicon.svg', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
  for (const f of generated) {
    if (files.includes(f)) {
      const stat = await fs.stat(path.join(PUB, f));
      console.log(`  ${f.padEnd(28)} ${(stat.size / 1024).toFixed(1).padStart(7)} KB`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

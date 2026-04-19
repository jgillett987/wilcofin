#!/usr/bin/env node
/**
 * Generates a branded Open Graph / Twitter social preview image at
 * public/og-default.png (1200 × 630, the spec for all major platforms).
 * Composition:
 *   - Navy background with a subtle darker gradient
 *   - Wilco logo (white variant) scaled and placed center-left
 *   - Tagline rendered via SVG so it uses the site's serif font
 *
 * Run with:  node scripts/generate-og-image.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'og-default.png');
const LOGO_WHITE = path.join(ROOT, 'public', 'logo-footer.png'); // white variant
const W = 1200;
const H = 630;

const NAVY = '#011342';
const NAVY_DEEP = '#041b4d';
const GREEN = '#81c460';

const bgSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${NAVY_DEEP}"/>
      <stop offset="100%" stop-color="${NAVY}"/>
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="70%" r="55%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="${GREEN}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${GREEN}"/>
</svg>
`;

const textSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .tagline { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; fill: #ffffff; }
    .sub     { font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-weight: 400; fill: rgba(255,255,255,0.82); letter-spacing: 0.02em; }
    .eyebrow { font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-weight: 700; fill: ${GREEN}; letter-spacing: 0.18em; text-transform: uppercase; }
  </style>
  <text class="eyebrow" x="80" y="348" font-size="24">Fiduciary · Fee-Only · Tennessee</text>
  <text class="tagline" x="80" y="420" font-size="58">Plain-English financial</text>
  <text class="tagline" x="80" y="490" font-size="58">planning and investment</text>
  <text class="tagline" x="80" y="560" font-size="58">management.</text>
</svg>
`;

async function main() {
  const logoBuf = await fs.readFile(LOGO_WHITE);
  const logoResized = await sharp(logoBuf).resize({ width: 460, withoutEnlargement: false }).png().toBuffer();
  const logoMeta = await sharp(logoResized).metadata();

  const bgBuf = Buffer.from(bgSvg);
  const textBuf = Buffer.from(textSvg);

  await sharp(bgBuf)
    .composite([
      { input: logoResized, top: 100, left: 80 },
      { input: textBuf, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUT);

  const stat = await fs.stat(OUT);
  console.log(`Wrote ${OUT}`);
  console.log(`  Dimensions: ${W} × ${H}`);
  console.log(`  Logo size:  ${logoMeta.width} × ${logoMeta.height}`);
  console.log(`  File size:  ${(stat.size / 1024).toFixed(0)} KB`);
}

main().catch((err) => { console.error(err); process.exit(1); });

#!/usr/bin/env node
/**
 * One-shot image optimizer. Resizes every photo in public/images/ to
 * max 2000px wide and writes it back at JPEG quality 82. Preserves
 * aspect ratio, skips tiny/logo PNGs, reports before/after totals.
 *
 * Run with:  node scripts/optimize-images.mjs
 */

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.resolve(__dirname, '..', 'public', 'images');

// Target: web-ready. 2000px is plenty for Retina-level hero backgrounds.
const MAX_WIDTH = 2000;
const JPEG_QUALITY = 82;

// Skip anything that looks like a logo / icon / symbol — those should
// keep transparency and exact dimensions.
const SKIP = /(logo|icon|symbol|favicon|slider-arrow|og-default)/i;

// Only touch raster photos.
const RASTER = /\.(jpe?g|png|JPE?G|PNG|JPEG)$/;

const fmt = (bytes) => {
  if (bytes > 1_048_576) return (bytes / 1_048_576).toFixed(2) + ' MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
};

async function main() {
  const files = (await fs.readdir(IMAGES_DIR)).filter((f) => RASTER.test(f) && !SKIP.test(f));
  console.log(`Scanning ${files.length} images in ${IMAGES_DIR}\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let optimized = 0;
  let skipped = 0;

  for (const file of files) {
    const abs = path.join(IMAGES_DIR, file);
    const statBefore = await fs.stat(abs);
    totalBefore += statBefore.size;

    const buf = await fs.readFile(abs);
    const meta = await sharp(buf).metadata();
    const alreadySmall = statBefore.size < 400 * 1024 && (meta.width ?? 0) <= MAX_WIDTH;
    if (alreadySmall) {
      skipped++;
      totalAfter += statBefore.size;
      console.log(`   · skip   ${file.padEnd(42)}  ${fmt(statBefore.size).padStart(9)}  (already small)`);
      continue;
    }

    // Re-encode as JPEG regardless of source extension (smaller for photos,
    // and all our heroes are photographic). We write to the same filename
    // so existing references keep working.
    const pipeline = sharp(buf, { failOn: 'none' })
      .rotate() // honor EXIF orientation
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
        fit: 'inside',
      });

    const outBuf = /\.png$/i.test(file)
      // PNGs that slipped through SKIP: keep PNG but compress
      ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
      : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true }).toBuffer();

    await fs.writeFile(abs, outBuf);
    const statAfter = await fs.stat(abs);
    totalAfter += statAfter.size;
    optimized++;
    const pct = Math.round((1 - statAfter.size / statBefore.size) * 100);
    console.log(
      `   ✓ opt    ${file.padEnd(42)}  ${fmt(statBefore.size).padStart(9)}  →  ${fmt(statAfter.size).padStart(9)}  (-${pct}%)`,
    );
  }

  console.log('');
  console.log(`Before:  ${fmt(totalBefore)}`);
  console.log(`After:   ${fmt(totalAfter)}   (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`);
  console.log(`Optimized: ${optimized}   Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

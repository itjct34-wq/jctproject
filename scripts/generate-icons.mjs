/**
 * Generates app icons + PWA icons from public/images/jct-official-logo.png
 * Run: node scripts/generate-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public', 'images', 'jct-official-logo.png');

async function squarePng(size, out, { maskable = false } = {}) {
  const pad = maskable ? Math.round(size * 0.1) : Math.round(size * 0.08);
  const inner = size - pad * 2;
  const logo = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toFile(out);
}

async function main() {
  if (!fs.existsSync(src)) {
    console.error('Missing logo:', src);
    process.exit(1);
  }

  const publicDir = path.join(root, 'public');
  const appDir = path.join(root, 'app');
  fs.mkdirSync(path.join(publicDir, 'icons'), { recursive: true });

  await squarePng(512, path.join(appDir, 'icon.png'));
  await squarePng(180, path.join(appDir, 'apple-icon.png'));
  await squarePng(192, path.join(publicDir, 'icons', 'icon-192.png'));
  await squarePng(512, path.join(publicDir, 'icons', 'icon-512.png'));
  await squarePng(512, path.join(publicDir, 'icons', 'icon-maskable-512.png'), { maskable: true });

  // favicon.ico — multi-size via png rename fallback if ico unsupported; write 32png as ico-compatible
  const fav32 = await sharp(src)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  // Next serves app/icon.png; also drop a classic favicon.ico (single 32 PNG wrapped)
  await sharp(fav32).toFile(path.join(appDir, 'favicon.ico'));
  await sharp(fav32).png().toFile(path.join(publicDir, 'favicon.ico'));

  console.log('Icons generated.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

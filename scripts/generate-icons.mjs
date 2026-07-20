/**
 * Sinh icon PWA từ SVG. Chạy lại khi muốn đổi hình:
 *   node scripts/generate-icons.mjs
 *
 * Icon được commit vào repo nên bước build KHÔNG cần chạy script này.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

/** Icon thường: chữ "A" trên nền bo góc. */
function svgIcon(size, maskable) {
  // Icon maskable cần chừa vùng an toàn ~10% mỗi bên vì hệ điều hành sẽ cắt tròn.
  const pad = maskable ? size * 0.14 : 0;
  const box = size - pad * 2;
  const radius = maskable ? size * 0.5 : size * 0.22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${maskable ? "#2563eb" : "none"}" rx="${maskable ? 0 : radius}"/>
  <rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${radius}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="${box * 0.52}" font-weight="700" fill="#ffffff">A</text>
  <text x="50%" y="${size - pad - box * 0.13}" text-anchor="middle"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="${box * 0.13}" font-weight="600" fill="#dbeafe">CÔNG SỞ</text>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

await mkdir(outDir, { recursive: true });

for (const t of targets) {
  const png = await sharp(Buffer.from(svgIcon(t.size, t.maskable))).png().toBuffer();
  await writeFile(join(outDir, t.file), png);
  console.log(`✓ ${t.file} (${t.size}×${t.size})`);
}

console.log("Xong. Icon nằm ở public/icons/");

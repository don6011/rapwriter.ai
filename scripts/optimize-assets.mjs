import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const assets = [
  ["public/studio/modern-hero-v2.png", "public/studio/modern-hero-v2.webp", 1440, 80],
  ["public/studio/bedroom-dreams.png", "public/studio/bedroom-dreams.webp", 1206, 80],
  ["public/studio/penthouse-sessions.png", "public/studio/penthouse-sessions.webp", 1206, 80],
  ["public/studio/trap-house-studio.png", "public/studio/trap-house-studio.webp", 1206, 80],
  ["public/studio/blue-booth.png", "public/studio/blue-booth.webp", 1147, 80],
  ["public/studio/cypher-sessions.png", "public/studio/cypher-sessions.webp", 1206, 80],
  ["public/brand/rapwriter-main-logo.png", "public/brand/rapwriter-main-logo.webp", 900, 82],
  ["public/brand/rapwriter-logo-tight.png", "public/brand/rapwriter-logo-tight.webp", 720, 82],
  ["public/brand/rapwriter-mark.png", "public/brand/rapwriter-mark.webp", 720, 82],
];

for (const [input, output, width, quality] of assets) {
  const destination = resolve(root, output);
  await mkdir(dirname(destination), { recursive: true });
  await sharp(resolve(root, input))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toFile(destination);
}

const iconSource = resolve(root, "public/brand/rapwriter-main-logo.png");
for (const size of [180, 192, 512]) {
  await sharp(iconSource)
    .resize(size, size, { fit: "contain", background: "#070708" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(root, `public/brand/rapwriter-${size}.png`));
}

console.log(`Optimized ${assets.length} visual assets and 3 install icons.`);

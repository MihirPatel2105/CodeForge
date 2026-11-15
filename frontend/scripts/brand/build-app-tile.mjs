// Build the app tile: the slab icon in ivory on a near-black rounded square.
// Usage (from frontend/): node scripts/brand/build-app-tile.mjs icon.svg outDir [appDir]
// Writes outDir/app-tile.svg and PNGs at 512/180/64/32/16. With appDir (app/), also writes the
// Next.js icon files: icon.svg, icon.png (512), apple-icon.png (180, square: iOS rounds it
// itself) and favicon.ico (16/32/48/64).
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const TILE = 1024, RADIUS = 0.225 * TILE, ICON_SHARE = 0.6; // icon width as a share of the tile
const INK = "#f5f3ee", GROUND = "#141413";
const ICO_SIZES = [16, 32, 48, 64];
const [iconPath, outDir, appDir] = process.argv.slice(2);
const icon = await readFile(iconPath, "utf8");
const [, w, h] = icon.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
const scale = (TILE * ICON_SHARE) / Math.max(w, h);
const dx = (TILE - w * scale) / 2, dy = (TILE - h * scale) / 2;
const paths = (icon.match(/<path[^>]*\/>/g) ?? []).join("").replaceAll("#000", INK);
// Fail loudly rather than ship dark slabs on the dark tile, which would be an invisible icon.
if (!paths || /#000\b|#000000|black|rgb\(/i.test(paths)) throw new Error(`could not recolour ${iconPath} to ${INK}`);
const tileSvg = (radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}"><rect width="${TILE}" height="${TILE}" rx="${radius}" fill="${GROUND}"/><g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(5)})">${paths}</g></svg>\n`;
const rounded = tileSvg(RADIUS);
const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// An ICO is a directory of images; modern browsers accept PNG entries directly.
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size % 256, at); header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8); header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

await writeFile(`${outDir}/app-tile.svg`, rounded);
for (const size of [512, 180, 64, 32, 16]) await writeFile(`${outDir}/app-tile-${size}.png`, await png(rounded, size));
if (appDir) {
  await writeFile(`${appDir}/icon.svg`, rounded);
  await writeFile(`${appDir}/icon.png`, await png(rounded, 512));
  await writeFile(`${appDir}/apple-icon.png`, await png(tileSvg(0), 180));
  await writeFile(`${appDir}/favicon.ico`, ico(await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await png(rounded, size) })))));
}
console.log(`app tile written to ${outDir}${appDir ? ` and icon files to ${appDir}` : ""}`);

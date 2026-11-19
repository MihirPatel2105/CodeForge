// Build the CodeForge lockup SVGs: the slab icon beside a vector wordmark (wordmark*.py output).
//
// By default the icon is cut pixel-for-pixel from the supplied v2 lockups (their left 24%). The live
// logo (v5) passes the redrawn vector icon instead, so the whole lockup is vector.
//
// Usage (from frontend/):
//   node scripts/brand/build-lockup.mjs wordmark.json [name] [icon.svg]
// With icon.svg (e.g. from scripts/brand/vectorize-icon.mjs) the icon is inlined as vector paths
// in each ink instead of the PNG crop, making the whole lockup vector.
// Writes public/brand/codeforge-lockup-{light,dark}-<name>.svg (name defaults to v3, the live
// logo) and prints the icon/word split. Pass another name to build a candidate alongside it.

import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const RIGHT_MARGIN = 12; // the supplied lockup leaves 12px after the last letter
const VARIANTS = [
  { name: "light", ink: "#000", source: "public/brand/codeforge-lockup-light-v2.png" },
  { name: "dark", ink: "#fff", source: "public/brand/codeforge-lockup-dark-v2.png" },
];

const word = JSON.parse(await readFile(process.argv[2], "utf8"));
const height = word.box;
const iconWidth = Math.round(word.iconBoxWidth); // 438px crop of the supplied image
const width = Math.ceil(word.inkRight + RIGHT_MARGIN);

const iconSvg = process.argv[4] ? await readFile(process.argv[4], "utf8") : null;

for (const variant of VARIANTS) {
  const icon = await sharp(variant.source)
    .extract({ left: 0, top: 0, width: iconWidth, height })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<title>CodeForge</title>`,
    iconSvg
      ? (iconSvg.match(/<path[^>]*\/>/g) ?? []).join("").replaceAll("#000", variant.ink)
      : `<image href="data:image/png;base64,${icon.toString("base64")}" x="0" y="0" width="${iconWidth}" height="${height}"/>`,
    `<path fill="${variant.ink}" d="${word.d}"/>`,
    `</svg>`,
  ].join("");
  const out = `public/brand/codeforge-lockup-${variant.name}-${process.argv[3] ?? "v3"}.svg`;
  await writeFile(out, svg + "\n");
  console.log(`${out}: ${width}x${height}, ${(svg.length / 1024).toFixed(1)} KB`);
}

const split = (iconWidth / width) * 100;
console.log(JSON.stringify({ width, height, iconWidth, iconPercent: +split.toFixed(4), wordPercent: +(100 - split).toFixed(4) }));

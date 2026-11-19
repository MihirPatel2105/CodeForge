// Build the CodeForge lockup SVGs: the slab icon beside a vector wordmark (wordmark*.py output).
//
// The icon is inlined as vector paths in each ink, so the whole lockup is vector. (An earlier
// version cut the icon out of the supplied v2 PNG lockups; those PNGs have been retired.)
//
// Usage (from frontend/):
//   node scripts/brand/build-lockup.mjs wordmark.json <name> icon.svg
// icon.svg comes from scripts/brand/vectorize-icon.mjs (or the live icon, e.g. app/icon1.svg).
// Writes public/brand/codeforge-lockup-{light,dark}-<name>.svg (name defaults to v3, the live
// logo) and prints the icon/word split. Pass another name to build a candidate alongside it.

import { readFile, writeFile } from "node:fs/promises";

const RIGHT_MARGIN = 12; // the lockup leaves 12px after the last letter
const VARIANTS = [
  { name: "light", ink: "#000" },
  { name: "dark", ink: "#fff" },
];

if (process.argv.length < 5) {
  console.error("usage: node scripts/brand/build-lockup.mjs wordmark.json <name> icon.svg");
  process.exit(1);
}

const word = JSON.parse(await readFile(process.argv[2], "utf8"));
const height = word.box;
const iconWidth = Math.round(word.iconBoxWidth); // width of the icon box (438px)
const width = Math.ceil(word.inkRight + RIGHT_MARGIN);

const iconSvg = await readFile(process.argv[4], "utf8");

for (const variant of VARIANTS) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<title>CodeForge</title>`,
    (iconSvg.match(/<path[^>]*\/>/g) ?? []).join("").replaceAll("#000", variant.ink),
    `<path fill="${variant.ink}" d="${word.d}"/>`,
    `</svg>`,
  ].join("");
  const out = `public/brand/codeforge-lockup-${variant.name}-${process.argv[3]}.svg`;
  await writeFile(out, svg + "\n");
  console.log(`${out}: ${width}x${height}, ${(svg.length / 1024).toFixed(1)} KB`);
}

const split = (iconWidth / width) * 100;
console.log(JSON.stringify({ width, height, iconWidth, iconPercent: +split.toFixed(4), wordPercent: +(100 - split).toFixed(4) }));

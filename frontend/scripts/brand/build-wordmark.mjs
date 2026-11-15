// Build the standalone CodeForge wordmark SVG (no icon), cropped to its ink, for places that
// show the word on its own (the footer). Outlines only: no font file is shipped to the site.
//
// Usage (from frontend/):
//   node scripts/brand/build-wordmark.mjs wordmark.json v4
// wordmark.json comes from scripts/brand/wordmark-roundex.py. Writes
// public/brand/codeforge-wordmark-<name>.svg, filled black so it can be used as a CSS mask.

import { readFile, writeFile } from "node:fs/promises";

const word = JSON.parse(await readFile(process.argv[2], "utf8"));
const name = process.argv[3] ?? "v4";
const x = Math.floor(word.inkLeft);
const y = Math.floor(word.inkTop);
const width = Math.ceil(word.inkRight) - x;
const height = Math.ceil(word.inkBottom) - y;

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}">`,
  `<title>CodeForge</title>`,
  `<path fill="#000" d="${word.d}"/>`,
  `</svg>`,
].join("");
const out = `public/brand/codeforge-wordmark-${name}.svg`;
await writeFile(out, svg + "\n");
console.log(JSON.stringify({ out, width, height, ratio: +(width / height).toFixed(4) }));

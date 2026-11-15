// Trace the supplied icon, snap edges to isometric angles, rebuild with uniform corner radius.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
const [src, outDir] = process.argv.slice(2);
const W = 438, H = 447;
const { data } = await sharp(src).extract({ left: 0, top: 0, width: W, height: H }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 128;
// Connected components.
const label = new Int32Array(W * H).fill(-1); const comps = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!on(x, y) || label[y * W + x] >= 0) continue;
  const id = comps.length, stack = [[x, y]]; let n = 0; label[y * W + x] = id;
  while (stack.length) { const [cx, cy] = stack.pop(); n++;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = cx+dx, ny = cy+dy;
      if (on(nx, ny) && label[ny*W+nx] < 0) { label[ny*W+nx] = id; stack.push([nx, ny]); } } }
  comps.push({ id, n, sx: x, sy: y });
}
const slabs = comps.filter(c => c.n > 500);
// Moore-neighbour boundary trace.
function trace(c) {
  const inC = (x, y) => on(x, y) && label[y*W+x] === c.id;
  const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const pts = []; let x = c.sx, y = c.sy, d = 6, guard = 0;
  do { pts.push([x + 0.5, y + 0.5]);
    let found = false;
    for (let i = 0; i < 8; i++) { const nd = (d + 6 + i) % 8; const [dx, dy] = dirs[nd];
      if (inC(x+dx, y+dy)) { x += dx; y += dy; d = nd; found = true; break; } }
    if (!found) break;
  } while ((x !== c.sx || y !== c.sy) && ++guard < 20000);
  return pts;
}
function rdp(p, eps) { if (p.length < 3) return p; const [a, b] = [p[0], p[p.length-1]];
  let idx = 0, max = 0; for (let i = 1; i < p.length-1; i++) { const d = Math.abs((b[0]-a[0])*(a[1]-p[i][1]) - (a[0]-p[i][0])*(b[1]-a[1])) / Math.hypot(b[0]-a[0], b[1]-a[1]) || 0; if (d > max) { max = d; idx = i; } }
  return max > eps ? [...rdp(p.slice(0, idx+1), eps).slice(0, -1), ...rdp(p.slice(idx), eps)] : [a, b]; }
const ANG = [30, 150, 90].map(a => a * Math.PI / 180);
const snapDir = (dx, dy) => { let t = Math.atan2(dy, dx); if (t < 0) t += Math.PI; if (t >= Math.PI) t -= Math.PI;
  let best = ANG[0], bd = 9; for (const a of ANG) { const dd = Math.min(Math.abs(t-a), Math.PI - Math.abs(t-a)); if (dd < bd) { bd = dd; best = a; } } return best; };
const inter = (l1, l2) => { const [p, a] = l1, [q, b] = l2; const d1 = [Math.cos(a), Math.sin(a)], d2 = [Math.cos(b), Math.sin(b)];
  const den = d1[0]*d2[1] - d1[1]*d2[0]; if (Math.abs(den) < 1e-9) return null; const t = ((q[0]-p[0])*d2[1] - (q[1]-p[1])*d2[0]) / den; return [p[0]+t*d1[0], p[1]+t*d1[1]]; };
function polygonFor(c) {
  let poly = rdp(trace(c), 3.2); if (poly.length > 1 && poly[0][0] === poly.at(-1)[0] && poly[0][1] === poly.at(-1)[1]) poly.pop();
  // Lines through each edge's midpoint at its snapped angle; merge parallel neighbours.
  let lines = poly.map((p, i) => { const q = poly[(i+1) % poly.length]; return [[(p[0]+q[0])/2, (p[1]+q[1])/2], snapDir(q[0]-p[0], q[1]-p[1]), Math.hypot(q[0]-p[0], q[1]-p[1])]; });
  for (let changed = true; changed;) { changed = false;
    for (let i = 0; i < lines.length && lines.length > 3; i++) { const j = (i+1) % lines.length;
      if (lines[i][1] === lines[j][1]) { const wsum = lines[i][2] + lines[j][2];
        lines[i] = [[(lines[i][0][0]*lines[i][2] + lines[j][0][0]*lines[j][2]) / wsum, (lines[i][0][1]*lines[i][2] + lines[j][0][1]*lines[j][2]) / wsum], lines[i][1], wsum];
        lines.splice(j, 1); changed = true; break; } } }
  // Rounded corners trace as tiny chamfer edges; drop them so each slab is rebuilt from its
  // real sides only (the neighbours' intersection restores the corner), then merge again.
  for (let dropped = true; dropped;) { dropped = false;
    const i = lines.findIndex(l => l[2] < 18);
    if (i >= 0 && lines.length > 4) { lines.splice(i, 1); dropped = true;
      for (let k = 0; k < lines.length && lines.length > 3; k++) { const j = (k + 1) % lines.length;
        if (lines[k][1] === lines[j][1]) { const ws = lines[k][2] + lines[j][2];
          lines[k] = [[(lines[k][0][0]*lines[k][2] + lines[j][0][0]*lines[j][2]) / ws, (lines[k][0][1]*lines[k][2] + lines[j][0][1]*lines[j][2]) / ws], lines[k][1], ws];
          lines.splice(j, 1); k = -1; } } } }
  return lines;
}
const vertices = lines => lines.map((l, i) => inter(lines[(i - 1 + lines.length) % lines.length], l));
// Move every line inward by `by` (positive shrinks), then intersect again.
function offset(lines, by) { const v = vertices(lines);
  return lines.map(([p, a, w]) => { const n = [-Math.sin(a), Math.cos(a)];
    const mid = p; const probe = [mid[0] + n[0]*0.5, mid[1] + n[1]*0.5];
    // Choose the normal pointing into the polygon via winding at the probe.
    const inside = pip(probe, v); const s = inside ? 1 : -1; return [[p[0] + n[0]*by*s, p[1] + n[1]*by*s], a, w]; }); }
function pip([x, y], v) { let c = false; for (let i = 0, j = v.length-1; i < v.length; j = i++) { const [xi, yi] = v[i], [xj, yj] = v[j]; if ((yi > y) !== (yj > y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) c = !c; } return c; }
const shapes = slabs.map(polygonFor);
const f = n => +n.toFixed(2);
const pathOf = v => "M" + v.map(p => `${f(p[0])} ${f(p[1])}`).join("L") + "Z";
function svg(body, extra = "") { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"${extra}>${body}</svg>\n`; }
// Filled, uniformly rounded: shrink by r, then fill + stroke 2r with round joins.
function filled(r, gapExtra = 0) { return svg(shapes.map(l => { const v = vertices(offset(l, r + gapExtra)); const d = pathOf(v);
  return `<path d="${d}" fill="#000" stroke="#000" stroke-width="${2*r}" stroke-linejoin="round"/>`; }).join("")); }
// Report geometry so the redraw can be checked.
const report = shapes.map((l, i) => ({ slab: i, edges: l.length, angles: [...new Set(l.map(x => Math.round(x[1]*180/Math.PI)))] }));
console.log(JSON.stringify({ slabs: slabs.length, report }));
const R_ORIGINAL = 9, R_ROUNDEX = 22, STROKE_ROUNDEX = 25;
writeFileSync(`${outDir}/icon-a-clean.svg`, filled(R_ORIGINAL));
writeFileSync(`${outDir}/icon-b-round.svg`, filled(R_ROUNDEX));
writeFileSync(`${outDir}/icon-b-line.svg`, (() => svg(shapes.map(l => { const v = vertices(offset(l, STROKE_ROUNDEX/2)); return `<path d="${pathOf(v)}" fill="none" stroke="#000" stroke-width="${STROKE_ROUNDEX}" stroke-linejoin="round" stroke-linecap="round"/>`; }).join("")))());
writeFileSync(`${outDir}/icon-c-small.svg`, filled(R_ROUNDEX, 7));

// Optical refinement: a slab's visual weight is its thickness (area / longest side). Each slab
// below the average weight grows part of the way toward it, capped so no gap closes, and the
// silhouette stays the same mark. Writes the refined icon plus per-slab paths for the
// assemble animation.
const area = v => Math.abs(v.reduce((s, p, i) => { const q = v[(i + 1) % v.length]; return s + p[0]*q[1] - q[0]*p[1]; }, 0)) / 2;
const longest = v => Math.max(...v.map((p, i) => { const q = v[(i + 1) % v.length]; return Math.hypot(q[0]-p[0], q[1]-p[1]); }));
const thickness = l => { const v = vertices(offset(l, R_ROUNDEX)); return area(v) / longest(v); };
const weights = shapes.map(thickness);
const WEIGHT_PULL = 0.5, MAX_SHIFT = 5;
const meanWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
// Grow only: slimming the hooked top slab folds its short inner edge into a notch.
const shift = weights.map(w => Math.max(0, Math.min(MAX_SHIFT, (meanWeight - w) / 2 * WEIGHT_PULL)));
const refinedPaths = shapes.map((l, i) => pathOf(vertices(offset(l, R_ROUNDEX - shift[i]))));
const refinedBody = refinedPaths.map(d => `<path d="${d}" fill="#000" stroke="#000" stroke-width="${2*R_ROUNDEX}" stroke-linejoin="round"/>`).join("");
writeFileSync(`${outDir}/icon-refined.svg`, svg(refinedBody));
writeFileSync(`${outDir}/icon-refined.json`, JSON.stringify({ width: W, height: H, radius: R_ROUNDEX, slabs: refinedPaths.map((d, i) => ({ d, centre: vertices(shapes[i]).reduce((c, p, _, a) => [c[0] + p[0]/a.length, c[1] + p[1]/a.length], [0, 0]).map(f) })) }, null, 1) + "\n");
console.log(JSON.stringify({ weightsBefore: weights.map(f), shift: shift.map(f) }));

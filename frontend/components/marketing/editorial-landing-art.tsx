/**
 * Small single-weight line drawings for the landing page's centred section heads. They are drawn
 * for CodeForge (see docs/design/ANTHROPIC_DESIGN.md §6): an ink outline with one warm-grey fill.
 */

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Six stages on a line, with the review path curving back to the Coder. */
export function StagesArt() {
  return (
    <svg className="el-art el-art-wide" viewBox="0 0 120 52" aria-hidden>
      <path {...STROKE} d="M10 24h100" />
      {[10, 30, 50, 70, 90, 110].map(x => <circle key={x} cx={x} cy={24} r={6} fill={x === 50 ? "var(--el-art-fill)" : "var(--surface)"} stroke="currentColor" strokeWidth={2} />)}
      <path {...STROKE} d="M70 31c0 18-20 18-20 4" strokeDasharray="3 5" />
      <path {...STROKE} d="M46 38l4-4 4 4" />
    </svg>
  );
}

/** A page whose feedback loops back into it: a return arrow leaves the top edge, curves round and
 * points back into the page. Review, repair, recheck. */
export function LoopArt() {
  return (
    <svg className="el-art" viewBox="0 0 104 72" aria-hidden>
      <rect x="22" y="8" width="44" height="56" rx="4" fill="var(--el-art-fill)" stroke="currentColor" strokeWidth={2} />
      <path {...STROKE} d="M31 22h26M31 31h18M31 40h22" />
      {/* Ends travelling left, so the head opens to the right and points into the page. */}
      <path {...STROKE} d="M70 18c26 0 26 36 2 36" />
      <path {...STROKE} d="M79 47l-7 7 7 7" />
    </svg>
  );
}

/** A terminal window with a prompt waiting: where every build starts. */
export function PromptArt() {
  return (
    <svg className="el-art" viewBox="0 0 104 72" aria-hidden>
      <rect x="10" y="10" width="84" height="54" rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth={2} />
      <path {...STROKE} d="M10 22h84" />
      <circle cx="19" cy="16" r="1.6" fill="currentColor" />
      <circle cx="26" cy="16" r="1.6" fill="currentColor" />
      <path {...STROKE} d="M22 36l7 6-7 6" />
      <rect x="35" y="45" width="34" height="5" rx="2.5" fill="var(--el-art-fill)" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

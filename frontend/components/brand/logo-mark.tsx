import { cn } from "@/lib/utils";

/**
 * The CodeForge mark: a C, open on the right, with a centre dot for the Coder — the
 * stage every returned finding comes back to.
 *
 * Cut deliberately down to two shapes. An earlier version added a small violet "loop"
 * stroke curling into the gap, meant to stand for the review/test feedback edge. It
 * never survived contact with a real renderer: three separate rebuilds of that one
 * piece each shipped a different bug (a wrong corner-angle convention, an arc sweeping
 * the long way round, then a hand-rolled email rasteriser that produced a visibly
 * "toothed" ring no one caught before it went out). A mark's job is to be unmistakable
 * at a glance — every added stroke is another way to fail that job, and the loop
 * stroke kept costing more than it added. The C and the dot carry the idea on their
 * own: open, and something at the centre still to return to.
 *
 * Colours are the product's own tokens, not fixed hex: `--fg`/`--surface` swap roles
 * under `.cf-invert` exactly like the tile it replaces.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="CodeForge"
    >
      <rect x="1" y="1" width="30" height="30" rx="4" style={{ fill: "var(--fg)" }} />
      <path
        d="M 25 13 L 25 10.2 A 3.2 3.2 0 0 1 21.8 7 L 10.2 7 A 3.2 3.2 0 0 1 7 10.2 L 7 21.8 A 3.2 3.2 0 0 1 10.2 25 L 21.8 25 A 3.2 3.2 0 0 1 25 21.8 L 25 19"
        fill="none"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: "var(--surface)" }}
      />
      <circle cx="16" cy="16" r="2.1" style={{ fill: "var(--surface)" }} />
    </svg>
  );
}

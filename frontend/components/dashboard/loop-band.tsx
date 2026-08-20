import { cn } from "@/lib/utils";
import type { LoopTrigger } from "@/lib/types";

/**
 * The return-arc band under the pipeline strip (design_handoff/README.md "The loop
 * moment"). Card centres as a percentage of the strip's width — 41.4% / 58.6% / 92.9%
 * for Coder / Reviewer / Sandbox — computed by the designer against the six-card,
 * five-30px-arrow flex layout. Kept in sync with that layout in pipeline-strip.tsx.
 */

const CODER_X = 41.4;
const REVIEWER_X = 58.6;
const SANDBOX_X = 92.9;

export interface LoopBandProps {
  /** True only during the transient firing window; see pipeline-strip.tsx. */
  firing: boolean;
  trigger: LoopTrigger | null;
  /** "2 blocking findings" / "3 failing tests" — the payload the chip carries. */
  chipText: string | null;
}

export function LoopBand({ firing, trigger, chipText }: LoopBandProps) {
  const reviewerFiring = firing && trigger === "reviewer";
  // A "tester" trigger is visualised on the Sandbox arc: Tester writes the tests,
  // Sandbox is where they actually run and where the failure is detected.
  const sandboxFiring = firing && trigger === "tester";
  const chipOriginX = trigger === "reviewer" ? REVIEWER_X : SANDBOX_X;

  return (
    <div className="relative h-[66px] w-full">
      <svg
        viewBox="0 0 1200 66"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <path
          d="M 702.9 0 C 702.9 34 497.2 34 497.2 2"
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeWidth={reviewerFiring ? 3 : 1.5}
          strokeDasharray={reviewerFiring ? "18 10" : "5 5"}
          strokeLinecap="round"
          className={
            reviewerFiring
              ? "stroke-loop motion-safe:animate-[cfDash_0.9s_linear_infinite]"
              : "stroke-border-strong"
          }
        />
        <path
          d="M 1114.3 0 C 1114.3 56 497.2 56 497.2 2"
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeWidth={sandboxFiring ? 3 : 1.5}
          strokeDasharray={sandboxFiring ? "18 10" : "5 5"}
          strokeLinecap="round"
          className={
            sandboxFiring
              ? "stroke-loop motion-safe:animate-[cfDash_0.9s_linear_infinite]"
              : "stroke-border-strong"
          }
        />
        {firing && (
          // Chevron arrowhead landing on the Coder — 497.2 matches both arcs' endpoint
          // exactly (not derived from CODER_X, whose rounding would be a hair off).
          <polygon points="-5,-4 5,0 -5,4" transform="translate(497.2, 2)" className="fill-loop" />
        )}
      </svg>

      <span
        className={cn(
          "absolute top-[50px] -translate-x-1/2 text-[11px] font-bold tracking-[0.07em] uppercase",
          "transition-colors duration-300",
          firing ? "text-loop" : "text-fg-faint",
        )}
        style={{ left: `${CODER_X}%` }}
      >
        Back to the Coder
      </span>

      {firing && chipText && trigger && (
        <span
          // Keyed on the loop's identity so React remounts (never reuses) the chip on
          // every firing, which is what makes the CSS animation replay from its start.
          key={`${trigger}-${chipText}`}
          className={cn(
            "absolute -translate-x-1/2 rounded-full bg-loop px-[13px] py-[5px]",
            "text-[13.5px] font-[650] whitespace-nowrap text-surface",
            "shadow-[0_6px_18px_rgba(109,40,217,.35)]",
            trigger === "reviewer"
              ? "motion-safe:animate-[cfChipRev_1.6s_cubic-bezier(.5,0,.4,1)_forwards]"
              : "motion-safe:animate-[cfChipSbx_1.6s_cubic-bezier(.5,0,.4,1)_forwards]",
          )}
          style={{ left: `${chipOriginX}%`, top: 0 }}
        >
          ⟳ {chipText}
        </span>
      )}
    </div>
  );
}

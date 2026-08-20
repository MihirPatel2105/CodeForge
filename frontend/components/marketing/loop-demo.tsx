"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";

/**
 * The loop, shown rather than asserted.
 *
 * A four-beat cycle taken from the recorded run in docs/UI_BRIEF.md §4.2: the Reviewer
 * finds a real blocking defect (the ObjectId/response-model mistake CLAUDE.md §8 names
 * as the #1 predicted failure mode), the work travels back to the Coder, the Coder
 * rewrites the file, and the second review passes.
 *
 * `--loop` is spent only on the return arc and the LOOP line, per the reservation
 * documented in globals.css — that discipline is what makes the moment read.
 */

const STAGES = ["Coder", "Reviewer"] as const;

type Beat = {
  /** Which stage is active, as an index into STAGES. */
  active: 0 | 1;
  firing: boolean;
  label: string;
  detail: string;
  tone: "plain" | "blocking" | "loop" | "pass";
};

const BEATS: Beat[] = [
  {
    active: 1,
    firing: false,
    label: "Reviewer",
    detail: "DELETE /books/{id} returns the Document directly — ObjectId is not serialisable",
    tone: "blocking",
  },
  {
    active: 1,
    firing: true,
    label: "⟳ LOOP",
    detail: "Iteration 1 — sending 2 blocking findings back to the Coder",
    tone: "loop",
  },
  {
    active: 0,
    firing: false,
    label: "Coder",
    detail: "Rewrote main.py — added BookResponse to the DELETE route",
    tone: "plain",
  },
  {
    active: 1,
    firing: false,
    label: "Reviewer",
    detail: "1 finding, 0 blocking — passed",
    tone: "pass",
  },
];

const TONE: Record<Beat["tone"], string> = {
  plain: "text-fg-muted",
  blocking: "text-danger",
  loop: "font-[700] text-loop",
  pass: "font-[650] text-ok",
};

export function LoopDemo() {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const last = beat === BEATS.length - 1;
    const timer = setTimeout(() => setBeat((b) => (b + 1) % BEATS.length), last ? 2600 : 1900);
    return () => clearTimeout(timer);
  }, [beat]);

  const current = BEATS[beat];

  return (
    <div className="rounded-[4px] border border-border bg-surface p-6 sm:p-8">
      <div className="relative mx-auto flex max-w-[420px] items-center justify-between gap-4">
        {STAGES.map((stage, i) => (
          <div
            key={stage}
            className={cn(
              "flex-1 rounded-[3px] border px-4 py-[14px] text-center transition-colors duration-300",
              current.active === i
                ? "border-accent-bd bg-accent-soft"
                : "border-border bg-bg",
            )}
          >
            <span
              className={cn(
                typeScale.cardTitle,
                current.active === i ? "text-accent" : "text-fg-faint",
              )}
            >
              {stage}
            </span>
          </div>
        ))}

        {/* Forward arrow, dimmed while the loop is firing so the eye follows the
            return path instead. */}
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[15px] transition-opacity duration-300",
            current.firing ? "opacity-20" : "opacity-100 text-fg-faint",
          )}
        >
          →
        </span>
      </div>

      {/* The return arc: Reviewer back to Coder. */}
      <div className="relative mx-auto mt-1 h-[42px] max-w-[420px]">
        <svg
          viewBox="0 0 420 42"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden
        >
          <path
            d="M 330 0 C 330 34, 90 34, 90 0"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="7 7"
            className={cn(
              "transition-[stroke] duration-300",
              current.firing
                ? "stroke-[var(--loop)] motion-safe:animate-[cfDash_.9s_linear_infinite]"
                : "stroke-[var(--border-strong)]",
            )}
          />
        </svg>
        <span
          className={cn(
            "absolute left-1/2 top-[26px] -translate-x-1/2 whitespace-nowrap rounded-full border px-[10px] py-[3px] text-[11.5px] font-[700] transition-colors duration-300",
            current.firing
              ? "border-loop-bd bg-loop-soft text-loop motion-safe:animate-[cfPop_.34s_ease-out]"
              : "border-border bg-bg text-fg-faint",
          )}
        >
          back to the Coder
        </span>
      </div>

      {/* The line the timeline would show at this beat. */}
      <div className="mt-8 rounded-[3px] border border-border bg-bg px-4 py-[14px]">
        <div className="flex items-baseline gap-[10px]">
          <span
            className={cn(
              "shrink-0 text-[11px] font-[700] uppercase tracking-[0.04em]",
              current.tone === "loop" ? "text-loop" : "text-fg-faint",
            )}
          >
            {current.label}
          </span>
        </div>
        <p
          key={beat}
          className={cn(
            "mt-[5px] text-[14px] leading-[1.45] motion-safe:animate-[cfFade_.28s_ease-out]",
            TONE[current.tone],
          )}
        >
          {current.detail}
        </p>
      </div>
    </div>
  );
}

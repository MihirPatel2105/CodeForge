"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A minimal moving illustration of the pipeline for the hero.
 *
 * Two lines and a rail — the stage currently lit, what that stage does, and how far
 * through the six it sits. Deliberately not a second copy of the auth panel's replayed
 * log: that one carries a whole run's messages, this one just keeps the fold alive.
 *
 * The eyebrow says "the pipeline", not "live": nothing here is streaming from a real
 * run, and labelling a loop of six names as live data would be a lie told for effect.
 */

const STAGES = [
  { name: "pm", job: "turns the request into structured requirements" },
  { name: "architect", job: "designs the endpoints and data models" },
  { name: "coder", job: "writes the application code" },
  { name: "reviewer", job: "checks the code against a fixed checklist" },
  { name: "tester", job: "writes the test suite" },
  { name: "sandbox", job: "runs the code and its tests for real" },
] as const;

export function HeroPulse({ label }: { label: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const last = i === STAGES.length - 1;
    // Holds a beat on the sandbox: it is the stage that produces the result.
    const timer = setTimeout(() => setI((n) => (n + 1) % STAGES.length), last ? 2600 : 1500);
    return () => clearTimeout(timer);
  }, [i]);

  const stage = STAGES[i];
  const done = i === STAGES.length - 1;

  return (
    <div>
      <span className={label}>the pipeline</span>

      <div className="mt-5 flex items-baseline gap-[10px]">
        <span
          aria-hidden
          className={cn(
            "h-[6px] w-[6px] shrink-0 translate-y-[-2px] rounded-full transition-colors duration-300",
            done ? "bg-ok" : "bg-fg",
          )}
        />
        <span
          key={stage.name}
          className={cn(
            "font-mono text-[15px] font-[600] tracking-[-0.02em] motion-safe:animate-[cfFade_.3s_ease-out]",
            done ? "text-ok" : "text-fg",
          )}
        >
          {stage.name}
        </span>
      </div>

      <p
        key={`${stage.name}-job`}
        className="mt-[6px] min-h-[42px] text-[13.5px] leading-[1.5] text-fg-muted motion-safe:animate-[cfFade_.3s_ease-out]"
      >
        {stage.job}
      </p>

      {/* Six ticks rather than a bar: the pipeline has a countable number of stages,
          and showing them as discrete steps says so. */}
      <div className="mt-5 flex gap-[4px]" aria-hidden>
        {STAGES.map((s, n) => (
          <span
            key={s.name}
            className={cn(
              "h-[2px] flex-1 transition-colors duration-300",
              n <= i ? (done ? "bg-ok" : "bg-fg") : "bg-border-strong",
            )}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Tooltip } from "@base-ui/react/tooltip";
import { formatWhen } from "@/lib/format";
import { OUTCOME_FILL } from "@/lib/run-stats";
import { displayStatus } from "@/lib/tone";
import type { RunSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BARS = 14;

/**
 * One bar per recent run, oldest on the left. Each bar opens its run and names it in a
 * tooltip on hover. The bars are a pointer shortcut and stay out of the tab order: a
 * row would otherwise cost fourteen extra Tab presses, and the summary below gives
 * keyboard and screen-reader users the same picture in one sentence.
 */
export function ProjectHeartbeat({ runs, className }: { runs: RunSummary[]; className?: string }) {
  const bars = runs.slice(0, MAX_BARS).reverse();
  if (!bars.length) {
    return <span className={cn("font-mono text-[11.5px] text-fg-faint", className)}>No runs yet</span>;
  }
  const passed = bars.filter((run) => run.status === "succeeded").length;
  return (
    <Tooltip.Provider delay={120} closeDelay={60}>
      <span className={cn("cf-heartbeat relative z-10 inline-flex h-5 items-end gap-[3px]", className)}>
        <span className="sr-only">{`Last ${bars.length} ${bars.length === 1 ? "run" : "runs"}: ${passed} passed`}</span>
        {bars.map((run) => (
          <Tooltip.Root key={run.id}>
            <Tooltip.Trigger
              render={<Link href={`/runs/${run.id}`} tabIndex={-1} aria-hidden="true" />}
              className={cn(
                "cf-heartbeat-bar block h-4 w-[7px] rounded-[2px] transition-[height] duration-150 hover:h-5",
                OUTCOME_FILL[run.status] ?? "bg-border-strong",
                run.status === "running" && "motion-safe:animate-pulse",
              )}
              data-status={run.status}
            />
            <Tooltip.Portal>
              {/* Its own layer above the cards: the bars and "more actions" button are positioned at
                  z-index 10, and without this they painted over the tip where rows overlap. */}
              <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={12} className="isolate z-50">
                <Tooltip.Popup className="cf-heartbeat-tip max-w-[260px] rounded-xl border border-border bg-surface px-3 py-2 text-[12px] shadow-[0_12px_32px_rgba(22,24,28,0.14)]">
                  <span className="block font-[650] text-fg">{displayStatus(run.status, null).label}</span>
                  <span className="mt-0.5 line-clamp-2 block text-fg-muted">{run.prompt}</span>
                  <time dateTime={run.created_at} className="mt-1 block font-mono text-[11px] text-fg-faint">
                    {formatWhen(run.created_at)}
                  </time>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </span>
    </Tooltip.Provider>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import { TimelineEntry, type TimelineEntryData } from "./timeline-entry";

export interface TimelinePanelProps {
  entries: TimelineEntryData[];
  /** The live SSE connection state — not derivable from the event log itself, so the
   * real Live Run screen supplies it from its EventSource, not from the reducer. */
  connectionLost?: { attempt: number; retryInSeconds: number } | null;
}

/** Live timeline panel (design_handoff/README.md "Live timeline"): newest at the
 * bottom, auto-scrolled on every update — `scrollTop = scrollHeight`, not `scrollIntoView`,
 * so it never fights a user who has scrolled up to re-read an earlier finding. */
export function TimelinePanel({ entries, connectionLost }: TimelinePanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_16px_45px_rgba(22,24,28,0.045)]">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2/70 px-4 py-[13px]">
        <span className={cn(typeScale.label, "flex items-center gap-2 text-fg-faint")}>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          LIVE TIMELINE
        </span>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[10px] text-fg-faint">{entries.length} events</span>
      </div>

      {connectionLost && (
        <div className="flex shrink-0 items-center gap-2 border-b border-warn-bd bg-warn-soft px-[14px] py-2">
          <span
            aria-hidden
            className="h-[7px] w-[7px] shrink-0 rounded-full bg-warn motion-safe:animate-[cfDot_1.1s_ease-in-out_infinite]"
          />
          <span className="text-[14px] font-[650] text-warn">Live stream lost — reconnecting…</span>
          <span className="ml-auto font-mono text-[12px] text-warn">
            attempt {connectionLost.attempt} · retrying in {connectionLost.retryInSeconds}s
          </span>
        </div>
      )}

      <div ref={viewportRef} className="cf-run-scroll flex flex-1 flex-col gap-[6px] overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="p-2 text-[13px] text-fg-faint">Nothing yet — the run hasn&apos;t started.</p>
        ) : (
          entries.map((entry, i) => <TimelineEntry key={i} entry={entry} i={i} />)
        )}
      </div>
    </div>
  );
}

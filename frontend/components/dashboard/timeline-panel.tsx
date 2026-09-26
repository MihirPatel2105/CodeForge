"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { preferredScrollBehavior } from "@/lib/motion";
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
  const previousLength = useRef(0);
  const [following, setFollowing] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const added = Math.max(0, entries.length - previousLength.current);
    previousLength.current = entries.length;
    if (following) {
      el.scrollTop = el.scrollHeight;
      setUnread(0);
    } else if (added > 0) {
      setUnread((count) => count + added);
    }
  }, [entries.length, following]);

  function handleScroll() {
    const el = viewportRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setFollowing(nearBottom);
    if (nearBottom) setUnread(0);
  }

  function resumeFollowing() {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: preferredScrollBehavior() });
    setFollowing(true);
    setUnread(0);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_16px_45px_rgba(34,48,78,0.06)]">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-white px-4 py-3">
        <span className={cn(typeScale.label, "flex items-center gap-2 text-fg-muted")}>
          <Clock3 className="h-4 w-4 text-accent" aria-hidden />
          Live timeline
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-[650] text-fg-faint" aria-label={`${entries.length} ${entries.length === 1 ? "event" : "events"}`}>{entries.length}</span>
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

      <div className="relative min-h-0 flex-1 bg-[#fbfcff]">
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          role="log"
          aria-label="Live timeline"
          className="cf-run-scroll absolute inset-0 flex flex-col gap-1.5 overflow-y-auto p-2.5"
        >
        {entries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent">
              <Clock3 className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-[15px] font-[650] text-fg">Waiting for activity</p>
            <p className="mt-1.5 max-w-[32ch] text-[13px] leading-5 text-fg-muted">Agent updates will appear here as the run progresses.</p>
          </div>
        ) : (
          entries.map((entry, i) => <TimelineEntry key={i} entry={entry} i={i} />)
        )}
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={resumeFollowing}
            className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent-bd bg-surface px-3 py-2 font-mono text-[10px] font-[700] uppercase tracking-[0.1em] text-accent shadow-[0_10px_28px_rgba(22,24,28,0.16)]"
            aria-live="polite"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            {unread} new {unread === 1 ? "event" : "events"}
          </button>
        )}
      </div>
    </div>
  );
}

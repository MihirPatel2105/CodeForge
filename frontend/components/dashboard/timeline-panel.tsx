"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronDown, Clock3, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { MorphingPopover } from "@/components/ui/morphing-popover";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PIPELINE_STAGES } from "@/lib/pipeline";
import { matchesTimeline, type TimelineFilters, type TimelineView } from "@/lib/timeline-filter";
import { cn } from "@/lib/utils";
import { preferredScrollBehavior } from "@/lib/motion";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { TimelineEntry, type TimelineEntryData } from "./timeline-entry";
import "./timeline-refinement.css";

type VisibleEntry = { entry: TimelineEntryData; index: number };
type ActivityGroup = { agent: string | null; items: VisibleEntry[] };

function groupActivity(visible: VisibleEntry[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const item of visible) {
    const { entry, index } = item;
    const agent = entry.kind === "message" && entry.agent !== "—"
      && (!entry.variant || entry.variant === "default" || entry.variant === "file")
      ? entry.agent : null;
    const previous = groups.at(-1);
    // Source indices keep filtered-out handoffs and repair boundaries from being merged.
    if (agent && previous?.agent === agent && previous.items.at(-1)!.index === index - 1) {
      previous.items.push(item);
    } else {
      groups.push({ agent, items: [item] });
    }
  }
  return groups;
}

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
  const reducedMotion = useMotionPreference();
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousLength = useRef(0);
  const [filters, setFilters] = useState<TimelineFilters>({ query: "", agent: "", view: "all" });
  const visible = useMemo(() => entries.flatMap((entry, index) => matchesTimeline(entry, filters) ? [{ entry, index }] : []), [entries, filters]);
  const groups = useMemo(() => groupActivity(visible), [visible]);
  const filtering = Boolean(filters.query || filters.agent || filters.view !== "all");
  const following = useRef(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const reset = entries.length < previousLength.current;
    const added = entries.slice(reset ? entries.length : previousLength.current).filter(entry => matchesTimeline(entry, filters)).length;
    previousLength.current = entries.length;
    if (following.current) {
      el.scrollTop = el.scrollHeight;
      setUnread(0);
    } else if (reset) {
      setUnread(0);
    } else if (added > 0) {
      setUnread((count) => count + added);
    }
  }, [entries, filters]);

  function changeFilters(patch: Partial<TimelineFilters>) {
    previousLength.current = entries.length;
    setUnread(0);
    following.current = true;
    setFilters(current => ({ ...current, ...patch }));
  }

  function clearFilters() {
    changeFilters({ query: "", agent: "", view: "all" });
  }

  function handleScroll() {
    const el = viewportRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    following.current = nearBottom;
    if (nearBottom) setUnread(0);
  }

  function resumeFollowing() {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: preferredScrollBehavior() });
    following.current = true;
    setUnread(0);
  }

  return (
    <div className="cf-evidence-timeline cf-timeline-refined flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-surface">
      {/* One row: filters on the left, the event count on the right. The tab above already says "Timeline". */}
      <div className="cf-timeline-filter flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
      <MorphingPopover label={filtering ? "Filters active" : "Filter activity"} title="Filter activity">
      <motion.div layout={!reducedMotion} initial={reducedMotion ? false : { opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .2 }} className="space-y-3">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(100px,130px)] gap-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" aria-hidden />
            <Input type="search" aria-label="Search timeline" value={filters.query} placeholder="Search activity…"
              onChange={event => changeFilters({ query: event.target.value })}
              onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); changeFilters({ query: "" }); } }}
              className="h-9 min-w-0 pl-8 text-xs" />
          </div>
          <div className="relative min-w-0">
            <select aria-label="Timeline agent" value={filters.agent} onChange={event => changeFilters({ agent: event.target.value })}
              className="h-9 w-full min-w-0 appearance-none rounded-lg border border-border-strong bg-bg pl-3 pr-8 text-xs text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <option value="">All agents</option>
              {PIPELINE_STAGES.map(stage => <option key={stage.id} value={stage.name}>{stage.name}</option>)}
              <option value="—">Run updates</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" aria-hidden />
          </div>
        </div>
        <div role="group" aria-label="Timeline view" className="flex flex-wrap gap-1.5">
          {([["all", "All activity"], ["failures", "Failures"], ["loops", "Repair loops"]] as const).map(([view, label]) => <Button key={view} variant={filters.view === view ? "default" : "outline"} size="sm" aria-pressed={filters.view === view} onClick={() => changeFilters({ view: view as TimelineView })} className="h-8 px-2.5 text-xs">{label}</Button>)}
          <Button variant="ghost" size="sm" disabled={!filtering} onClick={clearFilters} className="h-8 px-2 text-xs">Clear filters</Button>
        </div>
      </motion.div></MorphingPopover>
        <span role="status" aria-label="Timeline results" className="cf-timeline-count rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-[650] tabular-nums text-fg-faint">{filtering ? `${visible.length} of ${entries.length} events` : `${entries.length} ${entries.length === 1 ? "event" : "events"}`}</span>
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

      <div className="relative min-h-0 flex-1 bg-surface">
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          role="log"
          aria-label="Live timeline"
          /* Entries are plain text, so the log itself takes focus for keyboard scrolling. */
          tabIndex={0}
          className="cf-run-scroll cf-scroll-cue absolute inset-0 flex flex-col gap-1.5 overflow-y-auto p-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
          style={{ scrollBehavior: "auto" }}
        >
        {entries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent">
              <Clock3 className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-[15px] font-[650] text-fg">Waiting for activity</p>
            <p className="mt-1.5 max-w-[32ch] text-[13px] leading-5 text-fg-muted">Agent updates will appear here as the run progresses.</p>
          </div>
        ) : visible.length === 0 ? (
          <Empty illustration="search"><EmptyHeader><EmptyTitle>No matching activity</EmptyTitle><EmptyDescription>Try another search or clear the filters to see all events.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" size="sm" onClick={clearFilters}>Reset activity filters</Button></EmptyContent></Empty>
        ) : (
          groups.map(group => group.agent ? (
            <div key={group.items[0].index} className="cf-timeline-group" role="group" aria-label={`${group.agent} activity`}>
              <div className="cf-timeline-group-heading">
                <span>{group.agent}</span>
                <span aria-hidden="true">{group.items.length} {group.items.length === 1 ? "update" : "updates"}</span>
              </div>
              {group.items.map(({ entry, index }) => <TimelineEntry key={index} entry={entry} i={index} grouped />)}
            </div>
          ) : <TimelineEntry key={group.items[0].index} entry={group.items[0].entry} i={group.items[0].index} />)
        )}
        </div>
        <AnimatePresence initial={false}>
          {unread > 0 && (
            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
              <motion.button
                type="button"
                onClick={resumeFollowing}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-surface px-3 py-2 font-mono text-[12px] font-[700] uppercase tracking-[0.1em] text-accent shadow-[0_10px_28px_rgba(22,24,28,0.16)]"
                aria-live="polite"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                {unread} new {unread === 1 ? "event" : "events"}
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

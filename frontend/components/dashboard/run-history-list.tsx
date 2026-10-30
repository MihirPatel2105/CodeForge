"use client";

import Link from "next/link";
import {
  Check,
  CircleSlash,
  Clock3,
  Hand,
  LoaderCircle,
  RotateCcw,
  ServerCrash,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { formatElapsed, formatWhen, parseApiTime } from "@/lib/format";
import { tone as toneClasses, type Tone } from "@/lib/tone";
import type { RunSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RunStatusFilter } from "./run-status-filter";

/** One-line outcome labels; the long form lives on the run page itself. */
const OUTCOME: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  queued: { label: "Queued", tone: "neutral", icon: Clock3 },
  running: { label: "Running", tone: "accent", icon: LoaderCircle },
  awaiting_approval: { label: "Needs your approval", tone: "warn", icon: Hand },
  succeeded: { label: "Passed", tone: "ok", icon: Check },
  failed_max_loops: { label: "Loop limit reached", tone: "warn", icon: RotateCcw },
  failed_sandbox: { label: "Sandbox error", tone: "danger", icon: ServerCrash },
  failed_llm: { label: "Providers unavailable", tone: "danger", icon: Unplug },
  rejected: { label: "Rejected", tone: "neutral", icon: CircleSlash },
  cancelled: { label: "Cancelled", tone: "neutral", icon: CircleSlash },
};
const UNKNOWN_OUTCOME = { tone: "neutral" as Tone, icon: Clock3 };

const PRESETS = [
  { id: "all", label: "All", outcome: "" },
  { id: "passed", label: "Passed", outcome: "succeeded" },
  { id: "failed", label: "Failed", outcome: "failed_max_loops,failed_sandbox,failed_llm" },
  { id: "approval", label: "Needs you", outcome: "awaiting_approval" },
  { id: "active", label: "Running", outcome: "queued,running" },
] as const;

const HEALTH_BARS = 16;

export interface RunHistoryStats {
  total: number;
  succeeded: number;
  failed: number;
}

function outcomeOf(status: string) {
  return OUTCOME[status] ?? { ...UNKNOWN_OUTCOME, label: status };
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function groupByDay(runs: RunSummary[]): { label: string; runs: RunSummary[] }[] {
  const groups: { key: string; label: string; runs: RunSummary[] }[] = [];
  for (const run of runs) {
    const date = parseApiTime(run.created_at);
    const key = date.toDateString();
    const last = groups.at(-1);
    if (last?.key === key) last.runs.push(run);
    else groups.push({ key, label: dayLabel(date), runs: [run] });
  }
  return groups;
}

function HealthStrip({ history, stats }: { history: RunSummary[]; stats: RunHistoryStats }) {
  if (stats.total === 0) return null;
  const other = Math.max(0, stats.total - stats.succeeded - stats.failed);
  const recent = history.slice(0, HEALTH_BARS).reverse();
  return (
    <div className="flex items-center gap-3">
      <span
        role="img"
        aria-label={`Runs: ${stats.succeeded} passed, ${stats.failed} failed, ${other} other`}
        className="flex items-end gap-[3px]"
      >
        {recent.map((run) => (
          <span key={run.id} className="cf-run-health-bar" data-tone={outcomeOf(run.status).tone} />
        ))}
      </span>
      <span className="cf-run-health-rate font-mono text-[11.5px] tabular-nums text-fg-faint">
        {Math.round((stats.succeeded / stats.total) * 100)}% passed
      </span>
    </div>
  );
}

function RunRow({ run, onReuse }: { run: RunSummary; onReuse: (run: RunSummary) => void }) {
  const outcome = outcomeOf(run.status);
  const Icon = outcome.icon;
  const elapsed = Math.max(0, parseApiTime(run.updated_at).getTime() - parseApiTime(run.created_at).getTime());
  return (
    <li className="cf-run-row group relative grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-b border-rule px-5 py-3.5 transition-colors last:border-b-0 hover:bg-accent-soft/30 sm:grid-cols-[32px_minmax(0,1fr)_auto] md:px-6">
      <Link
        href={`/runs/${run.id}`}
        aria-label={`Open run: ${run.prompt}`}
        className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
      />
      <span className={cn("grid size-8 place-items-center rounded-full", toneClasses[outcome.tone].soft)} aria-hidden>
        <Icon className={cn("size-4", run.status === "running" && "animate-spin motion-reduce:animate-none")} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-[550] text-fg" title={run.prompt}>{run.prompt}</p>
        <p className="cf-run-meta mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11.5px] text-fg-faint">
          {run.iterations > 0 && (
            <span className="text-loop">{run.iterations} repair {run.iterations === 1 ? "loop" : "loops"}</span>
          )}
          <span>{formatElapsed(elapsed)}</span>
          <time dateTime={run.created_at}>{formatWhen(run.created_at)}</time>
          {run.parent_run_id && (
            <Link href={`/runs/${run.parent_run_id}`} className="relative text-accent underline-offset-2 hover:underline">
              Improves an earlier run
            </Link>
          )}
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
        <span className="cf-run-actions relative">
          <Button variant="outline" size="sm" className="gap-1.5 text-[11.5px]" onClick={() => onReuse(run)}>
            <RotateCcw className="size-3" aria-hidden />Reuse prompt
          </Button>
        </span>
        <span className={cn("cf-run-outcome whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-[650]", toneClasses[outcome.tone].soft)}>
          {outcome.label}
        </span>
      </div>
    </li>
  );
}

export interface RunHistoryListProps {
  history: RunSummary[];
  stats: RunHistoryStats;
  query: string;
  outcome: string;
  filtering: boolean;
  onFilter?: (query: string, outcome: string) => void;
  onReuse: (run: RunSummary) => void;
  nextCursor?: string | null;
  loadingMore?: boolean;
  moreError?: string | null;
  onLoadMore?: () => void;
}

/** Run history as a scannable list: one calm row per run, grouped by day. */
export function RunHistoryList({
  history,
  stats,
  query,
  outcome,
  filtering,
  onFilter,
  onReuse,
  nextCursor,
  loadingMore,
  moreError,
  onLoadMore,
}: RunHistoryListProps) {
  const counts: Record<string, number | undefined> = { all: stats.total, passed: stats.succeeded, failed: stats.failed };
  const filtered = Boolean(query || outcome);

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface" aria-labelledby="run-history-heading">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 md:px-6">
        <div className="flex items-baseline gap-3">
          <h2 id="run-history-heading" className="font-display text-[22px] font-[700] tracking-[-0.04em] text-fg">Run history</h2>
          <span className="text-[12px] font-[600] text-fg-faint">
            {history.length} of {stats.total} {stats.total === 1 ? "run" : "runs"}
          </span>
        </div>
        <HealthStrip history={history} stats={stats} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4 md:px-5" role="group" aria-label="Quick outcome filters">
        {PRESETS.map((preset) => {
          const active = outcome === preset.outcome;
          const count = counts[preset.id];
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter?.(query, preset.outcome)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[13px] font-[600] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {preset.label}
              {count != null && <span className="ml-1.5 font-mono text-[11.5px] tabular-nums opacity-80">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 border-b border-rule px-4 py-3 md:px-5">
        <Input aria-label="Search run prompts" placeholder="Search run prompts" value={query} onChange={(event) => onFilter?.(event.target.value, outcome)} className="min-w-0 flex-1" />
        <RunStatusFilter value={outcome} onChange={(value) => onFilter?.(query, value)} />
      </div>
      {filtering && <p role="status" className="px-5 py-2 text-sm text-fg-muted">Searching runs…</p>}

      <div
        className="cf-run-history-scroll max-h-[min(62dvh,600px)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        data-lenis-prevent
        role="region"
        aria-label="Run history list"
        tabIndex={0}
      >
        {history.length === 0 ? (
          <Empty illustration={filtered ? "search" : "inbox"} className="cf-project-history-empty min-h-[330px]">
            <EmptyHeader>
              <EmptyTitle>{filtered ? "No matching runs" : "No runs yet"}</EmptyTitle>
              <EmptyDescription>{filtered ? "Try fewer outcomes or another search." : "Describe the API in the prompt studio and start the agent workflow."}</EmptyDescription>
            </EmptyHeader>
            {filtered && <EmptyContent><Button variant="outline" onClick={() => onFilter?.("", "")}>Clear run filters</Button></EmptyContent>}
          </Empty>
        ) : (
          groupByDay(history).map((group) => (
            <div key={group.label}>
              <h3 className="sticky top-0 z-10 border-b border-rule bg-surface-2/95 px-5 py-1.5 text-[12px] font-[650] text-fg-faint backdrop-blur-sm md:px-6">
                {group.label}
              </h3>
              <ul>
                {group.runs.map((run) => <RunRow key={run.id} run={run} onReuse={onReuse} />)}
              </ul>
            </div>
          ))
        )}
        {moreError && <Notice>{moreError}</Notice>}
        {nextCursor && (
          <div className="border-t border-rule px-5 py-4">
            <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more runs"}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

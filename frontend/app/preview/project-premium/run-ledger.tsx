"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CircleSlash,
  Clock3,
  Hand,
  LoaderCircle,
  RotateCcw,
  Search,
  ServerCrash,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Notice } from "@/components/ui/notice";
import { formatElapsed, formatWhen, parseApiTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import type { RunSummary } from "@/lib/types";
import type { RunHistoryListProps } from "@/components/dashboard/run-history-list";

/** One-line outcome words; the long form lives on the run page itself. */
export const OUTCOME: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
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

// Every status sits under exactly one tab, so the tabs replace the outcome dropdown.
export const PRESETS = [
  { id: "all", label: "All", outcome: "" },
  { id: "passed", label: "Passed", outcome: "succeeded" },
  { id: "failed", label: "Failed", outcome: "failed_max_loops,failed_sandbox,failed_llm" },
  { id: "approval", label: "Needs you", outcome: "awaiting_approval" },
  { id: "active", label: "Running", outcome: "queued,running" },
  { id: "other", label: "Other", outcome: "cancelled,rejected" },
] as const;

const HEALTH_BARS = 16;

export const outcomeOf = (status: string) => OUTCOME[status] ?? { label: status, tone: "neutral" as Tone, icon: Clock3 };

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function groupByDay(runs: RunSummary[]) {
  return runs.reduce<{ key: string; label: string; runs: RunSummary[] }[]>((groups, run) => {
    const date = parseApiTime(run.created_at);
    const last = groups.at(-1);
    if (last?.key === date.toDateString()) return [...groups.slice(0, -1), { ...last, runs: [...last.runs, run] }];
    return [...groups, { key: date.toDateString(), label: dayLabel(date), runs: [run] }];
  }, []);
}

function Heartbeat({ history, stats }: Pick<RunHistoryListProps, "history" | "stats">) {
  if (stats.total === 0) return null;
  const other = Math.max(0, stats.total - stats.succeeded - stats.failed);
  return (
    <div className="pp-heartbeat">
      <span role="img" aria-label={`Runs: ${stats.succeeded} passed, ${stats.failed} failed, ${other} other`}>
        {history.slice(0, HEALTH_BARS).reverse().map((run) => (
          <i key={run.id} data-tone={outcomeOf(run.status).tone} />
        ))}
      </span>
      <span className="cf-run-health-rate">{Math.round((stats.succeeded / stats.total) * 100)}% passed</span>
    </div>
  );
}

function RunRow({ run, onReuse }: { run: RunSummary; onReuse: (run: RunSummary) => void }) {
  const outcome = outcomeOf(run.status);
  const Icon = outcome.icon;
  const elapsed = Math.max(0, parseApiTime(run.updated_at).getTime() - parseApiTime(run.created_at).getTime());
  return (
    <li className="pp-row" data-tone={outcome.tone}>
      <Link href={`/runs/${run.id}`} aria-label={`Open run: ${run.prompt}`} className="pp-row-link" />
      <span className="pp-row-icon" aria-hidden>
        <Icon className={run.status === "running" ? "animate-spin motion-reduce:animate-none" : undefined} />
      </span>
      <div className="pp-row-body">
        <p className="pp-row-prompt" title={run.prompt}>{run.prompt}</p>
        <p className="pp-row-meta">
          <span className="pp-row-outcome">{outcome.label}</span>
          {run.iterations > 0 && <span className="pp-row-loops">{run.iterations} repair {run.iterations === 1 ? "loop" : "loops"}</span>}
          <span className="pp-mono">{formatElapsed(elapsed)}</span>
          {run.parent_run_id && (
            <Link href={`/runs/${run.parent_run_id}`} className="pp-row-parent">Improves an earlier run</Link>
          )}
        </p>
      </div>
      <div className="pp-row-end">
        <time dateTime={run.created_at}>{formatWhen(run.created_at)}</time>
        <Button variant="ghost" size="sm" className="pp-reuse" onClick={() => onReuse(run)}>
          <RotateCcw className="size-3" aria-hidden />Reuse prompt
        </Button>
        <ArrowUpRight className="pp-row-arrow" aria-hidden />
      </div>
    </li>
  );
}

/** Run history as a calm ledger: one filter row, quiet day labels, one status signal per run. */
export function RunLedger({
  history, stats, query, outcome, filtering, onFilter, onReuse, nextCursor, loadingMore, moreError, onLoadMore,
}: RunHistoryListProps) {
  const counts: Record<string, number | undefined> = { all: stats.total, passed: stats.succeeded, failed: stats.failed };
  const filtered = Boolean(query || outcome);
  return (
    <section className="pp-card pp-ledger" aria-labelledby="run-history-heading">
      <header className="pp-ledger-head">
        <div>
          <p className="pp-eyebrow">{stats.total} {stats.total === 1 ? "run" : "runs"}</p>
          <h2 id="run-history-heading" className="pp-title">Run history</h2>
        </div>
        <Heartbeat history={history} stats={stats} />
      </header>

      <div className="pp-filters">
        <div className="pp-segments" role="group" aria-label="Quick outcome filters">
          {PRESETS.map((preset) => (
            <button key={preset.id} type="button" aria-pressed={outcome === preset.outcome} onClick={() => onFilter?.(query, preset.outcome)}>
              {preset.label}
              {counts[preset.id] != null && <span>{counts[preset.id]}</span>}
            </button>
          ))}
        </div>
        <label className="pp-search">
          <Search aria-hidden />
          <input type="search" aria-label="Search run prompts" placeholder="Search prompts" value={query} onChange={(event) => onFilter?.(event.target.value, outcome)} />
        </label>
      </div>
      {filtering && <p role="status" className="pp-searching">Searching runs…</p>}

      <div className="pp-scroll cf-run-history-scroll" data-lenis-prevent role="region" aria-label="Run history list" tabIndex={0}>
        {history.length === 0 ? (
          <Empty illustration={filtered ? "search" : "inbox"} className="min-h-[300px]">
            <EmptyHeader>
              <EmptyTitle>{filtered ? "No matching runs" : "No runs yet"}</EmptyTitle>
              <EmptyDescription>{filtered ? "Try another tab or search." : "Describe the API and start the agent workflow."}</EmptyDescription>
            </EmptyHeader>
            {filtered && <EmptyContent><Button variant="outline" onClick={() => onFilter?.("", "")}>Clear run filters</Button></EmptyContent>}
          </Empty>
        ) : (
          groupByDay(history).map((group) => (
            <div key={group.key}>
              <h3 className="pp-day">{group.label}</h3>
              <ul>{group.runs.map((run) => <RunRow key={run.id} run={run} onReuse={onReuse} />)}</ul>
            </div>
          ))
        )}
        {moreError && <Notice>{moreError}</Notice>}
        {nextCursor && (
          <div className="pp-more">
            <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more runs"}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

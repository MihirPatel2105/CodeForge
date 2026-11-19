"use client";

import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Notice } from "@/components/ui/notice";
import { formatElapsed, formatWhen, parseApiTime } from "@/lib/format";
import type { RunSummary } from "@/lib/types";
import { groupByDay, OUTCOME_PRESETS, outcomeOf } from "./run-outcomes";

export interface RunHistoryStats {
  total: number;
  succeeded: number;
  failed: number;
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

function RunLine({ run, onReuse }: { run: RunSummary; onReuse: (run: RunSummary) => void }) {
  const outcome = outcomeOf(run.status);
  const elapsed = Math.max(0, parseApiTime(run.updated_at).getTime() - parseApiTime(run.created_at).getTime());
  return (
    <li className="ax-run" data-tone={outcome.tone}>
      <Link href={`/runs/${run.id}`} aria-label={`Open run: ${run.prompt}`} className="ax-run-link" />
      <p className="ax-run-prompt" title={run.prompt}>{run.prompt}</p>
      <p className="ax-run-meta cf-run-meta">
        <span className="ax-run-status"><i aria-hidden /><span className="cf-run-outcome">{outcome.label}</span></span>
        {run.iterations > 0 && <span className="ax-run-loops">{run.iterations} repair {run.iterations === 1 ? "loop" : "loops"}</span>}
        <span>{formatElapsed(elapsed)}</span>
        {run.parent_run_id && <Link href={`/runs/${run.parent_run_id}`} className="ax-run-parent">Improves an earlier run</Link>}
      </p>
      <div className="ax-run-end">
        <time dateTime={run.created_at}>{formatWhen(run.created_at)}</time>
        <Button variant="ghost" size="sm" className="ax-reuse" onClick={() => onReuse(run)}>
          <RotateCcw aria-hidden />Reuse prompt
        </Button>
      </div>
    </li>
  );
}

/** Run history, editorial: a serif heading, text tabs, and each run as a plain line of writing. */
export function RunHistoryList({
  history, stats, query, outcome, filtering, onFilter, onReuse, nextCursor, loadingMore, moreError, onLoadMore,
}: RunHistoryListProps) {
  const counts: Record<string, number | undefined> = { all: stats.total, passed: stats.succeeded, failed: stats.failed };
  const filtered = Boolean(query || outcome);
  const passRate = stats.total ? Math.round((stats.succeeded / stats.total) * 100) : 0;
  return (
    <section className="ax-runs" aria-labelledby="run-history-heading">
      <div className="ax-runs-head">
        <h2 id="run-history-heading" className="ax-heading">Run history</h2>
        {stats.total > 0 && (
          <p className="ax-runs-rate">
            {/* How many are loaded, so "Load more" visibly adds to the count. */}
            {history.length} of {stats.total} {stats.total === 1 ? "run" : "runs"}
            <span aria-hidden> · </span>
            <span className="cf-run-health-rate">{passRate}% passed</span>
          </p>
        )}
      </div>

      <div className="ax-tabs" role="group" aria-label="Quick outcome filters">
        {OUTCOME_PRESETS.map((preset) => (
          <button key={preset.id} type="button" aria-pressed={outcome === preset.outcome} onClick={() => onFilter?.(query, preset.outcome)}>
            {preset.label}
            {counts[preset.id] != null && <span>{counts[preset.id]}</span>}
          </button>
        ))}
      </div>
      <label className="ax-search">
        <Search aria-hidden />
        <input type="search" aria-label="Search run prompts" placeholder="Search your runs" value={query} onChange={(event) => onFilter?.(event.target.value, outcome)} />
      </label>
      {filtering && <p role="status" className="ax-searching">Searching runs…</p>}

      <div className="ax-scroll cf-run-history-scroll" data-lenis-prevent role="region" aria-label="Run history list" tabIndex={0}>
        {history.length === 0 ? (
          <Empty illustration={filtered ? "search" : "inbox"} className="cf-project-history-empty min-h-[280px]">
            <EmptyHeader>
              <EmptyTitle>{filtered ? "No matching runs" : "No runs yet"}</EmptyTitle>
              <EmptyDescription>{filtered ? "Try another tab or search." : "Describe the API and start the agent workflow."}</EmptyDescription>
            </EmptyHeader>
            {filtered && <EmptyContent><Button variant="outline" onClick={() => onFilter?.("", "")}>Clear run filters</Button></EmptyContent>}
          </Empty>
        ) : (
          groupByDay(history).map((group, index) => (
            <div key={`${group.key}-${index}`} className="ax-day">
              <h3>{group.label}</h3>
              <ul>{group.runs.map((run) => <RunLine key={run.id} run={run} onReuse={onReuse} />)}</ul>
            </div>
          ))
        )}
        {moreError && <Notice>{moreError}</Notice>}
        {nextCursor && (
          <div className="ax-more">
            <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more runs"}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

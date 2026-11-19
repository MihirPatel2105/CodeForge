"use client";

import { useState } from "react";
import { PromptStudio } from "@/components/dashboard/prompt-studio";
import { RunHistoryList } from "@/components/dashboard/run-history-list";
import { PromptComposer } from "./prompt-composer";
import { RunLedger } from "./run-ledger";
import { EditorialComposer } from "./editorial-composer";
import { EditorialRuns } from "./editorial-runs";
import type { RunSummary } from "@/lib/types";
import { filterRuns, SAMPLE_RUNS, statsOf } from "./sample-runs";

type Version = "current" | "proposed" | "anthropic";
const VERSIONS: { id: Version; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "proposed", label: "Proposed" },
  { id: "anthropic", label: "Anthropic-style" },
];
type Stats = ReturnType<typeof statsOf>;
const WORKSPACE_CLASS: Record<Version, string> = { current: "", proposed: "pp-workspace", anthropic: "ax-workspace" };

function Hero() {
  return (
    <div className="relative px-6 py-6 md:px-9 md:py-7">
      <h1 className="font-display text-[36px] font-[700] tracking-[-0.055em] text-fg md:text-[42px]">Contact Directory</h1>
      <span className="cf-manage-project pp-static-button">Manage project</span>
      <p className="mt-2 max-w-[80ch] text-[14px] leading-[1.6] text-fg-muted md:text-[15px]">
        A simple API for storing and managing personal contacts with names, phone numbers, email addresses, and favourite status.
      </p>
    </div>
  );
}

/** The refined strip: one baseline, tabular figures, and the outcome mix drawn under the run count. */
function StatsStrip({ stats }: { stats: Stats }) {
  const other = stats.total - stats.succeeded - stats.failed;
  const share = (n: number) => `${(n / Math.max(1, stats.total)) * 100}%`;
  return (
    <div className="pp-stats">
      <dl>
        <div>
          <dt>Runs</dt>
          <dd>{stats.total}</dd>
          <div className="pp-mix" role="img" aria-label={`${stats.succeeded} passed, ${stats.failed} failed, ${other} other`}>
            {stats.succeeded > 0 && <i data-tone="ok" style={{ width: share(stats.succeeded) }} />}
            {stats.failed > 0 && <i data-tone="danger" style={{ width: share(stats.failed) }} />}
            {other > 0 && <i style={{ width: share(other) }} />}
          </div>
        </div>
        <div><dt>Passed</dt><dd>{stats.succeeded}</dd></div>
        <div><dt>Failed</dt><dd>{stats.failed}</dd></div>
        <div><dt>Average loops</dt><dd>{stats.avgLoops == null ? "—" : stats.avgLoops.toFixed(1)}</dd></div>
      </dl>
    </div>
  );
}

/**
 * The Anthropic-style summary: one short serif statement, then the detail in a quiet line. Only
 * the counts the server reports (total, passed, failed, average loops) are used, so it works
 * unchanged on the live page.
 */
function RunSummaryLine({ stats }: { stats: Stats }) {
  if (stats.total === 0) return <div className="ax-summary"><p className="ax-summary-lead">No runs yet.</p></div>;
  const other = stats.total - stats.succeeded - stats.failed;
  return (
    <div className="ax-summary">
      <p className="ax-summary-lead">
        <strong>{stats.succeeded} of {stats.total}</strong> runs passed.
      </p>
      <ul className="ax-summary-detail">
        <li data-tone="danger"><i aria-hidden />{stats.failed} failed</li>
        {other > 0 && <li><i aria-hidden />{other} stopped or still running</li>}
        {stats.avgLoops != null && <li data-tone="loop"><i aria-hidden />{stats.avgLoops.toFixed(1)} repair loops on average</li>}
      </ul>
    </div>
  );
}

/** Current, proposed and Anthropic-style project workspace, one mounted at a time (they share element ids). */
export function ProjectPremiumShell() {
  const [version, setVersion] = useState<Version>("proposed");
  const [prompt, setPrompt] = useState(SAMPLE_RUNS[2].prompt);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [parentRunId, setParentRunId] = useState<string | null>(null);
  // Preview-only: shows the error and failed-save notices, which the live page raises itself.
  const [showProblems, setShowProblems] = useState(false);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const history = filterRuns(SAMPLE_RUNS, query, outcome);
  const stats = statsOf(SAMPLE_RUNS);
  const isProposed = version === "proposed";

  const studio = {
    prompt, onPromptChange: setPrompt, ragEnabled, onRagChange: setRagEnabled,
    parentRunId, onDetachParent: () => setParentRunId(null),
    draftStatus: showProblems ? "Draft could not be saved on this device" : "Draft saved on this device",
    error: showProblems ? "Couldn't start the run." : null, starting: false, onStart: () => {},
  };
  const ledger = {
    history, stats, query, outcome, filtering: false,
    onFilter: (q: string, o: string) => { setQuery(q); setOutcome(o); },
    onReuse: (run: RunSummary) => { setPrompt(run.prompt); setParentRunId(run.parent_run_id ?? null); },
  };

  return (
    <div className="cf-project-detail min-h-screen bg-bg" data-version={version}>
      <div className="pp-switch" role="group" aria-label="Design version">
        {VERSIONS.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={version === id} onClick={() => setVersion(id)}>{label}</button>
        ))}
        <button type="button" aria-pressed={showProblems} onClick={() => setShowProblems((shown) => !shown)}>Errors</button>
      </div>
      <main className="mx-auto w-full max-w-[1320px] px-5 pb-20 pt-6 md:px-10 md:pt-8 lg:px-14">
        <section className={`cf-project-detail-hero mt-4 overflow-hidden rounded-3xl border border-border bg-surface ${isProposed ? "pp-hero" : ""}`}>
          <Hero />
          {version === "anthropic" && <RunSummaryLine stats={stats} />}
          {isProposed && <StatsStrip stats={stats} />}
          {version === "current" && (
            <dl className="cf-project-detail-stats grid grid-cols-2 bg-surface-2/65 sm:grid-cols-4">
              {[["Runs", stats.total], ["Succeeded", stats.succeeded], ["Failed", stats.failed], ["Average loops", stats.avgLoops?.toFixed(1) ?? "—"]].map(([label, value], i) => (
                <div key={label} className={`flex min-h-[86px] flex-col justify-center px-5 py-3 sm:px-6 ${i ? "sm:border-l border-rule" : ""}`}>
                  <dt className="text-[12px] font-[650] text-fg-muted">{label}</dt>
                  <dd className="font-display mt-1 text-[26px] font-[700] tracking-[-0.05em] text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <div className={`cf-project-workspace mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-start ${WORKSPACE_CLASS[version]}`}>
          {version === "current" && <><PromptStudio {...studio} /><RunHistoryList {...ledger} /></>}
          {version === "proposed" && <><PromptComposer {...studio} /><RunLedger {...ledger} /></>}
          {version === "anthropic" && <><EditorialComposer {...studio} /><EditorialRuns {...ledger} /></>}
        </div>
      </main>
    </div>
  );
}

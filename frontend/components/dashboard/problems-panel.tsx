"use client";

import { Button } from "@/components/ui/button";
import type { RunProblem } from "@/lib/run-problems";

export function ProblemsPanel({ problems, canOpen, onOpen, error }: {
  problems: RunProblem[];
  canOpen: (problem: RunProblem) => boolean;
  onOpen: (problem: RunProblem) => void;
  error: boolean;
}) {
  if (!problems.length && !error) return null;
  return (
    <section aria-label="Problems" className="cf-evidence-problems mb-4 min-w-0 rounded-2xl border border-border bg-surface p-4">
      <h3 className="font-semibold text-fg">Problems <span className="text-sm font-normal text-fg-muted">({problems.length})</span></h3>
      {error && <p role="status" className="mt-2 text-sm text-fg-muted">Could not refresh findings. Showing the last available results.</p>}
      <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
        {problems.map(problem => <li key={problem.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-3">
          <div className="min-w-0 flex-1 basis-52">
            <p className={`text-xs font-semibold ${problem.severity === "blocking" || problem.severity === "test" ? "text-danger" : "text-fg-muted"}`}>{problem.source} · {problem.severity === "test" ? "Failure" : problem.severity === "blocking" ? "Blocking" : problem.severity === "warning" ? "Warning" : "Suggestion"}</p>
            <p className="mt-1 break-words text-sm text-fg">{problem.message}</p>
            {!canOpen(problem) && <p className="mt-1 text-xs text-fg-muted">Source location unavailable for the displayed code.</p>}
          </div>
          {canOpen(problem) && problem.location && <Button variant="outline" size="sm" aria-label={`View ${problem.location.path} line ${problem.location.line}`} onClick={() => onOpen(problem)}>
            {problem.location.path}:{problem.location.line} · View code
          </Button>}
        </li>)}
      </ul>
    </section>
  );
}

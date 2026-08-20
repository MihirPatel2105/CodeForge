/**
 * Summary figures derived from a project's run history.
 *
 * Everything here is computed from `RunSummary[]` the pages already fetch — the
 * projects list was pulling each project's full history purely to count it, and then
 * throwing the rest away. No extra requests, and nothing displayed that the backend
 * did not actually report.
 */

import type { RunSummary } from "./types";

export interface RunStats {
  total: number;
  succeeded: number;
  failed: number;
  /** Still in flight: queued, running, or paused at an approval checkpoint. */
  active: number;
  /** Mean loop iterations over runs that finished; null when none have. */
  avgLoops: number | null;
  /** Most recent run, or null. History arrives newest-first from the API. */
  last: RunSummary | null;
}

const ACTIVE = new Set(["queued", "running", "awaiting_approval"]);

/** `failed_max_loops` counts as failed here even though it renders in `warn` rather
 * than `danger`: it is a designed stop, but it is not a run that produced a passing
 * API, and a success figure that counted it would flatter the project. */
const FAILED = new Set(["failed_max_loops", "failed_sandbox", "failed_llm"]);

export function runStats(runs: RunSummary[]): RunStats {
  const finished = runs.filter((r) => !ACTIVE.has(r.status));
  const loopTotal = finished.reduce((sum, r) => sum + r.iterations, 0);

  return {
    total: runs.length,
    succeeded: runs.filter((r) => r.status === "succeeded").length,
    failed: runs.filter((r) => FAILED.has(r.status)).length,
    active: runs.filter((r) => ACTIVE.has(r.status)).length,
    avgLoops: finished.length > 0 ? loopTotal / finished.length : null,
    last: runs[0] ?? null,
  };
}

/** Solid fills for the outcome strip. The tinted `tone.*.soft` pairs are for text on a
 * chip; a 3px bar needs the colour at full strength to read at all. */
export const OUTCOME_FILL: Record<string, string> = {
  succeeded: "bg-ok",
  failed_max_loops: "bg-warn",
  failed_sandbox: "bg-danger",
  failed_llm: "bg-danger",
  awaiting_approval: "bg-warn",
  running: "bg-accent",
  queued: "bg-border-strong",
  rejected: "bg-border-strong",
  cancelled: "bg-border-strong",
};

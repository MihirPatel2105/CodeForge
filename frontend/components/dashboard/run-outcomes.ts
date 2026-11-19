import { parseApiTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import type { RunSummary } from "@/lib/types";

/** One-line outcome words for a run row; the long form lives on the run page itself. */
const OUTCOME: Record<string, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "accent" },
  awaiting_approval: { label: "Needs your approval", tone: "warn" },
  succeeded: { label: "Passed", tone: "ok" },
  failed_max_loops: { label: "Loop limit reached", tone: "warn" },
  failed_sandbox: { label: "Sandbox error", tone: "danger" },
  failed_llm: { label: "Providers unavailable", tone: "danger" },
  rejected: { label: "Rejected", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** The history tabs. Every status sits under exactly one tab besides All. */
export const OUTCOME_PRESETS = [
  { id: "all", label: "All", outcome: "" },
  { id: "passed", label: "Passed", outcome: "succeeded" },
  { id: "failed", label: "Failed", outcome: "failed_max_loops,failed_sandbox,failed_llm" },
  { id: "approval", label: "Needs you", outcome: "awaiting_approval" },
  { id: "active", label: "Running", outcome: "queued,running" },
  { id: "other", label: "Other", outcome: "cancelled,rejected" },
] as const;

export function outcomeOf(status: string) {
  return OUTCOME[status] ?? { label: status, tone: "neutral" as Tone };
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

/** Consecutive runs from the same local day, newest first as the server sends them. */
export function groupByDay(runs: RunSummary[]): { key: string; label: string; runs: RunSummary[] }[] {
  return runs.reduce<{ key: string; label: string; runs: RunSummary[] }[]>((groups, run) => {
    const date = parseApiTime(run.created_at);
    const last = groups.at(-1);
    if (last?.key === date.toDateString()) return [...groups.slice(0, -1), { ...last, runs: [...last.runs, run] }];
    return [...groups, { key: date.toDateString(), label: dayLabel(date), runs: [run] }];
  }, []);
}

import type { TimelineEntryData } from "@/components/dashboard/timeline-entry";

export type TimelineView = "all" | "failures" | "loops";
export type TimelineFilters = { query: string; agent: string; view: TimelineView };

export function matchesTimeline(entry: TimelineEntryData, filters: TimelineFilters): boolean {
  const agent = entry.agent ?? "—";
  if (filters.agent && agent !== filters.agent) return false;
  if (filters.view === "loops" && entry.kind !== "loop") return false;
  if (filters.view === "failures" && entry.kind !== "finding" && !(entry.kind === "message" && entry.variant === "failed")) return false;
  const query = filters.query.trim().toLocaleLowerCase();
  if (!query) return true;
  const text = entry.kind === "finding"
    ? [entry.time, agent, entry.file, entry.line, entry.issue, entry.fixHint].join(" ")
    : [entry.time, agent, entry.text].join(" ");
  return text.toLocaleLowerCase().includes(query);
}

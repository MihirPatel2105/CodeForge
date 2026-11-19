import type { ProjectOverviewItem, RunStatus, RunSummary } from "@/lib/types";

// Synthetic projects covering every state the list shows: passing, failing, running, waiting on
// you, never run, and archived. Fixed dates keep the server and client render identical.
function runs(projectId: string, statuses: RunStatus[], latest: string): RunSummary[] {
  const start = new Date(latest).getTime();
  return statuses.map((status, index) => {
    const created = new Date(start - index * 26 * 3600 * 1000);
    return {
      id: `${projectId}-run-${index}`, project_id: projectId, prompt: `Run ${statuses.length - index} for this project`,
      status, iterations: index % 3 === 0 ? 1 : 0,
      created_at: created.toISOString(), updated_at: new Date(created.getTime() + 140_000).toISOString(),
    };
  });
}

function project(id: string, name: string, description: string, statuses: RunStatus[], latest: string, archived = false): ProjectOverviewItem {
  const recent = runs(id, statuses, latest);
  const succeeded = statuses.filter((s) => s === "succeeded").length;
  const failed = statuses.filter((s) => s.startsWith("failed_")).length;
  const active = statuses.filter((s) => s === "running" || s === "queued" || s === "awaiting_approval").length;
  return {
    id, name, description, archived, created_at: "2026-09-20T09:00:00Z",
    stats: { total: statuses.length, succeeded, failed, active, avg_loops: statuses.length ? 0.6 : null, last: recent[0] ?? null },
    recent_runs: recent, last_activity_at: recent[0]?.created_at ?? "2026-09-20T09:00:00Z",
  };
}

export const SAMPLE_PROJECTS: ProjectOverviewItem[] = [
  project("p-contacts", "Contact Directory", "A simple API for storing and managing personal contacts with names, phone numbers, email addresses, and favorite status.",
    ["succeeded", "cancelled", "succeeded", "failed_llm", "succeeded", "failed_max_loops", "rejected", "succeeded"], "2026-10-26T16:10:00Z"),
  project("p-events", "Community Event Planner", "", ["running", "succeeded", "failed_sandbox", "succeeded", "succeeded", "failed_llm"], "2026-11-18T09:40:00Z"),
  project("p-library", "Personal Library", "A simple API workspace for managing a personal book collection with authors, genres and reading status.",
    ["awaiting_approval", "succeeded", "succeeded"], "2026-11-17T21:17:00Z"),
  project("p-study", "Study Task Manager", "A study-focused API workspace for organizing academic tasks, deadlines and subjects.",
    ["failed_max_loops", "succeeded", "failed_llm", "succeeded", "failed_sandbox", "succeeded"], "2026-10-10T10:18:00Z"),
  project("p-recipes", "Recipe Box", "Recipes with ingredients, steps and cooking times.", [], "2026-11-01T12:00:00Z"),
  project("p-old", "Inventory (old)", "The first inventory attempt, kept for reference.", ["succeeded", "succeeded"], "2026-09-28T12:00:00Z", true),
];

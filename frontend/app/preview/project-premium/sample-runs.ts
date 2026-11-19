import type { RunStatus, RunSummary } from "@/lib/types";

// Synthetic runs covering every row shape the ledger must handle: each outcome, a repair loop,
// a revision of an earlier run, and a very long prompt. Fixed dates keep the server and client
// render identical.
const BOOKS = "Build a CRUD API for books with title and author (required strings), year (integer), and genres (list of strings). Support create, list, get by ID, update, and delete. Reject empty titles and return 404 for missing books.";
const CONTACTS = "Build a CRUD API for contacts with name (required string), email (required valid email address), phone (optional string), and favourite (boolean, default false).";

function run(id: string, status: RunStatus, prompt: string, at: string, seconds: number, iterations = 0, parent?: string): RunSummary {
  const start = new Date(at);
  return {
    id, project_id: "preview", prompt, status, iterations,
    created_at: start.toISOString(),
    updated_at: new Date(start.getTime() + seconds * 1000).toISOString(),
    parent_run_id: parent ?? null,
  };
}

export const SAMPLE_RUNS: RunSummary[] = [
  run("r9", "running", CONTACTS, "2026-11-18T09:12:00Z", 48),
  run("r8", "awaiting_approval", "Keep existing endpoints unchanged. Add a favourites filter to the list endpoint so the client can ask for starred contacts only.", "2026-11-18T08:40:00Z", 92, 0, "r7"),
  run("r7", "succeeded", BOOKS, "2026-10-26T16:10:00Z", 185, 1),
  run("r6", "cancelled", BOOKS, "2026-10-13T16:04:00Z", 13),
  run("r5", "failed_max_loops", `${CONTACTS} Email must be unique across all contacts, phone numbers are normalised to E.164, and a contact can belong to any number of groups, each with its own colour and an optional description that is shown in the directory sidebar.`, "2026-10-04T11:20:00Z", 412, 3),
  run("r4", "succeeded", CONTACTS, "2026-10-04T10:02:00Z", 141),
  run("r3", "failed_llm", CONTACTS, "2026-10-02T18:45:00Z", 64),
  run("r2", "succeeded", BOOKS, "2026-09-29T09:30:00Z", 158, 2),
  run("r1", "rejected", "Build a full-stack app with login, payments and a React front end.", "2026-09-29T09:01:00Z", 21),
];

const OUTCOME_OF_RUN = (outcome: string) => (r: RunSummary) => !outcome || outcome.split(",").includes(r.status);

/** The same filtering the server does, so the preview's tabs and search behave for real. */
export function filterRuns(runs: RunSummary[], query: string, outcome: string): RunSummary[] {
  const needle = query.trim().toLowerCase();
  return runs.filter(OUTCOME_OF_RUN(outcome)).filter((r) => !needle || r.prompt.toLowerCase().includes(needle));
}

export function statsOf(runs: RunSummary[]) {
  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const failed = runs.filter((r) => r.status.startsWith("failed_")).length;
  const finished = runs.filter((r) => !["queued", "running", "awaiting_approval"].includes(r.status));
  const avgLoops = finished.length ? finished.reduce((sum, r) => sum + r.iterations, 0) / finished.length : null;
  return { total: runs.length, succeeded, failed, avgLoops };
}

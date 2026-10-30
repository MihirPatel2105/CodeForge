/**
 * Read-outs for one project row on the projects page, derived from the overview the
 * page already fetched. Nothing here asks the backend for more.
 */

import type { ProjectOverviewItem, RunSummary } from "./types";

/** The list's status filters; the backend applies them to each project's latest run. */
export type ProjectState = "needs_you" | "running" | "failing" | "passing";

const LIVE = new Set(["queued", "running"]);
const FAILING = new Set(["failed_max_loops", "failed_sandbox", "failed_llm"]);
/** Runs per side when comparing recent outcomes with the ones before them. */
const TREND_WINDOW = 5;
/** Smallest change in pass rate, in percentage points, worth an arrow. */
const TREND_THRESHOLD = 10;

export function stateOf(project: ProjectOverviewItem): ProjectState | "new" | "idle" {
  const status = project.stats.last?.status;
  if (!status) return "new";
  if (status === "awaiting_approval") return "needs_you";
  if (LIVE.has(status)) return "running";
  if (FAILING.has(status)) return "failing";
  if (status === "succeeded") return "passing";
  return "idle";
}

/** Whether any listed project has a run the page should watch finish. */
export function hasLiveRun(projects: ProjectOverviewItem[]): boolean {
  return projects.some((project) => stateOf(project) === "running");
}

/** Share of finished runs that passed, as a whole percentage; null before any finish. */
export function passRate(runs: RunSummary[]): number | null {
  const finished = runs.filter((run) => !LIVE.has(run.status) && run.status !== "awaiting_approval");
  if (!finished.length) return null;
  return Math.round((finished.filter((run) => run.status === "succeeded").length / finished.length) * 100);
}

export interface PassTrend {
  direction: "up" | "down";
  /** Percentage points between the latest window and the one before it. */
  points: number;
}

/**
 * Whether the latest runs pass more or less often than the ones before them. Needs a
 * full window on each side, so a project with a handful of runs shows no arrow rather
 * than a confident claim drawn from two data points.
 */
export function passTrend(recentNewestFirst: RunSummary[]): PassTrend | null {
  if (recentNewestFirst.length < TREND_WINDOW * 2) return null;
  const latest = passRate(recentNewestFirst.slice(0, TREND_WINDOW));
  const earlier = passRate(recentNewestFirst.slice(TREND_WINDOW, TREND_WINDOW * 2));
  if (latest == null || earlier == null) return null;
  const points = latest - earlier;
  if (Math.abs(points) < TREND_THRESHOLD) return null;
  return { direction: points > 0 ? "up" : "down", points: Math.abs(points) };
}

/** When the project last moved: its latest run's start, else its creation. Older API
 * responses predate `last_activity_at`, so fall back the same way the backend does. */
export function activityOf(project: ProjectOverviewItem): string {
  return project.last_activity_at ?? project.stats.last?.created_at ?? project.created_at;
}

/** Pass rate over every finished run in the project's history. */
export function projectPassRate(project: ProjectOverviewItem): number | null {
  const finished = project.stats.total - (project.stats.active ?? 0);
  return finished > 0 ? Math.round((project.stats.succeeded / finished) * 100) : null;
}

/** Two-letter monogram for the row tile: initials of the first two words. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

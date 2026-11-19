"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatWhen } from "@/lib/format";
import { activityOf, passTrend, projectPassRate, stateOf } from "@/lib/project-insights";
import type { ProjectOverviewItem } from "@/lib/types";
import { ProjectActions } from "./project-actions";
import { ProjectHeartbeat } from "./project-heartbeat";

/** Each project's state as a word beside a dot in its colour (see projects-editorial.css). */
const STATE_META: Record<ReturnType<typeof stateOf>, { label: string; tone: string }> = {
  needs_you: { label: "Needs you", tone: "warn" },
  running: { label: "Running", tone: "accent" },
  failing: { label: "Failing", tone: "danger" },
  passing: { label: "Passed", tone: "ok" },
  idle: { label: "Stopped", tone: "neutral" },
  new: { label: "No runs yet", tone: "neutral" },
};

interface ItemProps {
  project: ProjectOverviewItem;
  onChanged: () => void;
}

function Status({ project }: { project: ProjectOverviewItem }) {
  const meta = STATE_META[stateOf(project)];
  return <span className="axp-status cf-project-status" data-tone={meta.tone}><i aria-hidden />{meta.label}</span>;
}

/** The project's name and description; its pseudo-element makes the whole row or card clickable. */
function ProjectLink({ project }: { project: ProjectOverviewItem }) {
  return (
    <Link href={`/projects/${project.id}`} data-project-link className="axp-link">
      <span className="axp-name">{project.name}</span>
      <span className="axp-desc">{project.description || "No description"}</span>
    </Link>
  );
}

function Trend({ project }: { project: ProjectOverviewItem }) {
  const trend = passTrend(project.recent_runs);
  if (!trend) return null;
  const Arrow = trend.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="axp-trend" data-direction={trend.direction} title={`${trend.points} points ${trend.direction} over the last 5 runs`}>
      <Arrow aria-hidden />
      {trend.points} pts
      <span className="sr-only">{` points ${trend.direction} over the last 5 runs`}</span>
    </span>
  );
}

/** "8 runs · 50% passed", with the pass-rate trend when there is enough history for one. */
function Results({ project }: { project: ProjectOverviewItem }) {
  const { total } = project.stats;
  const rate = projectPassRate(project);
  if (total === 0) return <span className="axp-runs">No runs yet</span>;
  return (
    <span className="axp-runs">
      {total} {total === 1 ? "run" : "runs"}
      {rate != null && <> · {rate}% passed</>}
      <Trend project={project} />
    </span>
  );
}

/** One project as a list row. The whole row opens the project; the run bars and the actions
 * menu sit above that link and keep their own clicks. */
export function ProjectListRow({ project, onChanged }: ItemProps) {
  return (
    <li className="axp-row cf-project-row">
      <ProjectLink project={project} />
      <Status project={project} />
      {project.recent_runs.length > 0
        ? <ProjectHeartbeat runs={project.recent_runs} className="axp-heartbeat" />
        : <span aria-hidden />}
      <Results project={project} />
      <time dateTime={activityOf(project)}>{formatWhen(activityOf(project))}</time>
      <ProjectActions project={project} runCount={project.stats.total} onChanged={onChanged} />
    </li>
  );
}

/** The same project as a soft card, for the grid layout. */
export function ProjectTile({ project, onChanged }: ItemProps) {
  return (
    <li className="axp-card cf-project-tile">
      <div className="axp-card-top">
        <ProjectLink project={project} />
        <ProjectActions project={project} runCount={project.stats.total} onChanged={onChanged} />
      </div>
      <div className="axp-card-pulse">
        <Status project={project} />
        {project.recent_runs.length > 0 && <ProjectHeartbeat runs={project.recent_runs} className="axp-heartbeat" />}
      </div>
      <p className="axp-card-foot">
        <Results project={project} />
        <time dateTime={activityOf(project)}>{formatWhen(activityOf(project))}</time>
      </p>
    </li>
  );
}

/** Column names for the list layout, aligned with ProjectListRow's columns. */
export function ProjectListHeader() {
  return (
    <div className="axp-list-head" aria-hidden>
      <span>Project</span>
      <span>Status</span>
      <span>Recent runs</span>
      <span>Results</span>
      <span>Updated</span>
      <span />
    </div>
  );
}

/** The page's lead: one serif sentence about every project's runs. */
export function ProjectsSummary({ projects, runs, succeeded }: { projects: number; runs: number; succeeded: number }) {
  const noun = projects === 1 ? "project" : "projects";
  if (runs === 0) {
    return <p className="axp-summary cf-projects-summary"><strong>{projects}</strong> {noun}, no runs yet.</p>;
  }
  return (
    <p className="axp-summary cf-projects-summary">
      <strong>{succeeded} of {runs}</strong> runs passed across <strong>{projects}</strong> {noun}.
    </p>
  );
}

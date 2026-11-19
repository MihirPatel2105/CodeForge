"use client";

import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { ProjectActions } from "@/components/dashboard/project-actions";
import { ProjectHeartbeat } from "@/components/dashboard/project-heartbeat";
import type { ProjectsToolbarProps } from "@/components/dashboard/projects-toolbar";
import { formatWhen } from "@/lib/format";
import { activityOf, projectPassRate, stateOf, type ProjectState } from "@/lib/project-insights";
import type { ProjectOverviewItem } from "@/lib/types";

const STATE_LABEL: Record<ReturnType<typeof stateOf>, { label: string; tone: string }> = {
  needs_you: { label: "Needs you", tone: "warn" },
  running: { label: "Running", tone: "accent" },
  failing: { label: "Failing", tone: "danger" },
  passing: { label: "Passing", tone: "ok" },
  idle: { label: "Stopped", tone: "neutral" },
  new: { label: "No runs yet", tone: "neutral" },
};

const FILTERS: { value: ProjectState | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "needs_you", label: "Needs you" },
  { value: "running", label: "Running" },
  { value: "failing", label: "Failing" },
  { value: "passing", label: "Passing" },
];

/** The page's lead: one serif sentence about every run, beside the one action. */
export function ProjectsSummary({ projects, runs, succeeded }: { projects: number; runs: number; succeeded: number }) {
  if (projects === 0) return <p className="axp-summary">Start your first project.</p>;
  if (runs === 0) return <p className="axp-summary"><strong>{projects}</strong> {projects === 1 ? "project" : "projects"}, no runs yet.</p>;
  return (
    <p className="axp-summary">
      <strong>{succeeded} of {runs}</strong> runs passed across <strong>{projects}</strong> {projects === 1 ? "project" : "projects"}.
    </p>
  );
}

/** Status as text tabs, view and search on one quiet line, and the layout as two small icons. */
export function EditorialProjectsToolbar({
  archived, onArchivedChange, state, onStateChange, search, onSearchChange, layout, onLayoutChange, searchRef,
}: ProjectsToolbarProps) {
  return (
    <div className="axp-toolbar">
      <div className="axp-tabs" role="group" aria-label="Filter by status">
        {FILTERS.map((option) => (
          <button key={option.label} type="button" aria-pressed={state === option.value} onClick={() => onStateChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="axp-tools">
        <div className="axp-view" role="group" aria-label="Project view">
          {[false, true].map((value) => (
            <button key={String(value)} type="button" aria-pressed={archived === value} onClick={() => onArchivedChange(value)}>
              {value ? "Archived" : "Active"}
            </button>
          ))}
        </div>
        <label className="axp-search">
          <Search aria-hidden />
          <span className="sr-only">Search projects</span>
          <input
            ref={searchRef}
            id="project-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search projects"
            aria-keyshortcuts="/"
          />
          <kbd aria-hidden>/</kbd>
        </label>
        <div className="axp-layout" role="group" aria-label="Layout">
          {(["list", "grid"] as const).map((value) => {
            const Icon = value === "list" ? List : LayoutGrid;
            return (
              <button key={value} type="button" aria-pressed={layout === value} aria-label={value === "list" ? "List layout" : "Grid layout"} onClick={() => onLayoutChange(value)}>
                <Icon aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Status({ project }: { project: ProjectOverviewItem }) {
  const meta = STATE_LABEL[stateOf(project)];
  return <span className="axp-status" data-tone={meta.tone}><i aria-hidden />{meta.label}</span>;
}

function ProjectLink({ project }: { project: ProjectOverviewItem }) {
  return (
    <Link href={`/projects/${project.id}`} data-project-link className="axp-link">
      <span className="axp-name">{project.name}</span>
      <span className="axp-desc">{project.description || "No description"}</span>
    </Link>
  );
}

function RunLine({ project }: { project: ProjectOverviewItem }) {
  const { total } = project.stats;
  const rate = projectPassRate(project);
  if (total === 0) return <span className="axp-runs">No runs yet</span>;
  return (
    <span className="axp-runs">
      {total} {total === 1 ? "run" : "runs"}
      {rate != null && <> · {rate}% passed</>}
    </span>
  );
}

interface ItemProps {
  project: ProjectOverviewItem;
  onChanged: () => void;
}

/** A project as a soft card: what it is, how it is doing, and when it last moved. */
export function EditorialProjectCard({ project, onChanged }: ItemProps) {
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
        <RunLine project={project} />
        <time dateTime={activityOf(project)}>{formatWhen(activityOf(project))}</time>
      </p>
    </li>
  );
}

/** The same project as one line of a list, columns aligned with the header above it. */
export function EditorialProjectRow({ project, onChanged }: ItemProps) {
  return (
    <li className="axp-row cf-project-row">
      <ProjectLink project={project} />
      <Status project={project} />
      {project.recent_runs.length > 0 ? <ProjectHeartbeat runs={project.recent_runs} className="axp-heartbeat" /> : <span aria-hidden />}
      <RunLine project={project} />
      <time dateTime={activityOf(project)}>{formatWhen(activityOf(project))}</time>
      <ProjectActions project={project} runCount={project.stats.total} onChanged={onChanged} />
    </li>
  );
}

export function EditorialListHeader() {
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

"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatWhen } from "@/lib/format";
import { activityOf, monogram, passTrend, projectPassRate, stateOf } from "@/lib/project-insights";
import { tone as toneClasses, type Tone } from "@/lib/tone";
import type { ProjectOverviewItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProjectActions } from "./project-actions";
import { ProjectHeartbeat } from "./project-heartbeat";

/** Columns shared by the list header and every row, so they line up. */
export const LIST_COLUMNS =
  "md:grid-cols-[minmax(0,1fr)_128px_132px_92px_56px_112px_32px]";

const STATE_META: Record<ReturnType<typeof stateOf>, { label: string; tone: Tone; dot: string }> = {
  needs_you: { label: "Needs you", tone: "warn", dot: "bg-warn" },
  running: { label: "Running", tone: "accent", dot: "bg-accent" },
  failing: { label: "Failing", tone: "danger", dot: "bg-danger" },
  passing: { label: "Passed", tone: "ok", dot: "bg-ok" },
  idle: { label: "Stopped", tone: "neutral", dot: "bg-border-strong" },
  new: { label: "No runs", tone: "neutral", dot: "bg-border-strong" },
};

interface RowProps {
  project: ProjectOverviewItem;
  onChanged: () => void;
}

function StatusDot({ project }: { project: ProjectOverviewItem }) {
  const state = stateOf(project);
  return (
    <span className="relative inline-flex size-2 shrink-0" aria-hidden>
      {state === "running" && (
        <span className="absolute inset-0 rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
      )}
      <span className={cn("relative size-2 rounded-full", STATE_META[state].dot)} />
    </span>
  );
}

function StatusPill({ project }: { project: ProjectOverviewItem }) {
  const meta = STATE_META[stateOf(project)];
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-[650]", toneClasses[meta.tone].soft)}>
      <StatusDot project={project} />
      {meta.label}
    </span>
  );
}

function PassRate({ project }: { project: ProjectOverviewItem }) {
  const rate = projectPassRate(project);
  const trend = passTrend(project.recent_runs);
  if (rate == null) return <span className="font-mono text-[12.5px] text-fg-faint">—</span>;
  const Arrow = trend?.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[12.5px] tabular-nums">
      <span className={rate >= 50 ? "text-ok" : "text-warn"}>{rate}%</span>
      {trend && (
        <span
          title={`${trend.points} points ${trend.direction} over the last 5 runs`}
          className={cn("inline-flex items-center text-[11px]", trend.direction === "up" ? "text-ok" : "text-danger")}
        >
          <Arrow className="size-3" aria-hidden />
          {trend.points}
          <span className="sr-only">{` points ${trend.direction} over the last 5 runs`}</span>
        </span>
      )}
    </span>
  );
}

function ProjectLink({ project, className }: { project: ProjectOverviewItem; className?: string }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      data-project-link
      className={cn(
        "cf-project-link block min-w-0 rounded-md outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent",
        className,
      )}
    >
      <span className="block truncate text-[15px] font-[650] tracking-[-0.01em] text-fg">{project.name}</span>
      <span className="mt-0.5 block truncate text-[12.5px] text-fg-muted">
        {project.description || "No description"}
      </span>
    </Link>
  );
}

/** One project as a dense list row. The whole row opens the project; the run bars and the
 * actions menu sit above that link and keep their own clicks. */
export function ProjectListRow({ project, onChanged }: RowProps) {
  const { stats } = project;
  return (
    <li className={cn("cf-project-row group relative grid grid-cols-[36px_minmax(0,1fr)_32px] items-center gap-x-3.5 gap-y-2.5 border-b border-rule px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 has-[[data-project-link]:focus-visible]:bg-surface-2/60 md:gap-x-4 md:px-5", LIST_COLUMNS)}>
      <span className="grid size-9 place-items-center rounded-[10px] border border-border bg-bg font-mono text-[12px] font-[650] text-fg-muted md:hidden" aria-hidden>
        {monogram(project.name)}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden size-9 shrink-0 place-items-center rounded-[10px] border border-border bg-bg font-mono text-[12px] font-[650] text-fg-muted md:grid" aria-hidden>
          {monogram(project.name)}
        </span>
        <ProjectLink project={project} />
      </div>
      <div className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto md:order-last">
        <ProjectActions project={project} onChanged={onChanged} />
      </div>
      <div className="col-span-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[50px] md:contents">
        <StatusPill project={project} />
        <ProjectHeartbeat runs={project.recent_runs} />
        <PassRate project={project} />
        <span className="font-mono text-[12.5px] tabular-nums text-fg-muted">
          {stats.total}
          <span className="md:sr-only"> {stats.total === 1 ? "run" : "runs"}</span>
        </span>
        <time dateTime={activityOf(project)} className="text-[12px] text-fg-muted">
          {formatWhen(activityOf(project))}
        </time>
      </div>
    </li>
  );
}

/** The same project as a compact card, for the grid layout. */
export function ProjectTile({ project, onChanged }: RowProps) {
  const { stats } = project;
  return (
    <li className="cf-project-tile group relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-[border-color,box-shadow] duration-200 hover:border-accent-bd hover:shadow-[0_14px_36px_rgba(27,41,70,0.08)] has-[[data-project-link]:focus-visible]:border-accent-bd">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-bg font-mono text-[12.5px] font-[650] text-fg-muted" aria-hidden>
          {monogram(project.name)}
        </span>
        <ProjectLink project={project} className="flex-1" />
        <ProjectActions project={project} onChanged={onChanged} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <StatusPill project={project} />
        <ProjectHeartbeat runs={project.recent_runs} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-rule pt-3 font-mono text-[12px] text-fg-muted">
        <span>{stats.total} {stats.total === 1 ? "run" : "runs"}</span>
        <PassRate project={project} />
        {stats.avg_loops != null && <span className="text-loop">{stats.avg_loops.toFixed(1)} loops</span>}
        <time dateTime={activityOf(project)} className="font-sans">{formatWhen(activityOf(project))}</time>
      </div>
    </li>
  );
}

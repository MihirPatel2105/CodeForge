"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FolderPlus, LoaderCircle, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, getToken, ApiError } from "@/lib/api";
import type { ProjectOverviewItem, ProjectResponse, RunSummary } from "@/lib/types";
import { OUTCOME_FILL, type RunStats } from "@/lib/run-stats";
import { RUN_STATUS_META, tone } from "@/lib/tone";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/dashboard/app-header";

interface ProjectRow extends ProjectResponse {
  runs: RunSummary[];
  stats: RunStats;
}

const LABEL = "text-[12px] font-[650] text-fg-muted";

function projectRow(item: ProjectOverviewItem): ProjectRow {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    created_at: item.created_at,
    runs: item.recent_runs,
    stats: { ...item.stats, avgLoops: item.stats.avg_loops },
  };
}

/** Projects (design_handoff/README.md "Other screens"). Renders whichever state the
 * real `/projects` list implies — empty or populated — matching UI_BRIEF.md §7 state 1
 * and the populated example, both live in the same component. */
export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totals, setTotals] = useState({ projects: 0, runs: 0, succeeded: 0 });
  const [matchingProjects, setMatchingProjects] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async (query = "") => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const page = await api.projectOverview({ q: query.trim() });
      if (currentRequest !== requestId.current) return;
      setProjects(page.items.map(projectRow));
      setNextCursor(page.next_cursor);
      setTotals({ projects: page.total_projects, runs: page.total_runs, succeeded: page.total_succeeded });
      setMatchingProjects(page.matching_projects);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Couldn't load projects.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [router]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const currentRequest = requestId.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await api.projectOverview({ cursor: nextCursor, q: search.trim() });
      if (currentRequest !== requestId.current) return;
      setProjects((current) => [...(current ?? []), ...page.items.map(projectRow)]);
      setNextCursor(page.next_cursor);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err instanceof ApiError ? err.message : "Couldn't load more projects.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, search]);

  useEffect(() => {
    if (!getToken()) {
      // `replace` so Back cannot return to a page this visitor cannot see.
      router.replace("/login");
      return;
    }
    const timer = setTimeout(() => void load(search), search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [router, load, search]);

  const query = search.trim();

  return (
    <div className="cf-projects min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1320px] px-5 pb-20 pt-8 md:px-10 md:pt-10 lg:px-14">
        <div className="cf-workspace-stage">
        <section className="cf-projects-intro relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-7 md:px-9 md:py-8">
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h1 className="font-display text-[36px] font-[700] tracking-[-0.055em] text-fg md:text-[42px]">
                Projects
              </h1>
              <p className="mt-2 max-w-[58ch] text-[14px] leading-[1.6] text-fg-muted md:text-[15px]">
                Pick up an API or start a new one. Each project keeps its runs, code, and test results together.
              </p>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button className="h-12 gap-2 rounded-full px-6 text-[14px]" />
                }
              >
                <Plus className="h-4 w-4" aria-hidden />
                New project
              </DialogTrigger>
              <NewProjectDialogContent
                onCreated={(project) => {
                  setSearch("");
                  setNewProjectId(project.id);
                  setOpen(false);
                  void load("");
                }}
              />
            </Dialog>
          </div>
        </section>

        {/* Portfolio totals. Only rendered once there is something to total. */}
        {loading && projects == null ? (
          <div className="cf-workspace-summary grid rounded-3xl" aria-hidden="true">
            {[0, 1, 2].map((item) => <div key={item} className="space-y-2"><div className="h-3 w-16 animate-pulse rounded bg-border" /><div className="h-7 w-12 animate-pulse rounded bg-border" /></div>)}
          </div>
        ) : projects && totals.projects > 0 && (
          <dl className="cf-workspace-summary grid overflow-hidden rounded-3xl border border-border bg-surface sm:grid-cols-3">
            <Figure label="Projects" value={String(totals.projects)} />
            <Figure label="Total runs" value={String(totals.runs)} bordered />
            <Figure
              label="Successful runs"
              value={String(totals.succeeded)}
              hint={
                totals.runs > 0
                  ? `${Math.round((totals.succeeded / totals.runs) * 100)}% of runs`
                  : undefined
              }
              bordered
            />
          </dl>
        )}

        </div>

        {error && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">
            <p>{error}</p>
            <Button type="button" variant="outline" onClick={() => void (nextCursor && projects ? loadMore() : load(search))} disabled={loading || loadingMore}>
              Try again
            </Button>
          </div>
        )}

        {loading && projects == null ? (
          <LoadingState />
        ) : projects == null ? null : projects.length === 0 && !query ? (
          <EmptyState onNewProject={() => setOpen(true)} />
        ) : (
          <section className="mt-6" aria-labelledby="project-list-heading">
            <div className="flex flex-wrap items-end justify-between gap-5 border-b border-rule pb-4">
              <div>
                <span className={LABEL}>Your workspaces</span>
                <h2
                  id="project-list-heading"
                  className="font-display mt-2 text-[24px] font-[700] tracking-[-0.04em] text-fg"
                >
                  Your projects
                </h2>
              </div>
              <div className="w-full sm:w-[280px]">
                <label htmlFor="project-search" className="sr-only">Search projects</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" aria-hidden />
                  <Input
                    id="project-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search projects"
                    className="h-11 rounded-xl border-border-strong bg-surface pl-10 pr-4 text-[14px]"
                  />
                </div>
              </div>
            </div>

            <p role="status" className="mt-4 text-[12px] font-[550] text-fg-muted">
              {query
                ? `${projects.length} of ${matchingProjects} matching projects shown`
                : `${projects.length} of ${totals.projects} projects shown`}
            </p>

            {projects.length ? (
              <ul className="cf-workspace-grid mt-6 grid gap-6 md:grid-cols-2">
                {projects.map((project) => (
                  <li key={project.id} className={project.id === newProjectId ? "motion-safe:animate-[cfReadoutEnter_300ms_cubic-bezier(.16,1,.3,1)]" : undefined}>
                    <ProjectCard project={project} />
                  </li>
                ))}
                {!query && (
                  <li>
                    <NewProjectCard onClick={() => setOpen(true)} />
                  </li>
                )}
              </ul>
            ) : (
              <div className="mt-5 rounded-3xl border border-border bg-surface px-6 py-14 text-center">
                <h3 className="font-display text-[20px] font-[700] tracking-[-0.035em] text-fg">
                  No matching projects
                </h3>
                <p className="mt-2 text-[14px] text-fg-muted">Try a different name or description.</p>
                <Button type="button" variant="outline" onClick={() => setSearch("")} className="mt-5 rounded-xl">
                  Clear search
                </Button>
              </div>
            )}
            {nextCursor && <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore} className="mt-6">{loadingMore ? "Loading…" : "Load more projects"}</Button>}
          </section>
        )}
      </main>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  bordered,
}: {
  label: string;
  value: string;
  hint?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative px-6 py-4 sm:py-5",
        bordered && "border-t border-rule sm:border-l sm:border-t-0",
      )}
    >
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1 flex items-baseline gap-3">
        <span className="font-display text-[30px] font-[700] tracking-[-0.055em] text-fg">
          {value}
        </span>
        {hint && <span className="text-[12px] font-[600] text-ok">{hint}</span>}
      </dd>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const { stats } = project;
  const lastMeta = stats.last
    ? (RUN_STATUS_META[stats.last.status] ?? {
        label: stats.last.status,
        tone: "neutral" as const,
      })
    : null;
  // Oldest-to-newest, so the strip reads left to right like the history it represents.
  const strip = project.runs.slice(0, 14).reverse();

  return (
    <Link
      href={`/projects/${project.id}`}
      className="cf-project-card group relative flex min-h-[280px] h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface p-6 transition-[border-color,box-shadow] duration-200 hover:border-accent-bd hover:shadow-[0_16px_40px_rgba(27,41,70,0.09)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" aria-hidden />

      <div className="relative z-10 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h3 className="font-display truncate text-[22px] font-[700] tracking-[-0.045em] text-fg">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-2 line-clamp-2 max-w-[56ch] text-[14px] leading-[1.6] text-fg-muted">
              {project.description}
            </p>
          )}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-bg text-fg-faint transition-colors group-hover:border-accent-bd group-hover:bg-accent-soft group-hover:text-accent">
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-[2px]"
            aria-hidden
          />
        </span>
      </div>

      {/* Outcome strip — one tick per run, newest at the right. Gives the shape of a
          project's history at a glance without adding another number to read.

          Ticks are a fixed width rather than `flex-1`. Stretching them made a project
          with a single successful run render as one full-width green bar, which reads
          as a progress meter sitting at 100% — a completely different claim from "one
          run, and it passed". */}
      {strip.length > 0 && (
        <div className="relative z-10 mt-5" aria-hidden>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[12px] font-[600] text-fg-muted">
              Recent runs
            </span>
            <span className="text-[11px] text-fg-muted">
              {strip.length === 1 ? "1 run" : `last ${strip.length}`}
            </span>
          </div>
          <div className="flex items-center gap-[4px]">
            {strip.map((run) => (
              <span
                key={run.id}
                title={run.status}
                className={cn(
                  "h-[6px] w-5 rounded-full",
                  OUTCOME_FILL[run.status] ?? "bg-border-strong",
                )}
              />
            ))}
            <span className="h-px flex-1 bg-rule" />
          </div>
        </div>
      )}

      <div className="relative z-10 mt-auto flex flex-col gap-4 border-t border-rule pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-baseline gap-6">
          <Stat label="runs" value={String(stats.total)} />
          <Stat label="succeeded" value={String(stats.succeeded)} />
          {stats.avgLoops != null && <Stat label="avg loops" value={stats.avgLoops.toFixed(1)} />}
        </div>

        {lastMeta && stats.last && (
          <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-[5px]">
            <span
              className={cn(
                "w-fit rounded-lg px-2 py-[3px] text-[11px] font-[650]",
                tone[lastMeta.tone].soft,
              )}
            >
              {lastMeta.label}
            </span>
            <span className="text-[11px] text-fg-muted">
              {formatWhen(stats.last.created_at)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/** The empty cell at the end of the grid.
 *
 * Deliberately quiet — dashed, no fill, muted type. It is an invitation sitting in the
 * gap a short list leaves, not a card competing with the real ones beside it. */
function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cf-project-new group relative flex min-h-[280px] h-full w-full flex-col items-start justify-between overflow-hidden rounded-2xl border border-dashed border-border-strong p-6 text-left transition-[border-color,background-color] duration-200 hover:border-accent-bd hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-accent-bd bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-105">
        <FolderPlus className="h-[19px] w-[19px]" aria-hidden />
      </span>

      <span className="relative z-10 block">
        <span className="font-display block text-[22px] font-[700] tracking-[-0.04em] text-fg">
          Start another API
        </span>
        <span className="mt-2 block max-w-[36ch] text-[13px] leading-[1.55] text-fg-muted">
          Create a clean workspace for its prompts, agent runs, code, and tests.
        </span>
        <span className="mt-5 inline-flex items-center gap-2 text-[13px] font-[650] text-accent">
          New project
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-display block text-[17px] font-[600] tracking-[-0.03em] text-fg">
        {value}
      </span>
      <span className={cn(LABEL, "mt-[2px] block text-[11px]")}>{label}</span>
    </div>
  );
}

function EmptyState({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div className="cf-project-empty mt-8 flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border px-6 py-20 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-accent-bd bg-accent-soft">
        <FolderPlus className="h-6 w-6 text-accent" aria-hidden />
      </div>
      <span className={cn(LABEL, "mt-6 text-accent")}>empty workspace</span>
      <h2 className="font-display mt-3 text-[24px] font-[650] tracking-[-0.045em] text-fg">
        Start your first API project
      </h2>
      <p className="mt-3 max-w-[44ch] text-[15px] leading-[1.6] text-fg-muted">
        A project holds the runs for one API. Name it after the thing you are building.
      </p>
      <Button onClick={onNewProject} className="mt-7 h-11 gap-2 px-5">
        <Plus className="h-4 w-4" aria-hidden />
        New project
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-6" aria-label="Loading projects" aria-live="polite">
      <div className="flex items-end justify-between border-b border-rule pb-4">
        <div className="space-y-2.5">
          <div className="h-2.5 w-24 animate-pulse rounded bg-border" />
          <div className="h-6 w-40 animate-pulse rounded bg-border" />
        </div>
        <div className="h-2.5 w-16 animate-pulse rounded bg-border" />
      </div>
      <div className="cf-workspace-grid mt-6 grid gap-6 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="min-h-[240px] animate-pulse rounded-3xl border border-border bg-bg p-6"
          >
            <div className="h-2.5 w-28 rounded bg-border" />
            <div className="mt-5 h-6 w-44 rounded bg-border" />
            <div className="mt-3 h-3 w-3/4 rounded bg-border" />
            <div className="mt-8 h-14 rounded-lg bg-bg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading projects</span>
    </div>
  );
}

function NewProjectDialogContent({ onCreated }: { onCreated: (project: ProjectResponse) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const project = await api.createProject({ name, description: description || undefined });
      setName("");
      setDescription("");
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="rounded-xl border-border p-0 shadow-[0_30px_90px_rgba(22,24,28,0.2)]">
      <div className="border-b border-rule bg-surface-2 px-6 py-5">
        <DialogHeader>
          <span className={LABEL}>create workspace</span>
          <DialogTitle className="font-display mt-2 text-[22px] tracking-[-0.04em]">
            New project
          </DialogTitle>
        </DialogHeader>
      </div>
      <form className="flex flex-col gap-4 px-6 pb-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="project-name" className={LABEL}>
            Name
          </Label>
          <Input
            id="project-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Book Collection API"
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="project-description" className={LABEL}>
            Description (optional)
          </Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this API for?"
          />
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <DialogFooter className="mt-2 border-t border-rule pt-5">
          <Button type="submit" disabled={submitting} className="min-w-[136px]">
            {submitting && <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
            {submitting ? "Creating project…" : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

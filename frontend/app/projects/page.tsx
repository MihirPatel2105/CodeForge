"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FolderPlus, Plus } from "lucide-react";
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
import type { ProjectResponse, RunSummary } from "@/lib/types";
import { runStats, OUTCOME_FILL, type RunStats } from "@/lib/run-stats";
import { RUN_STATUS_META, tone } from "@/lib/tone";
import { formatWhen, parseApiTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/dashboard/app-header";

interface ProjectRow extends ProjectResponse {
  runs: RunSummary[];
  stats: RunStats;
}

const LABEL = "text-[12px] font-[650] text-fg-muted";

/** Projects (design_handoff/README.md "Other screens"). Renders whichever state the
 * real `/projects` list implies — empty or populated — matching UI_BRIEF.md §7 state 1
 * and the populated example, both live in the same component. */
export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listProjects();
      // The list endpoint carries no run data, so each project's history is fetched in
      // parallel rather than adding a field the backend contract does not have. The
      // whole history is kept now, not just its length — it is what every figure on
      // this page is derived from, at no extra request cost.
      const histories = await Promise.all(list.map((p) => api.listProjectRuns(p.id)));
      const rows = list.map((p, i) => ({
        ...p,
        runs: histories[i],
        stats: runStats(histories[i]),
      }));
      // Most recently active first. A list ordered by creation buries the project you
      // were just working in as soon as there are more than a few.
      rows.sort((a, b) => {
        const at = a.stats.last ? parseApiTime(a.stats.last.created_at).getTime() : 0;
        const bt = b.stats.last ? parseApiTime(b.stats.last.created_at).getTime() : 0;
        return bt - at;
      });
      setProjects(rows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Couldn't load projects.");
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      // `replace` so Back cannot return to a page this visitor cannot see.
      router.replace("/login");
      return;
    }
    load();
  }, [router, load]);

  const totals = projects
    ? projects.reduce(
        (acc, p) => ({
          runs: acc.runs + p.stats.total,
          succeeded: acc.succeeded + p.stats.succeeded,
        }),
        { runs: 0, succeeded: 0 },
      )
    : null;

  return (
    <div className="cf-projects min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1320px] px-5 pb-20 pt-10 md:px-10 md:pt-14 lg:px-14">
        <section className="cf-projects-intro relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-8 shadow-[0_12px_36px_rgba(27,41,70,0.045)] md:px-9 md:py-10">
          <div className="relative z-10 flex flex-col items-start justify-between gap-7 md:flex-row md:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 text-[12px] font-[650] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                workspace overview
              </span>
              <h1 className="font-display mt-5 text-[38px] font-[700] tracking-[-0.055em] text-fg md:text-[46px]">
                Projects
              </h1>
              <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.65] text-fg-muted md:text-[16px]">
                One project per API. Every run keeps its agent decisions, generated code,
                review findings, and real test output together.
              </p>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button className="h-11 gap-2 rounded-xl px-5 text-[13px] shadow-[0_8px_22px_rgba(23,32,51,0.12)]" />
                }
              >
                <Plus className="h-4 w-4" aria-hidden />
                New project
              </DialogTrigger>
              <NewProjectDialogContent
                onCreated={() => {
                  setOpen(false);
                  load();
                }}
              />
            </Dialog>
          </div>
        </section>

        {/* Portfolio totals. Only rendered once there is something to total. */}
        {projects && projects.length > 0 && totals && (
          <dl className="mt-5 grid overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_36px_rgba(27,41,70,0.035)] sm:grid-cols-3">
            <Figure index="01" label="projects" value={String(projects.length)} />
            <Figure index="02" label="total runs" value={String(totals.runs)} bordered />
            <Figure
              index="03"
              label="successful runs"
              value={String(totals.succeeded)}
              hint={
                totals.runs > 0
                  ? `${Math.round((totals.succeeded / totals.runs) * 100)}% success`
                  : undefined
              }
              bordered
            />
          </dl>
        )}

        {error && (
          <p className="mt-6 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        )}

        {projects == null ? (
          <LoadingState />
        ) : projects.length === 0 ? (
          <EmptyState onNewProject={() => setOpen(true)} />
        ) : (
          <section className="mt-12" aria-labelledby="project-list-heading">
            <div className="flex items-end justify-between gap-5 border-b border-rule pb-4">
              <div>
                <span className={LABEL}>your workspaces</span>
                <h2
                  id="project-list-heading"
                  className="font-display mt-2 text-[24px] font-[700] tracking-[-0.04em] text-fg"
                >
                  Continue building
                </h2>
              </div>
              <span className="text-[12px] font-[550] text-fg-muted">
                {projects.length} {projects.length === 1 ? "project" : "projects"}
              </span>
            </div>

            <ul className="mt-5 grid gap-5 lg:grid-cols-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} />
                </li>
              ))}
              <li>
                <NewProjectCard onClick={() => setOpen(true)} />
              </li>
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function Figure({
  index,
  label,
  value,
  hint,
  bordered,
}: {
  index: string;
  label: string;
  value: string;
  hint?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative px-6 py-6 sm:py-7",
        bordered && "border-t border-rule sm:border-l sm:border-t-0",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <dt className={LABEL}>{label}</dt>
        <span className="font-mono text-[11px] text-fg-faint">{index}</span>
      </div>
      <dd className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-[34px] font-[700] tracking-[-0.055em] text-fg">
          {value}
        </span>
        {hint && <span className="font-mono text-[10.5px] text-ok">{hint}</span>}
      </dd>
      <span className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-accent-bd to-transparent opacity-60" aria-hidden />
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
      className="cf-project-card group relative flex min-h-[258px] h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-[0_10px_30px_rgba(27,41,70,0.035)] transition-[border-color,box-shadow] duration-200 hover:border-accent-bd hover:shadow-[0_16px_40px_rgba(27,41,70,0.09)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" aria-hidden />

      <div className="relative z-10 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <span className={LABEL}>project workspace</span>
          <h3 className="font-display mt-3 truncate text-[24px] font-[700] tracking-[-0.045em] text-fg">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-2 line-clamp-2 max-w-[56ch] text-[14px] leading-[1.6] text-fg-muted">
              {project.description}
            </p>
          )}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-fg-faint transition-colors group-hover:border-accent-bd group-hover:bg-accent-soft group-hover:text-accent">
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
        <div className="relative z-10 mt-6 rounded-xl border border-rule bg-surface-2 px-3.5 py-3" aria-hidden>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-[11px] font-[600] text-fg-muted">
              run history
            </span>
            <span className="font-mono text-[10.5px] text-fg-faint">
              {strip.length === 1 ? "1 run" : `last ${strip.length}`}
            </span>
          </div>
          <div className="flex items-center gap-[4px]">
            {strip.map((run) => (
              <span
                key={run.id}
                title={run.status}
                className={cn(
                  "h-[6px] w-5 rounded-[1px]",
                  OUTCOME_FILL[run.status] ?? "bg-border-strong",
                )}
              />
            ))}
            <span className="h-px flex-1 bg-rule" />
          </div>
        </div>
      )}

      <div className="relative z-10 mt-auto flex flex-col gap-5 border-t border-rule pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-baseline gap-6">
          <Stat label="runs" value={String(stats.total)} />
          <Stat label="succeeded" value={String(stats.succeeded)} />
          {stats.avgLoops != null && <Stat label="avg loops" value={stats.avgLoops.toFixed(1)} />}
        </div>

        {lastMeta && stats.last && (
          <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-[5px]">
            <span
              className={cn(
                "w-fit rounded-[2px] px-2 py-[3px] text-[11px] font-[650]",
                tone[lastMeta.tone].soft,
              )}
            >
              {lastMeta.label}
            </span>
            <span className="font-mono text-[11px] text-fg-faint">
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
      className="cf-project-new group relative flex min-h-[258px] h-full w-full flex-col items-start justify-between overflow-hidden rounded-2xl border border-dashed border-border-strong p-6 text-left transition-[border-color,background-color] duration-200 hover:border-accent-bd hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-accent-bd bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-105">
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
          new project
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
    <div className="cf-project-empty mt-8 flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border px-6 py-20 text-center shadow-[0_10px_30px_rgba(27,41,70,0.035)]">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-[5px] border border-accent-bd bg-accent-soft">
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
    <div className="mt-12" aria-label="Loading projects" aria-live="polite">
      <div className="flex items-end justify-between border-b border-rule pb-4">
        <div className="space-y-2.5">
          <div className="h-2.5 w-24 animate-pulse rounded bg-border" />
          <div className="h-6 w-40 animate-pulse rounded bg-border" />
        </div>
        <div className="h-2.5 w-16 animate-pulse rounded bg-border" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="min-h-[258px] animate-pulse rounded-[6px] border border-border bg-surface p-6"
          >
            <div className="h-2.5 w-28 rounded bg-border" />
            <div className="mt-5 h-6 w-44 rounded bg-border" />
            <div className="mt-3 h-3 w-3/4 rounded bg-border" />
            <div className="mt-8 h-14 rounded-[3px] bg-bg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading projects</span>
    </div>
  );
}

function NewProjectDialogContent({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createProject({ name, description: description || undefined });
      setName("");
      setDescription("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="rounded-[6px] border-border p-0 shadow-[0_30px_90px_rgba(22,24,28,0.2)]">
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
            {submitting ? "…" : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

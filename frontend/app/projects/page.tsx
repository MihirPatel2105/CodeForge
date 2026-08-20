"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FolderPlus } from "lucide-react";
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
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/dashboard/app-header";

interface ProjectRow extends ProjectResponse {
  runs: RunSummary[];
  stats: RunStats;
}

const LABEL = "font-mono text-[10.5px] font-[600] uppercase tracking-[0.14em] text-fg-faint";

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
      setProjects(
        list.map((p, i) => ({ ...p, runs: histories[i], stats: runStats(histories[i]) })),
      );
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
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-[1120px] px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[22px] font-[600] tracking-[-0.035em] text-fg">
            projects
          </h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>New project</DialogTrigger>
            <NewProjectDialogContent
              onCreated={() => {
                setOpen(false);
                load();
              }}
            />
          </Dialog>
        </div>

        {/* Portfolio totals. Only rendered once there is something to total. */}
        {projects && projects.length > 0 && totals && (
          <dl className="mt-8 grid grid-cols-3 border-y border-rule">
            <Figure label="projects" value={String(projects.length)} />
            <Figure label="runs" value={String(totals.runs)} bordered />
            <Figure
              label="succeeded"
              value={String(totals.succeeded)}
              hint={
                totals.runs > 0
                  ? `${Math.round((totals.succeeded / totals.runs) * 100)}%`
                  : undefined
              }
              bordered
            />
          </dl>
        )}

        {error && <p className="mt-6 text-[13px] text-danger">{error}</p>}

        {projects == null ? (
          <p className={cn(LABEL, "mt-10")}>loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState onNewProject={() => setOpen(true)} />
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </div>
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
    <div className={cn("py-5", bordered && "border-l border-rule pl-6")}>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-[26px] font-[600] tracking-[-0.04em] text-fg">
          {value}
        </span>
        {hint && <span className="font-mono text-[12px] text-fg-faint">{hint}</span>}
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
      className="group flex h-full flex-col border border-border bg-surface p-5 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display truncate text-[16px] font-[600] tracking-[-0.025em] text-fg">
            {project.name}
          </h2>
          {project.description && (
            <p className="mt-[6px] line-clamp-2 text-[13.5px] leading-[1.45] text-fg-muted">
              {project.description}
            </p>
          )}
        </div>
        <ArrowRight
          className="mt-[3px] h-4 w-4 shrink-0 text-fg-faint transition-transform group-hover:translate-x-[2px] group-hover:text-fg"
          aria-hidden
        />
      </div>

      {/* Outcome strip — one segment per run, newest at the right. Gives the shape of a
          project's history at a glance without adding another number to read. */}
      {strip.length > 0 && (
        <div className="mt-5 flex gap-[3px]" aria-hidden>
          {strip.map((run) => (
            <span
              key={run.id}
              title={run.status}
              className={cn(
                "h-[4px] flex-1 rounded-[1px]",
                OUTCOME_FILL[run.status] ?? "bg-border-strong",
              )}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-4 pt-5">
        <div className="flex items-baseline gap-[18px]">
          <Stat label="runs" value={String(stats.total)} />
          <Stat label="succeeded" value={String(stats.succeeded)} />
          {stats.avgLoops != null && <Stat label="avg loops" value={stats.avgLoops.toFixed(1)} />}
        </div>

        {lastMeta && stats.last && (
          <div className="flex shrink-0 flex-col items-end gap-[5px]">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-display block text-[17px] font-[600] tracking-[-0.03em] text-fg">
        {value}
      </span>
      <span className={cn(LABEL, "mt-[2px] block text-[9.5px]")}>{label}</span>
    </div>
  );
}

function EmptyState({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 border border-border py-24">
      <div className="flex h-11 w-11 items-center justify-center border border-border-strong">
        <FolderPlus className="h-5 w-5 text-fg-faint" aria-hidden />
      </div>
      <p className="font-display text-[19px] font-[600] tracking-[-0.03em] text-fg">
        no projects yet
      </p>
      <p className="max-w-[38ch] text-center text-[13.5px] leading-[1.5] text-fg-muted">
        A project holds the runs for one API. Name it after the thing you are building.
      </p>
      <Button onClick={onNewProject} className="mt-2">
        New project
      </Button>
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
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
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
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? "…" : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

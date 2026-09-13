"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock3,
  Play,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tone, RUN_STATUS_META } from "@/lib/tone";
import { formatElapsed, formatWhen } from "@/lib/format";
import { runStats } from "@/lib/run-stats";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse, RunSummary } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/app-header";

const LABEL = "font-mono text-[10.5px] font-[600] uppercase tracking-[0.14em] text-fg-faint";

/** Project detail (design_handoff/README.md "Other screens"): prompt entry on the
 * left, run history on the right. "Start run" calls the real `POST /runs` and
 * navigates into the live Live Run screen. */
export function ProjectDetail({
  project,
  history,
}: {
  project: ProjectResponse;
  history: RunSummary[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [ragEnabled, setRagEnabled] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const stats = runStats(history);

  async function startRun() {
    if (!prompt.trim()) return;
    setError(null);
    setStarting(true);
    try {
      const { run_id } = await api.createRun({
        project_id: project.id,
        prompt,
        rag_enabled: ragEnabled,
      });
      router.push(`/runs/${run_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the run.");
      setStarting(false);
    }
  }

  return (
    <div className="cf-project-detail min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1320px] px-6 pb-20 pt-9 md:px-10 md:pt-12 lg:px-14">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-[650] uppercase tracking-[0.13em] text-fg-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Projects
        </Link>

        <section className="cf-project-detail-hero mt-5 overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_24px_70px_rgba(22,24,28,0.075)]">
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(390px,0.65fr)]">
            <div className="relative px-6 py-8 md:px-9 md:py-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                project workspace
              </span>
              <h1 className="font-display mt-6 text-[30px] font-[650] tracking-[-0.055em] text-fg md:text-[38px]">
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-3 max-w-[66ch] text-[14px] leading-[1.65] text-fg-muted md:text-[15px]">
                  {project.description}
                </p>
              )}
            </div>

            {/* Every figure is derived from the history already loaded for this page. */}
            <dl className="cf-project-detail-stats cf-invert cf-lift grid grid-cols-2 bg-bg">
              <Figure index="01" label="runs" value={String(stats.total)} />
              <Figure index="02" label="succeeded" value={String(stats.succeeded)} bordered />
              <Figure index="03" label="failed" value={String(stats.failed)} topBorder />
              <Figure
                index="04"
                label="avg loops"
                value={stats.avgLoops == null ? "—" : stats.avgLoops.toFixed(1)}
                bordered
                topBorder
              />
            </dl>
          </div>
        </section>

        <div className="mt-10 grid gap-7 xl:grid-cols-[390px_minmax(0,1fr)] xl:items-start">
          {/* Prompt entry. Sticky so it stays reachable while a long history scrolls. */}
          <section className="overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_18px_50px_rgba(22,24,28,0.055)] xl:sticky xl:top-[78px]">
            <div className="cf-project-composer-head border-b border-rule px-5 py-5">
              <span className={LABEL}>new agent run</span>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-accent-bd bg-accent-soft text-accent">
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-[18px] font-[650] tracking-[-0.035em] text-fg">
                    Build from a prompt
                  </h2>
                  <p className="mt-0.5 text-[12px] text-fg-faint">
                    Describe the API in plain language.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-[7px]">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="prompt" className={LABEL}>
                    Describe the API
                  </label>
                  <span className="font-mono text-[9px] text-fg-faint">required</span>
                </div>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="I want an API to manage…"
                  className="min-h-[168px] resize-y rounded-[3px] border-border-strong bg-bg/60 px-4 py-3.5 text-[14px] leading-[1.6] focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/10"
                />
              </div>

              <div className="rounded-[4px] border border-border bg-surface-2/70 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border border-border bg-surface text-fg-muted">
                    <BookOpen className="h-4 w-4" aria-hidden />
                  </span>
                  <label htmlFor="rag-enabled" className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-[13px] font-[650] text-fg">Use example library</span>
                    <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-fg-faint">
                      {ragEnabled ? "Agents see 6 similar APIs" : "Agents use this prompt alone"}
                    </span>
                  </label>
                  <Switch
                    id="rag-enabled"
                    checked={ragEnabled}
                    onCheckedChange={setRagEnabled}
                    aria-label="Use example library"
                  />
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-[3px] border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
                >
                  {error}
                </p>
              )}

              <Button
                onClick={startRun}
                disabled={!prompt.trim() || starting}
                className="h-12 w-full gap-2 rounded-[3px] shadow-[0_10px_26px_rgba(22,24,28,0.14)]"
              >
                {starting ? (
                  "Starting…"
                ) : (
                  <>
                    Start run
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </Button>

              <p className="flex gap-2 text-[11.5px] leading-[1.5] text-fg-faint">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                The run pauses for approval after requirements and system design.
              </p>
            </div>
          </section>

          {/* Run history */}
          <section className="min-w-0 overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_18px_50px_rgba(22,24,28,0.05)]" aria-labelledby="run-history-heading">
            <div className="flex items-end justify-between gap-5 border-b border-rule bg-surface-2/55 px-5 py-5 md:px-6">
              <div>
                <span className={LABEL}>project activity</span>
                <h2 id="run-history-heading" className="font-display mt-2 text-[19px] font-[650] tracking-[-0.04em] text-fg">
                  Run history
                </h2>
              </div>
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[9.5px] font-[600] uppercase tracking-[0.1em] text-fg-faint">
                {history.length} {history.length === 1 ? "run" : "runs"}
              </span>
            </div>

            <div
              className="cf-run-history-grid hidden items-center gap-x-4 border-b border-border bg-bg/45 px-5 py-[11px] md:grid md:px-6"
            >
              {["Prompt", "Outcome", "Loops", "Elapsed", "When", ""].map((h) => (
                <span key={h} className={LABEL}>
                  {h}
                </span>
              ))}
            </div>

            {history.length === 0 ? (
              <div className="cf-project-history-empty flex min-h-[330px] flex-col items-center justify-center px-6 py-20 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-accent-bd bg-accent-soft text-accent">
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                </span>
                <p className="font-display mt-5 text-[18px] font-[650] tracking-[-0.035em] text-fg">
                  No runs yet
                </p>
                <p className="mt-2 max-w-[36ch] text-[13px] leading-[1.55] text-fg-muted">
                  Describe the API in the composer and start the agent workflow.
                </p>
              </div>
            ) : (
              history.map((run) => {
                const meta = RUN_STATUS_META[run.status] ?? {
                  label: run.status,
                  tone: "neutral" as const,
                };
                const elapsedMs =
                  new Date(run.updated_at).getTime() - new Date(run.created_at).getTime();
                return (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="cf-run-history-grid group grid gap-x-4 gap-y-4 border-b border-border px-5 py-5 transition-colors last:border-b-0 hover:bg-accent-soft/35 md:items-center md:gap-y-0 md:px-6 md:py-4"
                  >
                    <div className="cf-run-history-prompt min-w-0 md:pr-4">
                      <span className="mb-1.5 block font-mono text-[9px] font-[600] uppercase tracking-[0.12em] text-fg-faint md:hidden">
                        Prompt
                      </span>
                      <span className="line-clamp-2 text-[13.5px] leading-[1.5] text-fg md:truncate">
                        {run.prompt}
                      </span>
                    </div>
                    <div>
                      <span className="mb-1.5 block font-mono text-[9px] font-[600] uppercase tracking-[0.12em] text-fg-faint md:hidden">
                        Outcome
                      </span>
                      <span
                        className={cn(
                          "inline-flex w-fit rounded-[2px] px-2 py-[3px] text-[11px] font-[650]",
                          tone[meta.tone].soft,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <RunDatum
                      label="Loops"
                      className={
                        run.iterations > 0 ? "font-[700] text-loop" : "text-fg-faint"
                      }
                    >
                      {run.iterations}
                    </RunDatum>
                    <RunDatum label="Elapsed" className="text-fg-muted">
                      {formatElapsed(Math.max(0, elapsedMs))}
                    </RunDatum>
                    <RunDatum label="When" className="text-fg-faint">
                      {formatWhen(run.created_at)}
                    </RunDatum>
                    <ArrowRight className="hidden h-4 w-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent md:block" aria-hidden />
                  </Link>
                );
              })
            )}
          </section>
        </div>

        {/* Deleting sits at the very bottom, well past the things you came here to do.
            It is irreversible and takes the run history and stored code with it, so it
            should never be the thing your hand lands on. */}
        <section className="mt-14 flex flex-wrap items-center justify-between gap-5 rounded-[6px] border border-danger-bd/70 bg-danger-soft/35 px-5 py-5 md:px-6">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border border-danger-bd bg-surface text-danger">
              <Trash2 className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-[650] tracking-[-0.025em] text-fg">
                Delete project
              </h2>
              <p className="mt-1.5 max-w-[68ch] text-[12.5px] leading-[1.55] text-fg-muted">
                Removes this project, its {stats.total === 1 ? "run" : "runs"} and every
                generated file stored against {stats.total === 1 ? "it" : "them"}. This
                cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 rounded-[3px] border border-danger-bd bg-surface px-5 py-[11px] font-mono text-[10.5px] font-[650] uppercase tracking-[0.12em] text-danger transition-colors hover:bg-danger-soft"
          >
            Delete project
          </button>
        </section>

        <DeleteProjectDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          project={project}
          runCount={stats.total}
        />
      </main>
    </div>
  );
}

/**
 * Confirming a project deletion.
 *
 * Typing the name is deliberate friction, matching the account-deletion dialog. A plain
 * "are you sure?" is dismissed reflexively; having to reproduce the name makes you look
 * at which project you are about to destroy — which is the actual failure mode when two
 * projects are called something similar.
 */
function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
  runCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectResponse;
  runCount: number;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmation.trim() === project.name;

  async function handleDelete() {
    if (!matches || deleting) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteProject(project.id);
      // `replace`, so Back cannot return to a project that no longer exists.
      router.replace("/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete the project.");
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[6px] border-danger-bd p-0 shadow-[0_30px_90px_rgba(22,24,28,0.22)]">
        <div className="border-b border-danger-bd bg-danger-soft px-6 py-5">
          <DialogHeader>
            <span className={cn(LABEL, "text-danger")}>destructive action</span>
            <DialogTitle className="font-display mt-2 text-[22px] tracking-[-0.04em]">
              Delete this project?
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="text-[14px] leading-[1.6] text-fg-muted">
            <span className="font-[600] text-fg">{project.name}</span> and{" "}
            {runCount === 0
              ? "everything stored against it"
              : `its ${runCount} ${runCount === 1 ? "run" : "runs"}, including the generated code and test output`}{" "}
            will be permanently removed. There is no undo.
          </p>
          <div className="flex flex-col gap-[6px]">
            <label htmlFor="confirm-project" className={LABEL}>
              Type <span className="text-fg">{project.name}</span> to confirm
            </label>
            <Input
              id="confirm-project"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="h-11 rounded-[2px] border-border-strong bg-surface text-[14.5px] focus-visible:border-fg focus-visible:ring-0"
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-[2px] border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
            >
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="border-t border-rule px-6 py-5">
          <Button
            type="button"
            onClick={handleDelete}
            disabled={!matches || deleting}
            className="bg-danger text-surface hover:bg-danger disabled:opacity-45"
          >
            {deleting ? "Deleting…" : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunDatum({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block font-mono text-[9px] font-[600] uppercase tracking-[0.12em] text-fg-faint md:hidden">
        {label}
      </span>
      <span className={cn("font-mono text-[12px]", className)}>{children}</span>
    </div>
  );
}

function Figure({
  index,
  label,
  value,
  bordered,
  topBorder,
}: {
  index: string;
  label: string;
  value: string;
  bordered?: boolean;
  topBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[112px] flex-col justify-center px-5 py-5",
        bordered && "border-l border-rule",
        topBorder && "border-t border-rule",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <dt className={cn(LABEL, "text-[9px]")}>{label}</dt>
        <span className="font-mono text-[8.5px] text-fg-faint">{index}</span>
      </div>
      <dd className="font-display mt-2.5 text-[25px] font-[650] tracking-[-0.05em] text-fg">
        {value}
      </dd>
      <span className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-accent-bd to-transparent opacity-55" aria-hidden />
    </div>
  );
}

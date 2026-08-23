"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

const HISTORY_COLUMNS = "grid-cols-[1fr_200px_70px_86px_112px]";
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
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-[1220px] px-6 py-10">
        <Link
          href="/projects"
          className="font-mono text-[11px] font-[600] uppercase tracking-[0.12em] text-fg-faint hover:text-fg"
        >
          ← projects
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <h1 className="font-display text-[26px] font-[600] tracking-[-0.04em] text-fg">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.5] text-fg-muted">
                {project.description}
              </p>
            )}
          </div>

          {/* Figures for this project, derived from the history already on the page —
              the run table below shows every one of these events individually, but the
              totals are what tell you whether the thing is working. */}
          {stats.total > 0 && (
            <dl className="flex items-end gap-8">
              <Figure label="runs" value={String(stats.total)} />
              <Figure label="succeeded" value={String(stats.succeeded)} />
              <Figure label="failed" value={String(stats.failed)} />
              {stats.avgLoops != null && (
                <Figure label="avg loops" value={stats.avgLoops.toFixed(1)} />
              )}
            </dl>
          )}
        </div>

        <div className="mt-9 flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Prompt entry. Sticky so it stays reachable while a long history scrolls. */}
          <div className="flex w-full flex-col gap-4 lg:sticky lg:top-[78px] lg:w-[360px] lg:shrink-0">
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="prompt" className={LABEL}>
                Describe the API
              </label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="I want an API to manage…"
                className="min-h-[132px] rounded-[2px] border-border-strong bg-surface text-[14.5px] leading-[1.55] focus-visible:border-fg focus-visible:ring-0"
              />
            </div>

            <div className="flex items-center gap-3 border border-border bg-surface p-[14px]">
              <Switch checked={ragEnabled} onCheckedChange={setRagEnabled} />
              <div className="flex flex-col">
                <span className="text-[13.5px] font-[650] text-fg">Use example library</span>
                <span className="mt-[1px] text-[12px] leading-[1.4] text-fg-faint">
                  {ragEnabled
                    ? "Retrieval on — agents see 6 similar APIs"
                    : "Retrieval off — agents work from the prompt alone"}
                </span>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
              >
                {error}
              </p>
            )}

            <Button onClick={startRun} disabled={!prompt.trim() || starting} className="h-12">
              {starting ? "Starting…" : "Start run"}
            </Button>

            <p className="text-[12.5px] leading-[1.5] text-fg-faint">
              The run pauses twice for your approval — once on the requirements, once on
              the design.
            </p>
          </div>

          {/* Run history */}
          <div className="min-w-0 flex-1 border border-border bg-surface">
            <div
              className={cn(
                "grid items-center border-b border-border px-4 py-[11px]",
                HISTORY_COLUMNS,
              )}
            >
              {["Prompt", "Outcome", "Loops", "Elapsed", "When"].map((h) => (
                <span key={h} className={LABEL}>
                  {h}
                </span>
              ))}
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-20">
                <p className="font-display text-[17px] font-[600] tracking-[-0.03em] text-fg">
                  no runs yet
                </p>
                <p className="max-w-[34ch] text-center text-[13px] leading-[1.5] text-fg-muted">
                  Describe the API you want on the left, and the agents will take it from
                  there.
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
                    className={cn(
                      "grid items-center border-b border-border px-4 py-[13px] transition-colors last:border-b-0 hover:bg-surface-2",
                      HISTORY_COLUMNS,
                    )}
                  >
                    <span className="truncate pr-4 text-[13.5px] text-fg">{run.prompt}</span>
                    <span
                      className={cn(
                        "w-fit rounded-[2px] px-2 py-[3px] text-[11.5px] font-[650]",
                        tone[meta.tone].soft,
                      )}
                    >
                      {meta.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[13px]",
                        run.iterations > 0 ? "font-[700] text-loop" : "font-[400] text-fg-faint",
                      )}
                    >
                      {run.iterations}
                    </span>
                    <span className="font-mono text-[12.5px] text-fg-muted">
                      {formatElapsed(Math.max(0, elapsedMs))}
                    </span>
                    <span className="font-mono text-[12px] text-fg-faint">
                      {formatWhen(run.created_at)}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Deleting sits at the very bottom, well past the things you came here to do.
            It is irreversible and takes the run history and stored code with it, so it
            should never be the thing your hand lands on. */}
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <div>
            <p className="font-mono text-[11px] font-[600] uppercase tracking-[0.13em] text-fg-faint">
              delete project
            </p>
            <p className="mt-[6px] max-w-[62ch] text-[13px] leading-[1.5] text-fg-muted">
              Removes this project, its {stats.total === 1 ? "run" : "runs"} and every
              generated file stored against{" "}
              {stats.total === 1 ? "it" : "them"}. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 rounded-[2px] border border-danger-bd bg-surface px-5 py-[11px] font-mono text-[11.5px] font-[600] uppercase tracking-[0.12em] text-danger transition-colors hover:bg-danger-soft"
          >
            Delete project
          </button>
        </div>

        <DeleteProjectDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          project={project}
          runCount={stats.total}
        />
      </div>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this project?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
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
        <DialogFooter>
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={cn(LABEL, "text-[9.5px]")}>{label}</dt>
      <dd className="font-display mt-[5px] text-[22px] font-[600] tracking-[-0.04em] text-fg">
        {value}
      </dd>
    </div>
  );
}

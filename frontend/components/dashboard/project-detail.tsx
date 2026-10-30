"use client";

import "./workspace-design.css";


import { AnimatedNumber } from "@/components/ui/vengeance/animated-number";
import { AnimatedTooltip } from "@/components/ui/vengeance/animated-tooltip";
import { Notice } from "@/components/ui/notice";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeletionDialog } from "@/components/ui/deletion-dialog";
import { runStats } from "@/lib/run-stats";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse, RunSummary } from "@/lib/types";
import { readLocal, writeLocal } from "@/lib/workspace-storage";
import { useSession } from "@/lib/use-current-user";
import { ProjectSettings } from "@/components/dashboard/project-settings";
import { AppHeader } from "@/components/dashboard/app-header";
import { PromptStudio } from "@/components/dashboard/prompt-studio";
import { RunHistoryList } from "@/components/dashboard/run-history-list";

const LABEL = "text-[12px] font-[650] text-fg-muted";

/** Project detail (design_handoff/README.md "Other screens"): prompt entry on the
 * left, run history on the right. "Start run" calls the real `POST /runs` and
 * navigates into the live Live Run screen. */
export function ProjectDetail({
  project,
  history,
  stats: serverStats,
  nextCursor,
  loadingMore,
  moreError,
  onLoadMore, onProjectSaved, query = "", outcome = "", onFilter, filtering = false,
}: {
  onProjectSaved: (project: ProjectResponse) => void;
  query?: string; outcome?: string; onFilter?: (query: string, outcome: string) => void; filtering?: boolean;
  project: ProjectResponse;
  history: RunSummary[];
  stats?: { total: number; succeeded: number; failed: number; avg_loops: number | null } | null;
  nextCursor?: string | null;
  loadingMore?: boolean;
  moreError?: string | null;
  onLoadMore?: () => void;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [ragEnabled, setRagEnabled] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { user } = useSession();
  const draftKey = user ? `codeforge:draft:${user.id}:${project.id}` : null;
  const [loadedDraft, setLoadedDraft] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [parentRunId, setParentRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!draftKey) return;
    const draft = readLocal<{ prompt: string; rag: boolean; parentRunId?: string | null } | null>(draftKey, null);
    if (draft && typeof draft.prompt === "string") { setPrompt(draft.prompt); setRagEnabled(draft.rag !== false); setParentRunId(draft.parentRunId ?? null); }
    try {
      const retry = JSON.parse(sessionStorage.getItem("codeforge:retry-prompt") || "null");
      if (retry?.projectId === project.id && typeof retry.prompt === "string") { setPrompt(retry.prompt); setParentRunId(retry.parentRunId ?? null); sessionStorage.removeItem("codeforge:retry-prompt"); }
    } catch { /* A stored draft is optional. */ }
    setLoadedDraft(draftKey);
  }, [draftKey, project.id]);
  useEffect(() => {
    if (!draftKey || loadedDraft !== draftKey) return;
    setDraftStatus("Saving draft…");
    const save = () => writeLocal(draftKey, { prompt, rag: ragEnabled, parentRunId });
    const timer = setTimeout(() => setDraftStatus(save() ? "Draft saved on this device" : "Draft could not be saved on this device"), 400);
    window.addEventListener("pagehide", save);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", save); save(); };
  }, [prompt, ragEnabled, parentRunId, draftKey, loadedDraft]);

  const historyStats = runStats(history);
  const stats = serverStats ? { ...historyStats, ...serverStats, avgLoops: serverStats.avg_loops } : historyStats;

  async function startRun() {
    if (!prompt.trim()) return;
    setError(null);
    setStarting(true);
    try {
      const { run_id } = await api.createRun({
        project_id: project.id,
        prompt,
        rag_enabled: ragEnabled,
        ...(parentRunId ? { parent_run_id: parentRunId } : {}),
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
      <main className="mx-auto w-full max-w-[1320px] px-5 pb-20 pt-6 md:px-10 md:pt-8 lg:px-14">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-[13px] font-[600] text-fg-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Projects
        </Link>

        <section className="cf-project-detail-hero mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="relative px-6 py-6 md:px-9 md:py-7">
              <h1 className="font-display text-[36px] font-[700] tracking-[-0.055em] text-fg md:text-[42px]">
                {project.name}
              </h1>
              <ProjectSettings project={project} onSaved={onProjectSaved} />
              {project.description && (
                <p className="mt-2 max-w-[80ch] text-[14px] leading-[1.6] text-fg-muted md:text-[15px]">
                  {project.description}
                </p>
              )}
            </div>

            {/* Counts come from the server so they include runs on later pages. */}
            <dl className="cf-project-detail-stats grid grid-cols-2 bg-surface-2/65 sm:grid-cols-4">
              <Figure label="Runs" value={String(stats.total)} />
              <Figure label="Succeeded" value={String(stats.succeeded)} bordered />
              <Figure label="Failed" value={String(stats.failed)} bordered />
              <Figure
                label="Average loops"
                value={stats.avgLoops == null ? "—" : stats.avgLoops.toFixed(1)}
                bordered
              />
            </dl>
        </section>

        <div className="cf-project-workspace mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-start">
          <PromptStudio
            prompt={prompt}
            onPromptChange={setPrompt}
            ragEnabled={ragEnabled}
            onRagChange={setRagEnabled}
            parentRunId={parentRunId}
            onDetachParent={() => setParentRunId(null)}
            draftStatus={draftStatus}
            error={error}
            starting={starting}
            onStart={startRun}
          />
          <RunHistoryList
            history={history}
            stats={stats}
            query={query}
            outcome={outcome}
            filtering={filtering}
            onFilter={onFilter}
            onReuse={(run) => { setPrompt(run.prompt); setParentRunId(run.parent_run_id ?? null); }}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            moreError={moreError}
            onLoadMore={onLoadMore}
          />
        </div>

        {/* Deleting sits at the very bottom, well past the things you came here to do.
            It is irreversible and takes the run history and stored code with it, so it
            should never be the thing your hand lands on. */}
        <section className="cf-delete-zone mt-14 flex flex-wrap items-center justify-between gap-5 px-5 py-5 md:px-6">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-danger-bd bg-surface text-danger">
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
            className="cf-delete-trigger"
          >
            <Trash2 size={14} aria-hidden />Delete project
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
    <DeletionDialog open={open} onClose={() => { onOpenChange(false); setConfirmation(""); setError(null); }} busy={deleting}
      title="Delete this project?" description="Permanently remove this project and the work stored with it."
      target={project.name} targetLabel="Project to delete"
      impact={runCount === 0 ? "Every generated file stored with this project will be removed. There is no undo." : `${runCount} ${runCount === 1 ? "run" : "runs"}, generated code, and test output will be removed. There is no undo.`}>
      <div className="cf-deletion-fields"><div className="cf-deletion-field">
        <label htmlFor="confirm-project">Type <strong>{project.name}</strong> to confirm</label>
        <Input id="confirm-project" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" disabled={deleting} />
      </div>{error && <Notice>{error}</Notice>}</div>
      <div className="cf-deletion-actions">
        <Button type="button" variant="outline" onClick={() => { onOpenChange(false); setConfirmation(""); setError(null); }} disabled={deleting}>Cancel</Button>
        <Button type="button" onClick={handleDelete} disabled={!matches || deleting} className="cf-deletion-submit"><Trash2 size={14} aria-hidden />{deleting ? "Deleting…" : "Delete project"}</Button>
      </div>
    </DeletionDialog>
  );
}

function Figure({
  label,
  value,
  bordered,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[86px] flex-col justify-center px-5 py-3 sm:px-6",
        bordered && (label === "Failed" ? "border-rule sm:border-l" : "border-l border-rule"),
        label === "Failed" && "border-t border-rule sm:border-t-0",
        label === "Average loops" && "border-t border-rule sm:border-t-0",
      )}
    >
      <dt className={cn(LABEL, "text-[12px]")}>{label}{label === "Average loops" && <AnimatedTooltip label="average loops" content="Average repair iterations across this project's runs. A lower value means fewer repair passes, not necessarily a better API." />}</dt>
      <dd className="font-display mt-1 text-[26px] font-[700] tracking-[-0.05em] text-fg">
        {Number.isFinite(Number(value)) ? <AnimatedNumber value={Number(value)} formatter={() => value} /> : value}
      </dd>
    </div>
  );
}

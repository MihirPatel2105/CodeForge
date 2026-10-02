"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { API_TEMPLATES, readLocal, writeLocal } from "@/lib/workspace-storage";
import { useSession } from "@/lib/use-current-user";
import { ProjectSettings } from "@/components/dashboard/project-settings";
import { AppHeader } from "@/components/dashboard/app-header";

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
  const [template, setTemplate] = useState("");

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
          {/* Prompt entry. Sticky so it stays reachable while a long history scrolls. */}
          <section className="cf-prompt-stage overflow-hidden rounded-3xl border border-border bg-surface lg:sticky lg:top-[88px]">
            <div className="cf-project-composer-head border-b border-rule px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-bd bg-accent-soft text-accent">
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-[20px] font-[700] tracking-[-0.035em] text-fg">
                    What do you want to build?
                  </h2>
                  <p className="mt-0.5 text-[13px] text-fg-muted">
                    Describe the API in plain language.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <label className="text-[13px] font-semibold">Start from a template<select aria-label="Starter template" value={template} onChange={e => setTemplate(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3"><option value="">Choose a template</option>{API_TEMPLATES.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></label>
              {template !== "" && <Button variant="outline" onClick={() => { setPrompt(API_TEMPLATES[Number(template)].prompt); setParentRunId(null); setTemplate(""); }}>Use template{prompt.trim() ? " and replace draft" : ""}</Button>}
              <p className="text-[13px] leading-5 text-fg-muted">Describe 1–2 entities, their fields, and validation rules. CodeForge builds CRUD REST APIs; generated apps do not include a frontend or sign-in system.</p>
              <div className="flex flex-col gap-[7px]">
                <label htmlFor="prompt" className={LABEL}>Describe the API</label>
                <Textarea
                  id="prompt"
                  maxLength={12000}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="I want an API to manage…"
                  className="min-h-[136px] resize-y rounded-xl border-border-strong bg-bg/60 px-4 py-3.5 text-[16px] leading-[1.6] focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/10 md:text-[15px]"
                />
              </div>

              {parentRunId && <div className="rounded-xl bg-accent-soft p-3 text-sm"><Link href={`/runs/${parentRunId}`} className="text-accent underline">Revising an existing API</Link><Button variant="ghost" size="sm" onClick={() => setParentRunId(null)}>Start independently instead</Button></div>}
              <p role="status" className="text-xs text-fg-muted">{draftStatus}</p>
              <div className="rounded-lg border border-border bg-surface-2/70 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-fg-muted">
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
                  className="rounded-lg border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
                >
                  {error}
                </p>
              )}

              <Button
                onClick={startRun}
                disabled={!prompt.trim() || starting}
                className="h-12 w-full gap-2 rounded-xl text-[14px]"
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
          <section className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface" aria-labelledby="run-history-heading">
            <div className="flex items-end justify-between gap-5 border-b border-rule bg-surface-2/55 px-5 py-5 md:px-6">
              <div>
                <h2 id="run-history-heading" className="font-display text-[22px] font-[700] tracking-[-0.04em] text-fg">
                  Run history
                </h2>
              </div>
              <span className="rounded-xl border border-border bg-surface px-2.5 py-1 text-[12px] font-[600] text-fg-muted">
                {history.length} of {stats.total} {stats.total === 1 ? "run" : "runs"}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 border-b border-border p-4"><Input aria-label="Search run prompts" placeholder="Search run prompts" value={query} onChange={e => onFilter?.(e.target.value, outcome)} className="min-w-0 flex-1" /><select aria-label="Filter run outcome" value={outcome} onChange={e => onFilter?.(query, e.target.value)} className="h-11 rounded-lg border border-border bg-bg px-3 text-sm"><option value="">All outcomes</option>{Object.entries(RUN_STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></div>
            {filtering && <p role="status" className="px-5 py-2 text-sm text-fg-muted">Searching runs…</p>}
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
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-accent-bd bg-accent-soft text-accent">
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                </span>
                <p className="font-display mt-5 text-[18px] font-[650] tracking-[-0.035em] text-fg">
                  {query || outcome ? "No matching runs" : "No runs yet"}
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
                  <div key={run.id}><Link
                    href={`/runs/${run.id}`}
                    className="cf-run-history-grid group grid gap-x-4 gap-y-4 border-b border-border px-5 py-5 transition-colors last:border-b-0 hover:bg-accent-soft/35 md:items-center md:gap-y-0 md:px-6 md:py-4"
                  >
                    <div className="cf-run-history-prompt min-w-0 md:pr-4">
                      <span className="mb-1.5 block text-[12px] font-[600] text-fg-muted md:hidden">
                        Prompt
                      </span>
                      <span className="line-clamp-2 text-[13.5px] leading-[1.5] text-fg md:truncate">
                        {run.prompt}
                      </span>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[12px] font-[600] text-fg-muted md:hidden">
                        Outcome
                      </span>
                      <span
                        className={cn(
                          "inline-flex w-fit rounded-lg px-2 py-[3px] text-[11px] font-[650]",
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
                  </Link><div className="flex items-center justify-between border-b border-border px-5 pb-3">{run.parent_run_id && <Link href={`/runs/${run.parent_run_id}`} className="text-xs text-accent">View source version</Link>}<Button variant="ghost" size="sm" onClick={() => { setPrompt(run.prompt); setParentRunId(run.parent_run_id ?? null); }}>Reuse prompt</Button></div></div>
                );
              })
            )}
            {moreError && <p role="alert" className="px-5 py-3 text-[13px] text-danger">{moreError}</p>}
            {nextCursor && <div className="border-t border-border px-5 py-4"><Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more runs"}</Button></div>}
          </section>
        </div>

        {/* Deleting sits at the very bottom, well past the things you came here to do.
            It is irreversible and takes the run history and stored code with it, so it
            should never be the thing your hand lands on. */}
        <section className="mt-14 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-danger-bd/70 bg-danger-soft/35 px-5 py-5 md:px-6">
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
            className="shrink-0 rounded-xl border border-danger-bd bg-surface px-5 py-[11px] text-[13px] font-[650] text-danger transition-colors hover:bg-danger-soft"
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
      <DialogContent className="rounded-xl border-danger-bd p-0 shadow-[0_30px_90px_rgba(22,24,28,0.22)]">
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
              className="h-11 rounded-lg border-border-strong bg-surface text-[14.5px] focus-visible:border-fg focus-visible:ring-0"
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
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
      <span className="mb-1.5 block text-[12px] font-[600] text-fg-muted md:hidden">
        {label}
      </span>
      <span className={cn("font-mono text-[12px]", className)}>{children}</span>
    </div>
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
      <dt className={cn(LABEL, "text-[12px]")}>{label}</dt>
      <dd className="font-display mt-1 text-[26px] font-[700] tracking-[-0.05em] text-fg">
        {value}
      </dd>
    </div>
  );
}

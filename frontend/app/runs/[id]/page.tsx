"use client";

import { DashboardThemeToggle } from "@/components/dashboard/dashboard-theme-toggle";

import { Notice } from "@/components/ui/notice";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileCode2, FlaskConical, ListTree, RotateCcw, ShieldCheck } from "lucide-react";
import { useRunStream } from "@/lib/use-run-stream";
import { api, getToken, downloadLatestFileTree, ApiError } from "@/lib/api";
import { PipelineStrip } from "@/components/dashboard/pipeline-strip";
import { RunVersions } from "@/components/dashboard/run-versions";
import { PIPELINE_STAGES } from "@/lib/pipeline";
import { RunStory } from "@/components/dashboard/run-story";
import { EvidenceWorkbench } from "@/components/dashboard/evidence-workbench";
import { TimelinePanel } from "@/components/dashboard/timeline-panel";
import { CodePanel, type CodeVersion } from "@/components/dashboard/code-panel";
import { ProblemsPanel } from "@/components/dashboard/problems-panel";
import { canOpenProblem, runProblems, type CodeLocation } from "@/lib/run-problems";
import { buildHunks } from "@/lib/diff";
import { TerminalPanel } from "@/components/dashboard/terminal-panel";
import { TestsPanel } from "@/components/dashboard/tests-panel";
import { ApprovalBar } from "@/components/dashboard/approval-bar";
import { AgentCityInvite } from "@/components/dashboard/agent-city-invite";
import { ApprovalPresence } from "@/components/dashboard/approval-presence";
import { ResultSummary } from "@/components/dashboard/result-summary";
import { displayStatus, tone } from "@/lib/tone";
import { cn } from "@/lib/utils";
import type { ApprovalPhase, FileHistoryVersion } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/app-header";
import { Button } from "@/components/ui/button";

/**
 * The real Live Run screen (docs/UI_BRIEF.md §4) — the same components proven out
 * against mock playback in /dev/reducer, now composed against a live SSE connection
 * (lib/use-run-stream.ts) instead of a timer.
 *
 * Current content comes from /files; archived sandbox iterations come from
 * /file-history so a rewritten file can be compared with the previous pass.
 */
export default function LiveRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { snapshot, connectionLost, loading, refresh: refreshRun, restart: restartRun } = useRunStream(id);
  const [fileContent, setFileContent] = useState<Record<string, string>>({});
  const [fileHistory, setFileHistory] = useState<FileHistoryVersion[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<"idle" | "pending" | "started">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryStage, setRetryStage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retryPending = useRef(false);
  const [deciding, setDeciding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sourceRunId, setSourceRunId] = useState<string | null>(null);
  const [runProjectId, setRunProjectId] = useState<string | null>(null);
  const [problemState, setProblemState] = useState<{ runId: string; state: Record<string, unknown> } | null>(null);
  const [problemError, setProblemError] = useState(false);
  const [codeLocation, setCodeLocation] = useState<{ runId: string; location: CodeLocation } | null>(null);

  // `replace`, not `push`: a signed-out visitor should not be able to press Back and
  // land on a protected page again. The `allowed` flag then stops the run UI rendering
  // at all — the previous version queued a redirect and carried on, so the screen
  // mounted and flashed before navigating away.
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    if (!getToken()) {
      setAllowed(false);
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let terminalAttempts = 0;
    async function refreshEvidence() {
      let persistedTerminal = false;
      try {
        const run = await api.getRun(id);
        if (disposed) return;
        setRunProjectId(run.project_id); setSourceRunId(run.parent_run_id ?? null);
        setProblemState({ runId: id, state: run.state ?? {} }); setProblemError(false);
        persistedTerminal = !["queued", "running", "awaiting_approval"].includes(run.status);
      } catch {
        if (!disposed) setProblemError(true);
      }
      // Completion events precede persistence; allow a bounded catch-up after the stream ends.
      if (!disposed && ((!snapshot.endedAt && snapshot.status !== "awaiting_approval") || (snapshot.endedAt && !persistedTerminal && ++terminalAttempts < 3))) {
        timer = setTimeout(refreshEvidence, 2000);
      }
    }
    void refreshEvidence();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [id, snapshot.endedAt, snapshot.status]);



  const filesKey = snapshot.files.map((f) => `${f.path}:${f.iteration}`).join(",");
  useEffect(() => {
    if (snapshot.files.length === 0) return;
    api
      .getRunFiles(id)
      .then((tree) => {
        const next: Record<string, string> = {};
        for (const f of tree.files) next[f.path] = f.content;
        setFileContent(next);
      })
      .catch(() => {
        // A transient fetch failure here just means the code panel shows stale
        // content until the next file.written event retries it — not fatal.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filesKey]);

  useEffect(() => {
    if (snapshot.iterations === 0) return;
    api.getRunFileHistory(id).then((history) => setFileHistory(history.versions)).catch(() => {
      // A later file event or terminal event retries after artifacts are saved.
    });
  }, [id, filesKey, snapshot.iterations, snapshot.endedAt]);

  function getVersion(path: string, iteration: number): CodeVersion | null {
    const content = fileContent[path];
    if (content == null) return null;
    const previous = getPreviousVersion(path, iteration);
    if (!previous) return { content };
    const changed = buildHunks(previous.content, content, 0).flatMap((hunk) => hunk.lines);
    return {
      content,
      changedLines: changed.flatMap((line) =>
        line.kind === "added" && line.newLine != null ? [line.newLine] : [],
      ),
      changedLineCount: changed.filter((line) => line.kind !== "context").length,
    };
  }

  function getPreviousVersion(path: string, iteration: number): CodeVersion | null {
    const previous = fileHistory
      .filter((version) => version.iteration < iteration)
      .sort((a, b) => b.iteration - a.iteration)
      .find((version) => version.files.some((file) => file.path === path));
    const content = previous?.files.find((file) => file.path === path)?.content;
    return content != null ? { content } : null;
  }

  async function handleApprove(note: string) {
    if (!snapshot.approval || deciding) return;
    setDeciding(true);
    setActionError(null);
    try {
      await api.approveRun(id, {
        phase: snapshot.approval.phase as ApprovalPhase,
        expected_revision: Number(snapshot.approval.payload.revisions_used || 0),
        approved: true,
        note: note || null,
      });
      refreshRun();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't approve the run.");
    } finally { setDeciding(false); }
  }

  async function handleReject(note: string) {
    if (!snapshot.approval || deciding) return;
    setDeciding(true);
    setActionError(null);
    try {
      await api.approveRun(id, {
        phase: snapshot.approval.phase as ApprovalPhase,
        expected_revision: Number(snapshot.approval.payload.revisions_used || 0),
        approved: false,
        note: note || null,
      });
      refreshRun();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't reject the run.");
    } finally { setDeciding(false); }
  }

  async function handleRevise(note: string) {
    if (!snapshot.approval || deciding) return;
    setDeciding(true); setActionError(null);
    try { await api.reviseRun(id, snapshot.approval.phase, note, Number(snapshot.approval.payload.revisions_used || 0)); refreshRun(); }
    catch (err) { setActionError(err instanceof ApiError ? err.message : "Could not request changes."); }
    finally { setDeciding(false); }
  }

  async function handleCancel() {
    setActionError(null);
    setCancelling(true);
    try {
      await api.cancelRun(id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't cancel the run.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleDownload() {
    if (downloadState === "pending") return;
    setDownloadError(null);
    setDownloadState("pending");
    try {
      await downloadLatestFileTree(id);
      setDownloadState("started");
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Couldn't download the code.");
      setDownloadState("idle");
    }
  }

  useEffect(() => {
    if (downloadState !== "started") return;
    const timeout = window.setTimeout(() => setDownloadState("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [downloadState]);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setRetryStage(null);
    async function probe(attempt: number) {
      try {
        const info = await api.getRunRetry(id);
        if (disposed) return;
        setRetryStage(info.stage ? PIPELINE_STAGES.find(stage => stage.id === info.stage)?.name ?? null : null);
        // Terminal events precede the final checkpoint write and task cleanup.
        if (!info.stage && attempt < 3) timer = setTimeout(() => { void probe(attempt + 1); }, 500 * attempt);
      } catch { /* Keep Run again available when recovery cannot be checked. */ }
    }
    if (snapshot.status === "failed_llm" && snapshot.endedAt) void probe(1);
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [id, snapshot.status, snapshot.endedAt]);

  async function handleStageRetry() {
    if (retryPending.current || !retryStage) return;
    retryPending.current = true; setRetrying(true); setActionError(null);
    try {
      await api.retryRun(id);
      setRetryStage(null);
      restartRun();
    } catch (err) {
      setActionError(err instanceof ApiError && err.code === "conflict" ? "This run cannot be retried right now. Refresh the run and check its status." : err instanceof ApiError ? err.message : "Couldn't resume this run. Please try again.");
    } finally { retryPending.current = false; setRetrying(false); }
  }

  function handleRetry() {
    if (!runProjectId || !snapshot.prompt) return;
    sessionStorage.setItem(
      "codeforge:retry-prompt",
      JSON.stringify({ projectId: runProjectId, prompt: snapshot.prompt, parentRunId: sourceRunId }),
    );
    router.push(`/projects/${runProjectId}`);
  }

  // Every terminal outcome sets `endedAt` (run.completed / run.failed) — a more robust
  // check than enumerating status strings, since "cancelled" ends the run too.
  const isLive = snapshot.runId != null && !snapshot.endedAt;

  const status = displayStatus(snapshot.status, snapshot.tests?.ok ?? null);
  const problems = runProblems(problemState?.runId === id ? problemState.state : {});
  const completedStages = Object.values(snapshot.agents).filter(
    (agent) => agent.state === "done",
  ).length;

  if (!allowed) return null;
  if (loading) return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/projects" className="text-[13px] font-semibold text-fg-muted">Back to projects</Link>
        <Notice variant="info" title="Loading run" className="mt-6" aria-label="Loading run">
          {connectionLost ? "Reconnecting to load the saved run details…" : "Loading saved run details…"}
        </Notice>
      </main>
    </div>
  );

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1600px] justify-end px-5 pt-4 sm:px-6"><DashboardThemeToggle /></div>
      <main data-run-flow-page className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-[13px] font-[600] text-fg-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Projects
        </Link>

        <header className="cf-run-hero cf-run-summary mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="cf-build-stage grid">
            <div className="relative px-5 py-4 sm:px-7 sm:py-5 lg:px-7">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-[700]",
                    tone[status.tone].soft,
                  )}
                >
                  {isLive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-[cfDot_1.1s_ease-in-out_infinite]" aria-hidden />
                  )}
                  {status.label}
                </span>
                {snapshot.iterations > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-loop-soft px-3 py-1.5 font-mono text-[11px] font-bold text-loop">
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    loop {snapshot.iterations}
                  </span>
                )}
                <span className="font-mono text-[11px] text-fg-faint">
                  run {id.slice(0, 8)}
                </span>
              </div>

              <p className="mt-3 text-[12px] font-[650] text-accent">
                API build request
              </p>
              <h1 className="cf-run-request mt-1.5 text-[18px] font-[500] leading-[1.5] text-fg">
                {snapshot.prompt ?? "Preparing the agent workflow…"}
              </h1>

              {isLive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-3 border-danger-bd bg-surface text-danger hover:bg-danger-soft"
                >
                  {cancelling ? "Cancelling…" : "Cancel run"}
                </Button>
              )}
            </div>

            <dl className="cf-build-metrics grid grid-cols-2 bg-surface-2 sm:grid-cols-4">
              <RunMetric icon={<ShieldCheck />} label="stages complete" value={`${completedStages}/6`} />
              <RunMetric icon={<ListTree />} label="timeline events" value={String(snapshot.timeline.length)} bordered />
              <RunMetric icon={<FileCode2 />} label="generated files" value={String(snapshot.files.length)} topBorder />
              <RunMetric
                icon={<FlaskConical />}
                label="tests passed"
                value={snapshot.tests ? `${snapshot.tests.passed}/${snapshot.tests.total}` : "—"}
                bordered
                topBorder
              />
            </dl>
          </div>
        </header>

        <AgentCityInvite key={`agent-city:${id}`} runId={id} snapshot={snapshot} connected={!connectionLost} />
        {snapshot.approval && <a href="#approval-heading" className="sticky top-16 z-10 mt-3 block rounded-xl border border-warn-bd bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">Your decision is needed · Review checkpoint ↑</a>}
        {actionError && (
          <Notice className="mt-4">
            {actionError}
          </Notice>
        )}

        <ApprovalPresence show={snapshot.approval != null}>
          {snapshot.approval && (
            <ApprovalBar
              key={`${snapshot.approval.phase}:${snapshot.approval.payload.revisions_used ?? 0}`}
              busy={deciding}
              error={actionError}
              onRevise={handleRevise}
              approval={snapshot.approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
        </ApprovalPresence>

        <section className="cf-run-pipeline mt-5 overflow-hidden rounded-3xl border border-border bg-surface" aria-labelledby="agent-pipeline-heading">
          <div className="flex items-end justify-between gap-5 border-b border-rule bg-surface-2/55 px-5 py-3 sm:px-6">
            <div>
              <span className="text-[12px] font-[650] text-accent">Live orchestration</span>
              <h2 id="agent-pipeline-heading" className="font-display mt-1 text-[24px] font-[700] tracking-[-0.04em] text-fg">Agent pipeline</h2>
            </div>
            <span className="text-[11px] text-fg-muted">
              <span className="sm:hidden">6 stages</span>
              <span className="hidden sm:inline">6 stages · feedback enabled</span>
            </span>
          </div>
          <RunStory snapshot={snapshot} />

          <div className="cf-pipeline-viewport">
            <div className="min-w-0">
              <PipelineStrip key={id} agents={snapshot.agents} lastLoop={snapshot.lastLoop} />
            </div>
          </div>
        </section>

        {snapshot.endedAt && (
          <section className="mt-5" aria-label="Run result">
            <ResultSummary
              snapshot={snapshot}
              onDownload={handleDownload}
              downloadState={downloadState}
              retryStage={retryStage}
              retrying={retrying}
              onRetryStage={handleStageRetry}
              onRetry={runProjectId && snapshot.prompt ? handleRetry : undefined}
              onReuse={runProjectId && snapshot.prompt ? handleRetry : undefined}
              tryApiHref={snapshot.status === "succeeded" && snapshot.tests?.ok ? `/runs/${id}/use` : undefined}
            />
          </section>
        )}

        {(snapshot.endedAt || sourceRunId) && <RunVersions key={`run-versions:${id}`} id={id} completed={Boolean(snapshot.endedAt)} />}

        {downloadError && (
          <Notice className="mt-3">
            {downloadError}
          </Notice>
        )}

        <section className="mt-8" aria-labelledby="run-workbench-heading">
          <div className="mb-4 flex items-end justify-between border-b border-rule pb-4">
            <div>
              <span className="text-[12px] font-[600] text-fg-faint">Execution evidence</span>
              <h2 id="run-workbench-heading" className="font-display mt-1.5 text-[20px] font-[650] tracking-[-0.04em] text-fg">Inspect the run</h2>
            </div>
            <span className="hidden text-[12px] text-fg-muted sm:block">Events · code · sandbox · tests</span>
          </div>

          <EvidenceWorkbench
            problemCount={problems.length}
            problems={<ProblemsPanel problems={problems} error={problemError}
            canOpen={problem => canOpenProblem(problem, snapshot.files, fileContent, snapshot.iterations)}
            onOpen={problem => {
              if (!problem.location || !canOpenProblem(problem, snapshot.files, fileContent, snapshot.iterations)) return;
              const target = problem.location;
              setCodeLocation(current => ({ runId: id, location: { path: target.path, line: target.line, content: target.content, iteration: target.iteration, requestId: (current?.location.requestId ?? 0) + 1 } }));
            }} />}
            result={snapshot.tests}
            navigationRequest={codeLocation?.runId === id ? codeLocation.location.requestId : undefined}
            code={<CodePanel key={id} files={snapshot.files} getVersion={getVersion} getPreviousVersion={getPreviousVersion} location={codeLocation?.runId === id ? codeLocation.location : null} />}
            timeline={<TimelinePanel entries={snapshot.timeline} connectionLost={connectionLost} />}
            terminal={<TerminalPanel lines={snapshot.terminalLines} image={snapshot.agents.sandbox.model} running={snapshot.agents.sandbox.state === "working"} />}
            tests={<TestsPanel tests={snapshot.tests} terminalLines={snapshot.terminalLines} />}
          />
        </section>

      </main>
    </div>
  );
}

function RunMetric({
  icon,
  label,
  value,
  bordered,
  topBorder,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  bordered?: boolean;
  topBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[76px] flex-col justify-center px-3.5 py-3.5",
        bordered && "border-l border-rule",
        topBorder && "border-t border-rule",
      )}
    >
      <div className="flex items-center gap-2 text-fg-muted">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>{icon}</span>
        <dt className="text-[11px] font-[600]">{label}</dt>
      </div>
      <dd className="font-display mt-1 text-[24px] font-[700] tracking-[-0.05em] text-fg">{value}</dd>
      <span className="absolute inset-x-3.5 bottom-0 h-px bg-gradient-to-r from-accent-bd to-transparent opacity-55" aria-hidden />
    </div>
  );
}

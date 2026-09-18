"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileCode2, FlaskConical, ListTree, RotateCcw, ShieldCheck } from "lucide-react";
import { useRunStream } from "@/lib/use-run-stream";
import { api, getToken, downloadLatestFileTree, ApiError } from "@/lib/api";
import { PipelineStrip } from "@/components/dashboard/pipeline-strip";
import { TimelinePanel } from "@/components/dashboard/timeline-panel";
import { CodePanel, type CodeVersion } from "@/components/dashboard/code-panel";
import { buildHunks } from "@/lib/diff";
import { TerminalPanel } from "@/components/dashboard/terminal-panel";
import { TestsPanel } from "@/components/dashboard/tests-panel";
import { ApprovalBar } from "@/components/dashboard/approval-bar";
import { ResultSummary } from "@/components/dashboard/result-summary";
import { displayStatus, tone } from "@/lib/tone";
import { cn } from "@/lib/utils";
import type { ApprovalPhase, FileHistoryVersion } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/app-header";
import { Button } from "@/components/ui/button";
import { preferredScrollBehavior } from "@/lib/motion";

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
  const { snapshot, connectionLost } = useRunStream(id);
  const [fileContent, setFileContent] = useState<Record<string, string>>({});
  const [fileHistory, setFileHistory] = useState<FileHistoryVersion[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [runProjectId, setRunProjectId] = useState<string | null>(null);
  const [mobileEvidence, setMobileEvidence] = useState<"timeline" | "code" | "terminal" | "tests">("timeline");
  const pipelineViewport = useRef<HTMLDivElement>(null);

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
    api.getRun(id).then((run) => setRunProjectId(run.project_id)).catch(() => {
      // The event stream still renders the run. This only disables the convenience
      // action that returns to the original project with the prompt prefilled.
    });
  }, [id]);

  useEffect(() => {
    const viewport = pipelineViewport.current;
    if (!viewport || !snapshot.currentAgent || window.innerWidth >= 640) return;
    const card = viewport.querySelector<HTMLElement>(`[data-stage="${snapshot.currentAgent}"]`);
    if (!card) return;
    viewport.scrollTo({
      left: Math.max(0, card.offsetLeft - 20),
      behavior: preferredScrollBehavior(),
    });
  }, [snapshot.currentAgent]);

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
    if (!snapshot.approval) return;
    setActionError(null);
    try {
      await api.approveRun(id, {
        phase: snapshot.approval.phase as ApprovalPhase,
        approved: true,
        note: note || null,
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't approve the run.");
    }
  }

  async function handleReject(note: string) {
    if (!snapshot.approval) return;
    setActionError(null);
    try {
      await api.approveRun(id, {
        phase: snapshot.approval.phase as ApprovalPhase,
        approved: false,
        note: note || null,
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't reject the run.");
    }
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
    setDownloadError(null);
    try {
      await downloadLatestFileTree(id);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Couldn't download the code.");
    }
  }

  function handleRetry() {
    if (!runProjectId || !snapshot.prompt) return;
    sessionStorage.setItem(
      "codeforge:retry-prompt",
      JSON.stringify({ projectId: runProjectId, prompt: snapshot.prompt }),
    );
    router.push(`/projects/${runProjectId}`);
  }

  // Every terminal outcome sets `endedAt` (run.completed / run.failed) — a more robust
  // check than enumerating status strings, since "cancelled" ends the run too.
  const isLive = snapshot.runId != null && !snapshot.endedAt;

  const status = displayStatus(snapshot.status, snapshot.tests?.ok ?? null);
  const completedStages = Object.values(snapshot.agents).filter(
    (agent) => agent.state === "done",
  ).length;

  if (!allowed) return null;

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-[650] uppercase tracking-[0.13em] text-fg-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Projects
        </Link>

        <header className="cf-run-hero mt-4 overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_24px_70px_rgba(22,24,28,0.075)]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="relative px-5 py-5 sm:px-7 sm:py-6 lg:px-7">
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
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-fg-faint">
                  run {id.slice(0, 8)}
                </span>
              </div>

              <p className="mt-4 font-mono text-[9px] font-[650] uppercase tracking-[0.14em] text-accent">
                API build request
              </p>
              <h1 className="font-display mt-2 max-w-[60ch] text-[16px] font-[650] leading-[1.3] tracking-[-0.035em] text-fg sm:text-[18px]">
                {snapshot.prompt ?? "Preparing the agent workflow…"}
              </h1>

              {isLive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-6 border-danger-bd bg-surface text-danger hover:bg-danger-soft"
                >
                  {cancelling ? "Cancelling…" : "Cancel run"}
                </Button>
              )}
            </div>

            <dl className="cf-invert cf-lift grid grid-cols-2 bg-bg">
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

        {actionError && (
          <p role="alert" className="mt-4 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {actionError}
          </p>
        )}

        <section className="mt-7 overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_18px_50px_rgba(22,24,28,0.055)]" aria-labelledby="agent-pipeline-heading">
          <div className="flex items-end justify-between gap-5 border-b border-rule bg-surface-2/55 px-5 py-4 sm:px-6">
            <div>
              <span className="font-mono text-[9.5px] font-[650] uppercase tracking-[0.14em] text-fg-faint">live orchestration</span>
              <h2 id="agent-pipeline-heading" className="font-display mt-1.5 text-[19px] font-[650] tracking-[-0.04em] text-fg">Agent pipeline</h2>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-fg-faint">
              <span className="sm:hidden">swipe to inspect →</span>
              <span className="hidden sm:inline">6 stages · feedback enabled</span>
            </span>
          </div>
          <div ref={pipelineViewport} className="cf-run-scroll snap-x snap-proximity overflow-x-auto px-5 pb-1 pt-5 sm:px-6">
            <div className="min-w-[1180px]">
              <PipelineStrip agents={snapshot.agents} lastLoop={snapshot.lastLoop} />
            </div>
          </div>
        </section>

        {snapshot.endedAt && (
          <section className="mt-5" aria-label="Run result">
            <ResultSummary
              snapshot={snapshot}
              onDownload={handleDownload}
              onRetry={runProjectId && snapshot.prompt ? handleRetry : undefined}
            />
          </section>
        )}

        {downloadError && (
          <p role="alert" className="mt-3 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {downloadError}
          </p>
        )}

        <section className="mt-8" aria-labelledby="run-workbench-heading">
          <div className="mb-4 flex items-end justify-between border-b border-rule pb-4">
            <div>
              <span className="font-mono text-[9.5px] font-[650] uppercase tracking-[0.14em] text-fg-faint">execution evidence</span>
              <h2 id="run-workbench-heading" className="font-display mt-1.5 text-[20px] font-[650] tracking-[-0.04em] text-fg">Inspect the run</h2>
            </div>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-fg-faint sm:block">events · code · sandbox · tests</span>
          </div>

          <div
            className="mb-4 grid grid-cols-4 overflow-hidden rounded-[4px] border border-border bg-surface xl:hidden"
            role="tablist"
            aria-label="Run evidence"
          >
            {(["timeline", "code", "terminal", "tests"] as const).map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                id={`evidence-tab-${view}`}
                aria-controls={`evidence-panel-${view}`}
                aria-selected={mobileEvidence === view}
                tabIndex={mobileEvidence === view ? 0 : -1}
                onClick={() => setMobileEvidence(view)}
                className={cn(
                  "border-r border-border px-2 py-3 font-mono text-[10px] font-[700] uppercase tracking-[0.08em] last:border-r-0",
                  mobileEvidence === view
                    ? "bg-fg text-surface"
                    : "bg-surface text-fg-muted hover:bg-surface-2",
                )}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(380px,0.82fr)_minmax(0,1.45fr)]">
            <div
              id="evidence-panel-timeline"
              role="tabpanel"
              aria-labelledby="evidence-tab-timeline"
              className={cn("h-[520px] xl:block xl:h-[648px]", mobileEvidence !== "timeline" && "hidden")}
            >
              <TimelinePanel entries={snapshot.timeline} connectionLost={connectionLost} />
            </div>

            <div className={cn("min-w-0 flex-col gap-3 xl:flex", mobileEvidence === "timeline" ? "hidden" : "flex")}>
              <div
                id="evidence-panel-code"
                role="tabpanel"
                aria-labelledby="evidence-tab-code"
                className={cn("h-[560px] sm:h-[440px] xl:block", mobileEvidence !== "code" && "hidden")}
              >
                <CodePanel files={snapshot.files} getVersion={getVersion} getPreviousVersion={getPreviousVersion} />
              </div>

              <div className={cn("flex-col gap-3 md:flex-row xl:flex", mobileEvidence === "terminal" || mobileEvidence === "tests" ? "flex" : "hidden")}>
                <div
                  id="evidence-panel-terminal"
                  role="tabpanel"
                  aria-labelledby="evidence-tab-terminal"
                  className={cn("min-w-0 flex-1 xl:block", mobileEvidence !== "terminal" && "hidden")}
                >
                  <TerminalPanel
                    lines={snapshot.terminalLines}
                    image={snapshot.agents.sandbox.model}
                    running={snapshot.agents.sandbox.state === "working"}
                  />
                </div>
                <div
                  id="evidence-panel-tests"
                  role="tabpanel"
                  aria-labelledby="evidence-tab-tests"
                  className={cn("xl:block", mobileEvidence !== "tests" && "hidden")}
                >
                  <TestsPanel tests={snapshot.tests} terminalLines={snapshot.terminalLines} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {snapshot.approval && (
          <ApprovalBar
            approval={snapshot.approval}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
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
      <div className="flex items-center gap-2 text-fg-faint">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>{icon}</span>
        <dt className="font-mono text-[8.5px] font-[650] uppercase tracking-[0.13em]">{label}</dt>
      </div>
      <dd className="font-display mt-1 text-[20px] font-[650] tracking-[-0.05em] text-fg">{value}</dd>
      <span className="absolute inset-x-3.5 bottom-0 h-px bg-gradient-to-r from-accent-bd to-transparent opacity-55" aria-hidden />
    </div>
  );
}

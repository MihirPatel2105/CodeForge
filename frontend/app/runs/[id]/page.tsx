"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileCode2, FlaskConical, ListTree, RotateCcw, ShieldCheck } from "lucide-react";
import { useRunStream } from "@/lib/use-run-stream";
import { api, getToken, downloadLatestFileTree, ApiError } from "@/lib/api";
import { PipelineStrip } from "@/components/dashboard/pipeline-strip";
import { TimelinePanel } from "@/components/dashboard/timeline-panel";
import { CodePanel, type CodeVersion } from "@/components/dashboard/code-panel";
import { TerminalPanel } from "@/components/dashboard/terminal-panel";
import { TestsPanel } from "@/components/dashboard/tests-panel";
import { ApprovalBar } from "@/components/dashboard/approval-bar";
import { ResultSummary } from "@/components/dashboard/result-summary";
import { displayStatus, tone } from "@/lib/tone";
import { cn } from "@/lib/utils";
import type { ApprovalPhase } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/app-header";
import { Button } from "@/components/ui/button";

/**
 * The real Live Run screen (docs/UI_BRIEF.md §4) — the same components proven out
 * against mock playback in /dev/reducer, now composed against a live SSE connection
 * (lib/use-run-stream.ts) instead of a timer.
 *
 * One known gap: the Diff toggle never appears here. `GET /runs/{id}/files` only
 * returns each file's *current* content, not per-iteration history — the backend
 * stores that history as a zipped artifact per loop (backend/app/db/artifacts.py),
 * not as structured per-file JSON, so there is nothing cheap to diff against yet.
 */
export default function LiveRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { snapshot, connectionLost } = useRunStream(id);
  const [fileContent, setFileContent] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

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

  function getVersion(path: string): CodeVersion | null {
    const content = fileContent[path];
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
          <div className="grid lg:grid-cols-[minmax(0,1fr)_410px]">
            <div className="relative px-5 py-7 sm:px-7 sm:py-8 lg:px-9">
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

              <p className="mt-6 font-mono text-[9.5px] font-[650] uppercase tracking-[0.14em] text-accent">
                API build request
              </p>
              <h1 className="font-display mt-3 max-w-[46ch] text-[21px] font-[650] leading-[1.4] tracking-[-0.035em] text-fg sm:text-[25px]">
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
          <div className="cf-run-scroll overflow-x-auto px-5 pb-1 pt-5 sm:px-6">
            <div className="min-w-[1180px]">
              <PipelineStrip agents={snapshot.agents} lastLoop={snapshot.lastLoop} />
            </div>
          </div>
        </section>

        {snapshot.endedAt && (
          <section className="mt-5" aria-label="Run result">
            <ResultSummary snapshot={snapshot} onDownload={handleDownload} />
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

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(380px,0.82fr)_minmax(0,1.45fr)]">
            <div className="h-[520px] xl:h-[648px]">
              <TimelinePanel entries={snapshot.timeline} connectionLost={connectionLost} />
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div className="h-[560px] sm:h-[440px]">
                <CodePanel files={snapshot.files} getVersion={getVersion} />
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="min-w-0 flex-1">
                  <TerminalPanel
                    lines={snapshot.terminalLines}
                    image={snapshot.agents.sandbox.model}
                    running={snapshot.agents.sandbox.state === "working"}
                  />
                </div>
                <TestsPanel tests={snapshot.tests} />
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
        "relative flex min-h-[112px] flex-col justify-center px-5 py-5",
        bordered && "border-l border-rule",
        topBorder && "border-t border-rule",
      )}
    >
      <div className="flex items-center gap-2 text-fg-faint">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>{icon}</span>
        <dt className="font-mono text-[8.5px] font-[650] uppercase tracking-[0.13em]">{label}</dt>
      </div>
      <dd className="font-display mt-2.5 text-[24px] font-[650] tracking-[-0.05em] text-fg">{value}</dd>
      <span className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-accent-bd to-transparent opacity-55" aria-hidden />
    </div>
  );
}

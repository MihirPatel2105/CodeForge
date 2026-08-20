"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <div className="p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "rounded-[9px] px-[13px] py-[7px] text-[14.5px] font-[650]",
              tone[status.tone].soft,
            )}
          >
            {status.label}
          </span>
          {snapshot.iterations > 0 && (
            <span className="rounded-[9px] bg-loop-soft px-[13px] py-[7px] font-mono text-[15px] font-bold text-loop">
              LOOP {snapshot.iterations}
            </span>
          )}
          {isLive && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={cancelling}
              className="ml-auto text-danger"
            >
              {cancelling ? "Cancelling…" : "Cancel run"}
            </Button>
          )}
        </div>

        {actionError && <p className="mb-4 text-[13px] text-danger">{actionError}</p>}

        {snapshot.prompt && (
          <p className="mb-5 text-[21px] font-semibold tracking-[-0.02em] text-fg">
            {snapshot.prompt}
          </p>
        )}

        <div className="mb-6">
          <PipelineStrip agents={snapshot.agents} lastLoop={snapshot.lastLoop} />
        </div>

        <div className="grid grid-cols-[42%_1fr] items-start gap-4">
          <div className="h-[560px]">
            <TimelinePanel entries={snapshot.timeline} connectionLost={connectionLost} />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="h-[420px]">
              <CodePanel files={snapshot.files} getVersion={getVersion} />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
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

        {downloadError && <p className="mt-3 text-[13px] text-danger">{downloadError}</p>}

        {snapshot.endedAt && (
          <div className="mt-4">
            <ResultSummary snapshot={snapshot} onDownload={handleDownload} />
          </div>
        )}

        {snapshot.approval && (
          <div className="mt-4">
            <ApprovalBar
              approval={snapshot.approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        )}
      </div>
    </div>
  );
}

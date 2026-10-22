"use client";

import { useEffect, useState } from "react";
import ThoughtLine from "@/components/ui/react-bits/thought-line";
import LatticeLoader from "@/components/ui/react-bits/lattice-loader";
import type { AgentSnapshot } from "@/lib/run-reducer";

export function StageActivity({ name, snapshot, activity, playbackTime }: { name: string; snapshot: AgentSnapshot; activity: string[]; playbackTime?: number }) {
  const [now, setNow] = useState(() => Date.now());
  const working = snapshot.state === "working";
  const started = snapshot.startedAt ? Date.parse(snapshot.startedAt) : NaN;
  useEffect(() => {
    if (!working || !Number.isFinite(started) || playbackTime !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [working, started, playbackTime]);
  const elapsed = working && Number.isFinite(started) ? Math.max(0, (playbackTime ?? now) - started) / 1000
    : snapshot.durationMs != null ? snapshot.durationMs / 1000 : undefined;
  const detail = snapshot.summary ?? (snapshot.state === "idle" ? "This stage has not started yet."
    : working ? "Work is in progress. Output will appear as the stage updates."
      : snapshot.state === "stopped" ? "This stage was interrupted before it finished."
        : snapshot.state === "failed" ? "This stage failed. Inspect its errors in the evidence below."
          : "Stage complete. Inspect its output in the evidence below.");
  const settledLabel = snapshot.state === "done" ? `${name} completed`
    : snapshot.state === "failed" ? `${name} failed`
      : snapshot.state === "stopped" ? `${name} stopped` : `${name} not started`;
  return <div className="cf-stage-activity mt-3 min-w-0" data-state={snapshot.state}>
    {working && <LatticeLoader className="cf-stage-lattice mb-3" label={`${name} working`} fontSize={12} cellSize={4} gap={2}
      color="var(--accent)" showTimer={elapsed !== undefined} elapsed={elapsed} />}
    <ThoughtLine className="cf-stage-thought" label={`${name} activity`} doneLabel={settledLabel}
      steps={activity.length ? (snapshot.summary && !activity.includes(snapshot.summary) ? [...activity, snapshot.summary] : activity) : [detail]} working={working} completed={snapshot.state === "done"} collapseOnSettle={snapshot.state === "done"}
      glyph="dot" shimmer={false} fontSize={13} showTimer={false}
      color={snapshot.state === "failed" ? "var(--danger)" : "var(--fg-muted)"} />
  </div>;
}

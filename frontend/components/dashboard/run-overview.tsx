"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RunDisclosure } from "./run-disclosure";
import { ChevronDown, Clock3 } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/pipeline";
import { formatElapsed, parseApiTime } from "@/lib/format";
import { displayStatus, tone } from "@/lib/tone";
import type { RunSnapshot } from "@/lib/run-reducer";
import "./run-workspace.css";

export function RunOverview({ snapshot, title, playbackTime, actions }: {
  snapshot: RunSnapshot;
  title?: string;
  playbackTime?: number;
  actions?: ReactNode;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const requestId = useId();
  useEffect(() => {
    if (playbackTime != null || snapshot.endedAt || !snapshot.startedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [playbackTime, snapshot.endedAt, snapshot.startedAt]);

  const status = displayStatus(snapshot.status, snapshot.tests?.ok ?? null);
  const active = PIPELINE_STAGES.find(stage => snapshot.agents[stage.id].state === "working");
  const completed = Object.values(snapshot.agents).filter(agent => agent.state === "done").length;
  const started = snapshot.startedAt ? parseApiTime(snapshot.startedAt).getTime() : null;
  const stopped = snapshot.endedAt ? parseApiTime(snapshot.endedAt).getTime() : playbackTime ?? now;
  const elapsed = started != null && stopped != null && Number.isFinite(started) && Number.isFinite(stopped)
    ? formatElapsed(stopped - started) : "—";
  const replay = playbackTime != null;

  return (
    <header className="cf-run-overview" aria-label="Run overview">
      <div className="cf-overview-heading">
        <div className="cf-overview-title">
          <div className="cf-overview-eyebrow">
            <span>{replay ? "Recorded example" : "API build"}</span>
            {snapshot.runId && !replay && <span>run {snapshot.runId.slice(0, 8)}</span>}
            {replay && <span>Replay · no model calls</span>}
          </div>
          <h1 className="cf-run-request">{title ?? snapshot.prompt ?? "Preparing the agent workflow…"}</h1>
          <div className="cf-overview-state">
            <span role="status" className={`cf-overview-status ${tone[status.tone].soft}`}>
              <span aria-hidden="true" />{status.label}
            </span>
            {active && !snapshot.approval && !snapshot.endedAt && <span>{active.name} is working</span>}
            <span className="cf-overview-elapsed"><Clock3 size={13} aria-hidden="true" /><span className="sr-only">Elapsed time </span><span aria-label="Run elapsed time">{elapsed}</span></span>
          </div>
        </div>
        {actions && <div className="cf-overview-actions">{actions}</div>}
      </div>
      <div className="cf-overview-footer">
        <dl className="cf-overview-facts">
          <div><dt>Stages</dt><dd>{completed}/6</dd></div>
          <div><dt>Files</dt><dd>{snapshot.files.length}</dd></div>
          <div><dt>Tests</dt><dd>{snapshot.tests ? `${snapshot.tests.passed}/${snapshot.tests.total}` : "Pending"}</dd></div>
          {snapshot.iterations > 0 && <div className="cf-overview-loops"><dt>Repair loops</dt><dd>{snapshot.iterations}</dd></div>}
        </dl>
        {snapshot.prompt && <Button variant="ghost" size="sm" className="cf-request-toggle" aria-expanded={requestOpen} aria-controls={requestId} onClick={() => setRequestOpen(open => !open)}>
          View request <ChevronDown size={13} aria-hidden="true" />
        </Button>}
      </div>
      {snapshot.prompt && <RunDisclosure open={requestOpen}>
        <section id={requestId} className="cf-run-request-details" aria-label="Full request"><p>{snapshot.prompt}</p></section>
      </RunDisclosure>}
    </header>
  );
}

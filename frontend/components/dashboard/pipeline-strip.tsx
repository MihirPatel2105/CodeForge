"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronDown, RotateCcw } from "lucide-react";
import { StageActivity } from "./stage-activity";
import type { TimelineEntryData } from "./timeline-entry";
import { AgentCard, type AgentCardData } from "./agent-card";
import { LoopBand } from "./loop-band";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipeline";
import { formatDuration } from "@/lib/format";
import type { AgentSnapshot, LoopSnapshot } from "@/lib/run-reducer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RunDisclosure } from "./run-disclosure";
import "./run-dashboard.css";
import "./pipeline-compact.css";

/** How long the loop-firing visual treatment holds after a `loop.iteration` event —
 * long enough to cover the chip's 1.6s flight plus the badge pop on arrival, matching
 * the design's own 2.1s-vs-620ms narration pacing. */
const FIRING_MS = 1800;

export interface PipelineStripProps {
  agents: Record<PipelineStageId, AgentSnapshot>;
  lastLoop: LoopSnapshot | null;
  activity?: readonly TimelineEntryData[];
  playbackTime?: number;
}

/**
 * The hero of the Live Run screen: six agent cards, the arrows between them, and the
 * loop band underneath. This is the one component the whole product is built around
 * (docs/UI_BRIEF.md §10) — everything else is subordinate to whether a viewer can see
 * work travel backwards to the Coder and understand why.
 */
export function PipelineStrip({ agents, lastLoop, activity = [], playbackTime }: PipelineStripProps) {
  const [firing, setFiring] = useState(false);
  const [inspected, setInspected] = useState<PipelineStageId | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailId = useId();
  const active = PIPELINE_STAGES.find(stage => agents[stage.id].state === "working")
    ?? PIPELINE_STAGES.find(stage => agents[stage.id].state === "failed")
    ?? [...PIPELINE_STAGES].reverse().find(stage => agents[stage.id].state !== "idle")
    ?? PIPELINE_STAGES[0];
  const selected = PIPELINE_STAGES.find(stage => stage.id === inspected) ?? active;
  const selectedSnapshot = agents[selected.id];
  const recentActivity = activity.flatMap(entry => entry.kind === "message" && entry.agent === selected.name
    && entry.variant !== "failed" && entry.variant !== "rejected" ? [entry.text] : []).slice(-3);
  // Fires once per distinct loop, not once per render: `lastLoop` is a stable object
  // reference across re-renders until a *new* loop.iteration event replaces it, so
  // comparing its timestamp (rather than object identity) is what makes this correct
  // whether the snapshot came from live SSE or mock replay.
  const seenAt = useRef<string | null>(null);

  useEffect(() => {
    if (!lastLoop || seenAt.current === lastLoop.at) return;
    seenAt.current = lastLoop.at;
    setFiring(true);
    const timer = setTimeout(() => setFiring(false), FIRING_MS);
    return () => clearTimeout(timer);
  }, [lastLoop]);

  const triggerStage: PipelineStageId | null = !lastLoop
    ? null
    : lastLoop.trigger === "reviewer"
      ? "reviewer"
      : "sandbox";

  const chipText = !lastLoop
    ? null
    : lastLoop.trigger === "reviewer"
      ? `${lastLoop.blockingFindings} blocking finding${lastLoop.blockingFindings === 1 ? "" : "s"}`
      : `${lastLoop.failedTests} failing test${lastLoop.failedTests === 1 ? "" : "s"}`;

  return (
    <div className="cf-pipeline-explorer cf-pipeline-compact" data-has-loop={Boolean(lastLoop)}>
      {/* Six flex:1 cards separated by five fixed 30px arrow cells — the loop band's
          percentage-based positions below assume exactly this structure. */}
      <div className="cf-pipeline-overview" role="group" aria-label="Inspect pipeline stages">
        {PIPELINE_STAGES.map((stage, i) => {
          const snapshot = agents[stage.id];
          const isCoder = stage.id === "coder";
          const isTrigger = stage.id === triggerStage;
          const data: AgentCardData = {
            id: stage.id,
            index: stage.index,
            name: stage.name,
            job: stage.job,
            state: snapshot.state,
            iteration: snapshot.iteration,
            summary: snapshot.summary ?? undefined,
            model: snapshot.model ?? undefined,
            durationLabel: snapshot.durationMs != null ? formatDuration(snapshot.durationMs) : undefined,
            dimmed: firing && !isCoder && !isTrigger,
            loopHighlight: firing && (isCoder || isTrigger),
          };
          return (
            <Fragment key={stage.id}>
              <AgentCard data={data} selected={selected.id === stage.id} controls={detailId} indicatorId={`${detailId}-step`} onSelect={() => { setInspected(stage.id); setDetailsOpen(true); }} />
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="cf-pipeline-arrow flex w-[30px] shrink-0 items-center justify-center" aria-hidden>
                  <ArrowRight
                    size={15}
                    className={cn(
                      "transition-colors duration-300",
                      firing ? "text-fg-muted" : "text-border-strong",
                    )}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {lastLoop && <div className="cf-pipeline-loop-desktop"><LoopBand firing={firing} trigger={lastLoop.trigger} chipText={chipText} /><span className="cf-pipeline-loop-reason">Pass {lastLoop.iteration + 1} · {lastLoop.trigger === "reviewer" ? "Reviewer" : "Sandbox"} returned work · {chipText}</span></div>}
      {!lastLoop && <p className="cf-pipeline-idle-note"><RotateCcw size={12} aria-hidden />Review findings and failed tests can return work to the Coder.</p>}
      <div className="cf-pipeline-loop-compact"><RotateCcw size={14} aria-hidden /><span>{lastLoop ? `${lastLoop.trigger === "reviewer" ? "Reviewer" : "Sandbox"} → Coder · ${chipText}` : "Review or failed tests can return work to the Coder."}</span></div>
      <div className="cf-stage-inspection-bar">
        <span className="cf-stage-inspection-current"><strong>{selected.name}</strong><span>{selectedSnapshot.state === "idle" ? "Not started" : selectedSnapshot.state === "working" ? "In progress" : selectedSnapshot.state === "done" ? "Complete" : selectedSnapshot.state === "failed" ? "Failed" : "Stopped"}{selectedSnapshot.iteration > 0 && ` · Pass ${selectedSnapshot.iteration + 1}`}</span></span>
        <div className="cf-stage-inspection-actions">
          {inspected && <Button variant="ghost" size="sm" onClick={() => setInspected(null)}>Follow active stage</Button>}
          <Button variant="ghost" size="sm" aria-expanded={detailsOpen} aria-controls={detailId} onClick={() => setDetailsOpen(open => !open)}>
            {detailsOpen ? "Hide stage details" : "Show stage details"}<ChevronDown size={14} aria-hidden className={detailsOpen ? "cf-stage-chevron-open" : undefined} />
          </Button>
        </div>
      </div>
      <RunDisclosure open={detailsOpen}>
      <section id={detailId} className="cf-agent-detail" aria-label="Selected stage details">
        <div className="cf-agent-detail-heading"><span>{selected.name} <span>· Stage {selected.index}</span></span><div><span>{inspected ? "Inspecting a stage" : "Following the workflow"}</span></div></div>
        <div className="cf-agent-detail-body"><div><h3>{selected.job}</h3><StageActivity key={`${selected.id}-${selectedSnapshot.iteration}`} name={selected.name} snapshot={selectedSnapshot} activity={recentActivity} playbackTime={playbackTime} /></div>
          {(selectedSnapshot.model || selectedSnapshot.durationMs != null || selectedSnapshot.iteration > 0) && <dl>{selectedSnapshot.model && <div><dt>{selected.id === "sandbox" ? "Runtime image" : "Model"}</dt><dd>{selectedSnapshot.model}</dd></div>}{selectedSnapshot.durationMs != null && <div><dt>Duration</dt><dd>{formatDuration(selectedSnapshot.durationMs)}</dd></div>}{selectedSnapshot.iteration > 0 && <div><dt>Pass</dt><dd>{selectedSnapshot.iteration + 1}</dd></div>}</dl>}
        </div>
      </section>
      </RunDisclosure>
    </div>
  );
}

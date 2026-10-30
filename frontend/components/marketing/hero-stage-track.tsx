"use client";

import { Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipeline";
import type { AgentSnapshot, LoopSnapshot } from "@/lib/run-reducer";
import type { AgentCardState } from "@/lib/types";

const STATE_LABEL: Record<AgentCardState, string> = {
  idle: "waiting",
  working: "working",
  done: "done",
  failed: "failed",
  stopped: "stopped",
};

function StageNode({ state, index }: { state: AgentCardState; index: number }) {
  if (state === "done") return <Check size={13} strokeWidth={2.4} aria-hidden />;
  if (state === "working") return <LoaderCircle size={13} aria-hidden className="ol-hero-spin" />;
  if (state === "failed") return <X size={13} aria-hidden />;
  return <span aria-hidden>{index}</span>;
}

/** The six pipeline stages as one connected track; the fill shows how far the run has got. */
export function HeroStageTrack({
  agents,
  shown,
  loop,
  onSelect,
}: {
  agents: Record<PipelineStageId, AgentSnapshot>;
  shown: PipelineStageId;
  loop: LoopSnapshot | null;
  onSelect: (stage: PipelineStageId) => void;
}) {
  const done = PIPELINE_STAGES.filter((stage) => agents[stage.id].state === "done").length;
  const progress = Math.min(done / (PIPELINE_STAGES.length - 1), 1);

  return (
    <div className="ol-hero-track">
      <div className="ol-hero-track-line" aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="ol-run-stages" role="group" aria-label="Agent pipeline">
        {PIPELINE_STAGES.map((stage) => {
          const agent = agents[stage.id];
          return (
            <button
              key={stage.id}
              type="button"
              data-state={agent.state}
              aria-pressed={shown === stage.id}
              onClick={() => onSelect(stage.id)}
            >
              <span className="ol-hero-node"><StageNode state={agent.state} index={stage.index} /></span>
              <span className="ol-hero-node-label">{stage.name}</span>
              <span className="sr-only">, {STATE_LABEL[agent.state]}</span>
            </button>
          );
        })}
      </div>
      {/* The slot keeps its height before the loop fires, so the card never jumps. */}
      <div className="ol-hero-loop-slot">
        {loop && (
          <p className="ol-hero-loop">
            <RotateCcw size={12} aria-hidden />
            Repair loop · Reviewer sent {loop.blockingFindings} blocking finding back to the Coder
          </p>
        )}
      </div>
    </div>
  );
}

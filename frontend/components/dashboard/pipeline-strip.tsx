"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AgentCard, type AgentCardData } from "./agent-card";
import { LoopBand } from "./loop-band";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipeline";
import { formatDuration } from "@/lib/format";
import type { AgentSnapshot, LoopSnapshot } from "@/lib/run-reducer";
import { cn } from "@/lib/utils";

/** How long the loop-firing visual treatment holds after a `loop.iteration` event —
 * long enough to cover the chip's 1.6s flight plus the badge pop on arrival, matching
 * the design's own 2.1s-vs-620ms narration pacing. */
const FIRING_MS = 1800;

export interface PipelineStripProps {
  agents: Record<PipelineStageId, AgentSnapshot>;
  lastLoop: LoopSnapshot | null;
}

/**
 * The hero of the Live Run screen: six agent cards, the arrows between them, and the
 * loop band underneath. This is the one component the whole product is built around
 * (docs/UI_BRIEF.md §10) — everything else is subordinate to whether a viewer can see
 * work travel backwards to the Coder and understand why.
 */
export function PipelineStrip({ agents, lastLoop }: PipelineStripProps) {
  const [firing, setFiring] = useState(false);
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
    <div>
      {/* Six flex:1 cards separated by five fixed 30px arrow cells — the loop band's
          percentage-based positions below assume exactly this structure. */}
      <div className="flex items-stretch">
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
              <AgentCard data={data} />
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex w-[30px] shrink-0 items-center justify-center" aria-hidden>
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

      <LoopBand firing={firing} trigger={lastLoop?.trigger ?? null} chipText={chipText} />
    </div>
  );
}

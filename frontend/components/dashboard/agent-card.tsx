"use client";

import { motion } from "motion/react";
import StatusMark, { type StatusMarkStatus } from "@/components/ui/react-bits/status-mark";
import { pointerLight } from "@/components/ui/premium-effects";
import { ClipboardList, Boxes, Code2, ShieldCheck, FlaskConical, Terminal } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motionSpring } from "@/lib/motion-tokens";
import type { AgentCardState, AgentName } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PipelineStageId = AgentName | "sandbox";

export interface AgentCardData {
  id: PipelineStageId;
  index: number;
  name: string;
  job: string;
  state: AgentCardState;
  /** > 0 when this stage is doing a repeat pass after a loop iteration. */
  iteration?: number;
  /** Real strings only — see docs/UI_BRIEF.md §5 for the fixed vocabulary. */
  summary?: string;
  /** Model id (`groq/gpt-oss-120b`) or, for Sandbox, the image (`codeforge-sandbox:latest`). */
  model?: string;
  durationLabel?: string;
  /** True only during the ~1.8s loop-firing window, for every card except the Coder
   * and the trigger — recedes so the travelling payload reads clearly against it.
   * Overrides the card's own state-based opacity. */
  dimmed?: boolean;
  /** True for the Coder and the trigger stage while firing — lifts the card and
   * applies the loop border, distinct from the "working" treatment. */
  loopHighlight?: boolean;
}


const STAGE_ICON = { pm: ClipboardList, architect: Boxes, coder: Code2, reviewer: ShieldCheck, tester: FlaskConical, sandbox: Terminal };
const STATUS: Record<AgentCardState, StatusMarkStatus> = { idle: "pending", working: "running", done: "done", failed: "failed", stopped: "cancelled" };

/** A compact stage selector. Its full evidence is shown once in the shared detail panel. */
export function AgentCard({ data, selected, onSelect, controls, indicatorId }: {
  data: AgentCardData; selected: boolean; onSelect: () => void; controls: string; indicatorId: string;
}) {
  const reduced = useMotionPreference();
  const Icon = STAGE_ICON[data.id];
  return <motion.button type="button" initial={false}
    animate={{ y: reduced ? 0 : data.state === "working" || data.loopHighlight ? -2 : 0, opacity: data.dimmed ? 0.72 : 1 }}
    transition={reduced ? { duration: 0 } : motionSpring}
    className={cn("cf-agent-step cf-spotlight", data.state === "working" && "cf-agent-glow", data.loopHighlight && "cf-agent-step-loop")}
    onPointerMove={pointerLight} aria-current={data.state === "working" ? "step" : undefined}
    data-stage={data.id} data-state={data.state} aria-pressed={selected} aria-controls={controls}
    aria-label={`Inspect ${data.name}, ${data.state}`} onClick={onSelect}>
    <span className="cf-agent-step-top"><span className="cf-agent-step-icon"><Icon size={19} aria-hidden /></span><span className="cf-agent-step-index" aria-hidden>{String(data.index).padStart(2, "0")}</span></span>
    <span className="cf-agent-step-name">{data.name}</span>
    <span className="cf-agent-step-status"><StatusMark className="cf-agent-status-mark" status={STATUS[data.state]} label={data.state} size={16} fontSize={11} strike={false} doneColor="var(--ok)" errorColor="var(--danger)" /></span>
    {(data.iteration ?? 0) > 0 && <span className="cf-agent-step-pass">pass {(data.iteration ?? 0) + 1}</span>}
    {selected && <motion.span aria-hidden="true" className="cf-step-indicator" data-state={data.state} layoutId={indicatorId} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }} />}
  </motion.button>;
}

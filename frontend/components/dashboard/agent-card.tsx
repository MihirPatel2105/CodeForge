"use client";

import { motion } from "motion/react";
import { ClipboardList, Boxes, Code2, ShieldCheck, FlaskConical, Terminal, Check, Circle, Loader2, OctagonAlert, Pause } from "lucide-react";
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
const STATE_ICON = { idle: Circle, working: Loader2, done: Check, failed: OctagonAlert, stopped: Pause };

/** A compact stage selector. Its full evidence is shown once in the shared detail panel. */
export function AgentCard({ data, selected, onSelect, controls }: {
  data: AgentCardData; selected: boolean; onSelect: () => void; controls: string;
}) {
  const reduced = useMotionPreference();
  const Icon = STAGE_ICON[data.id];
  const StateIcon = STATE_ICON[data.state];
  return <motion.button type="button" initial={false}
    animate={{ y: reduced ? 0 : data.state === "working" || data.loopHighlight ? -2 : 0, opacity: data.dimmed ? 0.72 : 1 }}
    transition={reduced ? { duration: 0 } : motionSpring}
    className={cn("cf-agent-step", data.state === "working" && "cf-agent-glow", data.loopHighlight && "cf-agent-step-loop")}
    data-stage={data.id} data-state={data.state} aria-pressed={selected} aria-controls={controls}
    aria-label={`Inspect ${data.name}, ${data.state}`} onClick={onSelect}>
    <span className="cf-agent-step-top"><span className="cf-agent-step-icon"><Icon size={19} aria-hidden /></span><span className="cf-agent-step-index" aria-hidden>{String(data.index).padStart(2, "0")}</span></span>
    <span className="cf-agent-step-name">{data.name}</span>
    <span className="cf-agent-step-status"><StateIcon size={12} aria-hidden className={data.state === "working" ? "motion-safe:animate-spin" : undefined} />{data.state}</span>
    {(data.iteration ?? 0) > 0 && <span className="cf-agent-step-pass">pass {(data.iteration ?? 0) + 1}</span>}
  </motion.button>;
}

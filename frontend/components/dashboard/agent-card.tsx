"use client";

import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motionSpring } from "@/lib/motion-tokens";
import { ClipboardList, Boxes, Code2, ShieldCheck, FlaskConical, Terminal } from "lucide-react";
import type { AgentCardState, AgentName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import { tone } from "@/lib/tone";

/** The pipeline has one non-agent stage — execution — that shares the agent card's
 * visual language (docs/UI_BRIEF.md §4.1: "Sandbox as a 6th card, visually distinct as
 * real execution"). Frontend-local: the backend's AgentName has no such value, because
 * the sandbox is not an LLM agent. */
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
   * applies the loop's violet shadow, distinct from the "working" treatment. */
  loopHighlight?: boolean;
}

const STATE_TONE: Record<AgentCardState, "neutral" | "accent" | "ok" | "danger"> = {
  idle: "neutral",
  working: "accent",
  done: "ok",
  failed: "danger",
  // Neutral, never danger: the stage was interrupted, it did not fail (UI_BRIEF §5).
  stopped: "neutral",
};

const STATE_LABEL: Record<AgentCardState, string> = {
  idle: "idle",
  working: "working",
  done: "done",
  failed: "failed",
  stopped: "stopped",
};

const STAGE_ICON = { pm: ClipboardList, architect: Boxes, coder: Code2, reviewer: ShieldCheck, tester: FlaskConical, sandbox: Terminal };

export function AgentCard({ data }: { data: AgentCardData }) {
  const reducedMotion = useMotionPreference();
  const {
    index,
    name,
    job,
    state,
    iteration = 0,
    summary,
    model,
    durationLabel,
    dimmed,
    loopHighlight,
  } = data;
  const Icon = STAGE_ICON[data.id];
  const t = tone[STATE_TONE[state]];
  const working = state === "working";
  const failed = state === "failed";
  const stateRail = loopHighlight ? "bg-loop" : working ? "bg-accent" : state === "done" ? "bg-ok" : failed ? "bg-danger" : "bg-border-strong";

  return (
    <motion.div
      initial={false}
      animate={{ y: reducedMotion ? 0 : working || loopHighlight ? -3 : 0, opacity: dimmed ? 0.72 : state === "idle" ? 0.86 : state === "stopped" ? 0.82 : 1 }}
      transition={reducedMotion ? { duration: 0 } : motionSpring}
      className={cn(
        "relative flex flex-1 snap-center flex-col gap-3 overflow-hidden rounded-3xl border bg-surface px-5 py-6",
        "transition-[box-shadow,border-color] duration-300 ease-out",
        state === "idle" && "border-border",
        working && "border-accent-bd bg-accent-soft/25 shadow-[0_12px_28px_rgba(63,71,201,0.12)]",
        state === "done" && "border-ok-bd",
        failed && "border-danger-bd",
        // Reads as "ran, then was interrupted": not faded as far as idle, which means
        // "not reached yet", and carrying no verdict colour of its own.
        state === "stopped" && "border-border-strong",
        // Transient loop-moment overrides — applied last so they win over the card's
        // own state styling (cn/tailwind-merge resolves same-property conflicts by
        // keeping the last class), since even a "done" card must dim while the loop
        // fires, and the trigger must lift regardless of its own state.

        loopHighlight &&
          "border-loop-bd shadow-[0_12px_28px_rgba(109,40,217,0.14)]",
      )}
      data-stage={data.id}
      data-state={state}
    >
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", stateRail)} aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <span className={cn("grid size-10 place-items-center rounded-2xl", t.soft)}><Icon size={20} aria-hidden /></span>
        <span className="text-[12px] tabular-nums text-fg-faint" aria-label={`Stage ${index}`}>{index}</span>
      </div>
      {/* Role and repeat pass remain readable independently of the state color. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(typeScale.cardTitle, "text-fg")}>{name}</span>
        {iteration > 0 && (
          <span
            key={`pass-${iteration}`}
            className={cn(
              "ml-auto shrink-0 rounded-full px-2 py-[2px]",
              typeScale.metaMono,
              "text-[11px] font-bold",
              tone.loop.soft,
              "motion-safe:animate-[cfPop_0.5s_cubic-bezier(.3,1.4,.5,1)]",
            )}
          >
            pass {iteration + 1}
          </span>
        )}
      </div>

      {/* Row 2: job line — fixed height so all six cards align regardless of wrap */}
      <p className="min-h-[36px] text-[13.5px] leading-[1.4] text-fg-muted">{job}</p>

      {/* Row 3: state pill */}
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1",
          typeScale.label,
          t.soft,
        )}
      >
        {working && (
          <span
            aria-hidden
            className="h-[7px] w-[7px] shrink-0 rounded-full bg-current motion-safe:animate-[cfDot_1.1s_ease-in-out_infinite]"
          />
        )}
        {STATE_LABEL[state]}
      </span>

      {/* Row 4: sweep bar — only while genuinely working; nothing spins with no meaning */}
      {working && (
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full w-1/3 motion-safe:animate-[cfBar_1.25s_linear_infinite] bg-accent" />
        </div>
      )}

      {/* Row 5: summary — real per-stage strings, never placeholder text */}
      {/* Clamped as a structural guarantee, not just a tidy-up: the reducer already
          shortens failure text, but no future summary should be able to stretch one
          card and shove a later stage off the screen. */}
      <p
        className={cn(
          "line-clamp-3 min-h-[36px] break-words text-[13.5px] leading-[1.35]",
          failed ? "text-danger" : "text-fg",
        )}
      >
        {summary ?? "—"}
      </p>

      {/* Footer: model / image id + duration */}
      {(model || durationLabel) && (
        <div
          className={cn(
            "mt-auto flex items-center justify-between border-t border-border pt-[7px]",
            typeScale.metaMono,
            "text-[11px] text-fg-faint",
          )}
        >
          <span className="truncate">{model}</span>
          {durationLabel && <span className="shrink-0">{durationLabel}</span>}
        </div>
      )}
    </motion.div>
  );
}

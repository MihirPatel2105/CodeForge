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

export function AgentCard({ data }: { data: AgentCardData }) {
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
  const t = tone[STATE_TONE[state]];
  const working = state === "working";
  const failed = state === "failed";

  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-[7px] rounded-[3px] border-[1.5px] bg-surface px-[13px] pt-3 pb-[11px]",
        "transition-[transform,box-shadow,border-color,opacity] duration-300 ease-out",
        state === "idle" && "border-border opacity-[0.72]",
        working && "-translate-y-[3px] border-accent-bd shadow-[0_4px_16px_rgba(67,56,202,.15)]",
        state === "done" && "border-ok-bd",
        failed && "border-danger-bd",
        // Reads as "ran, then was interrupted": not faded as far as idle, which means
        // "not reached yet", and carrying no verdict colour of its own.
        state === "stopped" && "border-border-strong opacity-[0.82]",
        // Transient loop-moment overrides — applied last so they win over the card's
        // own state styling (cn/tailwind-merge resolves same-property conflicts by
        // keeping the last class), since even a "done" card must dim while the loop
        // fires, and the trigger must lift regardless of its own state.
        dimmed && "opacity-[0.32]",
        loopHighlight &&
          "-translate-y-[3px] border-loop-bd shadow-[0_6px_22px_rgba(109,40,217,.28)]",
      )}
      data-stage={data.id}
      data-state={state}
    >
      {/* Row 1: numbered square, name, iteration badge */}
      <div className="flex items-center gap-[7px]">
        <span
          className={cn(
            "flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md",
            typeScale.metaMono,
            "text-[11.5px] font-bold",
            t.soft,
          )}
        >
          {index}
        </span>
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
      <p className="min-h-[32px] text-[12px] leading-[1.35] text-fg-muted">{job}</p>

      {/* Row 3: state pill */}
      <span
        className={cn(
          "inline-flex w-fit items-center gap-[5px] rounded-[2px] px-2 py-[3px]",
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
          "line-clamp-3 min-h-[34px] break-words text-[12.5px] leading-[1.35]",
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
    </div>
  );
}

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";

/**
 * The three timeline entry kinds (docs/UI_BRIEF.md §4.2). All three share a 70px mono
 * time column and a 3px left rule; everything else about their treatment is deliberate
 * severity weighting — `blocking` gets the full-width red card because only a blocking
 * finding triggers the loop, and LOOP breaks the grid entirely because it is the moment
 * the whole demo is built around.
 */

type MessageKind =
  | "default"
  | "file"
  | "completed"
  | "approval-required"
  | "approval-resolved"
  | "rejected"
  | "failed";

const MESSAGE_KIND: Record<
  MessageKind,
  { rule: string; agent: string; bg?: string; weight?: string }
> = {
  default: { rule: "border-l-border-strong", agent: "text-fg-muted" },
  file: { rule: "border-l-accent-bd", agent: "text-accent" },
  completed: { rule: "border-l-ok-bd", agent: "text-ok-bd", weight: "font-[550]" },
  "approval-required": {
    rule: "border-l-warn",
    agent: "text-warn",
    bg: "bg-warn-soft",
    weight: "font-[600]",
  },
  "approval-resolved": { rule: "border-l-ok", agent: "text-ok" },
  rejected: { rule: "border-l-danger", agent: "text-danger" },
  failed: {
    rule: "border-l-danger",
    agent: "text-danger",
    bg: "bg-danger-soft",
    weight: "font-[600]",
  },
};

export interface MessageEntryProps {
  time: string;
  agent: string;
  text: string;
  /** Not called `kind`: TimelineEntryData's discriminant is also `kind`, and the two
   * would collide under the `{ kind: "message" } & MessageEntryProps` intersection —
   * collapsing to `kind: never` and breaking every spread of a message entry. */
  variant?: MessageKind;
}

export function MessageEntry({ time, agent, text, variant = "default" }: MessageEntryProps) {
  const k = MESSAGE_KIND[variant];
  return (
    <div
      className={cn(
        "grid grid-cols-[70px_78px_1fr] items-start gap-x-[10px] rounded-lg border-l-[3px] px-[10px] py-2",
        "motion-safe:animate-[cfFade_0.3s_ease]",
        k.rule,
        k.bg,
      )}
    >
      <span className={cn(typeScale.metaMono, "text-[12.5px] text-fg-faint")}>{time}</span>
      <span className={cn(typeScale.label, "text-[11.5px]", k.agent)}>{agent}</span>
      <span className={cn(typeScale.timelineBody, k.weight, "text-pretty text-fg")}>{text}</span>
    </div>
  );
}

export interface FindingEntryProps {
  time: string;
  agent: string;
  /** Absent when the source message had no recognisable "path.py: issue" prefix — the
   * reducer's heuristic for classifying an agent.message as a finding (see
   * lib/run-reducer.ts). Rendered without the file:line meta rather than a fabricated
   * filename. */
  file?: string;
  line?: number | null;
  issue: string;
  fixHint?: string;
}

export function FindingEntry({ time, agent, file, line, issue, fixHint }: FindingEntryProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[70px_1fr] gap-x-[10px] rounded-lg border border-danger-bd border-l-[3px] border-l-danger",
        "bg-danger-soft px-[10px] py-2",
        "motion-safe:animate-[cfFade_0.3s_ease]",
      )}
    >
      <span className={cn(typeScale.metaMono, "text-[12.5px] text-fg-faint")}>{time}</span>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-danger px-[6px] py-[1px] text-[11px] font-extrabold tracking-[0.05em] text-surface uppercase">
            blocking
          </span>
          <span className={cn(typeScale.label, "text-[11.5px] text-fg-muted")}>{agent}</span>
          {file && (
            <span className={cn(typeScale.metaMono, "text-[12px] text-fg-faint")}>
              {file}
              {line != null ? `:${line}` : ""}
            </span>
          )}
        </div>
        <p className="text-[14.5px] leading-[1.4] font-[550] text-pretty text-fg">{issue}</p>
        {fixHint && (
          <p className="text-[13.5px] text-fg-muted">
            <span className="font-[650]">Fix:</span> {fixHint}
          </p>
        )}
      </div>
    </div>
  );
}

export interface LoopEntryProps {
  time: string;
  /** "Iteration 1 — sending 2 blocking findings back to the Coder" */
  text: string;
}

export function LoopEntry({ time, text }: LoopEntryProps) {
  return (
    <div
      className={cn(
        "my-[5px] flex items-center gap-3 rounded-[3px] bg-loop px-[14px] py-[10px] text-surface",
        "shadow-[0_4px_14px_rgba(109,40,217,.28)]",
        "motion-safe:animate-[cfFade_0.3s_ease]",
      )}
    >
      <span className={cn(typeScale.metaMono, "text-[12.5px] opacity-80")}>{time}</span>
      <span className="flex items-center gap-1 rounded-full bg-white/[.18] px-[10px] py-[3px] text-[11px] font-bold tracking-[0.05em] uppercase">
        <RefreshCw className="h-3 w-3" aria-hidden />
        LOOP
      </span>
      <span className="text-[15px] font-[650]">{text}</span>
    </div>
  );
}

export type TimelineEntryData =
  | ({ kind: "message" } & MessageEntryProps)
  | ({ kind: "finding" } & FindingEntryProps)
  | ({ kind: "loop" } & LoopEntryProps);

export function TimelineEntry({ entry, i }: { entry: TimelineEntryData; i: number }) {
  switch (entry.kind) {
    case "loop":
      return <LoopEntry key={i} time={entry.time} text={entry.text} />;
    case "finding":
      return (
        <FindingEntry
          key={i}
          time={entry.time}
          agent={entry.agent}
          file={entry.file}
          line={entry.line}
          issue={entry.issue}
          fixHint={entry.fixHint}
        />
      );
    case "message":
      return (
        <MessageEntry
          key={i}
          time={entry.time}
          agent={entry.agent}
          text={entry.text}
          variant={entry.variant}
        />
      );
  }
}

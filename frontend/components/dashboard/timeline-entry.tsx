import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";

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
  { marker: string; agent: string; bg?: string; weight?: string }
> = {
  default: { marker: "bg-border-strong", agent: "text-fg-muted" },
  file: { marker: "bg-accent", agent: "text-accent" },
  completed: { marker: "bg-ok", agent: "text-ok", weight: "font-[550]" },
  "approval-required": {
    marker: "bg-warn",
    agent: "text-warn",
    bg: "bg-warn-soft/55",
    weight: "font-[600]",
  },
  "approval-resolved": { marker: "bg-ok", agent: "text-ok" },
  rejected: { marker: "bg-danger", agent: "text-danger" },
  failed: {
    marker: "bg-danger",
    agent: "text-danger",
    bg: "bg-danger-soft/65",
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
        "grid grid-cols-[12px_minmax(0,1fr)] gap-x-2.5 rounded-xl px-2.5 py-3",
        "motion-safe:animate-[cfFade_0.3s_ease]",
        k.bg,
      )}
    >
      <span className={cn("mt-[5px] h-2 w-2 rounded-full", k.marker)} aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <span className={cn(typeScale.metaMono, "text-[11px] text-fg-faint")}>{time}</span>
          {agent !== "—" && <span className={cn(typeScale.label, "text-[11px]", k.agent)}>{agent}</span>}
        </div>
        <p className={cn(typeScale.timelineBody, k.weight, "mt-1 text-pretty text-fg")}>{text}</p>
      </div>
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
        "rounded-2xl border border-danger-bd border-l-[3px] border-l-danger bg-danger-soft/75 px-4 py-3",
        "motion-safe:animate-[cfFade_0.3s_ease]",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-[700] text-white">Blocking</span>
        <span className={cn(typeScale.metaMono, "text-[11px] text-fg-faint")}>{time}</span>
        <span className={cn(typeScale.label, "text-[11px] text-fg-muted")}>{agent}</span>
        {file && (
          <span className="min-w-0 truncate rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">
            {file}{line != null ? `:${line}` : ""}
          </span>
        )}
      </div>
      <p className="mt-2 text-[14px] leading-[1.45] font-[550] text-pretty text-fg">{issue}</p>
      {fixHint && (
        <p className="mt-2 text-[13px] leading-5 text-fg-muted">
          <span className="font-[650]">Fix:</span> {fixHint}
        </p>
      )}
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
        "rounded-2xl border border-loop-bd border-l-[3px] border-l-loop bg-loop-soft px-4 py-3",
        "motion-safe:animate-[cfFade_0.3s_ease]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-loop text-white">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="text-[12px] font-[700] text-loop">Review loop</span>
        <span className={cn(typeScale.metaMono, "ml-auto text-[11px] text-fg-faint")}>{time}</span>
      </div>
      <p className="mt-2 text-[14px] leading-[1.45] font-[600] text-pretty text-fg">{text}</p>
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

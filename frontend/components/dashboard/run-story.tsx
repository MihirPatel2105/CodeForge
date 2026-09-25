import { RotateCcw } from "lucide-react";
import { stageMeta } from "@/lib/pipeline";
import type { RunSnapshot } from "@/lib/run-reducer";
import { displayStatus } from "@/lib/tone";
import { cn } from "@/lib/utils";

/** A plain-language readout beside the visual pipeline, including its feedback loop. */
export function RunStory({ snapshot }: { snapshot: RunSnapshot }) {
  const status = displayStatus(snapshot.status, snapshot.tests?.ok ?? null);
  const active = snapshot.currentAgent ? stageMeta(snapshot.currentAgent) : null;
  const isWorking = active != null && snapshot.agents[active.id].state === "working";
  const title = snapshot.approval
    ? "Waiting for your decision"
    : snapshot.endedAt
      ? status.label
      : isWorking
        ? `${active?.name} is working`
        : "Preparing the next stage";
  const description = snapshot.approval
    ? "Review the checkpoint. The agents will continue after you approve it."
    : snapshot.endedAt
      ? "The run has finished. Inspect the result and the evidence below."
      : isWorking
        ? active?.job
        : "The pipeline will update as each agent finishes its work.";
  const loop = snapshot.lastLoop;
  const loopCause = loop?.trigger === "reviewer"
    ? `${loop.blockingFindings} blocking finding${loop.blockingFindings === 1 ? "" : "s"}`
    : `${loop?.failedTests ?? 0} failing test${loop?.failedTests === 1 ? "" : "s"}`;
  const statusRule = snapshot.approval
    ? "bg-warn"
    : isWorking
      ? "bg-accent"
      : snapshot.endedAt && status.tone === "ok"
        ? "bg-ok"
        : snapshot.endedAt && status.tone === "danger"
          ? "bg-danger"
          : snapshot.endedAt && status.tone === "warn"
            ? "bg-warn"
            : "bg-border-strong";

  return (
    <div className="grid border-b border-rule bg-surface sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="relative min-w-0 px-5 py-3 sm:px-6" aria-live="polite">
        <span className={cn("absolute inset-y-0 left-0 w-[3px]", statusRule)} aria-hidden />
        <div key={title} className="motion-safe:animate-[cfReadoutEnter_280ms_cubic-bezier(.16,1,.3,1)]">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-fg-faint">Current state</p>
          <p className="mt-0.5 text-[18px] font-semibold leading-snug text-fg">{title}</p>
          <p className="mt-0.5 text-[14px] leading-snug text-fg-muted">{description}</p>
        </div>
      </div>
      <div className={cn("relative min-w-0 border-t border-rule px-5 py-3 sm:border-l sm:border-t-0 sm:px-6", loop ? "bg-loop-soft/55" : "bg-surface-2/45")}>
        {loop && <span className="absolute inset-y-0 left-0 hidden w-[3px] bg-loop sm:block" aria-hidden />}
        <div key={loop?.at ?? "no-loop"} className={loop ? "motion-safe:animate-[cfReadoutEnter_420ms_cubic-bezier(.16,1,.3,1)]" : undefined}>
          <div className="flex items-center gap-2">
            <RotateCcw className={cn("h-3.5 w-3.5 shrink-0", loop ? "text-loop" : "text-fg-faint")} aria-hidden />
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-fg-faint">Feedback cycle</p>
          </div>
          <p className="mt-0.5 text-[17px] font-semibold leading-snug text-fg">
            {loop ? `Pass ${loop.iteration + 1}: returned to the Coder` : "No revisions yet"}
          </p>
          <p className="mt-0.5 text-[14px] leading-snug text-fg-muted">
            {loop ? `${loop.trigger === "reviewer" ? "Reviewer found" : "Sandbox found"} ${loopCause}. The Coder received the work again.` : "Review or failed tests can send work back to the Coder."}
          </p>
        </div>
      </div>
    </div>
  );
}

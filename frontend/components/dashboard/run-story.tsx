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
  const statusDot = snapshot.approval
    ? "bg-warn"
    : isWorking
      ? "bg-accent"
      : snapshot.endedAt && status.tone === "ok"
        ? "bg-ok"
        : snapshot.endedAt && status.tone === "danger"
          ? "bg-danger"
          : snapshot.endedAt && status.tone === "warn"
            ? "bg-warn"
            : "bg-fg-faint";

  return (
    <div className="grid border-b border-rule bg-surface sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex gap-3 px-5 py-4 sm:px-6">
        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", statusDot)} aria-hidden />
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-fg-faint">Current state</p>
          <p className="mt-1 text-[17px] font-semibold leading-snug text-fg" aria-live="polite">{title}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-fg-muted">{description}</p>
        </div>
      </div>
      <div className="flex gap-3 border-t border-rule bg-surface-2/45 px-5 py-4 sm:border-l sm:border-t-0 sm:px-6">
        <RotateCcw className={cn("mt-0.5 h-4 w-4 shrink-0", loop ? "text-loop" : "text-fg-faint")} aria-hidden />
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-fg-faint">Feedback cycle</p>
          <p className="mt-1 text-[14px] font-semibold leading-snug text-fg">
            {loop ? `Pass ${loop.iteration + 1}: back to the Coder` : "Ready when review or tests find an issue"}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-fg-muted">
            {loop ? `${loop.trigger === "reviewer" ? "Reviewer found" : "Sandbox found"} ${loopCause}. The Coder received the work again.` : "A visible return path shows when the agents revise the code."}
          </p>
        </div>
      </div>
    </div>
  );
}

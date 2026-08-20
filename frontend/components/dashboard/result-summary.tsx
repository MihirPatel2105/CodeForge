import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import { tone, RUN_STATUS_META } from "@/lib/tone";
import { formatElapsed } from "@/lib/format";
import type { RunSnapshot } from "@/lib/run-reducer";

export interface ResultSummaryProps {
  snapshot: RunSnapshot;
  onDownload?: () => void;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Headline + a ≤52ch explanation per outcome (design_handoff/README.md "Result
 * summary"). Data-driven from the snapshot rather than the design's literal example
 * copy, since a result summary has to describe whichever run actually happened, not
 * only the one canonical demo recording. */
function copyFor(
  outcomeKey: string,
  snapshot: RunSnapshot,
): { headline: string; detail: string } {
  const iterations = snapshot.iterations;
  const trigger = snapshot.lastLoop?.trigger;
  const blocking = snapshot.lastLoop?.blockingFindings ?? 0;
  const failedTests = snapshot.tests?.failed ?? 0;
  const totalTests = snapshot.tests?.total ?? 0;

  switch (outcomeKey) {
    case "succeeded":
      if (iterations === 0) {
        return {
          headline: "Every test passed on the first attempt.",
          detail: "The agents produced working, tested code without needing a second pass.",
        };
      }
      return {
        headline: "The reviewer found a bug, sent it back, and the coder fixed it.",
        detail: `${iterations} loop ${plural(iterations, "iteration", "iterations")}, triggered by ${
          trigger === "reviewer"
            ? `${blocking} blocking ${plural(blocking, "finding", "findings")}`
            : `${snapshot.lastLoop?.failedTests ?? 0} failing tests`
        }. Everything the agents produced is kept.`,
      };
    case "partial":
      return {
        headline: `Code runs, ${failedTests} ${plural(failedTests, "behaviour is", "behaviours are")} wrong.`,
        detail: `The container built and served the app; ${failedTests} of ${totalTests} tests fail. This is the most common ending, not an error.`,
      };
    case "failed_max_loops":
      return {
        headline: "Stopped deliberately after three attempts.",
        detail: `Three passes could not clear the blocking findings, so the loop cap held and the work was kept as-is. Not a crash.`,
      };
    case "failed_llm":
      return {
        headline: "The run stopped early — no code was lost.",
        detail: snapshot.failureReason ?? "All providers were unavailable.",
      };
    case "cancelled":
      return {
        headline: "Cancelled by you before it finished.",
        detail: `Everything the agents produced up to that point is kept — ${snapshot.files.length} ${plural(snapshot.files.length, "file", "files")} generated.`,
      };
    case "rejected": {
      // By the time a rejection resolves, `snapshot.approval` (which carried the
      // phase) has already been cleared — but the Architect only ever runs after
      // the PM checkpoint is approved, so whether it finished says which checkpoint
      // this rejection was at.
      const atArchitect = snapshot.agents.architect.state === "done";
      return {
        headline: `Rejected at the ${atArchitect ? "Architect" : "PM"} checkpoint.`,
        detail:
          snapshot.failureReason ??
          `You rejected the ${atArchitect ? "design" : "requirements"} before the run continued.`,
      };
    }
    default:
      return {
        headline: RUN_STATUS_META[outcomeKey]?.label ?? outcomeKey,
        detail: snapshot.failureReason ?? "",
      };
  }
}

/** Inline at the bottom of the Live run screen when a run ends (docs/UI_BRIEF.md
 * §3.5), and the same card set standalone on the Screens tab. */
export function ResultSummary({ snapshot, onDownload }: ResultSummaryProps) {
  const isPartial = snapshot.status === "succeeded" && snapshot.tests?.ok === false;
  const outcomeKey = isPartial ? "partial" : snapshot.status;
  const meta = RUN_STATUS_META[outcomeKey] ?? { label: outcomeKey, tone: "neutral" as const };
  const t = tone[meta.tone];
  const { headline, detail } = copyFor(outcomeKey, snapshot);

  const elapsedMs =
    snapshot.startedAt && snapshot.endedAt
      ? new Date(snapshot.endedAt).getTime() - new Date(snapshot.startedAt).getTime()
      : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-6 rounded-xl border-[1.5px] p-4",
        "motion-safe:animate-[cfFade_0.3s_ease]",
        t.border,
        t.soft,
      )}
    >
      <div className="flex min-w-[260px] flex-1 flex-col gap-[6px]">
        <span
          className={cn(
            "w-fit rounded-[2px] px-[9px] py-[3px] text-[11.5px] font-[800] tracking-[0.05em] uppercase text-surface",
            meta.tone === "ok" && "bg-ok",
            meta.tone === "warn" && "bg-warn",
            meta.tone === "danger" && "bg-danger",
            meta.tone === "neutral" && "bg-fg-muted",
          )}
        >
          {meta.label}
        </span>
        <p className="text-[16px] font-[650] text-fg">{headline}</p>
        <p className="max-w-[52ch] text-[13.5px] leading-[1.4] text-fg-muted">{detail}</p>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <Metric label="Iterations" value={String(snapshot.iterations)} tone="loop" />
        <Metric
          label="Tests"
          value={snapshot.tests ? `${snapshot.tests.passed}/${snapshot.tests.total}` : "—"}
        />
        <Metric label="Elapsed" value={elapsedMs != null ? formatElapsed(elapsedMs) : "—"} />
        <Metric label="Files" value={String(snapshot.files.length)} />

        <button
          type="button"
          onClick={onDownload}
          className="shrink-0 rounded-[3px] bg-fg px-[16px] py-[10px] text-[13.5px] font-[700] text-surface"
        >
          Download code
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone: metricTone,
}: {
  label: string;
  value: string;
  tone?: "loop";
}) {
  return (
    <div className="flex flex-col items-center gap-[2px]">
      <span
        className={cn(
          "font-mono text-[18px] font-[700]",
          metricTone === "loop" ? "text-loop" : "text-fg",
        )}
      >
        {value}
      </span>
      <span className={cn(typeScale.label, "text-[11px] text-fg-faint")}>{label}</span>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Check, LoaderCircle } from "lucide-react";
import { RunFlowLink } from "@/components/dashboard/run-flow-link";
import { typeScale } from "@/lib/type-scale";
import { tone, RUN_STATUS_META } from "@/lib/tone";
import { formatElapsed } from "@/lib/format";
import type { RunSnapshot } from "@/lib/run-reducer";

export interface ResultSummaryProps {
  snapshot: RunSnapshot;
  onDownload?: () => void;
  downloadState?: "idle" | "pending" | "started";
  onRetry?: () => void;
  tryApiHref?: string;
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
        detail: `The container built and served the app; ${failedTests} of ${totalTests} tests fail. Review the test output before using this API.`,
      };
    case "failed_max_loops":
      return {
        headline: "Stopped deliberately after three attempts.",
        detail: `Three passes could not clear the blocking findings, so the loop cap held and the work was kept as-is. Not a crash.`,
      };
    case "failed_llm": {
      return {
        headline: "This run couldn't finish.",
        detail: "Your generated files are saved. Please try again later.",
      };
    }
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
export function ResultSummary({ snapshot, onDownload, downloadState = "idle", onRetry, tryApiHref }: ResultSummaryProps) {
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
        "flex flex-wrap items-center gap-6 rounded-2xl border p-5 sm:p-6",
        "motion-safe:animate-[cfFade_0.3s_ease]",
        t.border,
        t.soft,
      )}
    >
      <div className="flex min-w-[260px] flex-1 flex-col gap-[6px]">
        <span
          className={cn(
            "w-fit rounded-full px-3 py-1 text-[12px] font-[700] text-surface",
            meta.tone === "ok" && "bg-ok",
            meta.tone === "warn" && "bg-warn",
            meta.tone === "danger" && "bg-danger",
            meta.tone === "neutral" && "bg-fg-muted",
          )}
        >
          {meta.label}
        </span>
        <p className="font-display text-[20px] font-[700] leading-[1.3] tracking-[-0.035em] text-fg">{headline}</p>
        <p className="max-w-[52ch] text-[14px] leading-[1.5] text-fg-muted">{detail}</p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-5 lg:w-auto lg:shrink-0 lg:gap-6">
        <Metric label="Iterations" value={String(snapshot.iterations)} tone="loop" />
        <Metric
          label="Tests"
          value={snapshot.tests ? `${snapshot.tests.passed}/${snapshot.tests.total}` : "—"}
        />
        <Metric label="Elapsed" value={elapsedMs != null ? formatElapsed(elapsedMs) : "—"} />
        <Metric label="Files" value={String(snapshot.files.length)} />

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {tryApiHref && outcomeKey === "succeeded" && (
            <RunFlowLink href={tryApiHref} className="rounded-lg border border-accent-bd bg-accent-soft px-[16px] py-[10px] text-[13.5px] font-[700] text-accent hover:bg-surface">
              Use your API
            </RunFlowLink>
          )}
          {onRetry && outcomeKey !== "succeeded" && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-border-strong bg-surface px-[16px] py-[10px] text-[13.5px] font-[700] text-fg hover:border-accent-bd hover:text-accent"
            >
              Run again
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={snapshot.files.length === 0 || downloadState === "pending"}
              className="inline-flex min-w-[215px] shrink-0 items-center justify-center rounded-full bg-accent px-[16px] py-[10px] text-[13.5px] font-[700] text-surface shadow-[0_8px_20px_rgba(23,32,51,0.13)] motion-safe:transition-[transform,background-color,box-shadow] motion-safe:duration-[220ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] hover:bg-accent/90 hover:shadow-[0_12px_24px_rgba(23,32,51,0.2)] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-accent disabled:hover:shadow-[0_8px_20px_rgba(23,32,51,0.13)] motion-safe:disabled:hover:translate-y-0 motion-safe:disabled:hover:scale-100"
            >
              <span key={downloadState} className="inline-flex items-center justify-center gap-2 motion-safe:animate-[cfFade_0.22s_ease-out]" aria-live="polite">
                {downloadState === "pending" && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
                {downloadState === "started" && <Check className="size-4" aria-hidden="true" />}
                {snapshot.files.length === 0
                  ? "No code generated"
                  : downloadState === "pending"
                    ? "Preparing download…"
                    : downloadState === "started"
                      ? "Download started"
                      : "Download runnable project"}
              </span>
            </button>
          )}
        </div>
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
          "font-display text-[20px] font-[700] tracking-[-0.03em]",
          metricTone === "loop" ? "text-loop" : "text-fg",
        )}
      >
        {value}
      </span>
      <span className={cn(typeScale.label, "text-[11px] text-fg-faint")}>{label}</span>
    </div>
  );
}

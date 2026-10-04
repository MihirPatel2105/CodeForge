"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock3,
  GitBranch,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotionPreference } from "@/lib/use-motion-preference";

type RouteState = "queued" | "running" | "approval" | "done" | "returned";

const AGENTS = [
  { name: "PM", job: "Structures requirements", output: "1 entity · 4 operations" },
  { name: "Architect", job: "Designs routes and models", output: "5 endpoints designed" },
  { name: "Coder", job: "Writes the application", output: "4 files written" },
  { name: "Reviewer", job: "Checks a fixed checklist", output: "0 blocking findings" },
  { name: "Tester", job: "Writes tests independently", output: "8 tests collected" },
  { name: "Sandbox", job: "Runs code and tests", output: "8 of 8 passed" },
] as const;

const STEPS = [
  { id: "pm", agent: 0, mode: "running", event: "PM is extracting entities, fields and operations", approvals: 0 },
  { id: "approve-requirements", agent: 0, mode: "approval", event: "Requirements ready · waiting for approval 01", approvals: 0 },
  { id: "architect", agent: 1, mode: "running", event: "Approved · Architect is mapping routes and schemas", approvals: 1 },
  { id: "approve-design", agent: 1, mode: "approval", event: "Architecture ready · waiting for approval 02", approvals: 1 },
  { id: "coder", agent: 2, mode: "running", event: "Approved · Coder is writing the application files", approvals: 2 },
  { id: "reviewer", agent: 3, mode: "running", event: "Reviewer is checking the generated source", approvals: 2 },
  { id: "loop", agent: 2, mode: "loop", event: "2 blocking findings returned to Coder · pass 2", approvals: 2 },
  { id: "review-again", agent: 3, mode: "running", event: "Repair complete · Reviewer is checking pass 2", approvals: 2 },
  { id: "tester", agent: 4, mode: "running", event: "Review passed · Tester is writing eight tests", approvals: 2 },
  { id: "sandbox", agent: 5, mode: "running", event: "Sandbox is running the API and pytest", approvals: 2 },
  { id: "complete", agent: null, mode: "complete", event: "Run verified · 8 tests passed in 1.42s", approvals: 2 },
] as const;

function stateForAgent(agentIndex: number, stepIndex: number): RouteState {
  const step = STEPS[stepIndex];

  if (step.mode === "complete") return "done";
  if (step.mode === "loop") {
    if (agentIndex < 2) return "done";
    if (agentIndex === 2) return "running";
    if (agentIndex === 3) return "returned";
    return "queued";
  }
  if (step.agent === null) return "done";
  if (agentIndex < step.agent) return "done";
  if (agentIndex === step.agent) return step.mode === "approval" ? "approval" : "running";
  return "queued";
}

const STATUS_LABEL: Record<RouteState, string> = {
  queued: "queued",
  running: "running",
  approval: "approve",
  done: "complete",
  returned: "returned",
};

function StatusIcon({ state }: { state: RouteState }) {
  if (state === "done") return <Check className="h-4 w-4 text-fg-muted" strokeWidth={2.5} aria-hidden />;
  if (state === "running") return <LoaderCircle className="h-4 w-4 text-accent motion-safe:animate-spin" aria-hidden />;
  if (state === "approval") return <Pause className="h-4 w-4 text-warn" fill="currentColor" aria-hidden />;
  if (state === "returned") return <RotateCcw className="h-4 w-4 text-loop" aria-hidden />;
  return <Clock3 className="h-4 w-4 text-fg-faint" aria-hidden />;
}

export function HowRunRoute() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useMotionPreference();
  const visibleStep = prefersReducedMotion ? STEPS.length - 1 : activeStep;
  const step = STEPS[visibleStep];
  const complete = step.mode === "complete";
  const approval = step.mode === "approval";
  const looping = step.mode === "loop";
  const pass = visibleStep >= 6 ? 2 : 1;

  useEffect(() => {
    if (isPaused || prefersReducedMotion || complete) return;
    const delay = approval || looping ? 1800 : 1150;
    const timer = window.setTimeout(() => {
      setActiveStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeStep, approval, complete, isPaused, looping, prefersReducedMotion]);

  return (
    <div className="cf-frame mx-auto w-full max-w-[600px] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_20px_50px_-30px_rgba(22,24,28,0.18)]">
      <div className="relative border-b border-border bg-surface px-4 py-3.5 text-fg sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", complete ? "bg-ok" : approval ? "bg-warn" : looping ? "bg-loop" : "bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]")} aria-hidden />
            <span className="truncate text-[11px] font-[650] text-fg sm:text-[12px]">Example build pipeline</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-[11px] font-[650] sm:text-[11px]", complete ? "text-ok" : approval ? "text-warn" : looping ? "text-loop" : "text-fg-faint")}>{complete ? "Example complete" : approval ? "Approval needed" : looping ? "Repair loop" : prefersReducedMotion ? "Complete" : isPaused ? "Paused" : "Replaying"}</span>
            {!prefersReducedMotion && (
              <button
                type="button"
                onClick={() => {
                  if (complete) {
                    setActiveStep(0);
                    setIsPaused(false);
                  } else setIsPaused((current) => !current);
                }}
                className="grid h-11 w-11 place-items-center rounded-full border border-rule text-fg-muted transition-colors hover:border-accent hover:bg-accent-soft"
                aria-label={complete ? "Replay example pipeline" : isPaused ? "Resume example pipeline" : "Pause example pipeline"}
              >
                {complete ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : isPaused ? <Play className="h-3 w-3" fill="currentColor" aria-hidden /> : <Pause className="h-3 w-3" fill="currentColor" aria-hidden />}
              </button>
            )}
          </div>
        </div>
        <span className="absolute inset-x-0 bottom-0 h-px bg-rule" aria-hidden>
          <span className={cn("block h-full motion-safe:transition-[width,background-color] motion-safe:duration-500", approval ? "bg-warn" : looping ? "bg-loop" : complete ? "bg-ok" : "bg-accent")} style={{ width: `${((visibleStep + 1) / STEPS.length) * 100}%` }} />
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-bg px-4 py-3 sm:px-5">
        <span className="text-[12px] font-[600] text-fg-muted">Five agents + a sandbox</span>
        <div className="flex items-center gap-2">
          {[0, 1].map((index) => (
            <span key={index} className={cn("inline-flex h-5 items-center gap-1.5 rounded-full border px-2 font-sans text-[11px] font-[700] tracking-[0.01em]", step.approvals > index ? "border-border bg-surface text-fg-muted" : approval && step.approvals === index ? "border-warn-bd bg-warn-soft text-warn" : "border-border bg-surface text-fg-faint")}>
              {step.approvals > index ? <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> : <Pause className="h-2.5 w-2.5" fill="currentColor" aria-hidden />}
              {index === 0 ? "Requirements" : "Design"}
            </span>
          ))}
        </div>
      </div>

      <p className="px-4 pt-3 text-[11px] text-fg-muted sm:px-5">Library demo · Illustrative replay</p>
      <ol className="relative px-4 before:absolute before:bottom-7 before:left-[31px] before:top-7 before:w-px before:bg-rule sm:px-5 sm:before:left-[35px]">

        {AGENTS.map((agent, index) => {
          const state = stateForAgent(index, visibleStep);
          return (
            <li key={agent.name} className={cn("relative flex min-h-[58px] items-center gap-3 border-b border-rule py-2.5 motion-safe:transition-colors motion-safe:duration-500 last:border-b-0 sm:gap-4", state === "running" && "bg-accent-soft/40", state === "queued" && "opacity-70")}>
              <span className={cn("relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-lg border font-sans text-[11px] font-[700] motion-safe:transition-colors motion-safe:duration-300", state === "done" && "border-border bg-surface text-fg-muted", state === "running" && "border-accent-bd bg-accent-soft text-accent", state === "approval" && "border-warn-bd bg-warn-soft text-warn", state === "returned" && "border-loop-bd bg-loop-soft text-loop", state === "queued" && "border-border bg-surface text-fg-faint")}>{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display text-[12px] font-[650] text-fg sm:text-[13px]">{agent.name}</p>
                  {agent.name === "Coder" && pass === 2 && <span className="rounded-full bg-loop-soft px-1.5 py-0.5 font-sans text-[11px] font-[700] text-loop">pass 2</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-fg-faint sm:text-[11px]">{state === "done" ? agent.output : agent.job}</p>
              </div>
              <div className={cn("flex shrink-0 items-center gap-2 font-sans text-[11px] font-[700] tracking-[0.01em]", state === "done" && "text-fg-muted", state === "running" && "text-accent", state === "approval" && "text-warn", state === "returned" && "text-loop", state === "queued" && "text-fg-faint")}>
                <span className="hidden sm:inline">{STATUS_LABEL[state]}</span>
                <StatusIcon state={state} />
              </div>
              {state === "running" && <span className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-accent-bd" aria-hidden><span className="block h-full w-1/3 bg-accent motion-safe:animate-[cfBar_1.2s_ease-in-out_infinite]" /></span>}
            </li>
          );
        })}
      </ol>

      <p className={cn("mx-4 flex items-center gap-2 border-t border-rule pt-3 text-[12px] sm:mx-5", looping ? "text-loop" : "text-fg-muted")}><RotateCcw size={15} className="shrink-0" aria-hidden />Findings or failed tests → Coder</p>
      <div key={step.id} className={cn("m-4 flex min-h-[48px] items-center justify-between gap-3 rounded-lg border px-3.5 py-3 motion-safe:animate-[cfFade_.28s_ease-out] sm:m-5 sm:px-4", approval ? "border-warn-bd bg-warn-soft text-warn" : looping ? "border-loop-bd bg-loop-soft text-loop" : complete ? "border-border bg-surface text-fg-muted" : "border-accent-bd bg-accent-soft text-accent")} aria-live="polite">
        <div className="flex min-w-0 items-center gap-2.5">
          {approval ? <Pause className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden /> : looping ? <GitBranch className="h-3.5 w-3.5 shrink-0" aria-hidden /> : complete ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden /> : <LoaderCircle className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" aria-hidden />}
          <p className="font-sans text-[11px] font-[700] leading-[1.45] tracking-[0.01em] sm:text-[11px]">{step.event}</p>
        </div>
        {looping && <span className="hidden shrink-0 font-sans text-[11px] font-[700] tracking-[0.01em] sm:inline">back to coder</span>}
      </div>
    </div>
  );
}

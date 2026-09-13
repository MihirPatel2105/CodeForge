"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

type AgentState = "queued" | "working" | "done" | "returned";

const AGENTS = [
  { name: "PM", output: "scope mapped" },
  { name: "Architect", output: "5 endpoints" },
  { name: "Coder", output: "4 files" },
  { name: "Reviewer", output: "checklist passed" },
  { name: "Tester", output: "8 tests" },
  { name: "Sandbox", output: "8 passed" },
] as const;

const STEPS = [
  { id: "pm", activeAgent: 0, message: "PM is structuring the request", approvals: "00", repairs: "00", tests: "00/08" },
  { id: "architect", activeAgent: 1, message: "Requirements approved · Architect is designing endpoints", approvals: "01", repairs: "00", tests: "00/08" },
  { id: "coder", activeAgent: 2, message: "Architecture approved · Coder is writing four files", approvals: "02", repairs: "00", tests: "00/08" },
  { id: "reviewer", activeAgent: 3, message: "Reviewer is checking the generated tree", approvals: "02", repairs: "00", tests: "00/08" },
  { id: "loop", activeAgent: 2, message: "2 blocking findings returned to Coder · pass 2", approvals: "02", repairs: "01", tests: "00/08" },
  { id: "review-again", activeAgent: 3, message: "Coder repaired main.py · Reviewer is checking pass 2", approvals: "02", repairs: "01", tests: "00/08" },
  { id: "tester", activeAgent: 4, message: "Review passed · Tester is writing endpoint tests", approvals: "02", repairs: "01", tests: "00/08" },
  { id: "sandbox", activeAgent: 5, message: "Sandbox is running the API and test suite", approvals: "02", repairs: "01", tests: "06/08" },
  { id: "complete", activeAgent: null, message: "Run succeeded · source, tests and runtime output kept", approvals: "02", repairs: "01", tests: "08/08" },
] as const;

function subscribeToReducedMotion(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getAgentState(agentIndex: number, stepIndex: number): AgentState {
  const step = STEPS[stepIndex];

  if (step.id === "complete") return "done";
  if (step.id === "loop") {
    if (agentIndex < 2) return "done";
    if (agentIndex === 2) return "working";
    if (agentIndex === 3) return "returned";
    return "queued";
  }

  if (step.activeAgent === null) return "done";
  if (agentIndex < step.activeAgent) return "done";
  if (agentIndex === step.activeAgent) return "working";
  return "queued";
}

const STATE_LABEL: Record<AgentState, string> = {
  queued: "queued",
  working: "running",
  done: "done",
  returned: "returned",
};

function AgentCard({
  agent,
  index,
  state,
  pass,
}: {
  agent: (typeof AGENTS)[number];
  index: number;
  state: AgentState;
  pass: number;
}) {
  return (
    <li
      className={cn(
        "relative min-h-[104px] overflow-hidden rounded-[4px] border px-3 py-3.5 transition-[border-color,background-color,opacity,transform] duration-500",
        state === "working" && "border-accent-bd bg-accent-soft/60 shadow-[0_10px_24px_rgba(67,56,202,0.07)]",
        state === "done" && "border-ok-bd bg-surface",
        state === "returned" && "border-loop-bd bg-loop-soft/60",
        state === "queued" && "border-border bg-surface opacity-45",
      )}
    >
      {state === "working" && (
        <span className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-accent-bd" aria-hidden>
          <span className="block h-full w-1/3 bg-accent motion-safe:animate-[cfBar_1.2s_ease-in-out_infinite]" />
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-[3px] font-mono text-[8px] font-[700]",
            state === "working" && "bg-accent-soft text-accent",
            state === "done" && "bg-ok-soft text-ok",
            state === "returned" && "bg-loop-soft text-loop",
            state === "queued" && "bg-surface-2 text-fg-faint",
          )}
        >
          {index + 1}
        </span>
        {state === "done" ? (
          <Check className="h-3.5 w-3.5 text-ok" strokeWidth={2.5} aria-hidden />
        ) : state === "working" ? (
          <LoaderCircle className="h-3.5 w-3.5 text-accent motion-safe:animate-spin" aria-hidden />
        ) : state === "returned" ? (
          <RotateCcw className="h-3.5 w-3.5 text-loop" aria-hidden />
        ) : (
          <Clock3 className="h-3.5 w-3.5 text-fg-faint" aria-hidden />
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[11px] font-[650] tracking-[-0.02em] text-fg sm:text-[12px]">{agent.name}</p>
          <p className={cn("mt-1 truncate font-mono text-[7px] font-[700] uppercase tracking-[0.09em]", state === "working" ? "text-accent" : state === "done" ? "text-ok" : state === "returned" ? "text-loop" : "text-fg-faint")}>{state === "done" ? agent.output : STATE_LABEL[state]}</p>
        </div>
        {agent.name === "Coder" && pass === 2 && (
          <span className="shrink-0 rounded-full bg-loop-soft px-1.5 py-0.5 font-mono text-[7px] font-[700] uppercase text-loop">pass 2</span>
        )}
      </div>
    </li>
  );
}

export function AboutProcessProof() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const visibleStep = prefersReducedMotion ? STEPS.length - 1 : activeStep;
  const step = STEPS[visibleStep];
  const complete = step.id === "complete";
  const looping = step.id === "loop";
  const pass = visibleStep >= 4 ? 2 : 1;

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const delay = activeStep === STEPS.length - 1 ? 2600 : activeStep === 4 ? 1900 : 1350;
    const timer = window.setTimeout(() => {
      setActiveStep((current) => (current + 1) % STEPS.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeStep, isPaused, prefersReducedMotion]);

  return (
    <div className="cf-about-proof relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[8px] border border-border bg-surface shadow-[0_30px_90px_rgba(22,24,28,0.12)]">
      <div className="relative border-b border-border bg-fg text-surface">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", complete ? "bg-ok" : "bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]")} aria-hidden />
            <span className="truncate font-mono text-[8px] font-[700] uppercase tracking-[0.14em] sm:text-[9px]">recorded activity</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("font-mono text-[8px] font-[700] uppercase tracking-[0.11em]", complete ? "text-ok" : looping ? "text-loop" : "text-fg-faint")}>{complete ? "succeeded" : looping ? "repair loop" : prefersReducedMotion ? "complete" : isPaused ? "paused" : "replaying"}</span>
            {!prefersReducedMotion && (
              <button
                type="button"
                onClick={() => setIsPaused((current) => !current)}
                className="grid h-7 w-7 place-items-center rounded-[3px] border border-white/15 text-surface transition-colors hover:border-white/35 hover:bg-white/10"
                aria-label={isPaused ? "Resume recorded run" : "Pause recorded run"}
              >
                {isPaused ? <Play className="h-3 w-3" fill="currentColor" aria-hidden /> : <Pause className="h-3 w-3" fill="currentColor" aria-hidden />}
              </button>
            )}
          </div>
        </div>
        <span className="absolute inset-x-0 bottom-0 h-px bg-white/10" aria-hidden>
          <span className="block h-full bg-accent transition-[width] duration-500" style={{ width: `${((visibleStep + 1) / STEPS.length) * 100}%` }} />
        </span>
      </div>

      <div className="grid md:grid-cols-[1fr_7.5rem]">
        <div className="p-4 sm:p-6">
          <div className="rounded-[4px] border border-border bg-bg px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[8px] font-[700] uppercase tracking-[0.13em] text-fg-faint">your request</span>
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-fg-faint">run / 014</span>
            </div>
            <p className="mt-2 font-display text-[13px] font-[600] leading-[1.5] tracking-[-0.02em] text-fg sm:text-[14px]">Build an API for a library with books, authors and ratings.</p>
          </div>

          <ol className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {AGENTS.map((agent, index) => (
              <AgentCard key={agent.name} agent={agent} index={index} state={getAgentState(index, visibleStep)} pass={pass} />
            ))}
          </ol>

          <div
            key={step.id}
            className={cn(
              "mt-3 flex min-h-[48px] items-center gap-3 rounded-[4px] border px-3.5 py-3 motion-safe:animate-[cfFade_.28s_ease-out] sm:px-4",
              looping ? "border-loop-bd bg-loop-soft text-loop" : complete ? "border-ok-bd bg-ok-soft text-ok" : "border-accent-bd bg-accent-soft text-accent",
            )}
            aria-live="polite"
          >
            {looping ? <GitBranch className="h-4 w-4 shrink-0" aria-hidden /> : complete ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden /> : <LoaderCircle className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden />}
            <p className="font-mono text-[7.5px] font-[700] uppercase leading-[1.45] tracking-[0.09em] sm:text-[8.5px]">{step.message}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-border bg-bg md:grid-cols-1 md:border-l md:border-t-0">
          {[
            [step.approvals, "approvals"],
            [step.repairs, "repairs"],
            [step.tests, "tests"],
          ].map(([value, label]) => (
            <div key={label} className="flex min-h-[72px] flex-col justify-center border-r border-border px-3 py-4 text-center last:border-r-0 md:border-b md:border-r-0 md:last:border-b-0">
              <span className={cn("font-display text-[14px] font-[650] tracking-[-0.03em] transition-colors duration-300", label === "tests" && complete ? "text-ok" : "text-fg")}>{value}</span>
              <span className="mt-1 font-mono text-[7px] font-[700] uppercase tracking-[0.11em] text-fg-faint">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3.5 sm:px-5 sm:py-4">
        <span className="font-mono text-[8px] font-[700] uppercase tracking-[0.13em] text-fg-faint">outcome</span>
        <span className={cn("inline-flex items-center gap-2 text-right font-mono text-[8px] font-[700] uppercase tracking-[0.1em] sm:text-[9px]", complete ? "text-ok" : looping ? "text-loop" : "text-accent")}>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", complete ? "bg-ok" : looping ? "bg-loop" : "bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]")} aria-hidden />
          {complete ? "tested API kept" : looping ? "repair in progress" : "agents working"}
        </span>
      </div>
    </div>
  );
}

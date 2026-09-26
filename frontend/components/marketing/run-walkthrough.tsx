"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Line = { text: string; kind?: "plain" | "blocking" | "pass" | "meta" };

type Step = {
  id: string;
  stage: number;
  eyebrow: string;
  title: string;
  body: string;
  lines: Line[];
  loop?: boolean;
  iteration?: number;
};

type AgentState = "queued" | "working" | "done" | "returned";

const AGENTS = [
  { name: "PM", role: "Structures the request", output: "1 entity · 4 operations", position: "sm:col-start-1 sm:row-start-1" },
  { name: "Architect", role: "Designs endpoints and models", output: "5 endpoints designed", position: "sm:col-start-2 sm:row-start-1" },
  { name: "Coder", role: "Writes the application", output: "4 files written", position: "sm:col-start-3 sm:row-start-1" },
  { name: "Reviewer", role: "Checks a fixed checklist", output: "1 finding · 0 blocking", position: "sm:col-start-3 sm:row-start-2" },
  { name: "Tester", role: "Writes the test suite", output: "8 tests collected", position: "sm:col-start-2 sm:row-start-2" },
  { name: "Sandbox", role: "Runs code in isolation", output: "8 of 8 tests passed", position: "sm:col-start-1 sm:row-start-2" },
] as const;

const STEPS: Step[] = [
  {
    id: "pm",
    stage: 0,
    eyebrow: "01 · PM agent",
    title: "The request becomes a buildable specification.",
    body: "The PM reads the prompt, finds the product scope, and turns plain English into validated entities, fields, operations, and user stories.",
    lines: [
      { text: "Identified entity: Book (title, author, year, genres)" },
      { text: "Completed — 1 entity, 4 operations", kind: "meta" },
    ],
  },
  {
    id: "architect",
    stage: 1,
    eyebrow: "02 · Architect agent",
    title: "The specification becomes an API design.",
    body: "The Architect maps the approved requirements into endpoints, collections, response models, and a file plan before any code is written.",
    lines: [
      { text: "5 endpoints designed with explicit response models" },
      { text: "Requirements approved — design accepted", kind: "meta" },
    ],
  },
  {
    id: "coder",
    stage: 2,
    eyebrow: "03 · Coder agent",
    title: "The design becomes a complete file tree.",
    body: "The Coder generates each file separately, preserving enough context to keep imports, models, routes, and database setup consistent.",
    lines: [
      { text: "Wrote database.py (289 bytes)" },
      { text: "Wrote models.py (542 bytes)" },
      { text: "Wrote main.py (2,318 bytes)", kind: "meta" },
    ],
  },
  {
    id: "reviewer",
    stage: 3,
    eyebrow: "04 · Reviewer agent",
    title: "A fixed checklist catches a real defect.",
    body: "The Reviewer checks the generated tree against the design and runtime rules. It finds that a database ObjectId would escape into the API response.",
    lines: [
      { text: "DELETE /books/{id} returns a Document with a non-serialisable ObjectId", kind: "blocking" },
      { text: "3 findings — 2 blocking", kind: "meta" },
    ],
  },
  {
    id: "loop",
    stage: 2,
    eyebrow: "⟳ · Feedback loop",
    title: "The finding travels back to the Coder.",
    body: "CodeForge sends the exact blocking findings and affected files back for another pass. The rest of the working tree stays untouched.",
    lines: [{ text: "Iteration 1 — returning 2 blocking findings", kind: "blocking" }],
    loop: true,
    iteration: 2,
  },
  {
    id: "fix",
    stage: 2,
    eyebrow: "05 · Coder, pass 2",
    title: "The Coder repairs only what failed review.",
    body: "The second pass rewrites main.py with an explicit response model, then hands the focused change back for review.",
    lines: [
      { text: "Rewrote main.py — added BookResponse to DELETE" },
      { text: "Second review — 0 blocking findings", kind: "pass" },
    ],
    iteration: 2,
  },
  {
    id: "tester",
    stage: 4,
    eyebrow: "06 · Tester agent",
    title: "The behaviour becomes an executable test suite.",
    body: "The Tester writes one test for every endpoint plus the important failure paths, using the generated application exactly as a client would.",
    lines: [
      { text: "Created test_main.py" },
      { text: "Collected 8 endpoint and 404-path tests", kind: "meta" },
    ],
    iteration: 2,
  },
  {
    id: "sandbox",
    stage: 5,
    eyebrow: "07 · Sandbox",
    title: "The generated API runs for real.",
    body: "A locked-down container starts the application and executes pytest with networking disabled. The result comes from the runtime, not an AI prediction.",
    lines: [
      { text: "test_main.py ........ [100%]" },
      { text: "8 passed in 1.42s", kind: "pass" },
    ],
    iteration: 2,
  },
  {
    id: "complete",
    stage: 6,
    eyebrow: "08 · Run complete",
    title: "A tested API is ready to inspect and download.",
    body: "Every agent leaves behind structured output, generated files, review findings, and real test evidence, so the final result stays understandable.",
    lines: [
      { text: "Run succeeded after 2 passes" },
      { text: "5 agents complete · 8 of 8 tests passed", kind: "pass" },
    ],
    iteration: 2,
  },
];

function stateForAgent(agent: number, activeStep: number): AgentState {
  const step = STEPS[activeStep];

  if (step.id === "loop") {
    if (agent < 2) return "done";
    if (agent === 2) return "working";
    if (agent === 3) return "returned";
    return "queued";
  }

  if (step.id === "fix") {
    if (agent < 2) return "done";
    if (agent === 2) return "working";
    return "queued";
  }

  if (step.stage === 6) return "done";
  if (agent < step.stage) return "done";
  if (agent === step.stage) return "working";
  return "queued";
}

const STATE_LABEL: Record<AgentState, string> = {
  queued: "queued",
  working: "running",
  done: "done",
  returned: "2 blocking",
};

function AgentCard({ agent, index, state, iteration }: { agent: (typeof AGENTS)[number]; index: number; state: AgentState; iteration: number }) {
  return (
    <li
      className={cn(
        "relative min-h-[150px] overflow-hidden rounded-[18px] border bg-surface p-4 shadow-[0_2px_9px_rgba(35,50,81,0.035)] transition-[border-color,background-color,box-shadow] duration-300",
        agent.position,
        state === "working" && "border-accent-bd bg-accent-soft/65 shadow-[0_10px_28px_rgba(63,71,201,0.1)]",
        state === "done" && "border-ok-bd bg-white",
        state === "returned" && "border-danger-bd bg-danger-soft/65",
        state === "queued" && "border-border bg-white/80",
      )}
    >
      {state === "working" && (
        <span className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-accent-bd" aria-hidden>
          <span className="block h-full w-1/3 bg-accent motion-safe:animate-[cfBar_1.35s_ease-in-out_infinite]" />
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-[700]",
            state === "working" && "bg-accent-soft text-accent",
            state === "done" && "bg-ok-soft text-ok",
            state === "returned" && "bg-danger-soft text-danger",
            state === "queued" && "bg-surface-2 text-fg-faint",
          )}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-display text-[14px] font-[700] tracking-[-0.025em] text-fg">{agent.name}</span>
        </div>

        <span className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-2 px-2 py-1 text-[10px] font-[650]",
          state === "working" && "text-accent",
          state === "done" && "text-ok",
          state === "returned" && "text-danger",
          state === "queued" && "text-fg-faint",
        )}>
          <span className={cn(
            "h-1.5 w-1.5 rounded-full",
            state === "working" && "bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]",
            state === "done" && "bg-ok",
            state === "returned" && "bg-danger",
            state === "queued" && "bg-border-strong",
          )} aria-hidden />
          {STATE_LABEL[state]}
        </span>
      </div>

      <p className="mt-4 text-[12px] leading-[1.5] text-fg-muted">{agent.role}</p>

      <div className="absolute inset-x-4 bottom-3.5 flex items-center justify-between gap-3 border-t border-rule pt-2.5">
        <span className="truncate text-[11px] text-fg-muted">
          {state === "done" ? agent.output : state === "working" ? "processing…" : "waiting"}
        </span>
        {agent.name === "Coder" && iteration > 1 && (
          <span className="shrink-0 rounded-full bg-loop-soft px-2 py-0.5 font-mono text-[9px] font-[700] text-loop">pass {iteration}</span>
        )}
      </div>
    </li>
  );
}

function AgentWorkspace({ activeStep }: { activeStep: number }) {
  const step = STEPS[activeStep];
  const iteration = step.iteration ?? 1;
  const loopFiring = step.id === "loop";
  const complete = step.id === "complete";

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-border bg-[#f7f9fd] p-4 shadow-[0_28px_70px_rgba(34,48,78,0.11),0_3px_12px_rgba(34,48,78,0.04)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-1 pb-4">
        <div>
          <span className="text-[12px] font-[650] text-fg-muted">Live agent run</span>
          <p className="mt-1 font-mono text-[12px] font-[600] text-fg">library-api <span className="text-fg-faint">/ run_01</span></p>
        </div>
        <div className="flex items-center gap-2">
          {iteration > 1 && (
            <span className="rounded-full border border-loop-bd bg-loop-soft px-2.5 py-1 text-[11px] font-[650] text-loop">Loop {iteration - 1}</span>
          )}
          <span className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-[650]",
            complete ? "border-ok-bd bg-ok-soft text-ok" : "border-accent-bd bg-accent-soft text-accent",
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              complete ? "bg-ok" : "bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]",
            )} aria-hidden />
            {complete ? "Succeeded" : loopFiring ? "Returning" : "Running"}
          </span>
        </div>
      </div>

      <div className="relative mt-5">
        <ol className="relative z-10 grid gap-3 sm:grid-cols-3 sm:grid-rows-2">
          {AGENTS.map((agent, index) => (
            <AgentCard key={agent.name} agent={agent} index={index} state={stateForAgent(index, activeStep)} iteration={iteration} />
          ))}
        </ol>

        <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block" aria-hidden>
          <span className="absolute left-1/3 top-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">→</span>
          <span className="absolute left-2/3 top-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">→</span>
          <span className="absolute left-[83.33%] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">↓</span>
          <span className="absolute left-2/3 top-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">←</span>
          <span className="absolute left-1/3 top-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">←</span>
        </div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible sm:block" aria-hidden>
          <defs>
            <marker id="loop-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <path
            d="M 95 76 C 104 76, 104 24, 95 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.42"
            strokeDasharray="1.8 1.8"
            vectorEffect="non-scaling-stroke"
            markerEnd="url(#loop-arrow)"
            className={cn("text-border-strong transition-colors duration-300", loopFiring && "text-loop motion-safe:animate-[cfDash_.9s_linear_infinite]")}
          />
        </svg>

        <span className={cn(
          "absolute -right-2 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border px-2.5 py-1 text-[10px] font-[650] sm:block",
          loopFiring ? "border-loop-bd bg-loop-soft text-loop motion-safe:animate-[cfPop_.34s_ease-out]" : "border-border bg-white text-fg-muted",
        )}>
          Back to Coder
        </span>
      </div>

      <div key={step.id} className={cn(
        "mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 motion-safe:animate-[cfFade_.28s_ease-out]",
        loopFiring ? "border-loop-bd bg-loop-soft" : complete ? "border-ok-bd bg-ok-soft" : "border-border bg-surface",
      )}>
        <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", loopFiring ? "bg-loop" : complete ? "bg-ok" : "bg-accent")} aria-hidden />
        <div>
          <span className={cn(
            "text-[11px] font-[700]",
            loopFiring ? "text-loop" : complete ? "text-ok" : "text-fg-faint",
          )}>
            {loopFiring ? "feedback loop" : complete ? "run result" : `${AGENTS[Math.min(step.stage, 5)].name} activity`}
          </span>
          <p className="mt-1 text-[12px] leading-[1.5] text-fg-muted">{step.lines[0].text}</p>
        </div>
      </div>
    </div>
  );
}

export function RunWalkthrough() {
  const [activeStep, setActiveStep] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    let animationFrame = 0;

    const updateActiveStep = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const anchor = window.innerHeight * 0.46;
        let closest = 0;
        let distance = Number.POSITIVE_INFINITY;

        refs.current.forEach((element, index) => {
          if (!element) return;
          const rect = element.getBoundingClientRect();
          const point = Math.min(Math.max(anchor, rect.top), rect.bottom);
          const nextDistance = Math.abs(point - anchor);
          if (nextDistance < distance) {
            distance = nextDistance;
            closest = index;
          }
        });

        setActiveStep(closest);
      });
    };

    updateActiveStep();
    window.addEventListener("scroll", updateActiveStep, { passive: true });
    window.addEventListener("resize", updateActiveStep);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateActiveStep);
      window.removeEventListener("resize", updateActiveStep);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1536px] px-6 md:px-10 lg:px-14">
      <div className="mb-12 grid gap-x-14 gap-y-4 border-b border-rule pb-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(34rem,1.22fr)]">
        <div>
          <span className="font-mono text-[11px] font-[600] uppercase tracking-[0.16em] text-fg-faint">[ how a run moves ]</span>
          <h2 className="font-display mt-5 max-w-[22ch] text-[26px] font-[600] leading-[1.24] tracking-[-0.04em] text-fg md:text-[32px]">Scroll through one complete agent run.</h2>
        </div>
        <p className="max-w-[58ch] self-end text-[15px] leading-[1.65] text-fg-muted lg:justify-self-end">
          Each scroll step advances the active agent. Watch the right side closely when the Reviewer sends a blocking finding back to the Coder.
        </p>
      </div>

      <div className="grid gap-x-12 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(42rem,1.22fr)]">
        <div>
          {STEPS.map((step, index) => (
            <section
              key={step.id}
              ref={(element) => { refs.current[index] = element; }}
              className={cn(
                "relative flex min-h-[68svh] scroll-mt-32 flex-col justify-center border-t border-rule py-16 transition-opacity duration-500 first:border-t-0 first:pt-4",
                step.loop && "border-loop-bd",
                activeStep === index ? "opacity-100" : "xl:opacity-45",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 hidden h-16 w-[2px] -translate-y-1/2 transition-[background-color,transform,opacity] duration-500 xl:block",
                  activeStep === index
                    ? step.loop
                      ? "bg-loop opacity-100"
                      : "bg-accent opacity-100"
                    : "bg-border opacity-0",
                )}
              />
              <div className="xl:pl-6">
              <span className={cn(
                "font-mono text-[10px] font-[700] uppercase tracking-[0.16em] transition-colors",
                step.loop ? "text-loop" : activeStep === index ? "text-accent" : "text-fg-faint",
              )}>
                {step.eyebrow}
              </span>
              <h3 className={cn(
                "font-display mt-5 max-w-[23ch] text-[24px] font-[600] leading-[1.28] tracking-[-0.04em] md:text-[29px]",
                step.loop ? "text-loop" : "text-fg",
              )}>
                {step.title}
              </h3>
              <p className="mt-5 max-w-[49ch] text-[15px] leading-[1.68] text-fg-muted">{step.body}</p>
              <ul className="mt-7 space-y-3 border-l border-border pl-4">
                {step.lines.map((line) => (
                  <li key={line.text} className={cn(
                    "font-mono text-[11.5px] leading-[1.55]",
                    line.kind === "blocking" ? "text-danger" : line.kind === "pass" ? "font-[700] text-ok" : line.kind === "meta" ? "font-[600] text-fg" : "text-fg-muted",
                  )}>
                    {line.text}
                  </li>
                ))}
              </ul>
              <span className="mt-9 font-mono text-[9px] font-[600] uppercase tracking-[0.12em] text-fg-faint">
                {String(index + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
              </span>
              </div>
            </section>
          ))}
        </div>

        <aside className="order-first mb-10 xl:order-none xl:mb-0" aria-label="Animated agent pipeline">
          <div className="xl:sticky xl:top-[92px] xl:flex xl:min-h-[calc(100svh-116px)] xl:items-center">
            <div className="w-full">
              <AgentWorkspace activeStep={activeStep} />
              <p className="mt-3 hidden text-right font-mono text-[9px] font-[600] uppercase tracking-[0.12em] text-fg-faint xl:block">scroll to advance ↓</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

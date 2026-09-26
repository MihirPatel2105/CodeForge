"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pause, Play, RotateCcw, ShieldCheck, SkipForward } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { CodePanel, type CodeVersion } from "@/components/dashboard/code-panel";
import { PipelineStrip } from "@/components/dashboard/pipeline-strip";
import { RunStory } from "@/components/dashboard/run-story";
import { EvidenceTabs, type EvidenceView } from "@/components/dashboard/evidence-tabs";
import { ResultSummary } from "@/components/dashboard/result-summary";
import { TerminalPanel } from "@/components/dashboard/terminal-panel";
import { TestsPanel } from "@/components/dashboard/tests-panel";
import { TimelinePanel } from "@/components/dashboard/timeline-panel";
import type { DemoRun } from "@/lib/demo-runs";
import { preferredScrollBehavior } from "@/lib/motion";
import { reduceRun } from "@/lib/run-reducer";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const EVENT_INTERVAL_MS = 980;

export function DemoRunPage({ demo }: { demo: DemoRun }) {
  const user = useCurrentUser();
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [mobileEvidence, setMobileEvidence] = useState<EvidenceView>("timeline");
  const pipelineViewport = useRef<HTMLDivElement>(null);
  const lastEventIndex = demo.events.length - 1;
  const isComplete = eventIndex >= lastEventIndex;

  const snapshot = useMemo(
    () => reduceRun(demo.events.slice(0, eventIndex + 1)),
    [demo.events, eventIndex],
  );

  useEffect(() => {
    if (!playing || isComplete) return;
    const timer = window.setTimeout(() => setEventIndex((current) => current + 1), EVENT_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [eventIndex, isComplete, playing]);

  useEffect(() => {
    if (!isComplete) return;
    setPlaying(false);
  }, [isComplete]);

  useEffect(() => {
    const viewport = pipelineViewport.current;
    if (!viewport || !snapshot.currentAgent || window.innerWidth >= 640) return;
    const card = viewport.querySelector<HTMLElement>(`[data-stage="${snapshot.currentAgent}"]`);
    if (!card) return;
    viewport.scrollTo({
      left: Math.max(0, card.offsetLeft - 20),
      behavior: preferredScrollBehavior(),
    });
  }, [snapshot.currentAgent]);

  const finalFiles = useMemo(
    () => ({ ...demo.finalFiles, [demo.testFile.path]: demo.testFile.content }),
    [demo.finalFiles, demo.testFile],
  );

  const getVersion = useCallback(
    (path: string): CodeVersion | null => {
      const content = finalFiles[path];
      return content == null ? null : { content };
    },
    [finalFiles],
  );

  const getPreviousVersion = useCallback(
    (path: string, iteration: number): CodeVersion | null => {
      if (iteration === 0) return null;
      const content = demo.initialFiles[path];
      return content == null ? null : { content };
    },
    [demo.initialFiles],
  );

  function replay() {
    setEventIndex(0);
    setPlaying(true);
    setMobileEvidence("timeline");
  }

  function skipToResult() {
    setEventIndex(lastEventIndex);
    setPlaying(false);
  }

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-5 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-[650] uppercase tracking-[0.13em] text-fg-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Home
        </Link>

        <header className="cf-run-hero mt-3 overflow-hidden rounded-[6px] border border-border bg-surface">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="relative px-5 py-4 sm:px-7 sm:py-5 lg:px-7">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 font-mono text-[10px] font-[750] uppercase tracking-[0.1em] text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                  public demo replay
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-fg-faint">
                  no model calls · no login required
                </span>
              </div>
              <p className="mt-3 font-mono text-[11px] font-[650] uppercase tracking-[0.14em] text-accent">
                {demo.label} API workflow
              </p>
              <h1 className="font-display mt-2 max-w-[60ch] text-[22px] font-[650] leading-[1.25] tracking-[-0.04em] text-fg sm:text-[27px]">
                {demo.title}
              </h1>
              <p className="mt-2 max-w-[78ch] text-[15px] leading-[1.5] text-fg-muted">{demo.prompt}</p>
            </div>

            <div className="flex flex-col justify-between border-t border-rule bg-surface-2/45 px-5 py-4 sm:px-7 lg:border-t-0 lg:border-l lg:px-6">
              <div>
                <span className="font-mono text-[9.5px] font-[650] uppercase tracking-[0.14em] text-fg-faint">
                  replay controls
                </span>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPlaying((current) => !current)}
                    disabled={isComplete}
                    className="inline-flex items-center gap-2 rounded-[3px] bg-fg px-3 py-2 font-mono text-[10px] font-[700] uppercase tracking-[0.08em] text-surface disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                    {playing ? "Pause" : "Continue"}
                  </button>
                  <button
                    type="button"
                    onClick={replay}
                    className="inline-flex items-center gap-2 rounded-[3px] border border-border-strong bg-surface px-3 py-2 font-mono text-[10px] font-[700] uppercase tracking-[0.08em] text-fg hover:border-accent-bd hover:text-accent"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Replay
                  </button>
                  <button
                    type="button"
                    onClick={skipToResult}
                    disabled={isComplete}
                    className="inline-flex items-center gap-2 rounded-[3px] border border-border bg-surface px-3 py-2 font-mono text-[10px] font-[700] uppercase tracking-[0.08em] text-fg-muted hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <SkipForward className="h-3.5 w-3.5" aria-hidden />
                    Skip
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between font-mono text-[9px] font-[650] uppercase tracking-[0.1em] text-fg-faint">
                  <span>{isComplete ? "replay complete" : "agents are working"}</span>
                  <span>{Math.round(((eventIndex + 1) / demo.events.length) * 100)}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-accent transition-[width] duration-300"
                    style={{ width: `${((eventIndex + 1) / demo.events.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {snapshot.approval && (
          <div className="mt-5 flex items-start gap-3 rounded-[6px] border-2 border-warn bg-warn-soft px-4 py-3 text-warn" role="status">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-mono text-[11px] font-[750] uppercase tracking-[0.1em]">Human checkpoint</p>
              <p className="mt-1 text-[13.5px] leading-5 text-fg-muted">
                This recorded run pauses for approval before continuing. The replay resumes automatically.
              </p>
            </div>
          </div>
        )}

        <section className="cf-run-pipeline mt-5 overflow-hidden rounded-[6px] border border-border bg-surface" aria-labelledby="demo-pipeline-heading">
          <div className="flex items-end justify-between gap-5 border-b border-rule bg-surface-2/55 px-5 py-3 sm:px-6">
            <div>
              <span className="font-mono text-[9.5px] font-[650] uppercase tracking-[0.14em] text-fg-faint">recorded orchestration</span>
              <h2 id="demo-pipeline-heading" className="font-display mt-1 text-[22px] font-[650] tracking-[-0.04em] text-fg">Agent pipeline</h2>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-fg-faint">
              <span className="sm:hidden">swipe to inspect →</span>
              <span className="hidden sm:inline">6 stages · feedback enabled</span>
            </span>
          </div>
          <RunStory snapshot={snapshot} />
          <div ref={pipelineViewport} className="cf-run-scroll snap-x snap-proximity overflow-x-auto px-5 pb-1 pt-5 sm:px-6">
            <div className="min-w-[1180px]">
              <PipelineStrip agents={snapshot.agents} lastLoop={snapshot.lastLoop} />
            </div>
          </div>
        </section>

        {snapshot.endedAt && (
          <section className="mt-5" aria-label="Demo run result">
            <ResultSummary snapshot={snapshot} />
          </section>
        )}

        <section className="mt-8" aria-labelledby="demo-workbench-heading">
          <div className="mb-4 flex items-end justify-between border-b border-rule pb-4">
            <div>
              <span className="font-mono text-[9.5px] font-[650] uppercase tracking-[0.14em] text-fg-faint">execution evidence</span>
              <h2 id="demo-workbench-heading" className="font-display mt-1.5 text-[20px] font-[650] tracking-[-0.04em] text-fg">Inspect the run</h2>
            </div>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-fg-faint sm:block">events · code · sandbox · tests</span>
          </div>

          <EvidenceTabs value={mobileEvidence} onValueChange={setMobileEvidence} idPrefix="demo-evidence" label="Demo evidence" />

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(380px,0.82fr)_minmax(0,1.45fr)]">
            <div id="demo-evidence-panel-timeline" role="tabpanel" aria-labelledby="demo-evidence-tab-timeline" className={cn("h-[520px] xl:block xl:h-[648px]", mobileEvidence !== "timeline" && "hidden")}>
              <TimelinePanel entries={snapshot.timeline} />
            </div>

            <div className={cn("min-w-0 flex-col gap-3 xl:flex", mobileEvidence === "timeline" ? "hidden" : "flex")}>
              <div id="demo-evidence-panel-code" role="tabpanel" aria-labelledby="demo-evidence-tab-code" className={cn("h-[560px] sm:h-[440px] xl:block", mobileEvidence !== "code" && "hidden")}>
                <CodePanel files={snapshot.files} getVersion={getVersion} getPreviousVersion={getPreviousVersion} />
              </div>

              <div className={cn("flex-col gap-3 md:flex-row xl:flex", mobileEvidence === "terminal" || mobileEvidence === "tests" ? "flex" : "hidden")}>
                <div id="demo-evidence-panel-terminal" role="tabpanel" aria-labelledby="demo-evidence-tab-terminal" className={cn("min-w-0 flex-1 xl:block", mobileEvidence !== "terminal" && "hidden")}>
                  <TerminalPanel lines={snapshot.terminalLines} image={snapshot.agents.sandbox.model} running={snapshot.agents.sandbox.state === "working"} />
                </div>
                <div id="demo-evidence-panel-tests" role="tabpanel" aria-labelledby="demo-evidence-tab-tests" className={cn("xl:block", mobileEvidence !== "tests" && "hidden")}>
                  <TestsPanel tests={snapshot.tests} terminalLines={snapshot.terminalLines} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <p className="max-w-[58ch] text-[13.5px] leading-[1.55] text-fg-muted">
            This is a deterministic replay of the CodeForge interface. The real product uses the same workflow with live models and a locked-down sandbox.
          </p>
          <Link href={user ? "/projects" : "/signup"} className="inline-flex items-center gap-2 rounded-[3px] bg-fg px-5 py-3 font-mono text-[10.5px] font-[700] uppercase tracking-[0.1em] text-surface transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90">
            Build your own API
          </Link>
        </div>
      </main>
    </div>
  );
}

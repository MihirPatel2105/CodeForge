"use client";

import { DashboardThemeToggle } from "@/components/dashboard/dashboard-theme-toggle";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowLeft, Pause, Play, RotateCcw, ShieldCheck, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import { AppHeader } from "@/components/dashboard/app-header";
import { ApprovalPresence } from "@/components/dashboard/approval-presence";
import { CodePanel, type CodeVersion } from "@/components/dashboard/code-panel";
import { PipelineStrip } from "@/components/dashboard/pipeline-strip";
import { RunOverview } from "@/components/dashboard/run-overview";
import { EvidenceWorkbench } from "@/components/dashboard/evidence-workbench";
import { ResultSummary } from "@/components/dashboard/result-summary";
import { TerminalPanel } from "@/components/dashboard/terminal-panel";
import { TestsPanel } from "@/components/dashboard/tests-panel";
import { TimelinePanel } from "@/components/dashboard/timeline-panel";
import type { CodeForgeEvent } from "@/lib/types";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { useDemoPlayback } from "@/lib/use-demo-playback";
import { useCurrentUser } from "@/lib/use-current-user";
import "@/components/dashboard/run-editorial.css";

const EVENT_INTERVAL_MS = 980;

/** The words that differ between a scripted sample and a recorded real run. */
export interface ReplayCopy {
  back: { href: string; label: string };
  /** The overview's eyebrow, e.g. "Sample replay" or "Recorded run". */
  kindLabel: string;
  /** Progress text while playing and once finished. */
  playingLabel: string;
  finishedLabel: string;
  approvalNote: string;
  pipelineEyebrow: string;
  resultLabel: string;
  footer: string;
}

type Props = {
  replayKey: string;
  title: string;
  events: CodeForgeEvent[];
  getVersion: (path: string, iteration: number) => CodeVersion | null;
  getPreviousVersion: (path: string, iteration: number) => CodeVersion | null;
  copy: ReplayCopy;
  /** Shown under the overview, e.g. where a recording came from. */
  provenance?: ReactNode;
};

/** Plays a stored event list through the live dashboard's own reducer and panels. */
export function ReplayRunView({ replayKey, title, events, getVersion, getPreviousVersion, copy, provenance }: Props) {
  const user = useCurrentUser();
  const reducedMotion = useMotionPreference();
  const [controlsReady, setControlsReady] = useState(false);
  useEffect(() => { setControlsReady(true); }, []);
  const {
    eventIndex,
    snapshot,
    playing,
    isComplete,
    setPlaying,
    replay,
    skipToEnd: skipToResult,
  } = useDemoPlayback(events, { intervalMs: EVENT_INTERVAL_MS });
  const playbackTime = Date.parse(events[eventIndex].at);
  const progress = ((eventIndex + 1) / events.length) * 100;

  return (
    <div className="cf-run-page cf-run-refined min-h-screen bg-bg" data-run-look="editorial">
      <AppHeader />
      <main className="cf-page pb-20 pt-7">
        <div className="cf-run-navigation">
          <Link
            href={copy.back.href}
            className="inline-flex items-center gap-2 text-[13px] font-[600] text-fg-muted transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {copy.back.label}
          </Link>

          <DashboardThemeToggle />
        </div>

        <RunOverview snapshot={snapshot} title={title} playbackTime={playbackTime} replayLabel={copy.kindLabel} actions={
          <div className="cf-demo-controls">
            <div>
              <span className="text-[12px] font-[650] text-fg-muted">
                replay controls
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying((current) => !current)}
                  disabled={!controlsReady || isComplete}
                  aria-label={playing ? "Pause" : "Continue"}
                  className="cf-demo-button cf-demo-button--primary inline-flex min-h-9 items-center rounded-full bg-accent px-3 py-2 text-[12px] font-[650] text-surface disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="inline-grid items-center" aria-hidden="true">
                    <motion.span
                      initial={false}
                      animate={{ opacity: playing ? 1 : 0, y: reducedMotion ? 0 : playing ? 0 : -4 }}
                      transition={{ duration: reducedMotion ? 0 : 0.18 }}
                      className="col-start-1 row-start-1 inline-flex items-center gap-2"
                    ><Pause className="h-3.5 w-3.5" />Pause</motion.span>
                    <motion.span
                      initial={false}
                      animate={{ opacity: playing ? 0 : 1, y: reducedMotion ? 0 : playing ? 4 : 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.18 }}
                      className="col-start-1 row-start-1 inline-flex items-center gap-2"
                    ><Play className="h-3.5 w-3.5" />Continue</motion.span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={replay}
                  disabled={!controlsReady}
                  className="cf-demo-button inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-[12px] font-[650] text-fg hover:border-accent-bd hover:text-accent"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Replay
                </button>
                <button
                  type="button"
                  onClick={skipToResult}
                  disabled={!controlsReady || isComplete}
                  className="cf-demo-button inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-[650] text-fg-muted hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden />
                  Skip
                </button>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-[600] text-fg-muted">
                <span>{isComplete ? copy.finishedLabel : copy.playingLabel}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-border">
                <div
                  className="relative h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-300"
                  style={{ width: `${progress}%` }}
                >
                  {snapshot.currentAgent && !reducedMotion && (
                    <span className="absolute -right-1 top-1/2 -translate-y-1/2" aria-hidden>
                      <motion.span
                        key={snapshot.currentAgent}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: [0, 0.7, 0], scale: [0.7, 1.5, 1.8] }}
                        transition={{ duration: 0.55 }}
                        className="block h-2 w-2 rounded-full bg-accent"
                      />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        } />

        {provenance}

        <ApprovalPresence show={snapshot.approval != null}>
          {snapshot.approval && (
            <div className="mt-5 flex items-start gap-3 rounded-3xl border border-warn-bd bg-warn-soft px-5 py-4 " role="status">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-warn-bd bg-surface text-warn">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[13px] font-[700] text-warn">Human checkpoint</p>
                <p className="mt-1 text-[13.5px] leading-5 text-fg-muted">{copy.approvalNote}</p>
              </div>
            </div>
          )}
        </ApprovalPresence>

        <section className="cf-run-pipeline mt-5 overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="demo-pipeline-heading">
          <div className="flex items-end justify-between gap-5 border-b border-rule bg-surface-2/55 px-5 py-3 sm:px-6">
            <div>
              <span className="text-[12px] font-[650] text-accent">{copy.pipelineEyebrow}</span>
              <h2 id="demo-pipeline-heading" className="font-display mt-1 text-[24px] font-[700] tracking-[-0.04em] text-fg">Agent pipeline</h2>
            </div>
            <span className="text-[11px] text-fg-muted">
              <span className="sm:hidden">Tap a stage to inspect</span>
              <span className="hidden sm:inline">6 stages · feedback enabled</span>
            </span>
          </div>
          <div className="cf-pipeline-viewport">
            <div className="min-w-0">
              <PipelineStrip key={replayKey} agents={snapshot.agents} lastLoop={snapshot.lastLoop} activity={snapshot.timeline} playbackTime={playbackTime} />
            </div>
          </div>
        </section>

        <section className="cf-run-workbench-section" aria-labelledby="demo-workbench-heading">
          <div className="cf-run-workbench-title">
            <div>
              <h2 id="demo-workbench-heading" className="font-display mt-1.5 text-[20px] font-[650] tracking-[-0.04em] text-fg">Run workspace</h2>
            </div>
            <span className="hidden text-[12px] text-fg-muted sm:block">Events · code · sandbox · tests</span>
          </div>

          <EvidenceWorkbench
            result={snapshot.tests}
            code={<CodePanel files={snapshot.files} getVersion={getVersion} getPreviousVersion={getPreviousVersion} />}
            timeline={<TimelinePanel entries={snapshot.timeline} />}
            terminal={<TerminalPanel lines={snapshot.terminalLines} image={snapshot.agents.sandbox.model} running={snapshot.agents.sandbox.state === "working"} />}
            tests={<TestsPanel tests={snapshot.tests} terminalLines={snapshot.terminalLines} />}
          />
        </section>

        {snapshot.endedAt && (
          <section className="cf-run-result-section" aria-label={copy.resultLabel}>
            <ResultSummary snapshot={snapshot} />
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <p className="max-w-[58ch] text-[13.5px] leading-[1.55] text-fg-muted">{copy.footer}</p>
          <ButtonLink href={user ? "/projects" : "/signup"}>
            Build your own API
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}

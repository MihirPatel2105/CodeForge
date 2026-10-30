"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { ArrowDown, Check, Circle, Pause, Play, RotateCcw } from "lucide-react";
import { getDemoRun } from "@/lib/demo-runs";
import { PIPELINE_STAGES, stageName, type PipelineStageId } from "@/lib/pipeline";
import type { AgentSnapshot, RunSnapshot } from "@/lib/run-reducer";
import { useDemoPlayback } from "@/lib/use-demo-playback";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { HeroCodeViewer, type HeroFileVersion } from "./hero-code-viewer";
import { HeroStageTrack } from "./hero-stage-track";
import { followLandingSection } from "./landing-navigation";
import "./hero-workspace.css";

const DEMO = getDemoRun("library");
const EVENT_INTERVAL_MS = 700;
const FILES = ["models.py", "schemas.py", "database.py", "main.py", DEMO.testFile.path] as const;
const NO_CHANGES: ReadonlySet<number> = new Set();
const START_MS = Date.parse(DEMO.events[0].at);
const TOTAL_MS = Date.parse(DEMO.events[DEMO.events.length - 1].at) - START_MS;

/** Whether the element is meaningfully on screen in a visible tab. */
function useOnScreen(target: RefObject<HTMLElement | null>): boolean {
  const [intersecting, setIntersecting] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setIntersecting(entry.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return intersecting && pageVisible;
}

/** The file as the Coder last wrote it, with the lines its repair pass rewrote. */
function versionOf(path: string, iteration: number): HeroFileVersion {
  if (path === DEMO.testFile.path) return { content: DEMO.testFile.content, changed: NO_CHANGES };
  const initial = DEMO.initialFiles[path] ?? "";
  if (iteration === 0) return { content: initial, changed: NO_CHANGES };
  const final = DEMO.finalFiles[path] ?? "";
  const before = new Set(initial.split("\n"));
  const changed = new Set(
    final.split("\n").flatMap((line, index) => (line.trim() && !before.has(line) ? [index] : [])),
  );
  return { content: final, changed };
}

/** What the selected stage is doing, or what it produced and how long it took. */
function stageDetail(agent: AgentSnapshot, job: string): string {
  const pass = agent.iteration > 0 ? ` · pass ${agent.iteration + 1}` : "";
  if (agent.state === "idle") return `${job}.`;
  if (agent.state === "working") return `${job}…${pass}`;
  const duration = agent.durationMs != null ? ` · ${(agent.durationMs / 1000).toFixed(1)}s` : "";
  return `${agent.summary ?? job}${pass}${duration}`;
}

function formatClock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Tone = "idle" | "working" | "approval" | "loop" | "passed";

/** One line per milestone, so the live region announces progress without chatter. */
function runStatus(snapshot: RunSnapshot): { text: string; tone: Tone } {
  if (snapshot.tests) {
    const { passed, total } = snapshot.tests;
    return { text: `${passed} of ${total} tests passed in the sandbox`, tone: "passed" };
  }
  if (snapshot.approval) {
    const subject = snapshot.approval.phase === "pm" ? "the requirements" : "the design";
    return { text: `Waiting for your approval of ${subject}`, tone: "approval" };
  }
  const loop = snapshot.lastLoop;
  if (loop && snapshot.currentAgent === "coder") {
    return { text: `Reviewer found ${loop.blockingFindings} blocking issue, sent back to the Coder`, tone: "loop" };
  }
  if (snapshot.currentAgent) return { text: `${stageName(snapshot.currentAgent)} is working`, tone: "working" };
  return { text: "Your brief is ready", tone: "idle" };
}

export function HeroWorkspace() {
  const root = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  const onScreen = useOnScreen(root);
  const { eventIndex, snapshot, playing, isComplete, setPlaying, replay, skipToEnd } = useDemoPlayback(
    DEMO.events,
    { intervalMs: EVENT_INTERVAL_MS, held: !onScreen },
  );
  const [selected, setSelected] = useState<PipelineStageId | null>(null);
  const [file, setFile] = useState<string>("models.py");

  // Reduced motion shows the finished run; Replay still lets a visitor watch it on request.
  useEffect(() => {
    if (reduced) skipToEnd();
  }, [reduced, skipToEnd]);

  const restart = useCallback(() => {
    setSelected(null);
    replay();
  }, [replay]);

  const shown: PipelineStageId = selected ?? snapshot.currentAgent ?? (isComplete ? "sandbox" : "pm");
  const shownAgent = snapshot.agents[shown];
  const shownMeta = PIPELINE_STAGES.find((stage) => stage.id === shown)!;
  const written = new Map(snapshot.files.map((entry) => [entry.path, entry]));
  const approved = new Set(snapshot.approvedPhases);
  const status = runStatus(snapshot);
  const elapsed = Date.parse(DEMO.events[eventIndex].at) - START_MS;

  return (
    <section ref={root} className="ol-product-workspace" aria-label="CodeForge sample replay" data-on-screen={onScreen}>
      <div className="ol-product-brief">
        <span className="ol-mini-label">Your brief</span>
        <h2>A little library.{" "}<br />A real API.</h2>
        <p>“{DEMO.prompt}”</p>
        <div className="ol-brief-checks">
          {(["pm", "architect"] as const).map((phase) => (
            <span key={phase} data-approved={approved.has(phase)}>
              {approved.has(phase) ? <Check size={15} aria-hidden /> : <Circle size={12} aria-hidden />}
              {phase === "pm" ? "Requirements" : "Architecture"} {approved.has(phase) ? "approved" : "awaiting approval"}
            </span>
          ))}
        </div>
        <Link href="#build-story" onClick={(event) => followLandingSection(event, reduced)} aria-label="Follow the Library build">
          Follow this build<ArrowDown size={16} aria-hidden />
        </Link>
      </div>

      <div className="ol-product-code">
        <HeroStageTrack agents={snapshot.agents} shown={shown} loop={snapshot.lastLoop} onSelect={setSelected} />
        <p className="ol-hero-stage-detail" data-state={shownAgent.state}>
          <strong>{shownMeta.name}</strong>
          <span>{stageDetail(shownAgent, shownMeta.job)}</span>
        </p>

        <HeroCodeViewer files={FILES} file={file} onFileChange={setFile} written={written} versionOf={versionOf} />

        <div className="ol-product-outcome" data-tone={status.tone}>
          <span className="ol-hero-status">
            <span className="ol-hero-status-dot" aria-hidden />
            <span role="status" aria-live="polite">{status.text}</span>
          </span>
          <span className="ol-hero-controls">
            <span className="ol-hero-clock" aria-hidden>{formatClock(elapsed)} / {formatClock(TOTAL_MS)}</span>
            <button
              type="button"
              onClick={() => setPlaying((current) => !current)}
              disabled={isComplete}
              aria-label={playing ? "Pause replay" : "Play replay"}
            >
              {playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
            </button>
            <button type="button" onClick={restart} aria-label="Replay from start">
              <RotateCcw size={13} aria-hidden />Replay
            </button>
          </span>
          <span className="ol-hero-progress" aria-hidden>
            <span style={{ transform: `scaleX(${TOTAL_MS ? elapsed / TOTAL_MS : 0})` }} />
          </span>
        </div>
      </div>
    </section>
  );
}

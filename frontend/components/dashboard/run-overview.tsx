"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { flushSync } from "react-dom";
import { RunDisclosure } from "./run-disclosure";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { ChevronDown, Clock3 } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/pipeline";
import { formatElapsed, parseApiTime } from "@/lib/format";
import { displayStatus, tone } from "@/lib/tone";
import type { RunSnapshot } from "@/lib/run-reducer";
import "./run-workspace.css";

/** Matches --ui-duration-panel and --ui-ease, so the title moves like the other run panels. */
const TITLE_MOTION = { duration: 280, easing: "cubic-bezier(.16, 1, .3, 1)" } as const;

export function RunOverview({ snapshot, title, playbackTime, actions, replayLabel = "Sample replay" }: {
  snapshot: RunSnapshot;
  title?: string;
  playbackTime?: number;
  actions?: ReactNode;
  /** What a replay says it is: a scripted sample, or a recorded real run. */
  replayLabel?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [titleTruncated, setTitleTruncated] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const clampedHeight = useRef(0);
  const titleMotion = useRef<Animation | null>(null);
  const reducedMotion = useMotionPreference();
  const requestId = useId();
  useEffect(() => {
    if (playbackTime != null || snapshot.endedAt || !snapshot.startedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [playbackTime, snapshot.endedAt, snapshot.startedAt]);

  const heading = title ?? snapshot.prompt ?? "Preparing the agent workflow…";
  // On a real run the title is the request itself, so "show more" expands the title in place rather
  // than repeating the request underneath. A replay titles itself separately and keeps the panel.
  const titleIsRequest = title == null && Boolean(snapshot.prompt);
  useEffect(() => {
    const element = titleRef.current;
    // Measured only while clamped: once expanded, the title no longer overflows by definition.
    if (!element || !titleIsRequest || requestOpen) return;
    const measure = () => setTitleTruncated(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [titleIsRequest, requestOpen, heading]);
  const showRequestToggle = Boolean(snapshot.prompt) && (!titleIsRequest || titleTruncated || requestOpen);
  const toggleLabel = titleIsRequest ? (requestOpen ? "Show less" : "Show full request") : "View request";

  /**
   * Opening lifts the clamp, then grows the title from its two-line height to its full height.
   * Closing shrinks it back first and only restores the clamp (and its "…") once it has landed,
   * so the text never jumps. A replay's separate request panel animates itself.
   */
  function toggleRequest() {
    const element = titleRef.current;
    titleMotion.current?.cancel();
    if (!element || !titleIsRequest || reducedMotion) { setRequestOpen(open => !open); return; }
    const frames = (from: number, to: number) => [
      { height: `${from}px`, overflow: "hidden" },
      { height: `${to}px`, overflow: "hidden" },
    ];
    if (!requestOpen) {
      const from = element.getBoundingClientRect().height;
      clampedHeight.current = from;
      flushSync(() => setRequestOpen(true));
      titleMotion.current = element.animate(frames(from, element.getBoundingClientRect().height), TITLE_MOTION);
      return;
    }
    const animation = element.animate(frames(element.getBoundingClientRect().height, clampedHeight.current), { ...TITLE_MOTION, fill: "forwards" });
    titleMotion.current = animation;
    animation.onfinish = () => {
      flushSync(() => setRequestOpen(false));
      animation.cancel();
    };
  }

  const status = displayStatus(snapshot.status, snapshot.tests?.ok ?? null);
  const active = PIPELINE_STAGES.find(stage => snapshot.agents[stage.id].state === "working");
  const completed = Object.values(snapshot.agents).filter(agent => agent.state === "done").length;
  const started = snapshot.startedAt ? parseApiTime(snapshot.startedAt).getTime() : null;
  const stopped = snapshot.endedAt ? parseApiTime(snapshot.endedAt).getTime() : playbackTime ?? now;
  const elapsed = started != null && stopped != null && Number.isFinite(started) && Number.isFinite(stopped)
    ? formatElapsed(stopped - started) : "—";
  const replay = playbackTime != null;

  return (
    <header className="cf-run-overview" aria-label="Run overview">
      <div className="cf-overview-heading">
        <div className="cf-overview-title">
          <div className="cf-overview-eyebrow">
            <span>{replay ? replayLabel : "API build"}</span>
            {snapshot.runId && !replay && <span>run {snapshot.runId.slice(0, 8)}</span>}
            {replay && <span>Replay · no model calls</span>}
          </div>
          <h1 ref={titleRef} id={titleIsRequest ? requestId : undefined} className="cf-run-request" data-expanded={titleIsRequest && requestOpen ? "" : undefined}>{heading}</h1>
          <div className="cf-overview-state">
            <span role="status" className={`cf-overview-status ${tone[status.tone].soft}`}>
              <span aria-hidden="true" />{status.label}
            </span>
            {active && !snapshot.approval && !snapshot.endedAt && <span>{active.name} is working</span>}
            <span className="cf-overview-elapsed"><Clock3 size={13} aria-hidden="true" /><span className="sr-only">Elapsed time </span><span aria-label="Run elapsed time">{elapsed}</span></span>
          </div>
        </div>
        {actions && <div className="cf-overview-actions">{actions}</div>}
      </div>
      <div className="cf-overview-footer">
        <dl className="cf-overview-facts">
          <div><dt>Stages</dt><dd>{completed}/6</dd></div>
          <div><dt>Files</dt><dd>{snapshot.files.length}</dd></div>
          <div><dt>Tests</dt><dd>{snapshot.tests ? `${snapshot.tests.passed}/${snapshot.tests.total}` : "Pending"}</dd></div>
          {snapshot.iterations > 0 && <div className="cf-overview-loops"><dt>Repair loops</dt><dd>{snapshot.iterations}</dd></div>}
        </dl>
        {showRequestToggle && <Button variant="ghost" size="sm" className="cf-request-toggle" aria-expanded={requestOpen} aria-controls={requestId} onClick={toggleRequest}>
          {toggleLabel} <ChevronDown size={13} aria-hidden="true" />
        </Button>}
      </div>
      {snapshot.prompt && !titleIsRequest && <RunDisclosure open={requestOpen}>
        <section id={requestId} className="cf-run-request-details" aria-label="Full request"><p>{snapshot.prompt}</p></section>
      </RunDisclosure>}
    </header>
  );
}

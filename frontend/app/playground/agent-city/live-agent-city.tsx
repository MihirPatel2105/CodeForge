"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, Box, Braces, Check, ChevronRight, Circle, Clock3, Code2, Crosshair, FileCode2, FileText, FlaskConical, Focus, GitBranch, Layers3, Maximize2, Moon, Pause, Play, Radio, RotateCcw, ShieldCheck, Square, Sun, TriangleAlert, WifiOff, X, ZoomIn, ZoomOut } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { DashboardThemeToggle } from "@/components/dashboard/dashboard-theme-toggle";
import { Button } from "@/components/ui/button";
import { getDemoRun } from "@/lib/demo-runs";
import { isPipelineStage, stageName, type PipelineStageId } from "@/lib/pipeline";
import type { AgentCardState, CodeForgeEvent } from "@/lib/types";
import type { RunSnapshot } from "@/lib/run-reducer";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { CITY_STAGES, cityEventStage, cityEventText, cityStageFiles, cityStatusLabel, reduceCityEvents } from "./live-city-model";
import { useCityRun } from "./use-city-run";
import type { createLiveCity, LiveCityWorldState } from "./live-city-world";

const stageIcons = { pm: FileText, architect: Layers3, coder: Code2, reviewer: ShieldCheck, tester: FlaskConical, sandbox: Box };
const stageStates: Record<AgentCardState, string> = { idle: "Waiting", working: "Working", done: "Complete", failed: "Needs attention", stopped: "Stopped" };

function StateIcon({ state }: { state: AgentCardState }) {
  const Icon = state === "done" ? Check : state === "working" ? AudioLines : state === "failed" ? TriangleAlert : state === "stopped" ? Square : Circle;
  return <Icon size={13} aria-hidden />;
}

function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function eventTime(event?: CodeForgeEvent) {
  if (!event || !Number.isFinite(Date.parse(event.at))) return "—";
  return new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function humanize(text: string) {
  return text.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

function StructuredOutput({ value }: { value: unknown }) {
  if (value == null) return null;
  if (typeof value !== "object") return <p className="lc-output-text">{String(value)}</p>;
  if (Array.isArray(value)) return <div className="lc-output-list">{value.map((item, index) => <div key={index}><StructuredOutput value={item} /></div>)}</div>;
  return <dl className="lc-output-fields">{Object.entries(value).filter(([, item]) => item != null).map(([key, item]) => <div key={key}><dt>{humanize(key)}</dt><dd>{typeof item === "object" ? <pre>{JSON.stringify(item, null, 2)}</pre> : String(item)}</dd></div>)}</dl>;
}

function recordedOutput(stage: PipelineStageId, events: CodeForgeEvent[]) {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.event === "approval.required" && event.phase === stage) return event.payload;
    if (event.event === "agent.completed" && event.agent === stage) return event.output_summary;
    if (event.event === "agent.started" && event.agent === stage) return null;
  }
  return null;
}

function selectedFor(snapshot: RunSnapshot): PipelineStageId {
  if (snapshot.approval && isPipelineStage(snapshot.approval.phase)) return snapshot.approval.phase;
  const working = CITY_STAGES.find(stage => snapshot.agents[stage.id].state === "working");
  if (working) return working.id;
  if (snapshot.currentAgent) return snapshot.currentAgent;
  return [...CITY_STAGES].reverse().find(stage => snapshot.agents[stage.id].state !== "idle")?.id ?? "pm";
}

function CityScene({ snapshot, selected, reducedMotion, paused, night, follow, onSelect }: LiveCityWorldState & { onSelect: (id: PipelineStageId) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<ReturnType<typeof createLiveCity> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const current = useRef({ snapshot, selected, reducedMotion, paused, night, follow });
  const select = useRef(onSelect);

  useEffect(() => {
    current.current = { snapshot, selected, reducedMotion, paused, night, follow };
    select.current = onSelect;
    world.current?.update(current.current);
  }, [snapshot, selected, reducedMotion, paused, night, follow, onSelect]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let canvas: HTMLCanvasElement | null = null;
    function fallback() { if (!disposed) { setStatus("fallback"); world.current?.dispose(); world.current = null; } }
    void import("./live-city-world").then(({ createLiveCity }) => {
      if (disposed) return;
      try {
        world.current = createLiveCity(element!, current.current, id => select.current(id));
        canvas = element!.querySelector("canvas");
        canvas?.addEventListener("webglcontextlost", fallback);
        setStatus("ready");
      } catch { fallback(); }
    }).catch(fallback);
    return () => { disposed = true; canvas?.removeEventListener("webglcontextlost", fallback); world.current?.dispose(); world.current = null; };
  }, []);

  return <>
    <div ref={host} className="lc-world" data-status={status} aria-hidden="true" />
    {status === "loading" && <div className="lc-scene-loading" role="status"><div className="lc-loading-blocks"><i /><i /><i /></div><strong>Opening the city</strong><span>Getting the studios ready.</span></div>}
    {status === "fallback" && <div className="lc-flat-city"><span className="lc-flat-caption">City overview · 2D view</span><div className="lc-flat-grid">{CITY_STAGES.map(stage => {
      const Icon = stageIcons[stage.id];
      return <button key={stage.id} style={{ "--stage-color": stage.color } as CSSProperties} onClick={() => onSelect(stage.id)} aria-label={`Open ${stage.name} building`} data-state={snapshot.agents[stage.id].state} data-selected={selected === stage.id}><Icon size={27} /><strong>{stage.name}</strong><span>{stage.place}</span><small><StateIcon state={snapshot.agents[stage.id].state} />{stageStates[snapshot.agents[stage.id].state]}</small></button>;
    })}</div><p>3D is unavailable here. Every agent and its evidence is available below.</p></div>}
    <div className="lc-camera-tools" aria-label="City camera controls">
      <Button variant="ghost" size="icon" aria-label="Zoom in" disabled={status !== "ready"} onClick={() => world.current?.zoom(0.12)}><ZoomIn /></Button>
      <Button variant="ghost" size="icon" aria-label="Zoom out" disabled={status !== "ready"} onClick={() => world.current?.zoom(-0.12)}><ZoomOut /></Button>
      <span />
      <Button variant="ghost" size="icon" aria-label="Reset city camera" disabled={status !== "ready"} onClick={() => world.current?.resetView()}><Maximize2 /></Button>
      <Button variant="ghost" size="icon" aria-label={`Focus on ${stageName(selected)}`} disabled={status !== "ready"} onClick={() => world.current?.focus(selected)}><Focus /></Button>
    </div>
  </>;
}

export function LiveAgentCity({ runId, demoSlug, invalidRun = false }: { runId: string | null; demoSlug?: string; invalidRun?: boolean }) {
  const live = useCityRun(runId);
  const demo = useMemo(() => demoSlug ? getDemoRun(demoSlug) : null, [demoSlug]);
  const events = demo?.events ?? live.events;
  const [replaying, setReplaying] = useState(Boolean(demoSlug));
  const [cursor, setCursor] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [follow, setFollow] = useState(true);
  const [inspected, setInspected] = useState<PipelineStageId>("pm");
  const [tab, setTab] = useState<"output" | "activity">("output");
  const [file, setFile] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const [nightOverride, setNightOverride] = useState<boolean | null>(null);
  const night = nightOverride ?? resolvedTheme === "dark";
  const [paused, setPaused] = useState(false);
  const reducedMotion = useMotionPreference();
  const count = replaying ? Math.min(cursor, events.length) : events.length;
  const visibleEvents = useMemo(() => events.slice(0, count), [events, count]);
  const replaySnapshot = useMemo(() => replaying ? reduceCityEvents(visibleEvents) : null, [replaying, visibleEvents]);
  const snapshot = replaySnapshot ?? live.snapshot;
  const selected = follow ? selectedFor(snapshot) : inspected;
  const stage = CITY_STAGES.find(item => item.id === selected)!;
  const agent = snapshot.agents[selected];
  const Icon = stageIcons[selected];
  const complete = Boolean(live.snapshot.endedAt);
  const sceneSnapshot = snapshot;
  const error = invalidRun ? "This run link is invalid. Open Agent City from a run in your workspace." : live.error;

  useEffect(() => {
    if (!replaying || !playing || count >= events.length) return;
    const currentTime = Date.parse(events[Math.max(0, count - 1)]?.at ?? "");
    const nextTime = Date.parse(events[count]?.at ?? "");
    const delay = Number.isFinite(nextTime - currentTime) ? Math.max(40, (nextTime - currentTime) / speed) : 250;
    const timer = window.setTimeout(() => setCursor(value => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [replaying, playing, count, events, speed]);

  const inspect = useCallback((id: PipelineStageId) => { setInspected(id); setFollow(false); setFile(null); }, []);
  const replayFinished = replaying && count >= events.length;
  const hasHistory = events.length > 1;
  const atLatest = count === events.length;
  const latestEvent = visibleEvents.at(-1);
  const elapsed = visibleEvents.length > 0 ? Date.parse(latestEvent!.at) - Date.parse(events[0].at) : 0;
  const doneCount = CITY_STAGES.filter(item => snapshot.agents[item.id].state === "done").length;
  const stageEvents = useMemo(() => {
    let previous: PipelineStageId | null = null;
    return visibleEvents.flatMap((event, index) => {
      const owner = cityEventStage(event, previous);
      if (event.event === "agent.started" && isPipelineStage(event.agent)) previous = event.agent;
      if (event.event === "sandbox.started") previous = "sandbox";
      return owner === selected ? [{ event, index }] : [];
    });
  }, [visibleEvents, selected]);
  const output = useMemo(() => {
    if (snapshot.approval?.phase === selected) return snapshot.approval.payload;
    // Persisted evidence is the latest version, so historical playback uses only its own events.
    if (!replaying && agent.state === "done") {
      const key = selected === "pm" ? "requirements" : selected === "architect" ? "design" : selected === "reviewer" ? "review" : null;
      if (key && live.state[key]) return live.state[key];
    }
    return recordedOutput(selected, visibleEvents);
  }, [selected, snapshot.approval, replaying, agent.state, live.state, visibleEvents]);

  const files = useMemo(() => {
    if (!demo) return live.files;
    const recorded: Record<string, string> = {};
    for (const written of snapshot.files) {
      if (written.path === demo.testFile.path) recorded[written.path] = demo.testFile.content;
      else recorded[written.path] = (written.iteration > 0 ? demo.finalFiles : demo.initialFiles)[written.path] ?? "";
    }
    return recorded;
  }, [demo, live.files, snapshot.files]);
  const stageFiles = cityStageFiles(selected, snapshot.files.map(item => item.path));
  const codeAvailable = Boolean(demo) || !replaying || atLatest;
  const showingFile = file && stageFiles.includes(file) ? file : null;
  const loop = snapshot.lastLoop;
  const waitingForStream = live.loading || (!demo && events.length === 0 && !error);
  const connection = demo ? "Sample replay" : replaying ? "Recorded playback" : error ? "Unavailable" : live.connectionLost ? "Reconnecting" : waitingForStream ? "Connecting" : complete ? "Recorded run" : "Live connection";
  const headline = snapshot.approval ? "Your approval is the next step." : snapshot.endedAt ? snapshot.status === "succeeded" ? "An idea became a working API." : "Every step tells the story." : agent.state === "working" ? `${stageName(selectedFor(snapshot))} is moving the build forward.` : "An idea. A team. A working API.";

  function startReplay() { setReplaying(true); setCursor(1); setPlaying(true); setFollow(true); setFile(null); }
  function togglePlayback() {
    if (replayFinished) setCursor(1);
    setPlaying(value => replayFinished || !value);
  }

  return <main className="live-agent-city" data-night={night} data-reduced-motion={reducedMotion}>
    <header className="lc-header">
      <Link href={runId ? `/runs/${runId}` : "/projects"} className="lc-back" aria-label={runId ? "Back to run" : "Back to projects"}><ArrowLeft size={16} /><LogoLockup className="lc-brand" /></Link>
      <div className="lc-header-center"><span className="lc-breadcrumb">Workspace</span><ChevronRight size={12} /><span>Agent City</span></div>
      <div className="lc-header-actions"><DashboardThemeToggle /><Link href={runId ? `/runs/${runId}` : "/projects"} className="lc-header-link">{runId ? "Run workspace" : "Build your own"}<ArrowUpRight size={15} /></Link></div>
    </header>

    <div className="lc-title-row"><div><div className="lc-title-line"><h1>Agent City</h1><span className="lc-edition">Your build, in motion.</span></div><p>{headline}</p></div><div className="lc-session"><span className="lc-connection" data-state={error ? "error" : live.connectionLost ? "reconnecting" : demo || replaying || complete ? "recorded" : waitingForStream ? "connecting" : "live"}>{live.connectionLost && !replaying ? <WifiOff size={13} /> : <Radio size={13} />}{connection}</span><span className="lc-session-id">{demo ? `${demo.label} API · sample` : runId ? `Run ${runId.slice(-8)}` : "No run selected"}</span></div></div>

    {demo && <div className="lc-demo-notice"><Play size={13} /><span>This is a sample recording. Open Agent City from one of your runs to watch your actual agents.</span><Link href="/projects">Open workspace<ArrowRight size={13} /></Link></div>}
    {(error || (!demo && live.connectionLost && !replaying)) && <div className="lc-connection-notice" role="alert"><WifiOff size={17} /><div><strong>{error ? "The run couldn’t be opened" : "Reconnecting to your run"}</strong><p>{error ?? `The last received state is shown. Retrying in ${live.connectionLost?.retryInSeconds ?? 1}s.`}</p></div>{!invalidRun && <Button variant="outline" onClick={live.retry}>Retry connection<RotateCcw size={13} /></Button>}{invalidRun && <Link href="/projects">Open workspace<ArrowUpRight size={14} /></Link>}</div>}

    <div className="lc-workspace">
      <section className="lc-stage" aria-label="Live agent city" data-animation-paused={paused || (replaying && (!playing || replayFinished))}>
        <CityScene snapshot={sceneSnapshot} selected={selected} reducedMotion={reducedMotion} paused={paused || (replaying && (!playing || replayFinished))} night={night} follow={follow} onSelect={inspect} />
        <div className="lc-scene-top"><div className="lc-scene-label"><span className="lc-scene-symbol"><GitBranch size={17} /></span><div><strong>{replaying ? "The recorded journey" : "The build district"}</strong><span>{doneCount} of 6 stages complete</span></div></div><div className="lc-scene-actions"><Button variant="ghost" size="icon" aria-label={night ? "Switch city to day" : "Switch city to night"} onClick={() => setNightOverride(!night)}>{night ? <Sun /> : <Moon />}</Button><Button variant="ghost" size="icon" aria-label={paused ? "Resume city animation" : "Pause city animation"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play /> : <Pause />}</Button></div></div>
        {loop && <div className="lc-loop-signal" key={`${loop.at}:${replaying}`} role="status"><GitBranch size={17} /><div><strong>Repair loop {loop.iteration}</strong><span>{loop.trigger === "reviewer" ? "Reviewer" : "Sandbox"}<ArrowRight size={11} />Coder · {loop.trigger === "reviewer" ? `${loop.blockingFindings} blocking findings` : `${loop.failedTests} failing tests`}</span></div><span className="lc-loop-caption">{snapshot.agents.coder.state === "working" ? "Fix in progress" : "Recorded handoff"}</span></div>}
        <div className="lc-scene-bottom"><span><span className="lc-map-key" />{night ? "Night shift" : "Build district"}<span className="lc-map-divider">/</span>Six studios. One team.</span><Button className="lc-follow" shape="compact" variant="outline" aria-label="Follow active agent" aria-pressed={follow} onClick={() => { setFollow(value => !value); setFile(null); }}><Crosshair size={13} />{follow ? "Following activity" : "Follow active agent"}</Button></div>
      </section>

      <aside className="lc-inspector" role="region" aria-label="Stage evidence" style={{ "--stage-color": stage.color } as CSSProperties}>
        <div className="lc-inspector-heading"><div className="lc-agent-icon"><Icon size={23} /></div><div><p>{stage.place}</p><h2>{stage.name}</h2></div><span className="lc-stage-state" data-state={agent.state}><StateIcon state={agent.state} />{stageStates[agent.state]}</span></div>
        <p className="lc-agent-job">{stage.job}</p>
        <div className="lc-agent-metadata"><span><Clock3 size={12} />{agent.state === "working" ? "In progress" : agent.durationMs != null ? duration(agent.durationMs) : "Not timed yet"}</span><span><GitBranch size={12} />{agent.state === "idle" && !agent.startedAt ? "Not started" : `Pass ${agent.iteration + 1}`}</span></div>
        <div className="lc-evidence-tabs" role="tablist" aria-label="Agent evidence" onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "output" : event.key === "End" ? "activity" : tab === "output" ? "activity" : "output";
          setTab(next); document.getElementById(`lc-${next}-tab`)?.focus();
        }}><button role="tab" id="lc-output-tab" tabIndex={tab === "output" ? 0 : -1} aria-controls="lc-output" aria-selected={tab === "output"} onClick={() => setTab("output")}><Braces size={14} />Output</button><button role="tab" id="lc-activity-tab" tabIndex={tab === "activity" ? 0 : -1} aria-controls="lc-activity" aria-selected={tab === "activity"} onClick={() => setTab("activity")}><Activity size={14} />Activity<span>{stageEvents.length}</span></button></div>
        <div className="lc-evidence-body" data-lenis-prevent>
          {tab === "output" ? <div id="lc-output" role="tabpanel" aria-labelledby="lc-output-tab">
            {snapshot.approval?.phase === selected && <div className="lc-approval"><span><Pause size={14} />Waiting for your approval</span><p>Review the {selected === "pm" ? "requirements" : "design"} in the run workspace to continue.</p>{runId && !replaying && <Link href={`/runs/${runId}`}>Review checkpoint<ArrowUpRight size={13} /></Link>}</div>}
            {agent.summary && <p className="lc-agent-summary">{agent.summary}</p>}
            {selected === "sandbox" && snapshot.tests && <div className="lc-test-verdict" data-passed={snapshot.tests.ok}><span>{snapshot.tests.passed}<small>/{snapshot.tests.total}</small></span><div><strong>Tests passed</strong><p>{snapshot.tests.failed ? `${snapshot.tests.failed} need a fix` : "All recorded checks passed"}</p></div>{snapshot.tests.ok ? <Check size={20} /> : <TriangleAlert size={20} />}</div>}
            {output != null && <div className="lc-recorded-output"><h3>{stage.artifactLabel}</h3><StructuredOutput value={output} /></div>}
            {selected === "reviewer" && stageEvents.some(({ event }) => event.event === "agent.message") && <div className="lc-review-notes"><h3>Recorded review notes</h3>{stageEvents.filter(({ event }) => event.event === "agent.message").map(({ event, index }) => <p key={index}>{cityEventText(event)}</p>)}</div>}
            {stageFiles.length > 0 && <div className="lc-files"><h3>{selected === "tester" ? "Generated test suite" : "Application files"}</h3>{stageFiles.map(path => <Button key={path} variant="ghost" className="lc-file" aria-pressed={showingFile === path} onClick={() => setFile(value => value === path ? null : path)}><FileCode2 size={15} /><span>{path}</span>{showingFile === path ? <X size={13} /> : <ChevronRight size={13} />}</Button>)}</div>}
            {showingFile && <div className="lc-code-preview"><div><span>{showingFile}</span><span>{demo ? "Sample source" : "Latest source"}</span></div>{!codeAvailable ? <p>Earlier code versions are available in the run workspace. The latest source is shown when replay reaches the end.</p> : files[showingFile] != null ? <pre tabIndex={0} aria-label={`${showingFile} source code`}><code>{files[showingFile]}</code></pre> : <p>{live.filesError ?? "This file is being saved. Try loading it again."}<Button variant="outline" size="sm" onClick={live.refreshFiles}>Load files</Button></p>}</div>}
            {selected === "sandbox" && snapshot.terminalLines.length > 0 && <div className="lc-terminal"><h3>Execution output</h3><pre tabIndex={0} aria-label="Sandbox execution output">{snapshot.terminalLines.map(line => line.text).join("\n")}</pre></div>}
            {output == null && stageFiles.length === 0 && !(selected === "sandbox" && (snapshot.tests || snapshot.terminalLines.length)) && <div className="lc-empty-evidence"><Icon size={29} /><strong>{agent.state === "working" ? "Work is underway" : agent.state === "idle" ? "This studio is up next" : "No output recorded"}</strong><p>{agent.state === "working" ? "The output will appear as this stage finishes. You can follow its messages in Activity." : agent.state === "idle" ? "Select any building to explore. Evidence appears when its part of the build starts." : "Open Activity for the messages recorded during this stage."}</p></div>}
          </div> : <div id="lc-activity" role="tabpanel" aria-labelledby="lc-activity-tab" className="lc-activity-list">{stageEvents.length > 0 ? stageEvents.map(({ event, index }) => <div className="lc-activity-entry" key={index} data-kind={event.event}><span className="lc-activity-mark" /><div><time>{eventTime(event)}</time><p>{cityEventText(event)}</p></div></div>) : <div className="lc-empty-evidence"><Activity size={29} /><strong>No activity yet</strong><p>Messages for this stage will appear here as the build progresses.</p></div>}</div>}
        </div>
        <div className="lc-inspector-footer"><span className="lc-evidence-source"><span />{demo ? "Sample event data" : replaying ? "From recorded events" : "From your run’s events"}</span>{agent.model && <details><summary>Runtime details</summary><p>{agent.model}</p></details>}</div>
      </aside>
    </div>

    <nav className="lc-stations" aria-label="City agents">{CITY_STAGES.map((item, index) => {
      const stageAgent = snapshot.agents[item.id];
      const StageIcon = stageIcons[item.id];
      return <button key={item.id} data-city-stage={item.id} data-state={stageAgent.state} aria-label={`Inspect ${item.name}`} aria-pressed={selected === item.id} style={{ "--stage-color": item.color } as CSSProperties} onClick={() => inspect(item.id)}><span className="lc-station-number">{String(index + 1).padStart(2, "0")}</span><span className="lc-station-emblem"><StageIcon size={18} /></span><span className="lc-station-copy"><strong>{item.name}{stageAgent.iteration > 0 && <i>×{stageAgent.iteration + 1}</i>}</strong><small><StateIcon state={stageAgent.state} />{stageStates[stageAgent.state]}</small></span>{index < 5 && <ChevronRight className="lc-station-next" size={13} />}</button>;
    })}</nav>

    <section className="lc-transport" aria-label="Run playback">
      <div className="lc-transport-mode">{replaying ? <Play size={17} /> : <Radio size={17} />}<div><strong>{demo ? "Sample replay" : replaying ? "Recorded playback" : complete ? "Build recorded" : "Live activity"}</strong><span>{events.length} recorded events</span></div></div>
      {replaying ? <><Button variant="outline" size="icon" className="lc-play" aria-label={playing && !replayFinished ? "Pause replay" : "Play replay"} onClick={togglePlayback}>{playing && !replayFinished ? <Pause /> : <Play />}</Button><div className="lc-scrubber"><input type="range" aria-label="Replay position" aria-valuetext={`Event ${count} of ${events.length}: ${latestEvent ? cityEventText(latestEvent) : "Start"}`} min={0} max={Math.max(1, events.length)} value={Math.max(0, count)} onChange={event => { setCursor(Number(event.target.value)); setPlaying(false); setFile(null); }} /><div><span>{duration(elapsed)}</span><span>{replayFinished ? "Replay complete" : latestEvent ? cityEventText(latestEvent) : "Ready to play"}</span></div></div><select className="lc-speed" aria-label="Replay speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select>{!demo && <Button variant="outline" onClick={() => { setReplaying(false); setPlaying(false); setFollow(true); setFile(null); }}>Return to live<Radio size={13} /></Button>}{demo && <Button variant="ghost" size="icon" aria-label="Restart sample replay" onClick={() => { setCursor(1); setPlaying(false); setFile(null); }}><RotateCcw /></Button>}</> : <><div className="lc-live-message"><span>{latestEvent ? eventTime(latestEvent) : "—"}</span><p>{error ? "Reconnect to resume the city." : latestEvent ? cityEventText(latestEvent) : "Waiting for the first recorded event."}</p></div><Button variant="outline" disabled={!hasHistory || Boolean(error)} onClick={startReplay}><RotateCcw size={14} />Replay run</Button></>}
    </section>

    <footer className="lc-footer"><span>Click a building to inspect <b>·</b> Drag to orbit <b>·</b> Ctrl + scroll to zoom</span><span>{replaying ? "Playback never changes your run." : "The city follows your actual build."}{reducedMotion && " Reduced motion enabled."}</span></footer>
    {snapshot.prompt && <details className="lc-build-brief"><summary><FileText size={13} />Build brief<ChevronRight size={13} /></summary><p>{snapshot.prompt}</p></details>}
    <div className="sr-only" role="status">{connection}. {cityStatusLabel(snapshot.status)}. {snapshot.approval ? "Approval required in the run workspace." : `${stageName(selectedFor(snapshot))}: ${stageStates[snapshot.agents[selectedFor(snapshot)].state]}.`}</div>
  </main>;
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bug, Check, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Coffee, Moon, Sun, Pause, Play, RotateCcw, MapPin, Plus, Minus, X, Box } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { stations, bugs, type CitySnapshot } from "./city-data";
import type { createCity } from "./city-world";

type Progress = { started: boolean; stage: number; collected: number[]; secret: boolean; idea: "Library API" | "Task API" };
const freshProgress: Progress = { started: false, stage: 0, collected: [], secret: false, idea: "Library API" };
const storageKey = "codeforge-agent-city-v1";

export function AgentCity() {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<ReturnType<typeof createCity> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [progress, setProgress] = useState<Progress>(freshProgress);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [night, setNight] = useState(false);
  const [paused, setPaused] = useState(false);
  const [near, setNear] = useState<number | null>(null);
  const [dialog, setDialog] = useState<number | "secret" | "complete" | "help" | null>(null);
  const [toast, setToast] = useState("");
  const reducedMotion = useMotionPreference();
  const snapshot: CitySnapshot = { ...progress, night, paused: paused || dialog !== null, reducedMotion };
  const latest = useRef(snapshot);
  const events = useRef({
    visit: (index: number) => setDialog(index),
    near: (index: number | null) => setNear(index),
    collect: (index: number) => {
      setProgress(previous => previous.collected.includes(index) ? previous : { ...previous, collected: [...previous.collected, index] });
      setToast(`${bugs[index].name} caught. One less mystery in production.`);
    },
    secret: () => { setProgress(previous => ({ ...previous, secret: true })); setDialog("secret"); },
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved.started === "boolean" && Number.isInteger(saved.stage) && saved.stage >= 0 && saved.stage <= 5) {
        setProgress({ started: saved.started, stage: saved.stage, collected: Array.isArray(saved.collected) ? [...new Set<number>(saved.collected.filter((i: unknown): i is number => typeof i === "number" && Number.isInteger(i) && i >= 0 && i < bugs.length))] : [], secret: saved.secret === true, idea: saved.idea === "Task API" ? "Task API" : "Library API" });
      }
    } catch { /* The island still works when storage is unavailable. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* Progress can stay in memory. */ }
  }, [progress, hydrated]);

  useEffect(() => { latest.current = snapshot; world.current?.update(snapshot); });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    void import("./city-world").then(({ createCity }) => {
      if (disposed) return;
      try {
        world.current = createCity(element, latest.current, events.current);
        setStatus("ready");
      } catch { setStatus("fallback"); }
    }).catch(() => { if (!disposed) setStatus("fallback"); });
    return () => { disposed = true; world.current?.dispose(); world.current = null; };
  }, []);

  useEffect(() => {
    if (dialog !== null && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (dialog === null && dialogRef.current?.open) dialogRef.current.close();
  }, [dialog]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  function visit(index: number) {
    if (paused) { setToast("Resume the island to keep exploring."); return; }
    if (status === "ready") world.current?.visit(index);
    else setDialog(index);
  }

  function advance(index: number) {
    if (!progress.started || progress.stage !== index) return;
    setProgress(previous => previous.stage === index ? { ...previous, stage: index + 1 } : previous);
    if (index === 4) setDialog("complete");
    else { setDialog(null); setToast(`${stations[index].name} is done. Next stop: ${stations[index + 1].name}.`); }
  }

  function restart() {
    setProgress(freshProgress); setDialog(null); setPaused(false); world.current?.reset(); setToast("A fresh idea. A fresh little adventure.");
  }

  const station = typeof dialog === "number" ? stations[dialog] : null;
  const current = stations[Math.min(progress.stage, 4)];
  const route = progress.idea === "Task API" ? "tasks" : "books";
  const questTitle = !progress.started ? "A little idea. A whole adventure." : progress.stage === 5 ? "Your API made it home." : `Next stop: ${current.place}`;
  const questText = !progress.started ? "Pick up an idea cube and take it through the five agents. No deadlines on this island." : progress.stage === 5 ? "Quest complete. Stay a while, catch the bugs, or find the coffee nook." : current.task;

  return (
    <main className="agent-city" data-night={night}>
      <header className="city-header">
        <Link href="/" className="city-back"><ArrowLeft size={16} /><span>CodeForge</span></Link>
        <div className="city-heading"><h1>Agent City<span>Playground</span></h1><p>A small island. Some big ideas.</p></div>
        <button className="city-help" onClick={() => setDialog("help")}>How to play <span>?</span></button>
      </header>

      <section className="city-island" aria-label="Explore Agent City">
        <div ref={host} className="city-world" data-status={status} />
        {status !== "ready" && <div className="city-world-fallback"><Box size={38} /><h2>{status === "loading" ? "Opening the island…" : "Explore with the city guide"}</h2><p>{status === "loading" ? "The agents are putting the kettle on." : "3D isn’t available here. You can still play the whole quest using the agent stops below."}</p>{status === "fallback" && <div>{stations.map((s,i) => <button key={s.id} onClick={() => visit(i)}>{s.name}</button>)}</div>}</div>}

        <div className="city-world-caption"><span className="city-live-dot" /><span>{night ? "Evening on the island" : "A good day to make something"}</span></div>
        <div className="city-tools" aria-label="Island controls">
          <button aria-label={night ? "Switch to daytime" : "Switch to evening"} aria-pressed={night} onClick={() => setNight(!night)}>{night ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button aria-label={paused ? "Resume island" : "Pause island"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
          <span />
          <button aria-label="Zoom in" disabled={status !== "ready"} onClick={() => world.current?.zoom(0.1)}><Plus size={17} /></button>
          <button aria-label="Zoom out" disabled={status !== "ready"} onClick={() => world.current?.zoom(-0.1)}><Minus size={17} /></button>
        </div>

        <aside className="city-quest" aria-label="Your island quest">
          <div className="city-quest-tag"><Box size={14} />{progress.started ? progress.idea : "Your first quest"}<span>{progress.stage}/5</span></div>
          <h2>{questTitle}</h2><p>{questText}</p>
          {!progress.started ? <button className="city-primary" onClick={() => { setProgress(previous => ({ ...previous, started: true })); setToast("Idea cube picked up. Visit the PM’s idea office."); }}>Pick up an idea <Box size={15} /></button> : progress.stage < 5 ? <button className="city-primary" onClick={() => visit(progress.stage)}>Visit {current.name}<MapPin size={15} /></button> : <Link className="city-primary" href="/projects">Build a real API<ChevronRight size={15} /></Link>}
          <div className="city-collectibles"><span><Bug size={14} /> {progress.collected.length}/3 bugs</span><span><Coffee size={14} /> {progress.secret ? "Nook found" : "Find the nook"}</span></div>
        </aside>

        {near !== null && dialog === null && status === "ready" && <button className="city-talk" onClick={() => setDialog(near)}><span>E</span> Talk to {stations[near].name}</button>}
        {paused && <div className="city-paused"><Pause size={18} /><strong>Taking a breather.</strong><button onClick={() => setPaused(false)}>Resume</button></div>}
        <div className="city-toast" role="status">{toast}</div>
        <div className="city-dpad" aria-label="Movement controls">{[{key:"w",label:"Walk forward",Icon:ChevronUp},{key:"a",label:"Walk left",Icon:ChevronLeft},{key:"s",label:"Walk backward",Icon:ChevronDown},{key:"d",label:"Walk right",Icon:ChevronRight}].map(({ key,label,Icon }) => <button key={key} data-direction={key} aria-label={label} disabled={status !== "ready" || paused} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); world.current?.direction(key,true); }} onPointerUp={() => world.current?.direction(key,false)} onPointerCancel={() => world.current?.direction(key,false)} onLostPointerCapture={() => world.current?.direction(key,false)} onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); world.current?.direction(key,true); } }} onKeyUp={() => world.current?.direction(key,false)} onBlur={() => world.current?.direction(key,false)}><Icon size={20} /></button>)}</div>
      </section>

      <nav className="city-stops" aria-label="Agent stops">{stations.map((s,i) => <button key={s.id} onClick={() => visit(i)} aria-current={progress.started && progress.stage === i ? "step" : undefined}><span className="city-stop-icon" style={{ "--stop-color": s.color } as React.CSSProperties}>{i < progress.stage ? <Check size={16} /> : String(i+1).padStart(2,"0")}</span><span><strong>{s.name}</strong><small>{s.place}</small></span><ChevronRight size={14} /></button>)}</nav>
      <footer className="city-footer"><span>Click to walk <b>·</b> WASD / arrows <b>·</b> E to talk</span><span>Just a game. No real API runs.</span><button onClick={restart}><RotateCcw size={12} /> Start over</button></footer>

      <dialog ref={dialogRef} className="city-dialog" onCancel={event => { event.preventDefault(); setDialog(null); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setDialog(null); } }} aria-labelledby="city-dialog-title">
        <button className="city-dialog-close" aria-label="Close conversation" onClick={() => setDialog(null)}><X size={18} /></button>
        {station && typeof dialog === "number" ? <>
          <span className="city-dialog-avatar" style={{ background: station.color }}>{station.name.slice(0,2)}</span><p className="city-dialog-place">{station.place}</p><h2 id="city-dialog-title">Hey, I’m the {station.name}.</h2><blockquote>“{station.line}”</blockquote>
          {!progress.started ? <p>Pick up your idea cube in the quest panel first. I’ll be right here.</p> : dialog > progress.stage ? <p>Visit the {stations[progress.stage].name} first. We’ll catch up when your idea is ready for this stop.</p> : dialog < progress.stage ? <p>Our part is done. Go find the next agent, or take the scenic route. You’ve earned it.</p> : <p>{station.task}</p>}
          {dialog === 0 && progress.started && progress.stage === 0 && <fieldset className="city-idea-options"><legend>What are we building?</legend>{(["Library API","Task API"] as const).map(idea => <label key={idea}><input type="radio" name="city-idea" checked={progress.idea === idea} onChange={() => setProgress(previous => ({ ...previous, idea }))} />{idea}</label>)}</fieldset>}
          <pre className="city-artifact">{station.artifact.replaceAll("/items",`/${route}`)}</pre>
          {progress.started && dialog === progress.stage ? <button className="city-primary" onClick={() => advance(dialog)}>{station.action}<Check size={16} /></button> : <button className="city-primary" onClick={() => setDialog(null)}>Back to exploring<ChevronRight size={16} /></button>}
        </> : dialog === "complete" ? <><span className="city-dialog-avatar city-success"><Check size={28} /></span><p className="city-dialog-place">Quest complete</p><h2 id="city-dialog-title">An idea became an API.</h2><p>Your {progress.idea} made it through all five agents. The island’s imaginary tests are green. Nicely done.</p><pre className="city-artifact">{`GET /${route} → 200 OK\n5 quest checks passed\nBugs caught: ${progress.collected.length}/3`}</pre><button className="city-primary" onClick={() => setDialog(null)}>Keep exploring<ChevronRight size={16} /></button><Link className="city-dialog-link" href="/projects">Ready to build something real?</Link></> : dialog === "secret" ? <><span className="city-dialog-avatar city-coffee"><Coffee size={28} /></span><p className="city-dialog-place">Secret discovered</p><h2 id="city-dialog-title">The unofficial sixth agent.</h2><p>Coffee. No roadmap survives without it.</p><blockquote>“There are only two hard things in computer science: cache invalidation, naming things, and off-by-one errors.”</blockquote><p>You found the coffee nook. Take a seat. The bugs can wait.</p><button className="city-primary" onClick={() => setDialog(null)}>Back to the island<ChevronRight size={16} /></button></> : <><span className="city-dialog-avatar city-success"><MapPin size={28} /></span><h2 id="city-dialog-title">Welcome to your little break.</h2><p>Pick up an idea cube, then visit each agent in order. Click a building or use the agent stops to walk there.</p><ul><li><strong>Move:</strong> click the ground, use WASD / arrow keys, or the direction buttons.</li><li><strong>Talk:</strong> press E near a resident or click “Talk”.</li><li><strong>Explore:</strong> walk into three little bugs to catch them. Find the coffee nook for a secret.</li><li><strong>Relax:</strong> try evening mode. Your quest progress saves in this browser.</li></ul><button className="city-primary" onClick={() => setDialog(null)}>Let’s explore<ChevronRight size={16} /></button></>}
      </dialog>
    </main>
  );
}

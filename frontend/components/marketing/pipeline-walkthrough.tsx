"use client";

import { MotionButton } from "@/components/ui/motion-button";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardList, Code2, FlaskConical, Layers3, Pause, Play, RotateCcw, ShieldCheck, Terminal } from "lucide-react";
import { DEMO_RUNS, type DemoRun } from "@/lib/demo-runs";

const stages = [
  { name: "PM", detail: "Defines the requirements", icon: ClipboardList },
  { name: "Architect", detail: "Maps the API design", icon: Layers3 },
  { name: "Coder", detail: "Writes the application", icon: Code2 },
  { name: "Reviewer", detail: "Checks and sends feedback", icon: ShieldCheck },
  { name: "Tester", detail: "Writes the test suite", icon: FlaskConical },
  { name: "Sandbox", detail: "Runs the code and tests", icon: Terminal },
];
const sequence = [0, 1, 2, 3, 2, 3, 4, 5, 6];
const messages = [
  "Turning the prompt into clear requirements.",
  "Designing endpoints and data models. You approve the plan before the build.",
  "Writing the API and its response models.",
  "Review found a missing response model. Sending feedback to the Coder.",
  "Coder adds the missing response model for another review.",
  "The fix passes review. Ready for tests.",
  "Writing tests for CRUD operations and invalid input.",
  "Running the application and tests in an isolated sandbox.",
  "A tested API, with code and results you can inspect.",
];

export function PipelineWalkthrough({ demo, example, onExampleChange }: {
  demo: DemoRun; example: number; onExampleChange: (index: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setReducedMotion(motion.matches); if (motion.matches) { setStep(8); setPlaying(false); } };
    sync();
    motion.addEventListener("change", sync);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); motion.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    if (!playing || !visible || reducedMotion || step === 8) return;
    const timer = window.setTimeout(() => setStep(value => value + 1), step === 3 || step === 4 ? 2400 : 1800);
    return () => window.clearTimeout(timer);
  }, [playing, visible, reducedMotion, step]);

  const active = sequence[step];
  const finished = step === 8;
  const repair = step === 3 || step === 4;

  return (
    <div ref={root} className="lp-pipeline-content" aria-label="Example prompt to tested API walkthrough">
      <div className="lp-product-head"><span><span className="lp-status-dot" />From request to result</span><span>Example walkthrough</span></div>
      <div className="lp-pipeline-request">
        <div className="lp-pipeline-request-head"><span className="lp-pipeline-label">Start with an idea</span><div className="lp-example-switch" aria-label="Choose an example">{DEMO_RUNS.map((item, index) => <MotionButton key={item.slug} type="button" aria-pressed={example === index} onClick={() => onExampleChange(index)}>{item.label}</MotionButton>)}</div></div>
        <p className="lp-prompt" aria-live="polite" aria-atomic="true">{demo.prompt}</p>
      </div>
      <div className="lp-pipeline-body">
        <div className="lp-pipeline-caption"><span>Five AI agents. One sandbox.</span><span>6 connected stages</span></div>
        <ol className="lp-pipeline-stages" aria-label="Build pipeline">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const state = finished || index < active ? "done" : index === active ? "active" : "waiting";
            return <li key={stage.name} data-state={state} data-repair={repair && (index === 2 || index === 3)} aria-current={state === "active" ? "step" : undefined}>
              <div className="lp-stage-top"><span className="lp-stage-icon"><Icon size={21} strokeWidth={1.6} aria-hidden /></span><span className="lp-stage-number">0{index + 1}</span></div>
              <h3>{stage.name}</h3><p>{stage.detail}</p>
              <span className="lp-stage-state">{state === "done" ? <Check size={12} aria-hidden /> : <span className="lp-stage-dot" />}{state === "done" ? "Complete" : state === "active" ? repair && index === 2 ? "Repairing" : "Working" : "Up next"}</span>
              {index < 5 && <ArrowRight className="lp-stage-arrow" size={14} aria-hidden />}
            </li>;
          })}
        </ol>
        <div className="lp-pipeline-feedback" data-repair={repair}><RotateCcw size={14} aria-hidden /><span>Reviewer → Coder → Reviewer</span><span>{step < 3 ? "Feedback keeps the build moving." : repair ? "Missing response model → returned for repair" : "Response model fixed. Review passed."}</span></div>
        <div className="lp-pipeline-outcome" data-complete={finished}>
          <div><span className="lp-outcome-icon">{finished ? <Check size={18} aria-hidden /> : <ArrowRight size={18} aria-hidden />}</span><div><strong>{finished ? `Tests passed · ${demo.tests}/${demo.tests}` : `${stages[active].name} · ${repair ? "review & repair" : "in progress"}`}</strong><p>{messages[step]}</p></div></div>
          <div className="lp-walkthrough-controls">{finished ? <Link href={`/demo/${demo.slug}`}>Inspect generated code<ArrowRight size={14} aria-hidden /></Link> : null}<MotionButton type="button" onClick={() => { if (finished) { setStep(0); setPlaying(true); } else setPlaying(value => !value); }} disabled={reducedMotion} aria-label={finished ? "Replay walkthrough" : playing ? "Pause walkthrough" : "Play walkthrough"}>{finished ? <RotateCcw size={15} aria-hidden /> : playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}{finished ? "Replay" : playing ? "Pause" : "Play"}</MotionButton></div>
        </div>
      </div>
    </div>
  );
}

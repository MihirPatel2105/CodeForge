"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleCheck, ArrowDown, ArrowRight, type LucideIcon } from "lucide-react";
import { LayoutGroup, motion, useScroll, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { motionSpring, motionEase } from "@/lib/motion-tokens";
import { useMotionPreference } from "@/lib/use-motion-preference";

type Agent = {
  name: string;
  verb: string;
  detail: string;
  icon: LucideIcon;
  artifact: string;
  lines: string[];
  note: string;
  model?: string;
};

export function AgentScrollStack({ agents }: { agents: Agent[] }) {
  const [selected, setSelected] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start 0.18", "end 0.82"] });
  const id = useId();
  const reducedMotion = useMotionPreference();
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1000px) and (min-height: 760px)");
    const update = () => setScrollEnabled(desktop.matches && !reducedMotion);
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, [reducedMotion]);
  useMotionValueEvent(scrollYProgress, "change", value => {
    if (scrollEnabled) setSelected(Math.min(agents.length - 1, Math.floor(value * agents.length)));
  });
  const agent = agents[selected];
  if (!agent) return null;
  const Icon = agent.icon;

  return (
    <div ref={track} className="lp-agent-track" data-scroll-enabled={scrollEnabled}>
    <div className="lp-agent-showcase">
      <div className="lp-agent-scroll-heading">
        <p className="lp-agent-scroll-hint">{scrollEnabled ? <><ArrowDown size={14} aria-hidden />Scroll to build, one stage at a time.</> : "Choose a stage to explore the build."}</p>
        <span className="lp-agent-counter">{String(selected + 1).padStart(2, "0")} <span>/ {String(agents.length).padStart(2, "0")}</span></span>
      </div>
      <LayoutGroup id={id}><nav className="lp-agent-nav" aria-label="Explore the agents and sandbox">
        {agents.map((item, index) => (
          <button
            key={item.name}
            type="button"
            disabled={scrollEnabled}
            data-complete={scrollEnabled && index < selected}
            aria-pressed={index === selected}
            aria-controls={`${id}-content`}
            onClick={() => {
              if (!scrollEnabled) setSelected(index);
            }}
          >
            {index === selected && (reducedMotion
              ? <span className="lp-agent-selection" aria-hidden />
              : <motion.span className="lp-agent-selection" layoutId="agent-selection" transition={motionSpring} aria-hidden />)}
            <span className="lp-agent-label">{scrollEnabled && index < selected && <CircleCheck size={13} aria-hidden />}{item.name}</span>
            {scrollEnabled && <StageProgress progress={scrollYProgress} index={index} count={agents.length} />}
          </button>
        ))}
      </nav></LayoutGroup>
      <div id={`${id}-content`} aria-live={scrollEnabled ? "off" : "polite"} aria-atomic="true">

        <motion.div
          key={agent.name}
          className="lp-agent-content"
          initial={{ opacity: reducedMotion ? 1 : 0.4, transform: reducedMotion ? "none" : "translateY(12px)" }}
          animate={{ opacity: 1, transform: "none" }}
          transition={{ duration: reducedMotion ? 0 : 0.2, ease: motionEase }}
        >
          <div className="lp-agent-copy">
            <p className="lp-agent-phase">{String(selected + 1).padStart(2, "0")} / {agent.name}</p>
            <h3>{agent.verb}</h3>
            <p className="lp-agent-detail">{agent.detail}</p>
            <p className="lp-agent-note"><CircleCheck size={16} aria-hidden /><span>{agent.note}</span></p>
          </div>
          <div className="lp-agent-output">
            <div className="lp-agent-output-head"><span><Icon size={16} aria-hidden />{agent.artifact}</span><span>Example output</span></div>
            <ul>
              {agent.lines.map((line, index) => <OutputLine key={line} line={line} index={index} count={agent.lines.length} stage={selected} stages={agents.length} progress={scrollYProgress} scrollEnabled={scrollEnabled} reducedMotion={reducedMotion} />)}
            </ul>
            {agent.model && <p className="lp-agent-model"><strong>Book</strong> · {agent.model}</p>}
          </div>
        </motion.div>

      </div>
      <div className="lp-agent-footer"><span>One library example, from start to finish.</span><span className="lp-agent-next">{scrollEnabled ? (selected < agents.length - 1 ? <>Keep scrolling<ArrowRight size={14} aria-hidden />{agents[selected + 1].name}</> : <>End of the example<CircleCheck size={14} aria-hidden /></>) : "Review and test feedback can return to the Coder."}</span></div>
    </div>
    </div>
  );
}


function StageProgress({ progress, index, count }: { progress: MotionValue<number>; index: number; count: number }) {
  const scaleX = useTransform(progress, [index / count, (index + 1) / count], [0, 1]);
  return <span className="lp-agent-stage-rail" aria-hidden><motion.span style={{ scaleX }} /></span>;
}

function OutputLine({ line, index, count, stage, stages, progress, scrollEnabled, reducedMotion }: {
  line: string; index: number; count: number; stage: number; stages: number;
  progress: MotionValue<number>; scrollEnabled: boolean; reducedMotion: boolean;
}) {
  // Keep upcoming output readable while scroll progressively brings each row into focus.
  const start = (stage + index / count * 0.55) / stages;
  const end = start + 0.18 / stages;
  const opacity = useTransform(progress, [start, end], [0.25, 1]);
  const y = useTransform(progress, [start, end], [6, 0]);
  const route = /^(POST|GET|PATCH|DELETE)\s+(\/\S+)$/.exec(line);
  return <motion.li
    className={route ? "lp-agent-route" : "lp-agent-item"}
    style={scrollEnabled ? { opacity, y } : undefined}
    initial={scrollEnabled ? false : { opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 8 }}
    whileInView={scrollEnabled ? undefined : { opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : index * 0.07 }}
  >
    {route ? <><span className="lp-agent-method">{route[1]}</span><code>{route[2]}</code></> : <><CircleCheck size={15} aria-hidden /><span>{line}</span></>}
  </motion.li>;
}

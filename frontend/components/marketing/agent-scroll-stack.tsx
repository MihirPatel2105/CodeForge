"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { springValue } from "motion";
import { motionSpring } from "@/lib/motion-tokens";
import type { LucideIcon } from "lucide-react";

type Agent = {
  name: string;
  verb: string;
  detail: string;
  icon: LucideIcon;
  artifact: string;
  lines: string[];
};

export function AgentScrollStack({ agents }: { agents: Agent[] }) {
  const stack = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const cards = Array.from(stack.current?.querySelectorAll<HTMLElement>(".lp-stack-card") ?? []);
    const enabled = window.matchMedia("(min-width: 701px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)");
    const scales = cards.map((card) => {
      const value = springValue<number>(1, motionSpring);
      const unsubscribe = value.on("change", (scale) => card.style.setProperty("--stack-scale", String(scale)));
      return { value, unsubscribe };
    });
    let frame = 0;
    const update = () => {
      frame = 0;
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        let progress = 0;
        if (enabled.matches && next) {
          const top = 104 + (index + 1) * 16;
          const start = window.innerHeight * 0.85;
          progress = Math.max(0, Math.min(1, (start - next.getBoundingClientRect().top) / Math.max(1, start - top)));
        }
        const scale = 1 - progress * 0.04;
        if (enabled.matches) scales[index].value.set(scale);
        else scales[index].value.jump(1);
      });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    enabled.addEventListener("change", schedule);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      enabled.removeEventListener("change", schedule);
      window.cancelAnimationFrame(frame);
      scales.forEach(({ value, unsubscribe }) => { unsubscribe(); value.destroy(); });
      cards.forEach((card) => card.style.removeProperty("--stack-scale"));
    };
  }, []);

  return (
    <ol ref={stack} className="lp-agent-stack" aria-label="The five agents, from idea to tested API">
      {agents.map((agent, index) => {
        const Icon = agent.icon;
        return (
          <li key={agent.name} className="lp-stack-card" style={{ "--stack-index": index } as CSSProperties}>
            <article aria-labelledby={`agent-stack-${index}`}>
              <div className="lp-stack-head"><span><span className="lp-stack-number">0{index + 1}</span>{agent.name}</span><Icon size={22} strokeWidth={1.5} aria-hidden /></div>
              <div className="lp-stack-body">
                <div className="lp-stack-copy"><h3 id={`agent-stack-${index}`}>{agent.verb}</h3><p>{agent.detail}</p><span className="lp-stack-step">Step {index + 1} of {agents.length}</span></div>
                <div className="lp-artifact"><div><span>{agent.artifact}</span><span>Library example</span></div><ul>{agent.lines.map(line => <li key={line}>{line}</li>)}</ul></div>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

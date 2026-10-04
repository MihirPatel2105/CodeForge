"use client";

import { useId, useState } from "react";
import { CircleCheck, type LucideIcon } from "lucide-react";

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
  const [hasSwitched, setHasSwitched] = useState(false);
  const id = useId();
  const agent = agents[selected];
  if (!agent) return null;
  const Icon = agent.icon;

  return (
    <div className="lp-agent-showcase">
      <nav className="lp-agent-nav" aria-label="Explore the five agents">
        {agents.map((item, index) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={index === selected}
            aria-controls={`${id}-content`}
            onClick={() => {
              if (index !== selected) {
                setSelected(index);
                setHasSwitched(true);
              }
            }}
          >
            {item.name}
          </button>
        ))}
      </nav>
      <div id={`${id}-content`} aria-live="polite" aria-atomic="true">
        <div key={agent.name} className={`lp-agent-content${hasSwitched ? " lp-agent-switched" : ""}`}>
          <div className="lp-agent-copy">
            <p className="lp-agent-phase">{String(selected + 1).padStart(2, "0")} / {agent.name}</p>
            <h3>{agent.verb}</h3>
            <p className="lp-agent-detail">{agent.detail}</p>
            <p className="lp-agent-note"><CircleCheck size={16} aria-hidden /><span>{agent.note}</span></p>
          </div>
          <div className="lp-agent-output">
            <div className="lp-agent-output-head"><span><Icon size={16} aria-hidden />{agent.artifact}</span><span>Example output</span></div>
            <ul>
              {agent.lines.map((line) => {
                const route = /^(POST|GET|PATCH|DELETE)\s+(\/\S+)$/.exec(line);
                return (
                  <li key={line} className={route ? "lp-agent-route" : "lp-agent-item"}>
                    {route ? <><span className="lp-agent-method">{route[1]}</span><code>{route[2]}</code></> : <><CircleCheck size={15} aria-hidden /><span>{line}</span></>}
                  </li>
                );
              })}
            </ul>
            {agent.model && <p className="lp-agent-model"><strong>Book</strong> · {agent.model}</p>}
          </div>
        </div>
      </div>
      <div className="lp-agent-footer"><span>One library example, from start to finish.</span><span>Review and test feedback can return to the Coder.</span></div>
    </div>
  );
}

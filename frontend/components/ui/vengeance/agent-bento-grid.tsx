"use client";

// Adapted from Vengeance UI's agent workspace cards. MIT license: docs/vendor/vengeance-ui.md.
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";

type Agent = { name: string; verb: string; detail: string; icon: LucideIcon; artifact: string; lines: string[]; note: string };
export function AgentBentoGrid({ agents }: { agents: Agent[] }) {
  const reduced = useMotionPreference();
  return (
    <div className="vui-agent-grid">
      {agents.map((agent, index) => (
        <motion.article key={agent.name} className="vui-agent-card"
          initial={false} animate={reduced ? { transform: "none" } : undefined}
          whileHover={reduced ? undefined : { transform: "translateY(-3px)" }} transition={{ duration: reduced ? 0 : 0.2 }}>
          <div className="vui-agent-top"><span className="vui-agent-icon"><agent.icon size={21} aria-hidden /></span><span>0{index + 1} / {agent.name}</span></div>
          <h3>{agent.verb}</h3><p>{agent.detail}</p>
          <div className="vui-agent-artifact"><span>{agent.artifact}</span><ul>{agent.lines.map(line => <li key={line}>{line}</li>)}</ul></div>
          <span className="vui-agent-note">{agent.note}</span>
        </motion.article>
      ))}
    </div>
  );
}

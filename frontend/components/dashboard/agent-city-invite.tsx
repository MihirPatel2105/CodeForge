"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Gamepad2, X } from "lucide-react";
import type { RunSnapshot } from "@/lib/run-reducer";

export function AgentCityInvite({ runId, snapshot, connected }: { runId: string; snapshot: RunSnapshot; connected: boolean }) {
  const [visible, setVisible] = useState(false);
  const eligible = snapshot.runId === runId && connected && snapshot.status === "running" && !snapshot.endedAt && !snapshot.approval
    && snapshot.approvedPhases.includes("pm") && snapshot.approvedPhases.includes("architect")
    && ["coder", "reviewer", "tester", "sandbox"].includes(snapshot.currentAgent ?? "");

  useEffect(() => {
    if (!eligible) return;
    const key = `codeforge:agent-city-invite:${runId}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* Storage may be unavailable. */ }
    // Wait for replay to settle so a finished historical run never flashes an invite.
    const timer = window.setTimeout(() => {
      setVisible(true);
      try { sessionStorage.setItem(key, "shown"); } catch { /* The current mount still remembers dismissal. */ }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [eligible, runId]);

  if (!eligible || !visible) return null;
  return (
    <aside aria-label="Agent City invitation" className="fixed bottom-4 right-4 z-30 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-surface p-5 text-fg shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
      <button type="button" aria-label="Dismiss Agent City invitation" className="absolute right-3 top-3 rounded-lg p-2 text-fg-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent" onClick={() => setVisible(false)}><X size={16} /></button>
      <div role="status" className="pr-7">
        <span className="mb-3 flex items-center gap-2 text-xs font-medium text-fg-muted"><Gamepad2 size={17} /> A little break</span>
        <h2 className="text-base font-semibold tracking-tight">Your agents are on it.</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">Both approvals are complete. Explore Agent City while your API builds.</p>
      </div>
      <a href={`/playground/agent-city?run=${encodeURIComponent(runId)}`} target="_blank" rel="noopener noreferrer" onClick={() => setVisible(false)} className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-surface hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Play Agent City <ArrowUpRight size={16} aria-hidden /></a>
      <p className="mt-2 text-xs leading-5 text-fg-muted">Opens in a new tab. Keep this tab open to follow your build.</p>
    </aside>
  );
}

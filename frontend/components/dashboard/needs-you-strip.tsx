"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Hand } from "lucide-react";
import { api } from "@/lib/api";
import type { RunSummary } from "@/lib/types";

/**
 * Shown only while a run waits at an approval checkpoint: the one thing on this page
 * that cannot move until the viewer acts. Renders nothing otherwise, and a failed
 * lookup stays silent because the list below still shows each project's state.
 */
export function NeedsYouStrip({ projectNames, refreshKey }: { projectNames: Map<string, string>; refreshKey: number }) {
  const [waiting, setWaiting] = useState<RunSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .attentionRuns()
      .then((runs) => {
        if (!cancelled) setWaiting(runs.filter((run) => run.status === "awaiting_approval"));
      })
      .catch(() => {
        if (!cancelled) setWaiting([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!waiting.length) return null;
  const first = waiting[0];
  const where = projectNames.get(first.project_id);
  const summary =
    waiting.length === 1
      ? `1 run waits for your approval${where ? ` in ${where}` : ""}`
      : `${waiting.length} runs wait for your approval`;

  return (
    <section
      aria-label="Waiting for you"
      className="cf-needs-you flex flex-wrap items-center gap-3 rounded-2xl border border-warn-bd bg-warn-soft px-4 py-3 text-[13.5px] text-warn"
    >
      <Hand className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-[600]">{summary}</p>
      <Link
        href={`/runs/${first.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-[650] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn"
      >
        {waiting.length === 1 ? "Review it" : "Review the oldest"}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}

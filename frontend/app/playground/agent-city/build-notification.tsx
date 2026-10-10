"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, X } from "lucide-react";
import { api, ApiError, getToken } from "@/lib/api";
import type { RunStatus } from "@/lib/types";

const active = new Set<RunStatus>(["queued", "running", "awaiting_approval"]);

export function BuildNotification() {
  const [result, setResult] = useState<{ id: string; status: RunStatus } | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("run");
    if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !getToken()) return;
    let cancelled = false;
    let finished = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (cancelled || finished || pending) return;
      pending = true;
      clearTimeout(timer);
      try {
        const run = await api.getRun(id!);
        if (cancelled) return;
        if (!active.has(run.status)) {
          finished = true;
          setResult({ id: id!, status: run.status });
        }
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) finished = true;
      } finally {
        pending = false;
        if (!cancelled && !finished) timer = setTimeout(poll, document.hidden ? 15000 : 5000);
      }
    }
    function onVisibility() { if (!document.hidden) void poll(); }
    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  if (!result) return null;
  const success = result.status === "succeeded";
  const cancelled = result.status === "cancelled";
  return (
    <aside aria-label="API build update" className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-surface p-5 text-fg shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
      <button aria-label="Dismiss build update" className="absolute right-3 top-3 rounded-lg p-2 text-fg-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent" onClick={() => setResult(null)}><X size={16} /></button>
      <div role="status" className="pr-7">
        <Bell size={19} className="mb-3" aria-hidden />
        <h2 className="text-base font-semibold">{success ? "Your API is ready." : cancelled ? "Your build was cancelled." : "Your build needs a look."}</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{success ? "The agents finished your build. Your API and test results are ready to inspect." : "Return to the run to review its outcome and next steps."}</p>
      </div>
      <Link href={`/runs/${result.id}${success ? "/use" : ""}`} className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-surface hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">{success ? "View your API" : "View run"}<ArrowUpRight size={16} aria-hidden /></Link>
    </aside>
  );
}

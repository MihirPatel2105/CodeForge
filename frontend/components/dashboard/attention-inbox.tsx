"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { readLocal, writeLocal } from "@/lib/workspace-storage";
import { RUN_STATUS_META, tone } from "@/lib/tone";
import type { RunSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const fingerprint = (run: RunSummary) => `${run.id}:${run.status}:${run.updated_at}`;
export function AttentionInbox({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [enabled, setEnabled] = useState(false);
  const key = `codeforge:attention:${userId}`;
  useEffect(() => {
    setSeen(readLocal<string[]>(key, []));
    setEnabled(readLocal<boolean>(`${key}:notifications`, false));
    let cancelled = false;
    let known: Set<string> | null = null;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api.attentionRuns();
        if (cancelled) return;
        setRuns(next); setNotice("");
        if (known && document.hidden && "Notification" in window && Notification.permission === "granted" && readLocal(`${key}:notifications`, false)) {
          for (const run of next) {
            const eventKey = fingerprint(run);
            if (!known.has(eventKey) && !readLocal<string[]>(key, []).includes(eventKey)) {
              const notification = new Notification(run.status === "awaiting_approval" ? "CodeForge needs your approval" : "Your CodeForge run has finished", { body: "Open CodeForge to inspect the run.", tag: eventKey });
              notification.onclick = () => { window.focus(); window.location.assign(`/runs/${run.id}`); notification.close(); };
            }
          }
        }
        known = new Set(next.map(fingerprint));
      } catch { if (!cancelled) setNotice("Updates are temporarily unavailable. Retrying shortly."); }
      finally { if (!cancelled) timer = setTimeout(poll, 15000); }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key]);
  const visible = runs.filter(run => run.status === "awaiting_approval" || !seen.includes(fingerprint(run)));
  const unreadCompleted = visible.filter(run => run.status !== "awaiting_approval");
  function markRead(run: RunSummary) { const next = [...seen, fingerprint(run)].slice(-200); setSeen(next); writeLocal(key, next); }
  async function toggleNotifications() {
    if (enabled) { setEnabled(false); writeLocal(`${key}:notifications`, false); return; }
    if (!("Notification" in window)) { setNotice("This browser does not support notifications. In-app updates remain available."); return; }
    try {
      const permission = await Notification.requestPermission();
      setEnabled(permission === "granted"); writeLocal(`${key}:notifications`, permission === "granted");
      setNotice(permission === "granted" ? "Browser notifications are on while CodeForge is open." : "Browser notifications are blocked. You can change this in browser settings.");
    } catch { setNotice("Browser notifications are unavailable. Use the in-app inbox."); }
  }
  return <><Button variant="ghost" size="icon" aria-label={`Run updates${visible.length ? `, ${visible.length} need attention` : ""}`} className="relative size-10 rounded-full" onClick={() => setOpen(true)}><Bell className="size-4" />{visible.length > 0 && <span className="absolute right-0 top-0 rounded-full bg-accent px-1 text-[10px] text-surface">{visible.length}</span>}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Bell className="size-5" aria-hidden /></span>
            <div>
              <DialogTitle>Run updates</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-fg-muted">Approvals and results across your projects.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[45vh] overflow-y-auto px-4 py-4">
          {visible.length ? <div className="space-y-2">{visible.map(run => {
            const meta = RUN_STATUS_META[run.status] ?? { label: run.status, tone: "neutral" as const };
            return <Link key={run.id} href={`/runs/${run.id}`} onClick={() => { markRead(run); setOpen(false); }} className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-accent-bd hover:bg-accent-soft/30">
              <div className="min-w-0 flex-1">
                <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${tone[meta.tone].soft}`}>{meta.label}</span>
                <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-fg">{run.prompt}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-fg-muted group-hover:text-accent" aria-hidden />
            </Link>;
          })}</div> : <div className="flex flex-col items-center py-7 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok"><CheckCheck className="size-6" aria-hidden /></span>
            <p className="text-sm font-semibold text-fg">You’re all caught up.</p>
            <p className="mt-1 max-w-[28ch] text-xs leading-5 text-fg-muted">New approvals and completed runs will appear here.</p>
          </div>}
        </div>
        <div className="space-y-3 border-t border-border bg-surface-2/40 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-semibold text-fg">Browser notifications</p><p className="mt-1 text-[11px] leading-4 text-fg-muted">{enabled ? "On while CodeForge is open" : "Get updates when this tab is in the background"}</p></div>
            <Button variant="outline" size="sm" aria-label={enabled ? "Turn off browser notifications" : "Enable browser notifications"} onClick={toggleNotifications}>{enabled ? "Turn off" : "Enable"}</Button>
          </div>
          {unreadCompleted.length > 0 && <Button variant="ghost" size="sm" className="w-full text-xs text-fg-muted" onClick={() => { const next = [...seen, ...runs.filter(r => r.status !== "awaiting_approval").map(fingerprint)].slice(-200); setSeen(next); writeLocal(key, next); }}><CheckCheck className="size-3.5" aria-hidden />Mark completed runs as read</Button>}
          {notice && <p role="status" className="rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-5 text-fg-muted">{notice}</p>}
        </div>
      </DialogContent>
    </Dialog></>;
}

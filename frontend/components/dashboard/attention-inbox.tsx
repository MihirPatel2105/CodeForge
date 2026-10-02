"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { readLocal, writeLocal } from "@/lib/workspace-storage";
import { RUN_STATUS_META } from "@/lib/tone";
import type { RunSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  return <><Button variant="ghost" size="icon" aria-label={`Run updates${visible.length ? `, ${visible.length} need attention` : ""}`} className="relative size-10 rounded-full" onClick={() => setOpen(true)}><Bell className="size-4" />{visible.length > 0 && <span className="absolute right-0 top-0 rounded-full bg-accent px-1 text-[10px] text-white">{visible.length}</span>}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Run updates</DialogTitle></DialogHeader>
      <p className="text-sm text-fg-muted">Approvals and recent completed runs across your projects.</p>
      <div className="max-h-[55vh] space-y-2 overflow-auto">{visible.length ? visible.map(run => <Link key={run.id} href={`/runs/${run.id}`} onClick={() => { markRead(run); setOpen(false); }} className="block rounded-xl border border-border p-3 hover:bg-surface-2"><span className="text-sm font-semibold">{RUN_STATUS_META[run.status]?.label ?? run.status}</span><p className="mt-1 line-clamp-2 text-sm text-fg-muted">{run.prompt}</p></Link>) : <p className="py-8 text-sm text-fg-muted">You’re all caught up.</p>}</div>
      <Button variant="outline" onClick={toggleNotifications}>{enabled ? "Turn off browser notifications" : "Enable browser notifications"}</Button>
      <Button variant="ghost" onClick={() => { const next = [...seen, ...runs.filter(r => r.status !== "awaiting_approval").map(fingerprint)].slice(-200); setSeen(next); writeLocal(key, next); }}>Mark completed runs as read</Button>
      {notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
    </DialogContent></Dialog></>;
}

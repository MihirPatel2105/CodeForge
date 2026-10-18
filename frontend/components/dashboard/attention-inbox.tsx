"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CheckCheck, Check, CircleDot, CircleCheck, TriangleAlert, X, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "@/lib/api";
import { readLocal, writeLocal } from "@/lib/workspace-storage";
import { RUN_STATUS_META } from "@/lib/tone";
import type { RunSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Popover } from "@base-ui/react/popover";
import styles from "./attention-inbox.module.css";
import { motionSpring } from "@/lib/motion-tokens";
import { useMotionPreference } from "@/lib/use-motion-preference";

// Arc UI Notification Center adaptation; source and MIT license: docs/vendor/arc-ui.md.
const fingerprint = (run: RunSummary) => `${run.id}:${run.status}:${run.updated_at}`;
export function AttentionInbox({ userId }: { userId: string }) {
  const reducedMotion = useMotionPreference();
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [view, setView] = useState<"all" | "unread" | "approval" | "finished">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [badgePulse, setBadgePulse] = useState(0);
  const allFilter = useRef<HTMLButtonElement>(null);
  const previousVisible = useRef<number | null>(null);
  const key = `codeforge:attention:${userId}`;
  useEffect(() => {
    setDismissed(readLocal<string[]>(`${key}:dismissed`, []));
    setSeen(readLocal<string[]>(key, []));
    setEnabled(readLocal<boolean>(`${key}:notifications`, false));
    let cancelled = false;
    let known: Set<string> | null = null;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api.attentionRuns();
        if (cancelled) return;
        setRuns(next); setLoaded(true); setNotice("");
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
  const items = runs.filter(run => run.status === "awaiting_approval" || !dismissed.includes(fingerprint(run)));
  const unread = (run: RunSummary) => run.status === "awaiting_approval" || !seen.includes(fingerprint(run));
  const visible = items.filter(unread);
  const filtered = items.filter(run => view === "all" || (view === "unread" && unread(run)) || (view === "approval" && run.status === "awaiting_approval") || (view === "finished" && run.status !== "awaiting_approval"));
  const unreadCompleted = visible.filter(run => run.status !== "awaiting_approval");
  const readItems = items.filter(run => !unread(run));
  useEffect(() => {
    if (!loaded) return;
    if (previousVisible.current !== null && visible.length > previousVisible.current) setBadgePulse(pulse => pulse + 1);
    previousVisible.current = visible.length;
  }, [loaded, visible.length]);
  function updateSeen(next: string[]) {
    const bounded = [...new Set(next)].slice(-200);
    setSeen(bounded);
    if (!writeLocal(key, bounded)) setNotice("Read state could not be saved on this device.");
  }
  function markRead(run: RunSummary) { updateSeen([...seen, fingerprint(run)]); }
  function clearRead() {
    allFilter.current?.focus();
    const next = [...new Set([...dismissed, ...readItems.map(fingerprint)])].slice(-200);
    setDismissed(next);
    setExpanded(null);
    if (!writeLocal(`${key}:dismissed`, next)) setNotice("Cleared updates could not be saved on this device.");
  }
  async function toggleNotifications() {
    if (enabled) { setEnabled(false); writeLocal(`${key}:notifications`, false); return; }
    if (!("Notification" in window)) { setNotice("This browser does not support notifications. In-app updates remain available."); return; }
    try {
      const permission = await Notification.requestPermission();
      setEnabled(permission === "granted"); writeLocal(`${key}:notifications`, permission === "granted");
      setNotice(permission === "granted" ? "Browser notifications are on while CodeForge is open." : "Browser notifications are blocked. You can change this in browser settings.");
    } catch { setNotice("Browser notifications are unavailable. Use the in-app inbox."); }
  }
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger render={<Button variant="ghost" size="icon" />} aria-label={`Run updates${visible.length ? `, ${visible.length} need attention` : ""}`} className="relative size-10 rounded-full">
      <motion.span animate={{ rotate: open && !reducedMotion ? -12 : 0 }} transition={motionSpring}><Bell className="size-4" /></motion.span>
      {visible.length > 0 && <motion.span key={badgePulse} animate={{ scale: badgePulse && !reducedMotion ? [1, 1.18, 1] : 1 }} className={styles.badge} aria-hidden>{visible.length > 99 ? "99+" : visible.length}</motion.span>}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner align="end" sideOffset={12} collisionPadding={12} className="z-50">
        <Popover.Popup className={styles.panel}>
          <header className={styles.header}>
            <div><div className={styles.heading}><Popover.Title>Run updates</Popover.Title><span className={styles.count} aria-hidden>{visible.length}</span></div>
              <Popover.Description>Approvals and results across your projects.</Popover.Description>
            </div>
            <Popover.Close className={styles.close} aria-label="Close run updates"><X size={16} /></Popover.Close>
          </header>
          <div className={styles.toolbar}>
            <div className={styles.viewSwitch} role="group" aria-label="Filter run updates">
              {([['all', 'All'], ['unread', 'Unread'], ['approval', 'Needs approval'], ['finished', 'Finished']] as const).map(([value, label]) => <button key={value} ref={value === "all" ? allFilter : undefined} type="button" aria-pressed={view === value} className={view === value ? styles.viewActive : undefined} onClick={() => { setView(value); setExpanded(null); }}>
                {view === value && <motion.span className={styles.viewHighlight} layoutId={`inbox-view-${userId}`} transition={reducedMotion ? { duration: 0 } : motionSpring} />}
                <span>{label}</span>
              </button>)}
            </div>
          </div>
          <div className={styles.list}>
            {unreadCompleted.length > 0 && <button type="button" className={styles.markAll} onClick={() => { allFilter.current?.focus(); updateSeen([...seen, ...unreadCompleted.map(fingerprint)]); }}><CheckCheck size={14} /><span>Mark completed runs as read</span></button>}
            <div role="list" aria-label="Run updates">
              <AnimatePresence initial={false}>
                {filtered.map((run, index) => {
                  const id = fingerprint(run);
                  const isUnread = unread(run);
                  const approval = run.status === "awaiting_approval";
                  const isExpanded = expanded === id;
                  const meta = RUN_STATUS_META[run.status];
                  const Icon = approval || run.status.startsWith("failed_") ? TriangleAlert : run.status === "succeeded" ? CircleCheck : CircleDot;
                  return <motion.div key={id} role="listitem" className={styles.row} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reducedMotion ? 0 : .18, delay: reducedMotion ? 0 : Math.min(index * .025, .15) }}>
                    <article className={`${styles.item} ${!isUnread ? styles.itemRead : ""} ${isExpanded ? styles.itemExpanded : ""}`}>
                      <div className={styles.itemMain}>
                        <span className={`${styles.eventIcon} ${approval || run.status.startsWith("failed_") ? styles.warning : run.status === "succeeded" ? styles.success : ""}`}><Icon size={21} aria-hidden /></span>
                        <button type="button" className={styles.itemToggle} aria-expanded={isExpanded} aria-controls={`update-${run.id}`} onClick={() => setExpanded(isExpanded ? null : id)}>
                          <span className={styles.itemTitle}><strong>{approval ? "Approval needed" : meta?.label ?? run.status}</strong>{isUnread && <span className={styles.unreadDot} aria-label="Unread" />}</span>
                          <span className={styles.itemPreview}>{run.prompt}</span>
                          <time className={styles.time} dateTime={run.updated_at}>{new Date(run.updated_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                        </button>
                      </div>
                      <div id={`update-${run.id}`}>
                        <AnimatePresence initial={false}>{isExpanded && <motion.div className={styles.details} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reducedMotion ? { duration: 0 } : motionSpring}>
                          <p>{approval ? "This run is waiting for your decision. Open it to review the proposed work." : "Open the run to inspect its results and generated files."}</p>
                          <div className={styles.itemActions}>
                            <Link href={`/runs/${run.id}`} onClick={() => { markRead(run); setOpen(false); }}>{approval ? "Review approval" : "Open run"}<ArrowRight size={13} /></Link>
                            {!approval && <button type="button" onClick={() => { if (view === "unread") { allFilter.current?.focus(); setExpanded(null); } updateSeen(isUnread ? [...seen, id] : seen.filter(value => value !== id)); }}>{isUnread ? <Check size={13} /> : <CircleDot size={13} />}{isUnread ? "Mark read" : "Mark unread"}</button>}
                          </div>
                        </motion.div>}</AnimatePresence>
                      </div>
                    </article>
                  </motion.div>;
                })}
              </AnimatePresence>
            </div>
            {!filtered.length && <div className={styles.empty}>
              {!loaded && !notice ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" size={24} /><strong>Loading run updates…</strong></> : notice && !loaded ? <><TriangleAlert size={24} /><strong>Updates unavailable</strong><p>We’ll retry shortly.</p></> : <><CheckCheck size={26} /><strong>{view === "unread" ? "Nothing unread" : "You’re all caught up."}</strong><p>{view === "approval" ? "No runs need your approval." : "New approvals and results will appear here."}</p></>}
            </div>}
          </div>
          {readItems.length > 0 && <div className={styles.footer}><span>{readItems.length} read</span><button type="button" onClick={clearRead}>Clear read updates</button></div>}
          <div className={styles.preferences}>
            <div><strong>Browser notifications</strong><p>{enabled ? "On while CodeForge is open" : "Get updates while this tab is in the background"}</p></div>
            <Button variant="outline" size="sm" aria-label={enabled ? "Turn off browser notifications" : "Enable browser notifications"} onClick={toggleNotifications}>{enabled ? "Turn off" : "Enable"}</Button>
          </div>
          {notice && <p role="status" className={styles.notice}>{notice}</p>}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

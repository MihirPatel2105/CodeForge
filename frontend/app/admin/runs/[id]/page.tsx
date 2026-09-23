"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, Clock3, Download, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, TestTube2, Workflow } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, downloadAdminArtifact, getToken } from "@/lib/api";
import { formatElapsed, formatTime, formatWhen } from "@/lib/format";
import { RUN_STATUS_META, tone } from "@/lib/tone";
import type { AdminRunDetail, ArtifactRef } from "@/lib/types";
import { cn } from "@/lib/utils";

const TERMINAL = new Set(["succeeded", "failed_max_loops", "failed_sandbox", "failed_llm", "rejected", "cancelled"]);

export default function AdminRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<AdminRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactRef[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { const [run, artifactList] = await Promise.all([api.adminRun(id), api.adminRunArtifacts(id)]); setDetail(run); setArtifacts(artifactList.artifacts); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.replace("/login");
      if (err instanceof ApiError && err.status === 403) return router.replace("/projects");
      setError(err instanceof ApiError ? err.message : "Could not load this run.");
    }
  }, [id, router]);
  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(); }, [id, load, router]);

  const cancelRun = async () => {
    if (reason.trim().length < 3) return setError("Add a short reason before cancelling this run.");
    setBusy(true); setError(null); setNotice(null);
    try { const result = await api.adminCancelRun(id, reason.trim()); setNotice(result.message); setReason(""); setShowCancel(false); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not cancel this run."); }
    finally { setBusy(false); }
  };

  const retryRun = async () => {
    if (reason.trim().length < 3) return setError("Add a short reason before retrying this run.");
    setBusy(true); setError(null); setNotice(null);
    try { const result = await api.adminRetryRun(id, reason.trim()); setNotice(result.message); setReason(""); setShowRetry(false); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not retry this run."); }
    finally { setBusy(false); }
  };

  if (!detail) return <AdminShell><Link href="/admin/runs" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-muted"><ArrowLeft className="h-4 w-4" aria-hidden />Runs</Link>{error ? <p role="alert" className="mt-6 text-[13px] text-danger">{error}</p> : <div className="flex min-h-[55vh] items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-accent" aria-label="Loading run" /></div>}</AdminShell>;

  const { run } = detail;
  const meta = RUN_STATUS_META[run.status] ?? { label: run.status, tone: "neutral" as const };
  const canCancel = run.is_live || !TERMINAL.has(run.status);
  const facts = [
    { label: "Acceptance", value: run.acceptance_level ?? "Pending", icon: ShieldCheck },
    { label: "Tests", value: run.test_pass_ratio == null ? "Pending" : `${Math.round(run.test_pass_ratio * 100)}% passed`, icon: TestTube2 },
    { label: "Iterations", value: String(run.iterations), icon: Workflow },
    { label: "Elapsed", value: run.end_to_end_ms == null ? "In progress" : formatElapsed(run.end_to_end_ms), icon: Clock3 },
  ];

  return <AdminShell>
    <Link href="/admin/runs" className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.1em] text-fg-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden />Back to runs</Link>
    <AdminPageHeader eyebrow={`run / ${run.id}`} title={run.project_name} description={run.prompt} actions={<div className="flex gap-2">{TERMINAL.has(run.status) ? <Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => setShowRetry((value) => !value)}><RotateCcw className="h-4 w-4" aria-hidden />Retry run</Button> : null}{canCancel ? <Button variant="outline" className="h-10 gap-2 rounded-[3px] border-danger-bd text-danger" onClick={() => setShowCancel((value) => !value)}><Ban className="h-4 w-4" aria-hidden />Cancel run</Button> : null}</div>} />
    <div className="mt-4 flex flex-wrap items-center gap-3"><span className={cn("rounded-full px-2.5 py-1 font-mono text-[9px] font-[700] uppercase tracking-[0.08em]", tone[meta.tone].soft)}>{meta.label}</span><span className={ADMIN_LABEL}>{run.user_email}</span><span className={ADMIN_LABEL}>Started {formatWhen(run.created_at)}</span></div>
    {error ? <p role="alert" className="mt-6 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}
    {notice ? <p role="status" className="mt-6 rounded-[3px] border border-ok-bd bg-ok-soft px-4 py-3 text-[13px] text-ok">{notice}</p> : null}
    {showCancel ? <section className="mt-6 rounded-[6px] border border-danger-bd bg-danger-soft p-5" aria-labelledby="cancel-run-heading"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden /><div className="flex-1"><h2 id="cancel-run-heading" className="text-[14px] font-[700] text-fg">Stop this pipeline</h2><p className="mt-1 text-[12px] leading-5 text-fg-muted">The executor task is cancelled, the run becomes terminal, and the reason is audited.</p><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for cancellation" maxLength={240} className="mt-4 h-10 rounded-[3px] bg-surface" /><div className="mt-3 flex gap-2"><Button className="h-9 rounded-[3px] bg-danger text-white hover:bg-danger/90" disabled={busy} onClick={cancelRun}>{busy ? "Cancelling…" : "Confirm cancellation"}</Button><Button variant="ghost" className="h-9 rounded-[3px]" onClick={() => setShowCancel(false)}>Keep running</Button></div></div></div></section> : null}
    {showRetry ? <section className="mt-6 rounded-[6px] border border-accent-bd bg-accent-soft p-5"><h2 className="text-[14px] font-[700] text-fg">Retry as a new run</h2><p className="mt-1 text-[12px] text-fg-muted">The original evidence stays unchanged. A new audited run starts with the same prompt and RAG mode.</p><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for retry" maxLength={240} className="mt-4 h-10 rounded-[3px] bg-surface" /><div className="mt-3 flex gap-2"><Button disabled={busy} onClick={retryRun}>Start retry</Button><Button variant="ghost" onClick={() => setShowRetry(false)}>Cancel</Button></div></section> : null}

    <dl className="mt-7 grid overflow-hidden rounded-[6px] border border-border bg-surface sm:grid-cols-2 lg:grid-cols-4">{facts.map(({ label, value, icon: Icon }, index) => <div key={label} className={cn("p-5", index % 2 === 1 && "sm:border-l", index > 1 && "sm:border-t", index < 4 && "lg:border-t-0", index % 4 !== 0 && "lg:border-l", index % 4 === 0 && "lg:border-l-0")}><div className="flex items-center justify-between"><dt className={ADMIN_LABEL}>{label}</dt><Icon className="h-4 w-4 text-fg-faint" aria-hidden /></div><dd className="font-display mt-4 text-[20px] font-[650] tracking-[-0.04em] text-fg">{value}</dd></div>)}</dl>

    <section className="mt-10" aria-labelledby="artifacts-heading"><AdminSectionHeading eyebrow="generated evidence" title="Artifacts and failure details" id="artifacts-heading" /><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-[6px] border border-border bg-surface p-5">{artifacts.length ? artifacts.map((artifact) => <button key={artifact.file_id} onClick={() => downloadAdminArtifact(id, artifact.file_id, artifact.filename.split("/").pop() ?? artifact.filename)} className="flex w-full items-center justify-between border-b border-rule py-3 text-left last:border-b-0"><span><span className="block text-[12px] font-[650] text-fg">{artifact.kind.replaceAll("_", " ")}</span><span className="font-mono text-[9px] text-fg-faint">iteration {artifact.iteration} · {artifact.length.toLocaleString()} bytes</span></span><Download className="h-4 w-4 text-accent" aria-hidden /></button>) : <p className="text-[12px] text-fg-faint">No artifacts were persisted for this run.</p>}</div><pre className="max-h-72 overflow-auto rounded-[6px] border border-border bg-[#111318] p-4 font-mono text-[10px] leading-5 text-[#d5d9e2]">{JSON.stringify({ errors: detail.state.errors ?? [], llm_attempts: detail.state.llm_attempts ?? [], sandbox: detail.state.sandbox ?? null }, null, 2)}</pre></div></section>

    <section className="mt-10" aria-labelledby="timeline-heading"><AdminSectionHeading eyebrow="event replay" title="Durable timeline" id="timeline-heading" /><div className="mt-5 overflow-hidden rounded-[6px] border border-border bg-surface">{detail.events.length === 0 ? <p className="px-5 py-12 text-center text-[13px] text-fg-faint">No events recorded yet.</p> : detail.events.map((event, index) => { const kind = String(event.event ?? "event"); const at = typeof event.at === "string" ? formatTime(event.at) : "--:--:--"; const agent = typeof event.agent === "string" ? event.agent : "system"; const loop = kind === "loop.iteration"; return <div key={`${kind}-${index}`} className={cn("grid gap-2 border-b border-rule px-4 py-3 last:border-b-0 md:grid-cols-[78px_100px_150px_1fr]", loop && "border-loop-bd bg-loop-soft")}><span className="font-mono text-[10px] text-fg-faint">{at}</span><span className={cn("font-mono text-[10px] font-[700] uppercase tracking-[0.08em]", loop ? "text-loop" : "text-fg-muted")}>{agent}</span><span className="font-mono text-[10px] text-fg-faint">{kind}</span><span className="text-[12.5px] leading-5 text-fg-muted">{eventText(event)}</span></div>; })}</div></section>
  </AdminShell>;
}

function eventText(event: Record<string, unknown>): string {
  if (typeof event.text === "string") return event.text;
  if (typeof event.message === "string") return event.message;
  if (typeof event.reason === "string") return event.reason;
  if (typeof event.path === "string") return `${event.path} written`;
  if (event.event === "tests.result") return `${String(event.total ?? 0)} tests, ${String(event.failed ?? 0)} failed`;
  if (event.event === "loop.iteration") return `Iteration ${String(event.iteration ?? "—")} returned work to the Coder`;
  return "State transition recorded";
}

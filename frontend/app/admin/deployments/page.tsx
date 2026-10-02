"use client";
import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";
import { formatWhen } from "@/lib/format";
import { AdminShell, AdminPageHeader } from "@/components/admin/admin-shell";
import { RefreshStatus } from "@/components/admin/refresh-status";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { AdminDeployment } from "@/lib/types";

export default function AdminDeploymentsPage() {
  const { data, error, loading, refresh, updatedAt } = useAdminResource(api.adminDeployments);
  const [target, setTarget] = useState<AdminDeployment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function stop() {
    if (!target || reason.trim().length < 3) return;
    setBusy(true); setActionError(null);
    try { const result = await api.adminStopDeployment(target.id, reason.trim()); setNotice(result.message); setTarget(null); setReason(""); await refresh(); }
    catch (err) { setActionError(err instanceof ApiError ? err.message : "Could not stop this API. Try again."); }
    finally { setBusy(false); }
  }
  const userId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("user_id") : null;
  const items = data?.items.filter(item => !userId || item.user_id === userId);
  return <AdminShell><AdminPageHeader eyebrow="published APIs" title="API hosting" description="Inspect published API ownership, runtime readiness, and memory usage." actions={<Button variant="outline" disabled={loading} onClick={() => void refresh()}>Check runtimes</Button>} />
    <RefreshStatus at={updatedAt} loading={loading} />
    {error && <Notice className="mt-4">{error}</Notice>}{notice && <Notice variant="info" className="mt-4">{notice}</Notice>}
    <p className="mt-5 text-sm font-semibold">{data ? `${data.items.length} of ${data.capacity} hosting slots in use` : "Loading hosting capacity…"}</p>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">{items?.map(item => <article key={item.id} className="min-w-0 rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">{item.project_name}</h2><span className={`rounded-full px-2.5 py-1 text-xs ${item.runtime_status === "ready" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{item.status === "deleting" ? "Cleanup pending" : item.runtime_status}</span></div>
      <Link href={`/admin/users/${item.user_id}`} className="mt-2 block break-all text-xs text-accent">{item.user_email}</Link>
      <p className="mt-4 text-xs leading-5 text-fg-muted">{item.detail}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-fg-muted">Published</dt><dd className="mt-1">{formatWhen(item.created_at)}</dd></div><div><dt className="text-fg-muted">Runtime started</dt><dd className="mt-1">{item.started_at ? formatWhen(item.started_at) : "Not observed"}</dd></div><div><dt className="text-fg-muted">Memory usage</dt><dd className="mt-1">{item.memory_bytes == null ? "Not observed" : `${(item.memory_bytes / 1048576).toFixed(1)} MB`}{item.memory_limit_bytes != null && ` / ${(item.memory_limit_bytes / 1048576).toFixed(0)} MB`}</dd></div></dl>
      <div className="mt-5 flex flex-wrap items-center gap-3"><Link className="text-xs font-semibold text-accent" href={`/admin/runs/${item.run_id}`}>Inspect source run →</Link><Button variant="outline" size="sm" className="text-danger" onClick={() => { setTarget(item); setReason(""); setActionError(null); }}>Stop API</Button></div>
    </article>)}</div>
    {items?.length === 0 && <Notice variant="info" className="mt-5">No APIs are published.</Notice>}
    <p className="mt-4 text-xs leading-5 text-fg-muted">Readiness reflects the container and its startup marker. It does not measure endpoint availability or historical uptime.</p>
    <Dialog open={Boolean(target)} onOpenChange={open => { if (!open && !busy) setTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Stop {target?.project_name}?</DialogTitle><DialogDescription>The API will become unavailable. Its container and stored API data will be removed. The owner can publish the source run again. This action is audited.</DialogDescription></DialogHeader><label className="text-xs font-semibold">Reason<Input value={reason} onChange={e => setReason(e.target.value)} maxLength={240} className="mt-2" placeholder="Why does this API need to stop?" /></label>{actionError && <Notice>{actionError}</Notice>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>Keep API</Button><Button className="bg-danger text-white hover:bg-danger/90" disabled={busy || reason.trim().length < 3} onClick={() => void stop()}>{busy ? "Stopping…" : "Confirm stop"}</Button></div></DialogContent></Dialog>
  </AdminShell>;
}

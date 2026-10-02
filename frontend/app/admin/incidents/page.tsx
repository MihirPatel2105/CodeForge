"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";
import { formatWhen } from "@/lib/format";
import { AdminShell, AdminPageHeader } from "@/components/admin/admin-shell";
import { RefreshStatus } from "@/components/admin/refresh-status";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import type { AdminIncident } from "@/lib/types";

export default function AdminIncidentsPage() {
  const { data, error, loading, refresh, updatedAt } = useAdminResource(api.adminIncidents);
  const [filter, setFilter] = useState("unresolved");
  return <AdminShell><AdminPageHeader eyebrow="operator follow-up" title="Incidents" description="Failures from the last seven days, grouped by outcome and UTC day. New failures reopen a group." actions={<Button variant="outline" disabled={loading} onClick={() => void refresh()}>Refresh</Button>} /><RefreshStatus at={updatedAt} loading={loading} />{error && <Notice className="mt-4">{error}</Notice>}
    <div className="mt-5 flex flex-wrap gap-2">{["unresolved", "all", "resolved"].map(value => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</Button>)}</div>
    <div className="mt-5 space-y-4">{data?.items.filter(item => filter === "all" || (filter === "resolved" ? item.status === "resolved" : item.status !== "resolved")).map(item => <IncidentCard key={item.key} item={item} refresh={refresh} />)}</div>
    {data && !data.items.some(item => filter === "all" || (filter === "resolved" ? item.status === "resolved" : item.status !== "resolved")) && <Notice variant="info" className="mt-5">No incidents in this view.</Notice>}
  </AdminShell>;
}
function IncidentCard({ item, refresh }: { item: AdminIncident; refresh: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<AdminIncident["status"]>(item.status);
  useEffect(() => { setStatus(item.status); }, [item.status]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try { await api.adminUpdateIncident(item.key, status, note.trim()); setNote(""); await refresh(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not save the incident."); }
    finally { setBusy(false); }
  }
  return <article className="rounded-3xl border border-border bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-xs text-fg-muted">{item.count} affected runs · latest {formatWhen(item.latest_at)}</p></div><span className="rounded-full bg-surface-2 px-3 py-1 text-xs">{item.status}</span></div><Link href={`/admin/runs/${item.sample_run_id}`} className="mt-3 inline-block text-xs font-semibold text-accent">Inspect latest failure →</Link>
    {item.notes.length > 0 && <details className="mt-4 text-xs"><summary className="cursor-pointer font-semibold">Internal notes ({item.notes.length})</summary><ul className="mt-3 space-y-3">{item.notes.map((entry, i) => <li key={`${entry.at}:${i}`} className="rounded-xl bg-surface-2 p-3"><p className="break-words whitespace-pre-wrap leading-5">{entry.text}</p><p className="mt-1 break-all text-fg-muted">{entry.admin_email} · {formatWhen(entry.at)}</p></li>)}</ul></details>}
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px]"><label className="text-xs font-semibold">Internal note<Textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Record what you checked or how this was resolved." className="mt-2 min-h-20" /></label><div><label htmlFor={`incident-status-${item.key}`} className="text-xs font-semibold">Status</label><select id={`incident-status-${item.key}`} value={status} onChange={e => setStatus(e.target.value as AdminIncident["status"])} className="cf-project-select mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3"><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select></div></div>{error && <Notice className="mt-3">{error}</Notice>}<Button className="mt-3" size="sm" disabled={busy || note.trim().length < 3} onClick={() => void save()}>{busy ? "Saving…" : "Save update"}</Button>
  </article>;
}

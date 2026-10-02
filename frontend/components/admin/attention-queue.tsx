"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { RefreshStatus } from "./refresh-status";

export function AttentionQueue() {
  const { data, error, loading, refresh, updatedAt } = useAdminResource(api.adminAttention);
  return <section className="pt-8" aria-labelledby="operator-queue-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="operator-queue-heading" className="text-xl font-semibold">Needs attention</h2><p className="mt-1 text-xs text-fg-muted">Oldest active work first. Failures from the last seven days.</p></div><Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>Refresh queue</Button></div>
    <RefreshStatus at={updatedAt} loading={loading} />
    {error && <Notice className="mt-3">{error}</Notice>}
    <div className="mt-4 space-y-3">{data?.items.slice(0, 12).map(item => <div key={item.run.id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.priority === "urgent" ? "bg-danger-soft text-danger" : item.priority === "review" ? "bg-warn-soft text-warn" : "bg-surface-2 text-fg-muted"}`}>{item.priority === "urgent" ? "Check progress" : item.priority === "review" ? "Approval needed" : item.run.status.replaceAll("_", " ")}</span><span className="text-xs text-fg-muted">{item.waiting_minutes} min since update</span></div><p className="mt-2 text-sm font-semibold">{item.run.project_name}</p><Link className="mt-1 block w-fit break-all text-xs text-accent" href={`/admin/users/${item.run.user_id}`}>{item.run.user_email}</Link><p className="mt-2 text-xs leading-5 text-fg-muted">{item.reason}</p>{item.guidance && <p className="mt-1 text-xs leading-5">{item.guidance.next_step}</p>}</div>
      <Link href={`/admin/runs/${item.run.id}`} className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-accent hover:bg-accent-soft">Inspect run →</Link>
    </div>)}</div>
    {data?.total === 0 && <Notice variant="info" className="mt-4">No active workflows or recent failures need review.</Notice>}
    {data && data.total > Math.min(data.items.length, 12) && <p className="mt-3 text-xs text-fg-muted">Showing {Math.min(data.items.length, 12)} of {data.total} candidates. <Link href="/admin/runs" className="text-accent">Browse all runs →</Link></p>}
    <p className="mt-3 text-[11px] text-fg-muted">Progress checks flag 15 minutes without a recorded update; approval waits become urgent after 30 minutes. These are review cues.</p>
  </section>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Download, RefreshCw } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, downloadAdminCsv, getToken } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { AdminAuditEntry, AdminPageInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminAuditPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [pagination, setPagination] = useState<AdminPageInfo | null>(null);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (page = 1) => { setLoading(true); setError(null); try { const result = await api.adminAuditLog({ action, date_from: from || undefined, date_to: to ? `${to}T23:59:59Z` : undefined, page }); setEntries(result.items); setPagination(result.pagination); } catch (err) { if (err instanceof ApiError && err.status === 401) return router.replace("/login"); if (err instanceof ApiError && err.status === 403) return router.replace("/projects"); setError(err instanceof ApiError ? err.message : "Could not load the audit log."); } finally { setLoading(false); } }, [action, from, router, to]);
  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(); }, [load, router]);

  return <AdminShell>
    <AdminPageHeader eyebrow="accountability" title="Audit log" description="Filter and export the durable record of sensitive administrator actions." actions={<div className="flex gap-2"><Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => downloadAdminCsv("audit-log")}><Download className="h-4 w-4" aria-hidden />Export CSV</Button><Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => load(pagination?.page ?? 1)} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Refresh</Button></div>} />
    {error ? <p role="alert" className="mt-6 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}
    <div className="mt-6 grid gap-3 rounded-[6px] border border-border bg-surface p-4 md:grid-cols-3"><Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action, for example user.suspended" className="h-10 rounded-[3px]" /><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Audit from date" className="h-10 rounded-[3px]" /><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Audit to date" className="h-10 rounded-[3px]" /><Button onClick={() => load()} disabled={loading}>Apply filters</Button></div>
    <div className="mt-5 overflow-hidden rounded-[6px] border border-border bg-surface"><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="bg-surface-2"><tr>{["Action", "Administrator", "Target", "Reason", "Recorded"].map((label) => <th key={label} className={cn(ADMIN_LABEL, "border-b border-rule px-4 py-3")}>{label}</th>)}</tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-b border-rule last:border-b-0"><td className="px-4 py-4"><span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-accent"><ClipboardCheck className="h-3 w-3" aria-hidden />{entry.action.replaceAll(".", " ")}</span></td><td className="px-4 py-4 font-mono text-[10.5px] text-fg-muted">{entry.admin_email}</td><td className="px-4 py-4"><p className="text-[11px] font-[650] text-fg">{entry.target_type}</p><p className="mt-1 max-w-[180px] truncate font-mono text-[9.5px] text-fg-faint">{entry.target_id}</p></td><td className="max-w-[360px] px-4 py-4 text-[12px] leading-5 text-fg-muted">{entry.reason}</td><td className="px-4 py-4 font-mono text-[10.5px] text-fg-faint">{formatWhen(entry.created_at)}</td></tr>)}{entries.length === 0 && !loading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-fg-faint">No admin actions match these filters.</td></tr> : null}</tbody></table></div></div>
    {pagination ? <div className="mt-4 flex items-center justify-between"><p className={ADMIN_LABEL}>{pagination.total} records · page {pagination.page} of {pagination.pages}</p><div className="flex gap-2"><Button variant="outline" disabled={pagination.page <= 1 || loading} onClick={() => load(pagination.page - 1)}>Previous</Button><Button variant="outline" disabled={pagination.page >= pagination.pages || loading} onClick={() => load(pagination.page + 1)}>Next</Button></div></div> : null}
  </AdminShell>;
}

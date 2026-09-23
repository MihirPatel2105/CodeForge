"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Download, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, downloadAdminCsv, getToken } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { AdminPageInfo, AdminUserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminUsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [pagination, setPagination] = useState<AdminPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search = "", page = 1) => {
    setLoading(true); setError(null);
    try { const result = await api.adminUsers({ q: search, date_from: from || undefined, date_to: to ? `${to}T23:59:59Z` : undefined, page }); setUsers(result.items); setPagination(result.pagination); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.replace("/login");
      if (err instanceof ApiError && err.status === 403) return router.replace("/projects");
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    } finally { setLoading(false); }
  }, [from, router, to]);

  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(); }, [load, router]);
  const submit = (event: FormEvent) => { event.preventDefault(); void load(query); };

  return (
    <AdminShell>
      <AdminPageHeader eyebrow="access and support" title="Users" description="Find an account, verify access, apply limits, and resolve compromised sessions with audited actions." actions={<div className="flex gap-2"><Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => downloadAdminCsv("users")}><Download className="h-4 w-4" aria-hidden />Export CSV</Button><Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => load(query, pagination?.page ?? 1)} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Refresh</Button></div>} />
      {error ? <p role="alert" className="mt-6 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}
      <form onSubmit={submit} className="mt-7 grid max-w-4xl gap-2 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]"><label className="relative block"><span className="sr-only">Search users</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" aria-hidden /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" className="h-10 rounded-[3px] pl-9" /></label><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Users from date" className="h-10 rounded-[3px]" /><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Users to date" className="h-10 rounded-[3px]" /><Button type="submit" className="h-10 rounded-[3px]" disabled={loading}>Search</Button></form>
      <div className="mt-5 overflow-hidden rounded-[6px] border border-border bg-surface">
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-surface-2"><tr>{["Account", "Projects", "Runs", "Succeeded", "Last activity", ""].map((label) => <th key={label} className={cn(ADMIN_LABEL, "border-b border-rule px-4 py-3")}>{label}</th>)}</tr></thead><tbody>
          {users.map((user) => <tr key={user.id} className="border-b border-rule last:border-b-0 hover:bg-surface-2/60"><td className="px-4 py-4"><div className="flex items-center gap-2"><p className="text-[13px] font-[650] text-fg">{[user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed user"}</p>{user.is_admin ? <ShieldCheck className="h-4 w-4 text-accent" aria-label="Administrator" /> : null}{user.is_suspended ? <span className="rounded-full bg-danger-soft px-2 py-1 font-mono text-[8px] font-[700] uppercase text-danger">Suspended</span> : null}{user.email_verified ? <span className="rounded-full bg-ok-soft px-2 py-1 font-mono text-[8px] font-[700] uppercase text-ok">Verified</span> : null}</div><p className="mt-1 font-mono text-[10.5px] text-fg-faint">{user.email}</p></td><td className="px-4 py-4 font-mono text-[12px] text-fg-muted">{user.project_count}</td><td className="px-4 py-4 font-mono text-[12px] text-fg-muted">{user.run_count}</td><td className="px-4 py-4 font-mono text-[12px] text-fg-muted">{user.succeeded_runs}</td><td className="px-4 py-4 font-mono text-[10.5px] text-fg-faint">{user.last_activity_at ? formatWhen(user.last_activity_at) : "No runs"}</td><td className="px-4 py-4 text-right"><Link href={`/admin/users/${user.id}`} aria-label={`Open ${user.email}`} className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-border text-fg-faint hover:border-fg hover:text-fg"><ArrowUpRight className="h-4 w-4" aria-hidden /></Link></td></tr>)}
          {users.length === 0 && !loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-fg-faint">No accounts match this search.</td></tr> : null}
        </tbody></table></div>
      </div>
      {pagination ? <div className="mt-4 flex items-center justify-between"><p className={ADMIN_LABEL}>{pagination.total} accounts · page {pagination.page} of {pagination.pages}</p><div className="flex gap-2"><Button variant="outline" disabled={pagination.page <= 1 || loading} onClick={() => load(query, pagination.page - 1)}>Previous</Button><Button variant="outline" disabled={pagination.page >= pagination.pages || loading} onClick={() => load(query, pagination.page + 1)}>Next</Button></div></div> : null}
    </AdminShell>
  );
}

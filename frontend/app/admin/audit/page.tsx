"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Download, RefreshCw, SearchX } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, downloadAdminCsv, getToken } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { AdminAuditEntry, AdminPageInfo } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

type AuditFilters = { action: string; from: string; to: string };
const COLUMNS = ["Action", "Administrator", "Target", "Reason", "Recorded"];

export default function AdminAuditPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [pagination, setPagination] = useState<AdminPageInfo | null>(null);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const filters = useMemo(() => ({ action, from, to }), [action, from, to]);
  const debouncedFilters = useDebouncedValue(filters);
  const hasFilters = Boolean(action || from || to);
  const load = useCallback(async (next: AuditFilters, page = 1) => { const requestId = ++requestSequence.current; setLoading(true); setError(null); try { const result = await api.adminAuditLog({ action: next.action, date_from: next.from || undefined, date_to: next.to ? `${next.to}T23:59:59Z` : undefined, page }); if (requestId !== requestSequence.current) return; setEntries(result.items); setPagination(result.pagination); } catch (err) { if (requestId !== requestSequence.current) return; if (err instanceof ApiError && err.status === 401) return router.replace("/login"); if (err instanceof ApiError && err.status === 403) return router.replace("/projects"); setError(err instanceof ApiError ? err.message : "Could not load the audit log."); } finally { if (requestId === requestSequence.current) setLoading(false); } }, [router]);
  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(debouncedFilters); }, [debouncedFilters, load, router]);

  function clearFilters() {
    setAction("");
    setFrom("");
    setTo("");
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="accountability"
        title="Audit log"
        description="Filter and export the durable record of sensitive administrator actions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => downloadAdminCsv("audit-log")}>
              <Download className="h-4 w-4" aria-hidden />Export CSV
            </Button>
            <Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => load(debouncedFilters, pagination?.page ?? 1)} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin motion-reduce:animate-none")} aria-hidden />Refresh
            </Button>
          </div>
        }
      />

      {error ? <p role="alert" className="mt-6 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}

      <section className="mt-6 rounded-[6px] border border-border bg-surface p-4 sm:p-5" aria-label="Audit log filters">
        <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(150px,190px)_minmax(150px,190px)]">
          <label className="block min-w-0">
            <span className={ADMIN_LABEL}>Action</span>
            <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="e.g. user.suspended" className="mt-2 h-10 rounded-[3px]" />
          </label>
          <label className="block min-w-0">
            <span className={ADMIN_LABEL}>From date</span>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-2 h-10 rounded-[3px]" />
          </label>
          <label className="block min-w-0">
            <span className={ADMIN_LABEL}>To date</span>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-2 h-10 rounded-[3px]" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
          <p className="text-[12px] leading-5 text-fg-muted">Results update as you type.</p>
          {hasFilters ? <Button variant="ghost" className="h-8 rounded-[3px] text-[12px]" onClick={clearFilters}>Clear filters</Button> : null}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[6px] border border-border bg-surface" aria-label="Audit records" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="h-4 w-4 text-accent" aria-hidden />
            <h2 className="font-display text-[16px] font-[650] tracking-[-0.03em] text-fg">Recorded actions</h2>
          </div>
          <p className={ADMIN_LABEL}>{loading ? "Updating…" : `${pagination?.total ?? entries.length} records`}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead className="bg-surface-2/75">
              <tr>{COLUMNS.map((label) => <th key={label} scope="col" className={cn(ADMIN_LABEL, "border-b border-rule px-4 py-3.5 first:pl-5 last:pr-5")}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? Array.from({ length: 4 }, (_, index) => (
                <tr key={index} className="border-b border-rule last:border-b-0" aria-hidden>
                  {COLUMNS.map((column) => <td key={column} className="px-4 py-5"><div className="h-3 w-3/4 rounded-[2px] bg-surface-2" /></td>)}
                </tr>
              )) : entries.map((entry) => (
                <tr key={entry.id} className="border-b border-rule align-top transition-colors last:border-b-0 hover:bg-accent-soft/25">
                  <td className="py-4 pr-4 pl-5">
                    <span className="inline-flex max-w-[220px] items-center rounded-[2px] border border-accent-bd bg-accent-soft px-2.5 py-1 font-mono text-[11px] font-[700] leading-4 text-accent break-all">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[12px] leading-5 text-fg break-all">{entry.admin_email}</td>
                  <td className="px-4 py-4">
                    <p className="text-[12px] font-[650] leading-5 text-fg">{entry.target_type}</p>
                    <p className="mt-1 max-w-[190px] font-mono text-[10.5px] leading-4 text-fg-muted break-all">{entry.target_id}</p>
                  </td>
                  <td className="max-w-[360px] px-4 py-4 text-[12.5px] leading-5 text-fg-muted break-words">{entry.reason || "—"}</td>
                  <td className="whitespace-nowrap py-4 pr-5 pl-4 font-mono text-[11px] leading-5 text-fg-muted">{formatWhen(entry.created_at)}</td>
                </tr>
              ))}
              {entries.length === 0 && !loading ? (
                <tr><td colSpan={5}>
                  <div className="flex flex-col items-center px-5 py-14 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-border bg-surface-2 text-fg-muted"><SearchX className="h-5 w-5" aria-hidden /></span>
                    <p className="font-display mt-4 text-[17px] font-[650] text-fg">No actions found</p>
                    <p className="mt-1 max-w-[34ch] text-[13px] leading-5 text-fg-muted">{hasFilters ? "Try another action or date range." : "Administrator actions will appear here when recorded."}</p>
                    {hasFilters ? <Button variant="outline" className="mt-4 rounded-[3px]" onClick={clearFilters}>Clear filters</Button> : null}
                  </div>
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {pagination ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className={ADMIN_LABEL}>{pagination.total} records · page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={pagination.page <= 1 || loading} onClick={() => load(debouncedFilters, pagination.page - 1)}>Previous</Button>
            <Button variant="outline" disabled={pagination.page >= pagination.pages || loading} onClick={() => load(debouncedFilters, pagination.page + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

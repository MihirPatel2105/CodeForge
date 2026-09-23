"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Filter, RefreshCw, Search } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { AdminRunTable } from "@/components/admin/run-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, downloadAdminCsv, getToken } from "@/lib/api";
import type { AdminPageInfo, AdminRunSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filters = { q: string; status: string; rag_enabled: string; acceptance_level: string; failure_category: string; date_from: string; date_to: string };
const EMPTY: Filters = { q: "", status: "", rag_enabled: "", acceptance_level: "", failure_category: "", date_from: "", date_to: "" };
const SELECT = "h-10 rounded-[3px] border border-border bg-surface px-3 text-[12px] text-fg outline-none focus:border-fg";

export default function AdminRunsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [runs, setRuns] = useState<AdminRunSummary[]>([]);
  const [pagination, setPagination] = useState<AdminPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next: Filters, page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.adminRuns({
        q: next.q,
        status: next.status,
        rag_enabled: next.rag_enabled === "" ? undefined : next.rag_enabled === "true",
        acceptance_level: next.acceptance_level,
        failure_category: next.failure_category,
        date_from: next.date_from || undefined,
        date_to: next.date_to ? `${next.date_to}T23:59:59Z` : undefined,
        page,
      });
      setRuns(result.items); setPagination(result.pagination);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.replace("/login");
      if (err instanceof ApiError && err.status === 403) return router.replace("/projects");
      setError(err instanceof ApiError ? err.message : "Could not load runs.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) return router.replace("/login");
    void load(EMPTY);
  }, [load, router]);

  const submit = (event: FormEvent) => { event.preventDefault(); void load(filters); };
  const clear = () => { setFilters(EMPTY); void load(EMPTY); };
  const set = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <AdminShell>
      <AdminPageHeader eyebrow="run operations" title="Runs" description="Search every workspace run, isolate failures, retry safely, and export operational data." actions={<div className="flex gap-2"><Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => downloadAdminCsv("runs")}><Download className="h-4 w-4" aria-hidden />Export CSV</Button><Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={() => load(filters, pagination?.page ?? 1)} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Refresh</Button></div>} />
      {error ? <p role="alert" className="mt-6 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}

      <form onSubmit={submit} className="mt-7 grid gap-3 rounded-[6px] border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Search prompts</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" aria-hidden />
          <Input value={filters.q} onChange={(event) => set("q", event.target.value)} placeholder="Search run prompt" className="h-10 rounded-[3px] pl-9" />
        </label>
        <select aria-label="Run status" className={SELECT} value={filters.status} onChange={(event) => set("status", event.target.value)}><option value="">Any status</option><option value="queued">Queued</option><option value="running">Running</option><option value="awaiting_approval">Awaiting approval</option><option value="succeeded">Succeeded</option><option value="failed_llm">LLM failure</option><option value="failed_sandbox">Sandbox failure</option><option value="failed_max_loops">Max loops</option><option value="cancelled">Cancelled</option><option value="rejected">Rejected</option></select>
        <select aria-label="Acceptance level" className={SELECT} value={filters.acceptance_level} onChange={(event) => set("acceptance_level", event.target.value)}><option value="">Any level</option>{[5,4,3,2,1,0].map((level) => <option key={level} value={`L${level}`}>L{level}</option>)}</select>
        <select aria-label="RAG mode" className={SELECT} value={filters.rag_enabled} onChange={(event) => set("rag_enabled", event.target.value)}><option value="">RAG on or off</option><option value="true">RAG enabled</option><option value="false">RAG disabled</option></select>
        <select aria-label="Failure category" className={SELECT} value={filters.failure_category} onChange={(event) => set("failure_category", event.target.value)}><option value="">Any failure</option><option value="llm">LLM</option><option value="sandbox">Sandbox</option><option value="max_loops">Max loops</option><option value="tests">Tests</option><option value="review">Review</option></select>
        <Input aria-label="Runs from date" type="date" value={filters.date_from} onChange={(event) => set("date_from", event.target.value)} className="h-10 rounded-[3px]" />
        <Input aria-label="Runs to date" type="date" value={filters.date_to} onChange={(event) => set("date_to", event.target.value)} className="h-10 rounded-[3px]" />
        <div className="flex gap-2"><Button type="submit" className="h-10 flex-1 gap-2 rounded-[3px]" disabled={loading}><Filter className="h-4 w-4" aria-hidden />Apply</Button><Button type="button" variant="ghost" className="h-10 rounded-[3px]" onClick={clear}>Clear</Button></div>
      </form>
      <div className="mt-4 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-faint">{loading ? "Loading…" : `${pagination?.total ?? runs.length} runs`}</p><p className="text-[11px] text-fg-faint">Newest first · 25 per page</p></div>
      <div className="mt-3"><AdminRunTable runs={runs} /></div>
      {pagination ? <div className="mt-4 flex items-center justify-between"><p className={ADMIN_LABEL}>Page {pagination.page} of {pagination.pages}</p><div className="flex gap-2"><Button variant="outline" disabled={pagination.page <= 1 || loading} onClick={() => load(filters, pagination.page - 1)}>Previous</Button><Button variant="outline" disabled={pagination.page >= pagination.pages || loading} onClick={() => load(filters, pagination.page + 1)}>Next</Button></div></div> : null}
    </AdminShell>
  );
}

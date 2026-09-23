"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, RefreshCw, ServerCog, Users, Workflow } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { AdminRunTable } from "@/components/admin/run-table";
import { Button } from "@/components/ui/button";
import { api, ApiError, getToken } from "@/lib/api";
import type { AdminOverviewResponse, AdminSystemHealthResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [health, setHealth] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, healthData] = await Promise.all([api.adminOverview(), api.adminSystemHealth()]);
      setOverview(overviewData);
      setHealth(healthData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.replace("/login");
      if (err instanceof ApiError && err.status === 403) return router.replace("/projects");
      setError(err instanceof ApiError ? err.message : "Could not load the admin overview.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) return router.replace("/login");
    void load();
  }, [load, router]);

  const attentionRuns = useMemo(
    () => overview?.recent_runs.filter((run) => run.is_live || run.status === "awaiting_approval" || run.status.startsWith("failed_")) ?? [],
    [overview],
  );
  const degraded = health?.services.filter((item) => item.status !== "healthy") ?? [];

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="platform operations"
        title="Admin control centre"
        description="See what needs attention, trace platform quality, and take a small set of audited support actions."
        actions={<RefreshButton loading={loading} onClick={load} />}
      />
      {error ? <ErrorBanner message={error} /> : null}

      <section className="pt-8" aria-labelledby="overview-heading">
        <AdminSectionHeading eyebrow="01 / overview" title="Platform at a glance" id="overview-heading" />
        <MetricGrid overview={overview} loading={loading} />
      </section>

      <section className="pt-12" aria-labelledby="attention-heading">
        <div className="flex items-end justify-between gap-4">
          <AdminSectionHeading eyebrow="02 / attention queue" title="What needs an operator" detail="Live, approval-blocked, and recently failed runs appear here." id="attention-heading" />
          <Link href="/admin/runs" className={cn(ADMIN_LABEL, "inline-flex items-center gap-2 text-fg-muted hover:text-fg")}>All runs <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
        <div className="mt-5"><AdminRunTable runs={attentionRuns.slice(0, 6)} emptyLabel="Nothing needs attention right now." /></div>
      </section>

      <section className="grid gap-8 pt-12 xl:grid-cols-[1fr_340px]" aria-labelledby="recent-heading">
        <div className="min-w-0">
          <AdminSectionHeading eyebrow="03 / activity" title="Recent runs" id="recent-heading" />
          <div className="mt-5"><AdminRunTable runs={overview?.recent_runs ?? []} /></div>
        </div>
        <div className="min-w-0">
          <AdminSectionHeading eyebrow="04 / system" title="Service posture" id="service-heading" />
          <div className="mt-5 overflow-hidden rounded-[6px] border border-border bg-surface">
            {(health?.services ?? []).map((service) => (
              <div key={service.name} className="border-b border-rule px-4 py-4 last:border-b-0">
                <div className="flex items-center justify-between gap-4"><span className="text-[13px] font-[650] text-fg">{service.name}</span><HealthPill status={service.status} /></div>
                <p className="mt-2 text-[11px] leading-5 text-fg-faint">{service.detail}</p>
              </div>
            ))}
            {!health ? <p className="px-4 py-8 text-center text-[12px] text-fg-faint">{loading ? "Checking services…" : "No service data."}</p> : null}
          </div>
          {degraded.length > 0 ? <Link href="/admin/system" className="mt-3 inline-flex items-center gap-2 text-[12px] font-[650] text-warn hover:underline">Review {degraded.length} service warning{degraded.length === 1 ? "" : "s"}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link> : null}
        </div>
      </section>
    </AdminShell>
  );
}

function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return <Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={onClick} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Refresh</Button>;
}

function ErrorBanner({ message }: { message: string }) {
  return <p role="alert" className="mt-6 rounded-[3px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{message}</p>;
}

function MetricGrid({ overview, loading }: { overview: AdminOverviewResponse | null; loading: boolean }) {
  const totals = overview?.totals;
  const completionRate = totals?.runs ? Math.round((totals.succeeded_runs / totals.runs) * 100) : 0;
  const metrics = [
    { label: "users", value: totals?.users, icon: Users, className: "text-fg-faint" },
    { label: "total runs", value: totals?.runs, icon: Workflow, className: "text-fg-faint" },
    { label: "active now", value: totals?.active_runs, icon: Activity, className: "text-accent" },
    { label: "awaiting approval", value: totals?.awaiting_approval, icon: AlertTriangle, className: "text-warn" },
    { label: "successful", value: totals?.succeeded_runs, icon: CheckCircle2, className: "text-ok", hint: `${completionRate}% of all runs` },
    { label: "failed", value: totals?.failed_runs, icon: AlertTriangle, className: "text-danger" },
    { label: "L5 outcomes", value: totals?.l5_runs, icon: CheckCircle2, className: "text-ok" },
    { label: "fallback runs", value: totals?.runs_with_provider_fallbacks, icon: ServerCog, className: "text-warn" },
  ];
  return (
    <dl className="mt-5 grid overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_18px_50px_rgba(22,24,28,0.05)] sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon, className, hint }, index) => (
        <div key={label} className={cn("min-h-[136px] p-5", index % 2 === 1 && "sm:border-l", index > 1 && "sm:border-t", index < 4 && "xl:border-t-0", index % 4 !== 0 && "xl:border-l", index % 4 === 0 && "xl:border-l-0", index > 3 && "xl:border-t")}>
          <div className="flex items-center justify-between gap-4"><dt className={ADMIN_LABEL}>{label}</dt><Icon className={cn("h-4 w-4", className)} aria-hidden /></div>
          <dd className="font-display mt-5 text-[30px] font-[650] tracking-[-0.05em] text-fg">{loading || value == null ? "—" : value.toLocaleString()}</dd>
          {hint ? <p className="mt-1 font-mono text-[10px] text-fg-faint">{hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function HealthPill({ status }: { status: string }) {
  const classes = status === "healthy" ? "bg-ok-soft text-ok" : status === "degraded" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger";
  return <span className={cn("rounded-full px-2 py-1 font-mono text-[9px] font-[700] uppercase tracking-[0.08em]", classes)}>{status}</span>;
}

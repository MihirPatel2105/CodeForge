"use client";

import { AttentionQueue } from "@/components/admin/attention-queue";
import { Notice } from "@/components/ui/notice";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, RefreshCw, ServerCog, Users, Workflow } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { AdminRunTable } from "@/components/admin/run-table";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AdminOverviewResponse } from "@/lib/types";
import { useAdminResource } from "@/lib/use-admin-resource";
import { RefreshStatus } from "@/components/admin/refresh-status";
import { cn } from "@/lib/utils";

const fetchOverview = async () => {
  const [overview, health] = await Promise.all([api.adminOverview(), api.adminSystemHealth()]);
  return { overview, health };
};
export default function AdminPage() {
  const { data, error, loading, refresh: load, updatedAt } = useAdminResource(fetchOverview);
  const overview = data?.overview ?? null;
  const health = data?.health ?? null;
  const degraded = health?.services.filter((item) => item.status !== "healthy") ?? [];

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="platform operations"
        title="Admin control centre"
        description="See what needs attention, trace platform quality, and take a small set of audited support actions."
        actions={<RefreshButton loading={loading} onClick={load} />}
      />
      <RefreshStatus at={updatedAt} loading={loading} />
      {error ? <ErrorBanner message={error} /> : null}

      <section className="pt-8" aria-labelledby="overview-heading">
        <AdminSectionHeading eyebrow="01 / overview" title="Platform at a glance" id="overview-heading" />
        <MetricGrid overview={overview} loading={loading} />
      </section>

      <AttentionQueue />

      <section className="grid gap-8 pt-12 xl:grid-cols-[1fr_340px]" aria-labelledby="recent-heading">
        <div className="min-w-0">
          <AdminSectionHeading eyebrow="03 / activity" title="Recent runs" id="recent-heading" />
          <div className="mt-5"><AdminRunTable runs={overview?.recent_runs ?? []} /></div>
        </div>
        <div className="min-w-0">
          <AdminSectionHeading eyebrow="04 / system" title="Service posture" id="service-heading" />
          <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-surface">
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
  return <Button variant="outline" className="h-10 gap-2 rounded-lg" onClick={onClick} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Refresh</Button>;
}

function ErrorBanner({ message }: { message: string }) {
  return <Notice className="mt-6">{message}</Notice>;
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
    <dl className="mt-5 grid overflow-hidden rounded-3xl border border-border bg-surface sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon, className, hint }, index) => (
        <div key={label} className={cn("min-h-[136px] p-5", index % 2 === 1 && "sm:border-l", index > 1 && "sm:border-t", index < 4 && "xl:border-t-0", index % 4 !== 0 && "xl:border-l", index % 4 === 0 && "xl:border-l-0", index > 3 && "xl:border-t")}>
          <Link href={label === "users" ? "/admin/users" : label === "awaiting approval" ? "/admin/runs?status=awaiting_approval" : label === "successful" ? "/admin/runs?status=succeeded" : label === "failed" ? "/admin/incidents" : label === "active now" ? "#operator-queue-heading" : label === "L5 outcomes" ? "/admin/runs?acceptance_level=L5" : label === "fallback runs" ? "/admin/system" : "/admin/runs"} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
          <div className="flex items-center justify-between gap-4"><dt className={ADMIN_LABEL}>{label}</dt><Icon className={cn("h-4 w-4", className)} aria-hidden /></div>
          <dd className="font-display mt-5 text-[30px] font-[650] tracking-[-0.05em] text-fg">{loading || value == null ? "—" : value.toLocaleString()}</dd>
          {hint ? <p className="mt-1 font-mono text-[10px] text-fg-faint">{hint}</p> : null}
          </Link>
        </div>
      ))}
    </dl>
  );
}

function HealthPill({ status }: { status: string }) {
  const classes = status === "healthy" ? "bg-ok-soft text-ok" : status === "degraded" ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger";
  return <span className={cn("rounded-full px-2 py-1 font-mono text-[9px] font-[700] uppercase tracking-[0.08em]", classes)}>{status}</span>;
}

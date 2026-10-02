"use client";

import { Notice } from "@/components/ui/notice";
import { CheckCircle2, CircleHelp, RefreshCw, ServerOff, TriangleAlert } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { AdminHealthStatus } from "@/lib/types";
import { useAdminResource } from "@/lib/use-admin-resource";
import { RefreshStatus } from "@/components/admin/refresh-status";
import { cn } from "@/lib/utils";

const STATUS: Record<AdminHealthStatus, { className: string; icon: typeof CheckCircle2 }> = { healthy: { className: "bg-ok-soft text-ok", icon: CheckCircle2 }, degraded: { className: "bg-warn-soft text-warn", icon: TriangleAlert }, unavailable: { className: "bg-danger-soft text-danger", icon: ServerOff }, unknown: { className: "bg-surface-3 text-fg-muted", icon: CircleHelp } };

export default function AdminSystemPage() {
  const { data: health, error, loading, refresh: load, updatedAt } = useAdminResource(api.adminSystemHealth);

  return <AdminShell>
    <AdminPageHeader eyebrow="runtime posture" title="System health" description="Live checks for internal services plus passive observations from the latest 100 runs for model providers." actions={<Button variant="outline" className="h-10 gap-2 rounded-lg" onClick={load} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Run checks</Button>} />
    <RefreshStatus at={updatedAt} loading={loading} />
    {error ? <Notice className="mt-6">{error}</Notice> : null}
    <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-faint">{health ? `Checked ${formatWhen(health.checked_at)}` : loading ? "Checking…" : "Not checked"}</p>
    <section className="pt-8" aria-labelledby="services-heading"><AdminSectionHeading eyebrow="01 / services" title="Platform dependencies" id="services-heading" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{health?.services.map((service) => <div key={service.name} className="rounded-3xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-4"><h3 className="text-[14px] font-[700] text-fg">{service.name}</h3><StatusPill status={service.status} /></div><p className="mt-4 min-h-10 text-[12px] leading-5 text-fg-muted">{service.detail}</p><p className={cn(ADMIN_LABEL, "mt-3")}>{service.latency_ms == null ? "No latency reading" : `${service.latency_ms} ms`}</p></div>)}</div></section>
    <section className="pt-12" aria-labelledby="providers-heading"><AdminSectionHeading eyebrow="02 / model providers" title="Recent provider observations" detail="Provider status comes from recorded attempts, not a live availability check. Older observations may be stale; actual remaining quota is not known." id="providers-heading" /><div className="mt-5 overflow-hidden rounded-3xl border border-border bg-surface"><div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[760px] text-left"><thead className="sticky top-0 z-10 bg-surface-2"><tr>{["Provider", "Status", "Configured", "Attempts", "Success", "Failures", "Rate limits", "Last seen"].map((label) => <th key={label} className={cn(ADMIN_LABEL, "border-b border-rule px-4 py-3")}>{label}</th>)}</tr></thead><tbody>{health?.providers.map((provider) => <tr key={provider.name} className="border-b border-rule last:border-b-0"><td className="px-4 py-4 text-[13px] font-[700] capitalize text-fg">{provider.name}</td><td className="px-4 py-4"><StatusPill status={provider.status} /><p className="mt-1 text-[10px] text-fg-muted">{provider.observation?.replaceAll("_", " ") ?? "Past observations"}</p></td><td className="px-4 py-4 font-mono text-[11px] text-fg-muted">{provider.configured ? "Yes" : "No"}</td><td className="px-4 py-4 font-mono text-[11px] text-fg-muted">{provider.recent_attempts}</td><td className="px-4 py-4 font-mono text-[11px] text-ok">{provider.recent_successes}</td><td className="px-4 py-4 font-mono text-[11px] text-danger">{provider.recent_failures}</td><td className="px-4 py-4 font-mono text-[11px] text-warn">{provider.recent_rate_limits}</td><td className="px-4 py-4 font-mono text-[10px] text-fg-faint">{provider.last_observed_at ? formatWhen(provider.last_observed_at) : "No observation"}</td></tr>)}</tbody></table></div></div></section>
  </AdminShell>;
}

function StatusPill({ status }: { status: AdminHealthStatus }) { const meta = STATUS[status]; const Icon = meta.icon; return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-[700] uppercase tracking-[0.08em]", meta.className)}><Icon className="h-3 w-3" aria-hidden />{status}</span>; }

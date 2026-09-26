"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleHelp, RefreshCw, ServerOff, TriangleAlert } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { api, ApiError, getToken } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { AdminHealthStatus, AdminSystemHealthResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<AdminHealthStatus, { className: string; icon: typeof CheckCircle2 }> = { healthy: { className: "bg-ok-soft text-ok", icon: CheckCircle2 }, degraded: { className: "bg-warn-soft text-warn", icon: TriangleAlert }, unavailable: { className: "bg-danger-soft text-danger", icon: ServerOff }, unknown: { className: "bg-surface-3 text-fg-muted", icon: CircleHelp } };

export default function AdminSystemPage() {
  const router = useRouter();
  const [health, setHealth] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setHealth(await api.adminSystemHealth()); } catch (err) { if (err instanceof ApiError && err.status === 401) return router.replace("/login"); if (err instanceof ApiError && err.status === 403) return router.replace("/projects"); setError(err instanceof ApiError ? err.message : "Could not check system health."); } finally { setLoading(false); } }, [router]);
  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(); }, [load, router]);

  return <AdminShell>
    <AdminPageHeader eyebrow="runtime posture" title="System health" description="Live checks for internal services plus passive observations from the latest 100 runs for model providers." actions={<Button variant="outline" className="h-10 gap-2 rounded-lg" onClick={load} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Run checks</Button>} />
    {error ? <p role="alert" className="mt-6 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}
    <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-faint">{health ? `Checked ${formatWhen(health.checked_at)}` : loading ? "Checking…" : "Not checked"}</p>
    <section className="pt-8" aria-labelledby="services-heading"><AdminSectionHeading eyebrow="01 / services" title="Platform dependencies" id="services-heading" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{health?.services.map((service) => <div key={service.name} className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-4"><h3 className="text-[14px] font-[700] text-fg">{service.name}</h3><StatusPill status={service.status} /></div><p className="mt-4 min-h-10 text-[12px] leading-5 text-fg-muted">{service.detail}</p><p className={cn(ADMIN_LABEL, "mt-3")}>{service.latency_ms == null ? "No latency reading" : `${service.latency_ms} ms`}</p></div>)}</div></section>
    <section className="pt-12" aria-labelledby="providers-heading"><AdminSectionHeading eyebrow="02 / model providers" title="Recent provider observations" detail="No paid test calls are made here. Status is inferred from configuration and attempts recorded in the latest 100 runs." id="providers-heading" /><div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-surface-2"><tr>{["Provider", "Status", "Configured", "Attempts", "Success", "Failures", "Rate limits", "Last seen"].map((label) => <th key={label} className={cn(ADMIN_LABEL, "border-b border-rule px-4 py-3")}>{label}</th>)}</tr></thead><tbody>{health?.providers.map((provider) => <tr key={provider.name} className="border-b border-rule last:border-b-0"><td className="px-4 py-4 text-[13px] font-[700] capitalize text-fg">{provider.name}</td><td className="px-4 py-4"><StatusPill status={provider.status} /></td><td className="px-4 py-4 font-mono text-[11px] text-fg-muted">{provider.configured ? "Yes" : "No"}</td><td className="px-4 py-4 font-mono text-[11px] text-fg-muted">{provider.recent_attempts}</td><td className="px-4 py-4 font-mono text-[11px] text-ok">{provider.recent_successes}</td><td className="px-4 py-4 font-mono text-[11px] text-danger">{provider.recent_failures}</td><td className="px-4 py-4 font-mono text-[11px] text-warn">{provider.recent_rate_limits}</td><td className="px-4 py-4 font-mono text-[10px] text-fg-faint">{provider.last_observed_at ? formatWhen(provider.last_observed_at) : "No observation"}</td></tr>)}</tbody></table></div></div></section>
  </AdminShell>;
}

function StatusPill({ status }: { status: AdminHealthStatus }) { const meta = STATUS[status]; const Icon = meta.icon; return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-[700] uppercase tracking-[0.08em]", meta.className)}><Icon className="h-3 w-3" aria-hidden />{status}</span>; }

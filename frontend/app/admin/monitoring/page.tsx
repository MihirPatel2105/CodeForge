"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Database, RefreshCw, TriangleAlert, Workflow } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { api, ApiError, getToken } from "@/lib/api";
import type { AdminMonitoringResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function bytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }

export default function AdminMonitoringPage() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AdminMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setData(await api.adminMonitoring(days)); } catch (err) { if (err instanceof ApiError && err.status === 401) return router.replace("/login"); if (err instanceof ApiError && err.status === 403) return router.replace("/projects"); setError(err instanceof ApiError ? err.message : "Monitoring API is unavailable. Start the CodeForge backend and try again."); } finally { setLoading(false); } }, [days, router]);
  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(); }, [load, router]);
  const peak = useMemo(() => Math.max(1, ...(data?.daily.map((item) => item.runs) ?? [1])), [data]);
  const metrics = [{ label: "storage", value: bytes(data?.total_storage_bytes ?? 0), icon: Database }, { label: "tokens", value: (data?.total_tokens ?? 0).toLocaleString(), icon: Coins }, { label: "failure rate", value: `${data?.failure_rate ?? 0}%`, icon: TriangleAlert }, { label: "estimated cost", value: `$${(data?.estimated_cost_usd ?? 0).toFixed(2)}`, icon: Workflow }];

  return <AdminShell><AdminPageHeader eyebrow="platform telemetry" title="Monitoring" description="Historical runs, failure alerts, storage usage, token volume, and zero-cost provider tracking." actions={<div className="flex gap-2"><select value={days} onChange={(event) => setDays(Number(event.target.value))} className="h-10 rounded-[3px] border border-border bg-surface px-3 text-[12px]"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select><Button variant="outline" className="h-10 gap-2 rounded-[3px]" onClick={load} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Refresh</Button></div>} />
    {error ? <p role="alert" className="mt-6 text-[13px] text-danger">{error}</p> : null}
    <dl className="mt-7 grid overflow-hidden rounded-[6px] border border-border bg-surface sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }, index) => <div key={label} className={cn("p-5", index > 0 && "xl:border-l")}><div className="flex justify-between"><dt className={ADMIN_LABEL}>{label}</dt><Icon className="h-4 w-4 text-accent" aria-hidden /></div><dd className="font-display mt-4 text-[24px] font-[650]">{loading || !data ? "—" : value}</dd></div>)}</dl>
    <section className="pt-10" aria-labelledby="alerts-heading"><AdminSectionHeading eyebrow="01 / alerts" title="Active alerts" id="alerts-heading" /><div className="mt-5 grid gap-3">{data?.alerts.map((alert) => <div key={alert.title} className={cn("rounded-[5px] border p-4", alert.severity === "critical" ? "border-danger-bd bg-danger-soft" : alert.severity === "warning" ? "border-warn-bd bg-warn-soft" : "border-ok-bd bg-ok-soft")}><p className="text-[13px] font-[700] text-fg">{alert.title}</p><p className="mt-1 text-[12px] text-fg-muted">{alert.detail}</p></div>)}</div></section>
    <section className="pt-10" aria-labelledby="history-heading"><AdminSectionHeading eyebrow="02 / history" title="Run volume by day" id="history-heading" /><div className="mt-5 flex h-56 items-end gap-1 overflow-x-auto rounded-[6px] border border-border bg-surface p-5">{data?.daily.map((item) => <div key={item.date} className="group flex min-w-3 flex-1 flex-col items-center justify-end"><div title={`${item.date}: ${item.runs} runs, ${item.failed} failed`} className="w-full rounded-t-sm bg-accent/75 transition-colors hover:bg-accent" style={{ height: `${Math.max(3, (item.runs / peak) * 170)}px` }} /><span className="mt-2 hidden font-mono text-[8px] text-fg-faint xl:block">{item.date.slice(5)}</span></div>)}</div></section>
    <section className="pt-10" aria-labelledby="providers-heading"><AdminSectionHeading eyebrow="03 / usage" title="Provider usage" id="providers-heading" /><div className="mt-5 overflow-x-auto rounded-[6px] border border-border bg-surface"><table className="w-full min-w-[700px]"><thead><tr>{["Provider", "Attempts", "Successes", "Failures", "Tokens", "Estimated cost"].map((label) => <th key={label} className={cn(ADMIN_LABEL, "border-b border-rule px-4 py-3 text-left")}>{label}</th>)}</tr></thead><tbody>{data?.providers.map((provider) => <tr key={provider.provider} className="border-b border-rule last:border-0"><td className="px-4 py-3 text-[13px] font-[700] capitalize">{provider.provider}</td><td className="px-4 py-3 font-mono text-[11px]">{provider.attempts}</td><td className="px-4 py-3 font-mono text-[11px] text-ok">{provider.successes}</td><td className="px-4 py-3 font-mono text-[11px] text-danger">{provider.failures}</td><td className="px-4 py-3 font-mono text-[11px]">{provider.tokens.toLocaleString()}</td><td className="px-4 py-3 font-mono text-[11px]">${provider.estimated_cost_usd.toFixed(2)}</td></tr>)}</tbody></table></div></section>
  </AdminShell>;
}

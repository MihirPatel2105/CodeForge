"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Braces, CheckCircle2, Clock3, RefreshCw, Repeat2, Sparkles, TestTube2 } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { api, ApiError, getToken } from "@/lib/api";
import { formatElapsed } from "@/lib/format";
import type { AdminBreakdownItem, AdminQualityResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminQualityPage() {
  const router = useRouter();
  const [quality, setQuality] = useState<AdminQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setQuality(await api.adminQuality()); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.replace("/login");
      if (err instanceof ApiError && err.status === 403) return router.replace("/projects");
      setError(err instanceof ApiError ? err.message : "Could not load quality metrics.");
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(); }, [load, router]);

  return (
    <AdminShell>
      <AdminPageHeader eyebrow="outcome analytics" title="Quality" description="Measured results from persisted RunMetrics. The cards use eligible completed runs; exclusions are reported separately." actions={<Button variant="outline" className="h-10 gap-2 rounded-lg" onClick={load} disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />Refresh</Button>} />
      {error ? <p role="alert" className="mt-6 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}
      <div className="mt-6 rounded-lg border border-accent-bd bg-accent-soft px-4 py-3 text-[12px] leading-5 text-fg-muted"><strong className="text-fg">Population:</strong> {quality?.eligible_runs ?? "—"} eligible of {quality?.measured_runs ?? "—"} measured runs. Cancelled, rejected, and infrastructure or quota failures before completion are excluded from outcome rates.</div>

      <section className="pt-8" aria-labelledby="quality-kpis"><AdminSectionHeading eyebrow="01 / core signals" title="Outcome scorecard" id="quality-kpis" /><Kpis quality={quality} loading={loading} /></section>
      <section className="grid gap-8 pt-12 xl:grid-cols-3" aria-label="Quality breakdowns"><Breakdown title="Acceptance level" eyebrow="02 / distribution" items={quality?.acceptance_levels ?? []} tone="bg-accent" /><Breakdown title="Failure category" eyebrow="03 / causes" items={quality?.failure_categories ?? []} tone="bg-danger" /><Breakdown title="Excluded runs" eyebrow="04 / denominator" items={quality?.exclusions ?? []} tone="bg-warn" /></section>

      <section className="pt-12" aria-labelledby="rag-heading"><AdminSectionHeading eyebrow="05 / retrieval" title="RAG comparison" detail="Side-by-side only; this does not prove that RAG caused the difference." id="rag-heading" /><div className="mt-5 grid gap-4 lg:grid-cols-2">{(quality?.rag_comparison ?? []).map((group) => <div key={String(group.rag_enabled)} className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><h3 className="text-[15px] font-[700] text-fg">RAG {group.rag_enabled ? "enabled" : "disabled"}</h3><span className={ADMIN_LABEL}>{group.runs} eligible runs</span></div><dl className="mt-5 grid grid-cols-2 gap-4"><Mini label="L5 rate" value={`${group.l5_rate}%`} /><Mini label="Generation" value={`${group.generation_success_rate}%`} /><Mini label="Test pass ratio" value={`${group.average_test_pass_ratio}%`} /><Mini label="Avg. iterations" value={String(group.average_iterations)} /><Mini label="Avg. duration" value={formatElapsed(group.average_duration_ms)} /></dl></div>)}</div></section>
    </AdminShell>
  );
}

function Kpis({ quality, loading }: { quality: AdminQualityResponse | null; loading: boolean }) {
  const metrics = [
    { label: "Generation success", value: `${quality?.generation_success_rate ?? 0}%`, icon: Sparkles },
    { label: "Tests passed", value: `${quality?.test_pass_rate ?? 0}%`, icon: TestTube2 },
    { label: "Avg. test ratio", value: `${quality?.average_test_pass_ratio ?? 0}%`, icon: CheckCircle2 },
    { label: "Review fix rate", value: `${quality?.review_fix_rate ?? 0}%`, icon: Braces },
    { label: "Avg. iterations", value: String(quality?.average_iterations ?? 0), icon: Repeat2 },
    { label: "Avg. duration", value: formatElapsed(quality?.average_duration_ms ?? 0), icon: Clock3 },
    { label: "Avg. tokens", value: (quality?.average_tokens ?? 0).toLocaleString(), icon: Braces },
    { label: "Provider fallbacks", value: (quality?.provider_fallbacks ?? 0).toLocaleString(), icon: Repeat2 },
  ];
  return <dl className="mt-5 grid overflow-hidden rounded-xl border border-border bg-surface sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }, index) => <div key={label} className={cn("p-5", index % 2 === 1 && "sm:border-l", index > 1 && "sm:border-t", index < 4 && "xl:border-t-0", index % 4 !== 0 && "xl:border-l", index % 4 === 0 && "xl:border-l-0", index > 3 && "xl:border-t")}><div className="flex items-center justify-between"><dt className={ADMIN_LABEL}>{label}</dt><Icon className="h-4 w-4 text-fg-faint" aria-hidden /></div><dd className="font-display mt-5 text-[25px] font-[650] tracking-[-0.045em] text-fg">{loading ? "—" : value}</dd></div>)}</dl>;
}

function Breakdown({ title, eyebrow, items, tone }: { title: string; eyebrow: string; items: AdminBreakdownItem[]; tone: string }) {
  return <div><AdminSectionHeading eyebrow={eyebrow} title={title} id={title.toLowerCase().replaceAll(" ", "-")} /><div className="mt-5 space-y-4 rounded-xl border border-border bg-surface p-5">{items.map((item) => <div key={item.label}><div className="flex items-center justify-between gap-4"><span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">{item.label.replaceAll("_", " ")}</span><span className="font-mono text-[10px] text-fg-faint">{item.count} · {item.percentage}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(item.percentage, 100)}%` }} /></div></div>)}{items.length === 0 ? <p className="py-5 text-center text-[12px] text-fg-faint">No data in this category.</p> : null}</div></div>;
}

function Mini({ label, value }: { label: string; value: string }) { return <div><dt className={ADMIN_LABEL}>{label}</dt><dd className="mt-2 font-mono text-[13px] font-[650] text-fg">{value}</dd></div>; }

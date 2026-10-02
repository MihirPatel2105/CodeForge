"use client";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";
import { Notice } from "@/components/ui/notice";
import { RefreshStatus } from "./refresh-status";
export function PeriodComparison({ days }: { days: number }) {
  const fetcher = useCallback(() => api.adminTrends(days), [days]);
  const { data, error, loading, updatedAt } = useAdminResource(fetcher);
  return <section className="mt-6 rounded-3xl border border-border bg-surface p-5"><h2 className="text-sm font-semibold">Last {days} days versus the previous {days}</h2><RefreshStatus at={updatedAt} loading={loading} />{error && <Notice className="mt-3">{error}</Notice>}{data && <dl className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-4">{(["runs", "succeeded", "failed", "tokens"] as const).map(key => { const current = data.current[key]; const previous = data.previous[key]; const delta = current - previous; return <div key={key}><dt className="text-xs capitalize text-fg-muted">{key}</dt><dd className="mt-2 text-xl font-semibold">{current.toLocaleString()}</dd><p className="mt-1 text-xs text-fg-muted">{delta > 0 ? "+" : ""}{delta.toLocaleString()} · previous {previous.toLocaleString()}</p></div>; })}</dl>}</section>;
}

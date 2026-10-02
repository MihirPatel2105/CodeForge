"use client";
import { useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";
import type { AdminUserSummary } from "@/lib/types";
import { Notice } from "@/components/ui/notice";
import { RefreshStatus } from "./refresh-status";
export function SupportPanel({ user }: { user: AdminUserSummary }) {
  const fetcher = useCallback(() => api.adminSupport(user.id), [user.id]);
  const { data, error, loading, updatedAt } = useAdminResource(fetcher);
  return <section className="mt-7 rounded-3xl border border-border bg-surface p-5"><h2 className="text-sm font-semibold">Support snapshot</h2><RefreshStatus at={updatedAt} loading={loading} />{error && <Notice className="mt-3">{error}</Notice>}{data && <><dl className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-4">{[["Projects used", `${user.project_count} / ${user.project_limit ?? "unlimited"}`], ["Runs this UTC month", `${data.monthly_runs} / ${user.monthly_run_limit ?? "unlimited"}`], ["Active sessions", data.active_sessions], ["Failed runs", data.failed_runs]].map(([label, value]) => <div key={label}><dt className="text-xs text-fg-muted">{label}</dt><dd className="mt-2 text-base font-semibold">{value}</dd></div>)}</dl><div className="mt-5 flex flex-wrap gap-4"><Link href={`/admin/runs?user_id=${user.id}`} className="text-xs font-semibold text-accent">Browse this user’s runs →</Link><Link href={`/admin/deployments?user_id=${user.id}`} className="text-xs font-semibold text-accent">Published APIs ({data.deployments.length}) →</Link></div>{data.deployments.map(item => <p key={item.id} className="mt-2 text-xs text-fg-muted">{item.project_name} · {item.status}</p>)}</>}</section>;
}

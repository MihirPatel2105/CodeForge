"use client";

import { Notice } from "@/components/ui/notice";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  PlayCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AccountShell } from "@/components/account/account-shell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-current-user";
import { api, getToken, ApiError } from "@/lib/api";
import { runStats } from "@/lib/run-stats";
import { formatWhen } from "@/lib/format";
import type { AdminOverviewTotals } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL =
  "text-[12px] font-[650] text-fg-muted";

interface Totals {
  projects: number;
  runs: number;
  succeeded: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useSession();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [adminTotals, setAdminTotals] = useState<AdminOverviewTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const load = useCallback(async (isAdmin: boolean) => {
    setError(null);
    setActivityLoading(true);
    try {
      if (isAdmin) {
        const overview = await api.adminOverview();
        setAdminTotals(overview.totals);
        return;
      }
      const projects = await api.listProjects();
      const histories = await Promise.all(
        projects.map((project) => api.listProjectRuns(project.id)),
      );
      const stats = histories.map(runStats);
      setTotals({
        projects: projects.length,
        runs: stats.reduce((count, item) => count + item.total, 0),
        succeeded: stats.reduce((count, item) => count + item.succeeded, 0),
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError("Couldn't load your activity.");
    } finally {
      setActivityLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (userLoading || !user) return;
    void load(user.is_admin);
  }, [router, load, user, userLoading]);

  const successRate =
    totals && totals.runs > 0
      ? String(Math.round((totals.succeeded / totals.runs) * 100)) + "%"
      : "—";
  const platformSuccessRate =
    adminTotals && adminTotals.runs > 0
      ? `${Math.round((adminTotals.succeeded_runs / adminTotals.runs) * 100)}%`
      : "—";
  const isAdmin = Boolean(user?.is_admin);
  const activityValue = (value: number | undefined) =>
    activityLoading ? "…" : value === undefined ? "—" : String(value);

  return (
    <AccountShell page="profile">
        <section className="profile-summary">
          <div className="profile-identity">
            <span className="profile-avatar" aria-hidden>{user?.initials ?? "—"}</span>
            <div className="min-w-0">
              <h1 className="profile-name">{user?.displayName ?? "Loading…"}</h1>
              {user && user.displayName !== user.email && <p className="profile-email">{user.email}</p>}
              <p className="profile-membership">{isAdmin ? "Platform administrator · " : ""}Member since {user ? formatWhen(user.created_at) : "—"}</p>
            </div>
          </div>
            <dl aria-label="Activity summary" aria-busy={activityLoading} className="cf-identity-metrics grid border-t border-border sm:grid-cols-3">
              <ProfileMetric
                icon={isAdmin ? Users : FolderKanban}
                label={isAdmin ? "platform users" : "projects"}
                value={activityValue(isAdmin ? adminTotals?.users : totals?.projects)}
              />
              <ProfileMetric
                icon={PlayCircle}
                label="total runs"
                value={activityValue(isAdmin ? adminTotals?.runs : totals?.runs)}
                bordered
              />
              <ProfileMetric
                icon={ShieldCheck}
                label={isAdmin ? "platform success" : "success rate"}
                value={activityLoading ? "…" : isAdmin ? platformSuccessRate : successRate}
                bordered
              />
            </dl>
        </section>

        {error && (
          <Notice className="mt-5"><div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load(isAdmin)}>
              Retry activity
            </Button>
          </div></Notice>
        )}

        <div className="profile-details mt-8">
          <section className="rounded-3xl border border-border bg-surface">
            <div className="border-b border-rule px-6 py-5">
              <h2 className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">
                {isAdmin ? "Administrator identity" : "Personal details"}
              </h2>
            </div>
            <dl className="px-6">
              <DetailRow label="First name" value={user?.first_name || "—"} />
              <DetailRow label="Last name" value={user?.last_name || "—"} />
              <DetailRow label="Email address" value={user?.email ?? "—"} mono />
              {isAdmin ? <DetailRow label="Role" value="Platform administrator" /> : null}
              <DetailRow label="Two-factor" value={user ? user.totp_enabled ? "On" : "Off" : "—"} last />

            </dl>
          </section>


        </div>

    </AccountShell>
  );
}

function DetailRow({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 border-b border-rule py-4 sm:grid-cols-[11rem_1fr] sm:items-center",
        last && "border-b-0",
      )}
    >
      <dt className={LABEL}>{label}</dt>
      <dd className={cn("min-w-0 text-[14px] text-fg", mono && "break-all text-[13px]")}>
        {value}
      </dd>
    </div>
  );
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
  bordered,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-5 px-6 py-6 lg:px-8 lg:py-8",
        bordered && "border-t border-rule sm:border-l sm:border-t-0",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface">
          <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
        </span>
        <dt className="text-[12px] font-[650] text-fg-muted">
          {label}
        </dt>
      </div>
      <dd className="font-display text-[28px] font-[700] tracking-[-0.05em] text-fg">
        {value}
      </dd>
    </div>
  );
}

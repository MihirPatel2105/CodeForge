"use client";

import { Notice } from "@/components/ui/notice";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  PlayCircle,
  ServerCog,
  Settings,
  ShieldCheck,
  ShieldOff,
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
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="text-[13px] font-[650] text-accent">Your account</span>
          <Link
            href="/profile/settings"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-[13px] font-[650] text-fg transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Account settings
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <section className="cf-account-hero relative overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="cf-identity-stage grid">
            <div className="relative z-10 flex flex-col justify-between p-6 sm:p-8 md:p-10">
              <div>
                <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-[650] text-fg-muted">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  {isAdmin ? "Platform administrator" : "Account overview"}
                </span>

                <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-[21px] font-[700] text-accent sm:h-20 sm:w-20 sm:text-[25px]">
                    {user?.initials ?? "—"}
                  </span>
                  <div className="min-w-0">
                    <p className={LABEL}>{isAdmin ? "Operator profile" : "Profile"}</p>
                    <h1 className="font-display mt-1 break-words text-[29px] font-[700] leading-tight tracking-[-0.05em] text-fg sm:text-[34px] md:text-[38px]">
                      {user?.displayName ?? "Loading…"}
                    </h1>
                    {user && user.displayName !== user.email && (
                      <p className="mt-2 break-all text-[13px] text-fg-muted">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-7 max-w-[52ch] text-[14px] leading-[1.6] text-fg-muted">
                {isAdmin
                  ? "Your operator identity, platform activity, and protected account controls in one place."
                  : "A clear view of your account and workspace activity."}
              </p>
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
          </div>
        </section>

        {error && (
          <Notice className="mt-5"><div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load(isAdmin)}>
              Retry activity
            </Button>
          </div></Notice>
        )}

        <div className="cf-account-content mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <section className="rounded-3xl border border-border bg-surface">
            <div className="border-b border-rule px-6 py-5">
              <span className={LABEL}>{isAdmin ? "Operator record" : "Account record"}</span>
              <h2 className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">
                {isAdmin ? "Administrator identity" : "Personal details"}
              </h2>
            </div>
            <dl className="px-6">
              <DetailRow label="First name" value={user?.first_name || "—"} />
              <DetailRow label="Last name" value={user?.last_name || "—"} />
              <DetailRow label="Email address" value={user?.email ?? "—"} mono />
              {isAdmin ? <DetailRow label="Role" value="Platform administrator" /> : null}
              <DetailRow label="Two-factor" value={user ? user.totp_enabled ? "On" : "Off" : "—"} />
              <DetailRow
                label="Member since"
                value={user ? formatWhen(user.created_at) : "—"}
                mono
                last
              />
            </dl>
          </section>

          <section className="rounded-3xl border border-border bg-surface">
            <div className="border-b border-rule px-6 py-5">
              <span className={LABEL}>Quick access</span>
              <h2 className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">
                {isAdmin ? "Operate CodeForge" : "Manage your workspace"}
              </h2>
            </div>
            <div className="p-3">
              {isAdmin ? (
                <>
                  <AccountLink href="/admin" icon={LayoutDashboard} title="Admin control centre" description="Open the platform overview and operator attention queue." />
                  <AccountLink href="/admin/system" icon={ServerCog} title="System health" description="Check services and recent model-provider observations." />
                  <AccountLink href="/admin/audit" icon={ClipboardList} title="Audit log" description="Review sensitive administrator actions and their reasons." />
                </>
              ) : (
                <AccountLink href="/projects" icon={FolderKanban} title="Projects" description="Open your APIs, previous runs, and generated files." />
              )}
              <AccountLink
                href="/profile/settings"
                icon={Settings}
                title="Security settings"
                description="Change your password and manage active sessions."
              />
              <AccountLink
                href="/profile/settings/2fa"
                icon={user?.totp_enabled ? ShieldCheck : ShieldOff}
                title="Two-factor authentication"
                description={user?.totp_enabled ? "Authenticator codes are on. Manage your setup." : "Add authenticator codes to protect your account."}
              />
            </div>
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

function AccountLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof FolderKanban;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-4 transition-colors hover:border-border hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-bg">
        <Icon className="h-4 w-4 text-accent" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-[650] text-fg">{title}</span>
        <span className="mt-1 block text-[12.5px] leading-[1.45] text-fg-muted">
          {description}
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
        aria-hidden
      />
    </Link>
  );
}

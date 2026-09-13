"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  PlayCircle,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { useCurrentUser } from "@/lib/use-current-user";
import { api, getToken, ApiError } from "@/lib/api";
import { runStats } from "@/lib/run-stats";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

const LABEL =
  "font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-fg-faint";

interface Totals {
  projects: number;
  runs: number;
  succeeded: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
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
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load();
  }, [router, load]);

  const successRate =
    totals && totals.runs > 0
      ? String(Math.round((totals.succeeded / totals.runs) * 100)) + "%"
      : "—";

  return (
    <div className="cf-account min-h-screen bg-bg">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1320px] px-6 py-10 md:px-10 md:py-14 lg:px-14">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className={LABEL}>[ account / profile ]</span>
          <Link
            href="/profile/settings"
            className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-fg-faint transition-colors hover:text-fg"
          >
            Account settings
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <section className="cf-account-hero relative overflow-hidden rounded-[7px] border border-border bg-surface shadow-[0_24px_70px_rgba(22,24,28,0.07)]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_31rem]">
            <div className="relative z-10 flex min-h-[290px] flex-col justify-between p-7 md:p-10">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-ok-bd bg-ok-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-ok">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  authenticated account
                </span>

                <div className="mt-8 flex items-center gap-5">
                  <span className="grid h-20 w-20 shrink-0 place-items-center rounded-[5px] border border-border-strong bg-fg font-mono text-[25px] font-[700] tracking-[0.04em] text-surface shadow-[0_12px_30px_rgba(22,24,28,0.16)]">
                    {user?.initials ?? "—"}
                  </span>
                  <div className="min-w-0">
                    <p className={LABEL}>profile</p>
                    <h1 className="font-display mt-2 truncate text-[30px] font-[650] leading-none tracking-[-0.05em] text-fg md:text-[38px]">
                      {user?.displayName ?? "Loading…"}
                    </h1>
                    {user && user.displayName !== user.email && (
                      <p className="mt-3 truncate font-mono text-[12px] text-fg-muted">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-8 max-w-[52ch] text-[13.5px] leading-[1.6] text-fg-muted">
                Your identity, workspace activity, and account controls in one place.
              </p>
            </div>

            <dl className="cf-invert grid bg-bg sm:grid-cols-3 lg:grid-cols-1">
              <ProfileMetric
                icon={FolderKanban}
                label="projects"
                value={totals ? String(totals.projects) : "—"}
              />
              <ProfileMetric
                icon={PlayCircle}
                label="total runs"
                value={totals ? String(totals.runs) : "—"}
                bordered
              />
              <ProfileMetric
                icon={ShieldCheck}
                label="success rate"
                value={successRate}
                bordered
              />
            </dl>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-[4px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger"
          >
            {error}
          </p>
        )}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <section className="rounded-[6px] border border-border bg-surface shadow-[0_16px_45px_rgba(22,24,28,0.045)]">
            <div className="border-b border-rule px-6 py-5">
              <span className={LABEL}>account record</span>
              <h2 className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">
                Personal details
              </h2>
            </div>
            <dl className="px-6">
              <DetailRow label="first name" value={user?.first_name || "—"} />
              <DetailRow label="last name" value={user?.last_name || "—"} />
              <DetailRow label="email address" value={user?.email ?? "—"} mono />
              <DetailRow
                label="member since"
                value={user ? formatWhen(user.created_at) : "—"}
                mono
                last
              />
            </dl>
          </section>

          <section className="rounded-[6px] border border-border bg-surface shadow-[0_16px_45px_rgba(22,24,28,0.045)]">
            <div className="border-b border-rule px-6 py-5">
              <span className={LABEL}>quick access</span>
              <h2 className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">
                Manage your workspace
              </h2>
            </div>
            <div className="p-3">
              <AccountLink
                href="/projects"
                icon={FolderKanban}
                title="Projects"
                description="Open your APIs, previous runs, and generated files."
              />
              <AccountLink
                href="/profile/settings"
                icon={Settings}
                title="Security settings"
                description="Change your password or manage active sessions."
              />
            </div>

            <div className="mx-6 flex items-center gap-3 border-t border-rule py-5">
              <CalendarDays className="h-4 w-4 text-fg-faint" aria-hidden />
              <p className="text-[12.5px] text-fg-muted">
                Member since {user ? formatWhen(user.created_at) : "—"}
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
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
      <dd className={cn("text-[14px] text-fg", mono && "font-mono text-[12.5px]")}>
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
        "flex items-center justify-between gap-5 px-6 py-5 lg:px-7",
        bordered && "border-t border-rule sm:border-l sm:border-t-0 lg:border-l-0 lg:border-t",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-[3px] border border-border bg-surface">
          <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
        </span>
        <dt className="font-mono text-[9px] font-[700] uppercase tracking-[0.13em] text-fg-faint">
          {label}
        </dt>
      </div>
      <dd className="font-display text-[27px] font-[650] tracking-[-0.05em] text-fg">
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
      className="group flex items-center gap-4 rounded-[4px] border border-transparent px-3 py-4 transition-colors hover:border-border hover:bg-surface-2"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border border-border bg-bg">
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

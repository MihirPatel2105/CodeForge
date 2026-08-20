"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { useCurrentUser } from "@/lib/use-current-user";
import { api, getToken, ApiError } from "@/lib/api";
import { runStats } from "@/lib/run-stats";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

const LABEL = "font-mono text-[10.5px] font-[600] uppercase tracking-[0.14em] text-fg-faint";

interface Totals {
  projects: number;
  runs: number;
  succeeded: number;
}

/**
 * The signed-in user's own page: who they are, and what their account has actually
 * done. The figures come from the same project/run endpoints the dashboard uses, so
 * nothing here is a number this product cannot stand behind.
 */
export default function ProfilePage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const projects = await api.listProjects();
      const histories = await Promise.all(projects.map((p) => api.listProjectRuns(p.id)));
      const stats = histories.map(runStats);
      setTotals({
        projects: projects.length,
        runs: stats.reduce((n, s) => n + s.total, 0),
        succeeded: stats.reduce((n, s) => n + s.succeeded, 0),
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
      // `replace` so Back cannot return to a page this visitor cannot see.
      router.replace("/login");
      return;
    }
    load();
  }, [router, load]);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />

      {/* No "← projects" crumb here. Profile is a top-level page reached from the
          avatar in the header, not a child of Projects — a back link would claim a
          hierarchy that does not exist, and points somewhere the visitor may never
          have been. The header carries the navigation. */}
      <div className="mx-auto w-full px-6 py-12 md:px-10 lg:px-14">
        <div className="flex items-center gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[3px] border border-border-strong bg-surface-2 font-mono text-[22px] font-[700] tracking-[0.04em] text-fg">
            {user?.initials ?? "—"}
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate text-[26px] font-[600] tracking-[-0.04em] text-fg">
              {user?.displayName ?? "…"}
            </h1>
            {user && user.displayName !== user.email && (
              <p className="mt-1 truncate font-mono text-[13px] text-fg-muted">{user.email}</p>
            )}
          </div>
        </div>

        {/* Account */}
        <section className="mt-11">
          <h2 className={LABEL}>account</h2>
          <dl className="mt-4 border-t border-rule">
            <Row label="first name" value={user?.first_name || "—"} />
            <Row label="last name" value={user?.last_name || "—"} />
            <Row label="email" value={user?.email ?? "—"} mono />
            <Row
              label="member since"
              value={user ? formatWhen(user.created_at) : "—"}
              mono
            />
          </dl>
        </section>

        {/* Activity */}
        <section className="mt-12">
          <h2 className={LABEL}>activity</h2>
          {error ? (
            <p className="mt-4 text-[13.5px] text-danger">{error}</p>
          ) : (
            <dl className="mt-4 grid grid-cols-3 border-y border-rule">
              <Figure label="projects" value={totals ? String(totals.projects) : "—"} />
              <Figure label="runs" value={totals ? String(totals.runs) : "—"} bordered />
              <Figure
                label="succeeded"
                value={totals ? String(totals.succeeded) : "—"}
                hint={
                  totals && totals.runs > 0
                    ? `${Math.round((totals.succeeded / totals.runs) * 100)}%`
                    : undefined
                }
                bordered
              />
            </dl>
          )}
        </section>

        {/* Sign out and account deletion both live in Settings now. Keeping a
            destructive control off a page people scroll through casually is the point
            of the split; sign-out follows it so there is one place the account is
            managed rather than two. */}
        <section className="mt-12 flex flex-wrap items-center gap-4 border-t border-rule pt-8">
          <Link
            href="/profile/settings"
            className="inline-flex h-11 items-center gap-[7px] rounded-[2px] border border-border-strong px-[15px] text-[14px] font-[500] text-fg transition-colors hover:bg-surface-2"
          >
            <SettingsIcon className="h-[15px] w-[15px]" />
            Settings
          </Link>
          <p className="text-[12.5px] text-fg-faint">
            Sign out, or permanently delete this account.
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-1 border-b border-rule py-[15px] sm:grid-cols-[13rem_1fr]">
      <dt className={LABEL}>{label}</dt>
      <dd className={cn("text-[15px] text-fg", mono && "font-mono text-[14px]")}>{value}</dd>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  bordered,
}: {
  label: string;
  value: string;
  hint?: string;
  bordered?: boolean;
}) {
  return (
    <div className={cn("py-5", bordered && "border-l border-rule pl-6")}>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-[26px] font-[600] tracking-[-0.04em] text-fg">
          {value}
        </span>
        {hint && <span className="font-mono text-[12px] text-fg-faint">{hint}</span>}
      </dd>
    </div>
  );
}

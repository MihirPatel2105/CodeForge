"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  ServerCog,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { cn } from "@/lib/utils";

export const ADMIN_LABEL =
  "font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-fg-faint";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/runs", label: "Runs", icon: Workflow, exact: false },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/quality", label: "Quality", icon: BarChart3, exact: false },
  { href: "/admin/monitoring", label: "Monitoring", icon: TrendingUp, exact: false },
  { href: "/admin/system", label: "System", icon: ServerCog, exact: false },
  { href: "/admin/audit", label: "Audit log", icon: ClipboardList, exact: false },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1540px]">
        <aside className="sticky top-[58px] hidden h-[calc(100vh-58px)] w-[220px] shrink-0 border-r border-rule px-4 py-8 lg:block">
          <span className={cn(ADMIN_LABEL, "px-3")}>Control centre</span>
          <nav className="mt-4 space-y-1" aria-label="Admin navigation">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[3px] px-3 py-2.5 font-mono text-[11px] font-[650] uppercase tracking-[0.08em] transition-colors",
                    active
                      ? "bg-fg text-bg"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute inset-x-4 bottom-7 rounded-[3px] border border-ok-bd bg-ok-soft p-3">
            <div className="flex items-center gap-2 text-ok">
              <Activity className="h-4 w-4" aria-hidden />
              <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.1em]">
                audited actions
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-fg-muted">
              Run cancellation and session revocation require a reason and leave a durable record.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <nav
            className="flex gap-1 overflow-x-auto border-b border-rule bg-surface px-4 py-3 lg:hidden"
            aria-label="Admin navigation"
          >
            {NAV.map(({ href, label, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-[3px] px-3 py-2 font-mono text-[9.5px] font-[700] uppercase tracking-[0.08em]",
                    active ? "bg-fg text-bg" : "text-fg-muted",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <main className="px-5 pb-20 pt-8 md:px-8 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-5 border-b border-rule pb-7 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden />
          <span className={ADMIN_LABEL}>{eyebrow}</span>
        </div>
        <h1 className="font-display mt-3 text-[30px] font-[650] tracking-[-0.055em] text-fg md:text-[38px]">
          {title}
        </h1>
        <p className="mt-3 max-w-[72ch] text-[14px] leading-6 text-fg-muted">{description}</p>
      </div>
      {actions}
    </header>
  );
}

export function AdminSectionHeading({
  eyebrow,
  title,
  detail,
  id,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  id: string;
}) {
  return (
    <div>
      <span className={ADMIN_LABEL}>{eyebrow}</span>
      <h2 id={id} className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">
        {title}
      </h2>
      {detail ? <p className="mt-2 text-[12.5px] leading-5 text-fg-muted">{detail}</p> : null}
    </div>
  );
}

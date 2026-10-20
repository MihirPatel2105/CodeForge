"use client";

import "./admin-premium.css";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Command,
  Globe,
  ShieldAlert,
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
  "text-[12px] font-[600] text-fg-muted";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/runs", label: "Runs", icon: Workflow, exact: false },
  { href: "/admin/deployments", label: "API hosting", icon: Globe, exact: false },
  { href: "/admin/incidents", label: "Incidents", icon: ShieldAlert, exact: false },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/quality", label: "Quality", icon: BarChart3, exact: false },
  { href: "/admin/monitoring", label: "Monitoring", icon: TrendingUp, exact: false },
  { href: "/admin/system", label: "System", icon: ServerCog, exact: false },
  { href: "/admin/audit", label: "Audit log", icon: ClipboardList, exact: false },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="cf-admin min-h-screen bg-bg">
      <AppHeader />
      <div className="cf-operations-layout mx-auto flex w-full max-w-[1540px] gap-8">
        <aside className="cf-operations-nav sticky top-[88px] hidden h-fit w-[220px] shrink-0 rounded-3xl border border-border px-3 py-6 lg:block">
          <div className="cf-admin-brand">
            <span className="cf-admin-brand-icon"><Command className="h-5 w-5" aria-hidden /></span>
            <div><span className="cf-admin-brand-title">Control centre</span><span className="cf-admin-brand-caption">Platform administration</span></div>
          </div>
          <nav className="mt-4 space-y-1" aria-label="Admin navigation">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-[600] transition-colors",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                  {active && <span className="cf-admin-nav-indicator" aria-hidden />}
                </Link>
              );
            })}
          </nav>
          <Link href="/projects" className="cf-admin-workspace-link">Open workspace <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
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
                    "shrink-0 rounded-lg px-3 py-2 text-[12px] font-[600]",
                    active ? "bg-accent-soft text-accent" : "text-fg-muted",
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
    <header className="cf-admin-page-header flex flex-col justify-between gap-5 pb-8 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden />
          <span className={ADMIN_LABEL}>{eyebrow.replace(/^\d+ \/ /, "")}</span>
        </div>
        <h1 className="font-display mt-3 text-[36px] font-[650] tracking-[-0.055em] text-fg md:text-[46px]">
          {title}
        </h1>
        <p className="mt-3 max-w-[72ch] text-[15px] leading-6 text-fg-muted">{description}</p>
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
      <span className={ADMIN_LABEL}>{eyebrow.replace(/^\d+ \/ /, "")}</span>
      <h2 id={id} className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">
        {title}
      </h2>
      {detail ? <p className="mt-2 text-[12.5px] leading-5 text-fg-muted">{detail}</p> : null}
    </div>
  );
}

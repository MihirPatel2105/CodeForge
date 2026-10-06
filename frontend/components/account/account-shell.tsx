"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Fingerprint, FolderKanban, Settings2, UserRound } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { useSession } from "@/lib/use-current-user";
import "./account.css";

export function AccountShell({ page, children }: { page: "profile" | "settings"; children: ReactNode }) {
  const { user } = useSession();
  return <div className="cf-account account-workspace min-h-screen">
    <AppHeader />
    <div className="account-frame">
      <aside className="account-sidebar">
        <div className="account-sidebar-identity">
          <span className="account-avatar">{user?.initials ?? "—"}</span>
          <div><strong>{user?.displayName ?? "Your account"}</strong><span>{user?.is_admin ? "Administrator" : "Personal workspace"}</span></div>
        </div>
        <p className="account-nav-label">Account</p>
        <nav aria-label="Account navigation">
          <Link href="/profile" aria-current={page === "profile" ? "page" : undefined}><UserRound size={17} aria-hidden />Profile</Link>
          <Link href="/profile/settings" aria-current={page === "settings" ? "page" : undefined}><Settings2 size={17} aria-hidden />Settings</Link>
          <Link href="/profile/settings/2fa"><Fingerprint size={17} aria-hidden />Two-factor authentication</Link>
        </nav>
        <div className="account-sidebar-footer">
          <Link href={user?.is_admin ? "/admin" : "/projects"}><FolderKanban size={17} aria-hidden /><span>{user?.is_admin ? "Admin workspace" : "Back to projects"}</span><ArrowUpRight size={15} aria-hidden /></Link>
          <p>Your account. Your control.</p>
        </div>
      </aside>
      <main className={`account-main account-main--${page}`}>{children}</main>
    </div>
  </div>;
}

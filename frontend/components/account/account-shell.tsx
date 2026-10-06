"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import "./account.css";

export function AccountShell({ page, children }: { page: "profile" | "settings"; children: ReactNode }) {
  return <div className="cf-account account-workspace min-h-screen">
    <AppHeader />
    <div className="account-frame">
      <nav className="account-tabs" aria-label="Account navigation">
        <Link href="/profile" aria-current={page === "profile" ? "page" : undefined}>Profile</Link>
        <Link href="/profile/settings" aria-current={page === "settings" ? "page" : undefined}>Settings</Link>
      </nav>
      <main className={`account-main account-main--${page}`}>{children}</main>
    </div>
  </div>;
}

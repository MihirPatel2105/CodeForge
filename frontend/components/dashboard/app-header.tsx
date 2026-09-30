"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FolderKanban, LayoutDashboard } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { LogoLockup } from "@/components/brand/logo-lockup";

export function AppHeader() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const onProjects = pathname === "/projects" || pathname.startsWith("/projects/") || pathname.startsWith("/runs/");
  const navigation = [
    { href: "/projects", label: "Projects", active: onProjects, icon: FolderKanban },
    ...(user?.is_admin ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin"), icon: LayoutDashboard }] : []),
  ];

  return (
    <header className="cf-app-header sticky top-0 z-20 border-b border-rule backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <Link href="/" aria-label="CodeForge home" className="shrink-0 transition-opacity hover:opacity-75">
          <LogoLockup className="h-8 w-auto sm:h-9" />
        </Link>
        <nav aria-label="Workspace navigation" className="flex items-center gap-1 rounded-full bg-surface-2 p-1 sm:gap-2">
          {navigation.map(({ href, label, active, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn(
              "flex min-h-10 items-center gap-2 rounded-full px-3 text-[13px] font-[600] transition-[background-color,color,box-shadow] duration-200 sm:px-5",
              active ? "bg-surface text-accent shadow-sm" : "text-fg-muted hover:bg-surface hover:text-fg",
            )}>
              <Icon className="size-4 sm:hidden" aria-hidden />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex min-w-8 items-center justify-end">{user && <UserAvatar initials={user.initials} name={user.displayName} />}</div>
      </div>
    </header>
  );
}

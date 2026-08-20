"use client";


import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * The persistent app header (design_handoff/README.md "Header (58px, sticky...)"),
 * adapted for the real product rather than ported from the prototype: the prototype's
 * three tabs were its own dev-tool navigation (Live run / Screens / Foundations), which
 * has no equivalent here — the wordmark goes to the landing page and a Projects link
 * beside it goes to the app's root — and the right side carries the user's avatar,
 * which is the way through to their profile and to signing out.
 */
export function AppHeader() {
  const pathname = usePathname();
  const user = useCurrentUser();

  const onProjects = pathname === "/projects";

  return (
    <header className="sticky top-0 z-20 flex h-[58px] shrink-0 items-center justify-between border-b border-rule bg-bg px-4">
      <div className="flex items-center gap-6">
        {/* The wordmark goes to the landing page, not to Projects — that is what a
            wordmark does everywhere else on the web, and the Projects link sitting
            right beside it already covers the other destination. */}
        <Link
          href="/"
          aria-label="CodeForge home"
          className="flex items-center gap-[9px] transition-opacity hover:opacity-80"
        >
          <LogoMark className="h-6 w-6 rounded-[2px]" />
          <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
            codeforge
          </span>
        </Link>

        <Link
          href="/projects"
          className={cn(
            "hidden font-mono text-[11px] font-[600] uppercase tracking-[0.12em] transition-colors sm:block",
            onProjects ? "text-fg" : "text-fg-faint hover:text-fg",
          )}
        >
          Projects
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {user && <UserAvatar initials={user.initials} name={user.displayName} />}
      </div>
    </header>
  );
}

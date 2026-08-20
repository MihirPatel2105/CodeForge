"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
import { UserAvatar } from "@/components/user-avatar";
import { LogoMark } from "@/components/brand/logo-mark";

/** Marketing header for the landing page. Distinct from the signed-in `AppHeader`:
 * this one sells, that one navigates — but it still has to know who is looking at it.
 * Asking a signed-in user to "Get started" is the kind of detail that makes a product
 * feel like it is not paying attention. */
export function SiteHeader() {
  const user = useCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-bg/90 backdrop-blur">
      <div className="flex h-[58px] items-center justify-between mx-auto w-full px-6 md:px-10 lg:px-14">
        <Link href="/" className="flex items-center gap-[9px]">
          <LogoMark className="h-6 w-6 rounded-[2px]" />
          <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">codeforge</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/projects"
                className="rounded-[2px] bg-fg px-[15px] py-[10px] font-mono text-[11px] font-[600] uppercase tracking-[0.12em] text-surface transition-opacity hover:opacity-88"
              >
                Go to projects
              </Link>
              <UserAvatar initials={user.initials} name={user.displayName} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-[6px] font-mono text-[11px] font-[600] uppercase tracking-[0.12em] text-fg underline underline-offset-[5px] decoration-1 decoration-border-strong hover:decoration-fg"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-[2px] bg-fg px-[15px] py-[10px] font-mono text-[11px] font-[600] uppercase tracking-[0.12em] text-surface transition-opacity hover:opacity-88"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

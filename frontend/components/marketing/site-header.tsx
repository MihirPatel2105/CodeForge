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
    <header className="sticky top-0 z-20 border-b border-rule bg-bg/90 backdrop-blur-xl">
      <div className="flex h-[58px] items-center justify-between mx-auto w-full px-6 md:px-10 lg:px-14">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-8 w-8" />
          <span className="cf-wordmark text-fg">codeforge</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/projects"
                className="rounded-lg bg-fg px-4 py-2.5 text-[13px] font-[650] text-surface transition-opacity hover:opacity-85"
              >
                Go to projects
              </Link>
              <UserAvatar initials={user.initials} name={user.displayName} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-[13px] font-[600] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-fg px-4 py-2.5 text-[13px] font-[650] text-surface transition-opacity hover:opacity-85"
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

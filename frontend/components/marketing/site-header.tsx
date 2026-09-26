"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
import { UserAvatar } from "@/components/user-avatar";
import { LogoMark } from "@/components/brand/logo-mark";

/** Public site header. The brand and account actions stay clear of the page content. */
export function SiteHeader() {
  const user = useCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-bg/85 shadow-[0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1536px] items-center justify-between gap-3 px-4 sm:px-6 md:px-10 lg:px-14">
        <Link
          href="/"
          aria-label="CodeForge home"
          className="flex w-fit shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="cf-wordmark text-fg">Code<span className="cf-wordmark__forge">Forge</span></span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/projects"
                className="inline-flex h-10 items-center rounded-lg bg-fg px-3 text-[13px] font-[650] text-surface transition-[background-color,transform] hover:bg-fg/90 active:scale-[0.98] sm:px-4"
              >
                Projects
              </Link>
              <UserAvatar initials={user.initials} name={user.displayName} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-lg px-2 text-[13px] font-[600] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:px-3"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center rounded-lg bg-fg px-3 text-[13px] font-[650] text-surface transition-[background-color,transform] hover:bg-fg/90 active:scale-[0.98] sm:px-4"
              >
                <span className="hidden min-[380px]:inline">Get started</span>
                <span className="min-[380px]:hidden">Start</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";
import { UserAvatar } from "@/components/user-avatar";
import { LogoMark } from "@/components/brand/logo-mark";
import { cn } from "@/lib/utils";

const PAGES = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
] as const;

/** Shared navigation across the public site. Account actions follow the session. */
export function SiteHeader() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="sticky top-0 z-20 border-b border-rule bg-bg/85 shadow-[0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="mx-auto grid h-16 w-full max-w-[1536px] grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-6 md:px-10 lg:grid-cols-[1fr_auto_1fr] lg:px-14">
        <Link
          href="/"
          aria-label="CodeForge home"
          className="flex w-fit items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="cf-wordmark text-fg">codeforge</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 rounded-full border border-border bg-surface/85 p-1 shadow-[0_2px_8px_rgba(23,32,51,0.035)] lg:flex">
          {PAGES.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-[600] transition-colors",
                pathname === href
                  ? "bg-surface-2 text-fg"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/projects"
                className="hidden h-10 items-center rounded-full bg-fg px-4 text-[13px] font-[650] text-surface transition-[background-color,transform] hover:bg-fg/90 active:scale-[0.98] sm:inline-flex"
              >
                Projects
              </Link>
              <UserAvatar initials={user.initials} name={user.displayName} className="rounded-full" />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-3 py-2 text-[13px] font-[600] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center rounded-full bg-fg px-4 text-[13px] font-[650] text-surface transition-[background-color,transform] hover:bg-fg/90 active:scale-[0.98]"
              >
                <span className="hidden min-[380px]:inline">Get started</span>
                <span className="min-[380px]:hidden">Start</span>
              </Link>
            </>
          )}

          <button
            ref={menuButton}
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-controls="site-mobile-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-fg transition-colors hover:bg-surface-2 lg:hidden"
          >
            {menuOpen ? <X className="h-[18px] w-[18px]" aria-hidden /> : <Menu className="h-[18px] w-[18px]" aria-hidden />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="site-mobile-navigation"
          aria-label="Mobile navigation"
          className="absolute inset-x-4 top-[calc(100%+8px)] rounded-2xl border border-border bg-surface p-2 shadow-[0_20px_50px_rgba(23,32,51,0.14)] sm:inset-x-auto sm:right-6 sm:w-64 md:right-10 lg:hidden"
        >
          {PAGES.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "block rounded-xl px-4 py-3 text-[14px] font-[600] transition-colors hover:bg-surface-2",
                pathname === href ? "bg-surface-2 text-fg" : "text-fg-muted",
              )}
            >
              {label}
            </Link>
          ))}
          {user && (
            <Link
              href="/projects"
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-4 py-3 text-[14px] font-[600] text-fg-muted transition-colors hover:bg-surface-2 sm:hidden"
            >
              Projects
            </Link>
          )}
          {!user && (
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-4 py-3 text-[14px] font-[600] text-fg-muted transition-colors hover:bg-surface-2 sm:hidden"
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

"use client";

import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motionSpring } from "@/lib/motion-tokens";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-current-user";
import { UserAvatar } from "@/components/user-avatar";
import { AttentionInbox } from "@/components/dashboard/attention-inbox";
import { LogoLockup } from "@/components/brand/logo-lockup";

const MotionLink = motion.create(Link);

/** Public site header. The brand and account actions stay clear of the page content. */
export function SiteHeader({ workspace = false }: { workspace?: boolean }) {
  const reducedMotion = useMotionPreference();
  const pressMotion = { whileTap: reducedMotion ? undefined : { scale: 0.98 }, animate: reducedMotion ? { scale: 1 } : undefined, transition: reducedMotion ? { duration: 0 } : motionSpring };
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const { user, loading } = useSession();
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    if (!isLandingPage) return;

    let frame = 0;
    const update = () => { frame = 0; setFloating(window.scrollY > 48); };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [isLandingPage]);

  return (
    <header className="cf-site-header sticky top-0 z-20 h-16" data-floating={isLandingPage && floating}>
      <div className="cf-site-header-bar border border-transparent border-b-rule bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1536px] items-center justify-between gap-3 px-4 sm:px-6 md:px-10 lg:px-14">
        <MotionLink {...pressMotion}
          href="/"
          aria-label="CodeForge home"
          className="flex w-fit shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <LogoLockup className="h-9 w-auto shrink-0" />
        </MotionLink>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {loading ? (
              <div role="status" aria-label="Loading account" className="flex h-10 items-center gap-3">
                <span aria-hidden className="h-10 w-24 rounded-full bg-fg/5 motion-safe:animate-pulse" />
                <span aria-hidden className="h-10 w-10 rounded-full bg-fg/5 motion-safe:animate-pulse" />
              </div>
            ) : user ? (
            <>
              <AttentionInbox key={user.id} userId={user.id} />
              {workspace && user.is_admin && (
                <MotionLink {...pressMotion} href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined} className="hidden sm:inline-flex h-10 items-center rounded-full px-3 text-[13px] font-[600] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:px-4">
                  Admin
                </MotionLink>
              )}
              <MotionLink {...pressMotion}
                aria-current={workspace && (pathname.startsWith("/projects") || pathname.startsWith("/runs")) ? "page" : undefined}
                href="/projects"
                className="cf-header-projects inline-flex h-10 items-center rounded-full bg-accent px-3 text-[13px] font-[650] text-surface transition-[background-color] hover:bg-accent/90 sm:px-4"
              >
                Projects
              </MotionLink>
              <UserAvatar initials={user.initials} name={user.displayName} className="cf-header-profile" />
            </>
          ) : (
            <>
              <MotionLink {...pressMotion}
                href="/login"
                className="inline-flex h-10 items-center rounded-lg px-2 text-[13px] font-[600] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:px-3"
              >
                Sign in
              </MotionLink>
              <MotionLink {...pressMotion}
                href="/signup"
                className="inline-flex h-10 items-center rounded-full bg-accent px-3 text-[13px] font-[650] text-surface transition-[background-color] hover:bg-accent/90 sm:px-4"
              >
                <span className="hidden min-[380px]:inline">Get started</span>
                <span className="min-[380px]:hidden">Start</span>
              </MotionLink>
            </>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}

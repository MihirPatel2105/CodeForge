"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { MobileNavigation } from "@/components/ui/enhancements/mobile-navigation";
import { HeaderAccount } from "./header-account";
import { NavMenu } from "./nav-menu";
import "./launch-hero.css";
import {
  DIRECTION_THRESHOLD_PX,
  INITIAL_HEADER_STATE,
  nextHeaderState,
  sameHeaderState,
  type HeaderState,
} from "./header-state";

interface LaunchHeaderProps {
  /** A dark hero the bar floats over; without one the bar starts solid and takes its own space. */
  heroId?: string;
  /** Hold the bar back until the hero's headline has landed (landing page only). */
  entrance?: boolean;
  /** The marketing dropdowns. Workspace pages leave them out; the account group stays. */
  siteNav?: boolean;
}

// Each page mounts its own bar. Module scope survives client-side navigation, so a new bar
// starts with the logo where the previous page left it, then slides on the next frame. Moving
// between two workspace pages (or two public pages) therefore leaves the logo still.
let logoWasLeft: boolean | null = null;

function useLogoLeft(left: boolean): boolean {
  const [current, setCurrent] = useState(() => logoWasLeft ?? left);
  useEffect(() => {
    logoWasLeft = left;
    const frame = requestAnimationFrame(() => setCurrent(left));
    return () => cancelAnimationFrame(frame);
  }, [left]);
  return current;
}

/** Top bar: pills carry their own surface, and the wordmark retracts into the mark on scroll. */
export function LaunchHeader({ heroId, entrance = false, siteNav = true }: LaunchHeaderProps) {
  const bar = useRef<HTMLElement>(null);
  const pathname = usePathname() ?? "";
  const logoLeft = useLogoLeft(!siteNav);
  const [state, setState] = useState<HeaderState>(() => (heroId ? INITIAL_HEADER_STATE : { ...INITIAL_HEADER_STATE, tone: "page" }));

  useEffect(() => {
    const hero = heroId ? document.getElementById(heroId) : null;
    let anchorY = window.scrollY;
    let wasHidden = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      const scrollY = window.scrollY;
      // Measured per frame: content above the hero can move it without resizing it.
      const heroBottom = hero ? hero.getBoundingClientRect().bottom + scrollY : 0;
      const next = nextHeaderState({
        scrollY,
        anchorY,
        heroBottom,
        headerHeight: bar.current?.offsetHeight ?? 0,
        wasHidden,
      });
      if (Math.abs(scrollY - anchorY) >= DIRECTION_THRESHOLD_PX) anchorY = scrollY;
      wasHidden = next.hidden;
      setState((current) => (sameHeaderState(current, next) ? current : next));
      bar.current?.setAttribute("data-ready", "");
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // Once the bar has slid in, drop the entrance for good, so a later style change
    // (focus leaving the bar) can never put it back into its delayed, off-screen start.
    const element = bar.current;
    const markEntered = (event: AnimationEvent) => {
      if (event.target === element && event.animationName === "lh-bar-in") element?.setAttribute("data-entered", "");
    };

    schedule();
    element?.addEventListener("animationend", markEntered);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      element?.removeEventListener("animationend", markEntered);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [heroId]);

  return (
    <header
      ref={bar}
      data-launch-header
      data-tone={state.tone}
      data-overlay={heroId ? "" : undefined}
      data-entrance={entrance ? "" : undefined}
      data-hidden={state.hidden ? "" : undefined}
      data-workspace={siteNav ? undefined : ""}
      className="lh-header"
    >
      <div className="lh-bar">
        {siteNav ? (
          <nav aria-label="Site" className="lh-start">
            <MobileNavigation />
            <NavMenu pathname={pathname} />
          </nav>
        ) : (
          // Keeps the three-column grid, so the logo stays centred.
          <div className="lh-start" />
        )}

        <Link
          href="/"
          aria-label="CodeForge home"
          className="lh-logo"
          data-collapsed={state.collapsed ? "" : undefined}
          data-logo-left={logoLeft ? "" : undefined}
        >
          <LogoLockup className="lh-lockup" />
        </Link>

        <div className="lh-end">
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}

"use client";

import { useRef, type ReactNode, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { useMotionPreference } from "@/lib/use-motion-preference";
import SpotlightCard from "./profile-spotlight";

export function ProfilePanel({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { resolvedTheme } = useTheme();
  const reduced = useMotionPreference();
  return <SpotlightCard className={`profile-premium-panel ${className}`} theme={resolvedTheme === "dark" ? "dark" : "light"}
    intensity={reduced ? 0 : 0.08} borderGlow={reduced ? 0 : 0.3} proximity={0} grain={0} flare={false}
    style={{ "--profile-delay": `${delay}s`, "--spotlight-card-surface": "var(--bg)", "--spotlight-card-border": "var(--border)", "--spotlight-card-shadow": "var(--profile-panel-shadow)" } as CSSProperties}>
    {children}
  </SpotlightCard>;
}

/** Restrained identity-card tilt, adapted from the React Bits Profile Card interaction. */
export function ProfileIdentityCard({ children }: { children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  function reset() {
    card.current?.style.removeProperty("--profile-rotate-x");
    card.current?.style.removeProperty("--profile-rotate-y");
    card.current?.style.removeProperty("--profile-glare-x");
    card.current?.style.removeProperty("--profile-glare-y");
  }
  return <div className="profile-identity-stage"><div ref={card} className="profile-premium-identity" onPointerMove={event => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    event.currentTarget.style.setProperty("--profile-rotate-x", `${(0.5 - y) * 5}deg`);
    event.currentTarget.style.setProperty("--profile-rotate-y", `${(x - 0.5) * 5}deg`);
    event.currentTarget.style.setProperty("--profile-glare-x", `${x * 100}%`);
    event.currentTarget.style.setProperty("--profile-glare-y", `${y * 100}%`);
  }} onPointerLeave={reset} onPointerCancel={reset}>{children}</div></div>;
}

"use client";

import { type ComponentProps, type CSSProperties, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useMotionPreference } from "@/lib/use-motion-preference";
import SpotlightCard from "./profile-spotlight";

export function SettingsPanel({ children, className = "", ...props }: ComponentProps<"section">) {
  const { resolvedTheme } = useTheme();
  const reduced = useMotionPreference();
  return <section className={`settings-premium-panel ${className}`} {...props}>
    <SpotlightCard className="settings-panel-surface" theme={resolvedTheme === "dark" ? "dark" : "light"}
      intensity={reduced ? 0 : 0.07} borderGlow={reduced ? 0 : 0.25} proximity={0} grain={0} flare={false}
      style={{ "--spotlight-card-surface": "var(--bg)", "--spotlight-card-border": "transparent", "--spotlight-card-shadow": "none" } as CSSProperties}>
      {children}
    </SpotlightCard>
  </section>;
}

/** React Bits Line Sidebar proximity adapted to native, accessible anchor links. */
export function SettingsRail({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const links = Array.from(node.querySelectorAll<HTMLAnchorElement>("nav a"));
    const reset = () => links.forEach(link => link.style.removeProperty("--settings-shift"));
    if (reduced) { reset(); return; }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      for (const link of links) {
        const rect = link.getBoundingClientRect();
        const distance = Math.abs(event.clientY - rect.top - rect.height / 2);
        const proximity = Math.max(0, 1 - distance / 90);
        const smooth = proximity * proximity * (3 - 2 * proximity);
        link.style.setProperty("--settings-shift", `${smooth * 4}px`);
      }
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", reset);
    return () => { node.removeEventListener("pointermove", move); node.removeEventListener("pointerleave", reset); reset(); };
  }, [reduced]);
  return <aside ref={root} className="settings-premium-rail"><p className="settings-rail-label">ON THIS PAGE</p>{children}<p className="settings-rail-note">Your access.<br />Your control.</p></aside>;
}

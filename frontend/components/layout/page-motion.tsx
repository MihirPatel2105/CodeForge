"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { animate } from "motion";
import { motionTransition } from "@/lib/motion-tokens";

/** Animate the new route without remounting its session or live-stream state. */
export function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || pathname === "/login" || pathname === "/signup" || pathname === "/login/passkey") return;

    const animations: Array<{ stop: () => void }> = [];
    const main = document.querySelector("main");
    if (main) {
      animations.push(animate(main, { opacity: [0.8, 1] }, motionTransition));
    }

    // Only public editorial sections reveal on scroll; live evidence remains immediate.
    const sections = Array.from(document.querySelectorAll<HTMLElement>(
      ".cf-premium-marketing main > section:not(:first-child), .cf-premium main > section:not(:first-child)",
    ));
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || preference.matches) continue;
        const section = entry.target as HTMLElement;
        animations.push(animate(section, { opacity: [0.75, 1], y: [12, 0] }, { ...motionTransition, duration: 0.4 }));
        observer?.unobserve(section);
      }
    }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });
    for (const section of sections) {
      if (!observer || section.getBoundingClientRect().top < window.innerHeight) continue;
      observer.observe(section);
    }

    const revealImmediately = () => {
      if (!preference.matches) return;
      observer?.disconnect();
      animations.forEach((animation) => animation.stop());
      main?.style.removeProperty("opacity");
      sections.forEach((section) => { section.style.removeProperty("opacity"); section.style.removeProperty("transform"); });
    };
    preference.addEventListener("change", revealImmediately);
    return () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.stop());
      main?.style.removeProperty("opacity");
      sections.forEach((section) => { section.style.removeProperty("opacity"); section.style.removeProperty("transform"); });
      preference.removeEventListener("change", revealImmediately);
    };
  }, [pathname]);

  return children;
}

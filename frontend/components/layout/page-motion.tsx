"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/** Animate the new route without remounting its session or live-stream state. */
export function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;

    const animations: Animation[] = [];
    const main = document.querySelector("main");
    if (main && typeof main.animate === "function") {
      animations.push(main.animate(
        [{ opacity: 0.65, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" },
      ));
    }

    // Only public editorial sections reveal on scroll; live evidence remains immediate.
    const sections = Array.from(document.querySelectorAll<HTMLElement>(
      ".cf-premium-marketing main > section:not(:first-child)",
    ));
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const section = entry.target as HTMLElement;
        section.classList.remove("cf-reveal-pending");
        observer?.unobserve(section);
      }
    }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });
    for (const section of sections) {
      if (!observer || section.getBoundingClientRect().top < window.innerHeight) continue;
      section.classList.add("cf-reveal-pending");
      observer.observe(section);
    }

    const revealImmediately = () => {
      if (!preference.matches) return;
      animations.forEach((animation) => animation.cancel());
      sections.forEach((section) => section.classList.remove("cf-reveal-pending"));
    };
    preference.addEventListener("change", revealImmediately);
    return () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      sections.forEach((section) => section.classList.remove("cf-reveal-pending"));
      preference.removeEventListener("change", revealImmediately);
    };
  }, [pathname]);

  return children;
}

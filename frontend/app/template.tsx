"use client";

import { useEffect, useRef } from "react";

export default function RouteTransition({ children }: Readonly<{ children: React.ReactNode }>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sections = Array.from(container.querySelectorAll<HTMLElement>("main > section, .cf-home > section"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.removeAttribute("data-cf-reveal-pending");
        entry.target.setAttribute("data-cf-reveal-visible", "");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });

    for (const section of sections) {
      if (section.getBoundingClientRect().top < window.innerHeight) continue;
      section.setAttribute("data-cf-reveal-pending", "");
      observer.observe(section);
    }

    return () => {
      observer.disconnect();
      for (const section of sections) {
        section.removeAttribute("data-cf-reveal-pending");
        section.removeAttribute("data-cf-reveal-visible");
      }
    };
  }, []);

  return <div ref={containerRef} className="cf-route-transition">{children}</div>;
}

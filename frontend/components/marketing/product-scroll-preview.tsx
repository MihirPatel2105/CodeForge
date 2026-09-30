"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Scroll progress controls both the preview's scale and its occupied space. */
export function ProductScrollPreview({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = container.current;
    const preview = frame?.firstElementChild as HTMLElement | null;
    if (!frame || !preview) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scheduled = 0;
    const update = () => {
      scheduled = 0;
      const viewport = window.innerHeight;
      const top = frame.getBoundingClientRect().top;
      // Reach full size near the top of the viewport; reverse along the same path.
      const position = top + window.scrollY;
      const start = Math.max(0, position - viewport * 0.9);
      const end = Math.max(start + viewport * 0.35, position - viewport * 0.15);
      const progress = Math.max(0, Math.min(1, (window.scrollY - start) / (end - start)));
      const compactScale = window.innerWidth <= 600 ? 0.96 : 0.8;
      const scale = motion.matches ? 1 : compactScale + (1 - compactScale) * progress;
      frame.style.setProperty("--preview-scale", String(scale));
      frame.style.height = `${preview.offsetHeight * scale}px`;
      frame.dataset.scrollReady = "true";
    };
    const schedule = () => {
      if (!scheduled) scheduled = window.requestAnimationFrame(update);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(preview);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    update();

    return () => {
      window.cancelAnimationFrame(scheduled);
      resize?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
      frame.style.removeProperty("--preview-scale");
      frame.style.removeProperty("height");
      delete frame.dataset.scrollReady;
    };
  }, []);

  return <div ref={container} className="lp-product-scroll">{children}</div>;
}

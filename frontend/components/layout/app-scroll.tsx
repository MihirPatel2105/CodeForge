"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

export function AppScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let revision = 0;
    let lenis: Lenis | undefined;

    const destroy = () => {
      if (!lenis) return;
      // Clear Lenis's pending native-scroll timeout before it can restore classes.
      lenis.stop();
      window.dispatchEvent(new Event("scroll"));
      lenis.destroy();
      lenis = undefined;
    };

    const update = async () => {
      const currentRevision = ++revision;
      destroy();
      if (preference.matches) return;

      const { default: Lenis } = await import("lenis");
      if (disposed || preference.matches || currentRevision !== revision) return;

      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.09,
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: -72 },
        allowNestedScroll: true,
        prevent: node => node.tagName === "DIALOG" || node.tagName === "CANVAS",
      });
    };

    void update();
    preference.addEventListener("change", update);
    return () => {
      disposed = true;
      preference.removeEventListener("change", update);
      destroy();
    };
  }, [pathname]);

  return null;
}

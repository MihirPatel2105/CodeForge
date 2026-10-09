"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

const marketingRoutes = new Set(["/", "/about", "/how-it-works"]);

export function MarketingScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (!marketingRoutes.has(pathname)) return;

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
        lerp: 0.14,
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: -72 },
        allowNestedScroll: true,
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

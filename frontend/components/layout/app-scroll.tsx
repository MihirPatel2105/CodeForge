"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

let activeScroll: Lenis | undefined;
const scrollLocks = new Set<symbol>();

/** Native modal locking cannot stop Lenis's programmatic wheel scrolling. */
export function pausePageScroll() {
  const lock = Symbol("modal-scroll-lock");
  scrollLocks.add(lock);
  activeScroll?.stop();
  return () => {
    scrollLocks.delete(lock);
    if (scrollLocks.size === 0) activeScroll?.start();
  };
}

/** Use the same scroll controller as the page so native and Lenis animations do not compete. */
export function scrollToSection(target: HTMLElement, reduced: boolean) {
  if (scrollLocks.size > 0) return;
  const top = target.getBoundingClientRect().top + window.scrollY - 96;
  if (activeScroll && !reduced) {
    activeScroll.resize();
    activeScroll.scrollTo(top, { duration: 0.7 });
  } else {
    window.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
  }
}

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
      if (activeScroll === lenis) activeScroll = undefined;
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
      activeScroll = lenis;
      if (scrollLocks.size > 0) lenis.stop();
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

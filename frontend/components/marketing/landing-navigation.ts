import type { MouseEvent } from "react";
import { scrollToSection } from "@/components/layout/app-scroll";

export function followLandingSection(event: MouseEvent<HTMLAnchorElement>, reducedMotion: boolean) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const hash = event.currentTarget.hash;
  const target = hash && document.getElementById(hash.slice(1));
  if (!target) return;
  event.preventDefault();
  if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  // An early native smooth scroll can be interrupted when Lenis first attaches.
  scrollToSection(target, reducedMotion || !document.documentElement.classList.contains("lenis"));
}

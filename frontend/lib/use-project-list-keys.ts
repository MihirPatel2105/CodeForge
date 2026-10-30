"use client";

import { useEffect, type RefObject } from "react";

/** Elements where a plain key press is someone typing or driving a widget. */
const TYPING = "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']";

/**
 * Linear-style keys for the projects list: `/` jumps to search, `j` and `k` move focus
 * down and up through the project links, and Enter opens the focused one natively.
 * Keys with a modifier, or pressed while typing, are left alone.
 */
export function useProjectListKeys(searchRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TYPING)) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key !== "j" && event.key !== "k") return;
      const links = Array.from(document.querySelectorAll<HTMLElement>("[data-project-link]"));
      if (!links.length) return;
      event.preventDefault();
      const current = links.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "j" ? Math.min(current + 1, links.length - 1) : Math.max(current < 0 ? 0 : current - 1, 0);
      links[next].focus();
      links[next].scrollIntoView({ block: "nearest" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchRef]);
}

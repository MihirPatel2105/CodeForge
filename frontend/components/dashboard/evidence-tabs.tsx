"use client";

import { LayoutGroup, motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motionSpring } from "@/lib/motion-tokens";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type EvidenceView = "timeline" | "code" | "terminal" | "tests";

const VIEWS: EvidenceView[] = ["timeline", "code", "terminal", "tests"];

/** The desktop workbench shows all evidence; these tabs navigate its compact layout. */
export function EvidenceTabs({
  value,
  onValueChange,
  idPrefix,
  label,
}: {
  value: EvidenceView;
  onValueChange: (view: EvidenceView) => void;
  idPrefix: string;
  label: string;
}) {
  const reducedMotion = useMotionPreference();
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % VIEWS.length
      : event.key === "ArrowLeft" ? (index - 1 + VIEWS.length) % VIEWS.length
        : event.key === "Home" ? 0
          : event.key === "End" ? VIEWS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const view = VIEWS[next];
    onValueChange(view);
    document.getElementById(`${idPrefix}-tab-${view}`)?.focus();
  }

  return (
    <LayoutGroup id={idPrefix}><div className="mb-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-border bg-surface xl:hidden" role="tablist" aria-label={label}>
      {VIEWS.map((view, index) => (
        <button
          key={view}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${view}`}
          aria-controls={`${idPrefix}-panel-${view}`}
          aria-selected={value === view}
          tabIndex={value === view ? 0 : -1}
          onClick={() => onValueChange(view)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={cn(
            "relative isolate min-h-11 border-r border-border px-2 py-3 text-[13px] font-semibold last:border-r-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent",
            value === view ? "text-accent" : "text-fg-muted hover:bg-surface-2",
          )}
        >
          {value === view && <motion.span layoutId="evidence-selection" className="absolute inset-0 -z-10 bg-accent-soft" transition={reducedMotion ? { duration: 0 } : motionSpring} aria-hidden />}
          {view.charAt(0).toUpperCase() + view.slice(1)}
        </button>
      ))}
    </div></LayoutGroup>
  );
}

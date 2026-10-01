"use client";

import { useId, useState, type ReactNode } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";

export function AnimatedDisclosure({ title, children, className = "" }: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useMotionPreference();
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <section className={`rounded-lg border border-border bg-bg text-[12px] leading-5 text-fg-muted ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-lg p-4 text-left font-[700] text-fg transition-colors duration-150 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent motion-reduce:transition-none"
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={reducedMotion ? { duration: 0 } : undefined} className="inline-flex shrink-0" aria-hidden><ChevronRight className="h-4 w-4" /></motion.span>
        {title}
      </button>
      <motion.div id={contentId} initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={reducedMotion ? { duration: 0 } : undefined} className="overflow-hidden" aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </motion.div>
    </section>
  );
}

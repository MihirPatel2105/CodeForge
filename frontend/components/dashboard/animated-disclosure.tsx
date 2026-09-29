"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function AnimatedDisclosure({ title, children, className = "" }: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
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
        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-[250ms] ease-out motion-reduce:transition-none ${open ? "rotate-90" : ""}`} aria-hidden />
        {title}
      </button>
      <div id={contentId} className={`grid transition-[grid-template-rows,opacity] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

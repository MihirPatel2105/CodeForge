"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ApprovalPresenceProps {
  show: boolean;
  children: ReactNode;
}

/** Retain the checkpoint while its exit transition closes the layout gap. */
export function ApprovalPresence({ show, children }: ApprovalPresenceProps) {
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(false);
  const lastChildren = useRef(children);

  if (show) lastChildren.current = children;

  useEffect(() => {
    if (show) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setOpen(false);
    if (!mounted) return;
    const timeout = window.setTimeout(() => setMounted(false), 360);
    return () => window.clearTimeout(timeout);
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={cn(
        "grid transition-[grid-template-rows,opacity] motion-safe:duration-[360ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-150",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden motion-safe:transition-transform motion-safe:duration-[360ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "motion-safe:translate-y-0" : "motion-safe:-translate-y-2",
        )}
      >
        {lastChildren.current}
      </div>
    </div>
  );
}

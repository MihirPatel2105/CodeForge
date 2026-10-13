"use client";

// Adapted from Skiper UI 99. Attribution and usage terms: docs/vendor/skiper-ui.md.
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { cn } from "@/lib/utils";

export function AnimatedArrow({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cn("cf-animated-arrow size-4", className)} aria-hidden>
    <path className="cf-arrow-shaft" d="M4 12h15" /><path className="cf-arrow-head" d="m13 6 6 6-6 6" />
  </svg>;
}

export function AnimatedMenu({ open }: { open: boolean }) {
  const reduced = useMotionPreference();
  const transition = { duration: reduced ? 0 : 0.2 };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <motion.path initial={false} animate={{ d: open ? "M6 6L18 18" : "M4 6H20" }} transition={transition} />
    <motion.path initial={false} d="M4 12H20" animate={{ opacity: open ? 0 : 1 }} transition={transition} />
    <motion.path initial={false} animate={{ d: open ? "M6 18L18 6" : "M4 18H20" }} transition={transition} />
  </svg>;
}

"use client";

import { type ReactNode } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { AnimatePresence, motion, useIsPresent } from "motion/react";

interface ApprovalPresenceProps {
  show: boolean;
  children: ReactNode;
}

function ApprovalPanel({ children }: { children: ReactNode }) {
  const reducedMotion = useMotionPreference();
  const present = useIsPresent();
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      aria-hidden={!present}
      inert={!present}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

export function ApprovalPresence({ show, children }: ApprovalPresenceProps) {
  return (
    <AnimatePresence initial={false}>
      {show && <ApprovalPanel key="approval">{children}</ApprovalPanel>}
    </AnimatePresence>
  );
}

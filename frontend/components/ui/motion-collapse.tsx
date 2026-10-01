"use client";

import type { ComponentProps, ReactNode } from "react";
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function MotionCollapse({ open, children, ...props }: {
  open: boolean;
  children: ReactNode;
} & Omit<ComponentProps<typeof motion.div>, "children" | "animate" | "initial" | "transition">) {
  const reducedMotion = useMotionPreference();
  return (
    <motion.div
      {...props}
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={reducedMotion ? { duration: 0 } : undefined}
      aria-hidden={!open}
      inert={!open}
      style={{ ...props.style, overflow: "hidden" }}
    >
      {children}
    </motion.div>
  );
}

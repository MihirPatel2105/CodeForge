"use client";

import { MotionConfig } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motionTransition } from "@/lib/motion-tokens";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reducedMotion = useMotionPreference();
  return <MotionConfig reducedMotion={reducedMotion ? "always" : "never"} transition={motionTransition}>{children}</MotionConfig>;
}

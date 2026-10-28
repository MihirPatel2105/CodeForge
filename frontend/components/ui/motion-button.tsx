"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { controlMotion } from "@/lib/motion-tokens";

/** Press feedback for existing native controls; their handlers and semantics stay intact. */
export function MotionButton(props: HTMLMotionProps<"button">) {
  const reducedMotion = useMotionPreference();
  const inactive = props.disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";
  return (
    <motion.button
      {...props}
      data-motion-control
      {...controlMotion(reducedMotion, inactive)}
    />
  );
}

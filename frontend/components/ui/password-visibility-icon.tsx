"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  const reduced = useMotionPreference();
  const Icon = visible ? EyeOff : Eye;
  return (
    <span aria-hidden="true" className="relative inline-grid size-4 shrink-0 place-items-center">
      <AnimatePresence initial={false}>
        <motion.span
          key={visible ? "visible" : "hidden"}
          className="absolute inset-0 inline-grid place-items-center"
          initial={reduced ? false : { opacity: 0, scale: 0.75, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 0.75, rotate: reduced ? 0 : 12 }}
          transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
        >
          <Icon className="size-4" />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

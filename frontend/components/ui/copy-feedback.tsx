"use client";

import { useMotionPreference } from "@/lib/use-motion-preference";
import { motion } from "motion/react";
import { Check, Copy } from "lucide-react";

export function CopyFeedback({ copied, label, iconClassName = "h-3.5 w-3.5" }: {
  copied: boolean;
  label: string;
  iconClassName?: string;
}) {
  const reducedMotion = useMotionPreference();
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.18 };

  return (
    <span className="inline-grid items-center" aria-hidden="true">
      <motion.span initial={false} animate={{ opacity: copied ? 0 : 1, y: reducedMotion ? 0 : copied ? -4 : 0 }} transition={transition} className="col-start-1 row-start-1 inline-flex items-center gap-1.5">
        <Copy className={iconClassName} />{label}
      </motion.span>
      <motion.span initial={false} animate={{ opacity: copied ? 1 : 0, y: reducedMotion ? 0 : copied ? 0 : 4 }} transition={transition} className="col-start-1 row-start-1 inline-flex items-center gap-1.5">
        <Check className={`${iconClassName} text-ok`} />Copied
      </motion.span>
    </span>
  );
}

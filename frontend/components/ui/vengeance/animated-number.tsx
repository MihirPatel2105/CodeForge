"use client";

// Adapted from Vengeance UI. MIT license and source provenance: docs/vendor/vengeance-ui.md.
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { cn } from "@/lib/utils";

export function AnimatedNumber({ value, formatter = String, className }: {
  value: number; formatter?: (value: number) => string; className?: string;
}) {
  const reduced = useMotionPreference();
  const text = formatter(value);
  return (
    <span className={cn("vui-number", className)}>
      <span className="sr-only">{text}</span>
      <span className="vui-number-digits" aria-hidden>
        {Array.from(text).map((digit, index) => /\d/.test(digit) ? (
          <span key={text.length - index} className="vui-digit">
            <motion.span className="vui-digit-strip" initial={false}
              animate={{ y: `${-Number(digit) * 10}%` }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 25 }}>
              {Array.from({ length: 10 }, (_, n) => <span key={n}>{n}</span>)}
            </motion.span>
          </span>
        ) : <span key={text.length - index}>{digit}</span>)}
      </span>
    </span>
  );
}

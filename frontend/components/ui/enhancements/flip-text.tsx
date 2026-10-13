"use client";

// Adapted from Vengeance UI. MIT attribution: docs/vendor/vengeance-ui.md.
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function FlipText({ children }: { children: string }) {
  const reduced = useMotionPreference();
  return <span className="cf-flip-text"><span className="sr-only">{children}</span><span aria-hidden>
    {children.split(" ").map((word, index) => <motion.span className="cf-flip-word" key={`${index}-${word}`}
      initial={false} whileInView={{ opacity: 1, transform: "rotateX(0deg) translateY(0)" }} viewport={{ once: true, amount: 0.5 }}
      style={reduced ? undefined : { opacity: 0.65, transform: "rotateX(-20deg) translateY(4px)" }}
      transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : index * 0.055 }}>{word}{index < children.split(" ").length - 1 ? "\u00a0" : ""}</motion.span>)}
  </span></span>;
}

"use client";

// Adapted from Vengeance UI's wordmark scroll reveal. MIT license: docs/vendor/vengeance-ui.md.
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function AnimatedFooter() {
  const reduced = useMotionPreference();
  return (
    <div className="vui-footer-mark" aria-hidden>
      <motion.span initial={false} whileInView={{ opacity: 1, transform: "translateY(0)" }}
        viewport={{ once: true }} className="vui-footer-word"
        style={reduced ? undefined : { opacity: 0.55, transform: "translateY(12%)" }}
        transition={{ duration: reduced ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}>CodeForge</motion.span>
    </div>
  );
}

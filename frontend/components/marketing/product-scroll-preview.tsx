"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

/** Grow the preview inside its normal layout footprint so scrolling cannot move later sections. */
export function ProductScrollPreview({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const reducedMotion = useMotionPreference();
  const { scrollYProgress } = useScroll({ target: container, offset: ["start 0.9", "start 0.15"] });
  const transform = useTransform(scrollYProgress, [0, 1], ["scale(0.94)", "scale(1)"]);

  return <motion.div
    ref={container}
    className="lp-product-scroll"
    initial={{ opacity: reducedMotion ? 1 : 0, transform: reducedMotion ? "none" : "translateY(16px)" }}
    animate={reducedMotion ? { opacity: 1, transform: "none" } : undefined}
    whileInView={{ opacity: 1, transform: "none" }}
    viewport={{ once: true, amount: 0.08 }}
    transition={reducedMotion ? { duration: 0, delay: 0 } : { duration: 1.6, delay: 0.85, ease: [0.22, 0.61, 0.36, 1] }}
  >
    <motion.div className="lp-product-scale" style={{ transform: reducedMotion ? "none" : transform }}>
      {children}
    </motion.div>
  </motion.div>;
}

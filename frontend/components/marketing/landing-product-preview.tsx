"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Code2 } from "lucide-react";
import Link from "next/link";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { HeroWorkspace } from "./hero-workspace";

export function LandingProductPreview() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({ target: root, offset: ["start end", "center center"] });
  const transform = useTransform(scrollYProgress, [0, 1], ["perspective(1800px) rotateX(12deg) scale(.93)", "perspective(1800px) rotateX(0deg) scale(1)"]);

  return <div className="ol-product-stage lp-product-scroll" ref={root}>
    <motion.div className="ol-product-entrance"
      initial={reduced ? false : { opacity: 0, transform: "translateY(24px)" }}
      animate={{ opacity: 1, transform: "none" }}
      transition={{ duration: reduced ? 0 : 1.5, delay: reduced ? 0 : 0.9, ease: [0.22, 0.61, 0.36, 1] }}
    >
    <motion.div className="ol-product-shell lp-product-scale" style={{ transform: reduced ? "none" : transform }}>
      <div className="ol-product-toolbar"><span className="ol-window-dots" aria-hidden><i /><i /><i /></span><Code2 size={16} aria-hidden /><strong>CodeForge</strong><span>Personal Library / Sample replay</span></div>
      <HeroWorkspace />
      <div className="ol-product-foot"><span>One prompt. A visible process.</span><Link href="/demo/library">Open the full run ↗</Link></div>
    </motion.div>
    </motion.div>
  </div>;
}

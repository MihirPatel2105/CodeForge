"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowDown, Check, Code2, FileCode2, GitBranch } from "lucide-react";
import Link from "next/link";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { ModelPreview } from "./control-previews";
import { followLandingSection } from "./landing-navigation";

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
      <div className="ol-product-toolbar"><span className="ol-window-dots" aria-hidden><i /><i /><i /></span><Code2 size={16} aria-hidden /><strong>CodeForge</strong><span>Personal Library / Recorded example</span></div>
      <div className="ol-product-workspace">
        <div className="ol-product-brief"><span className="ol-mini-label">Your brief</span><h2>A little library.{" "}<br />A real API.</h2><p>“An API for my books, authors, and reading list.”</p><div className="ol-brief-checks"><span><Check size={15} aria-hidden />Requirements approved</span><span><Check size={15} aria-hidden />Architecture approved</span></div><Link href="#build-story" onClick={event => followLandingSection(event, reduced)} aria-label="Follow the Library build">Follow this build<ArrowDown size={16} aria-hidden /></Link></div>
        <div className="ol-product-code"><div className="ol-run-stages" aria-label="Example agent pipeline">{["PM", "Architect", "Coder", "Reviewer", "Tester"].map(stage => <span key={stage}><Check size={10} aria-hidden />{stage}</span>)}</div><ModelPreview /><div className="ol-product-outcome"><span><Check size={14} aria-hidden />Tests + execution logs</span><span><FileCode2 size={13} aria-hidden />5 files</span><span><GitBranch size={13} aria-hidden />Inspectable result</span></div></div>
      </div>
      <div className="ol-product-foot"><span>One prompt. A visible process.</span><Link href="/demo/library">Inspect the recorded run ↗</Link></div>
    </motion.div>
    </motion.div>
  </div>;
}

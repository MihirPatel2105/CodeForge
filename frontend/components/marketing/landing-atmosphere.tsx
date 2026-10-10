"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./landing-atmosphere.css";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { ConstellationBackground } from "./constellation-background";
import { motion, useScroll, useTransform, type MotionStyle, type MotionValue } from "motion/react";

export function LandingAtmosphere({ children }: { children: ReactNode }) {
  const reducedMotion = useMotionPreference();
  const root = useRef<HTMLDivElement>(null);
  const [hero, setHero] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHero(root.current?.querySelector<HTMLElement>(".lp-hero") ?? null);
  }, []);
  const { scrollY } = useScroll();
  const backgroundOpacity = useTransform(scrollY, [0, 550], [1, 0]);
  const backgroundY = useTransform(scrollY, [0, 800], [0, 120]);
  const headerOpacity = useTransform(scrollY, [0, 64], [0, 1]);
  const heroY = useTransform(scrollY, [0, 600], [0, -40]);
  const heroScale = useTransform(scrollY, [0, 600], [1, .95]);
  const copyOpacity = useTransform(scrollY, [180, 620], [1, .15]);
  const previewY = useTransform(scrollY, [0, 650], [0, -24]);
  const style: MotionStyle & Record<string, MotionValue<number> | number> = {
    "--relief-opacity": backgroundOpacity,
    "--header-opacity": headerOpacity,
    "--hero-y": reducedMotion ? 0 : heroY,
    "--hero-scale": reducedMotion ? 1 : heroScale,
    "--hero-copy-opacity": reducedMotion ? 1 : copyOpacity,
    "--preview-y": reducedMotion ? 0 : previewY,
  };

  return (
    <motion.div ref={root} className="cf-landing-atmosphere cf-constellation" style={style}>
      {children}
      {hero && createPortal(<motion.div className="constellation-layer" style={{ y: reducedMotion ? 0 : backgroundY, opacity: backgroundOpacity }}><ConstellationBackground /></motion.div>, hero)}
    </motion.div>
  );
}

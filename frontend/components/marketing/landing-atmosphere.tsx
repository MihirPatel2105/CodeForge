"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./landing-atmosphere.css";
import { PointerBackground } from "./pointer-background";
import { motion, useScroll, useTransform, type MotionStyle, type MotionValue } from "motion/react";

export function LandingAtmosphere({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [hero, setHero] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHero(root.current?.querySelector<HTMLElement>(".lp-hero") ?? null);
  }, []);
  const { scrollY } = useScroll();
  const backgroundOpacity = useTransform(scrollY, [0, 320], [1, 0]);
  const headerOpacity = useTransform(scrollY, [0, 64], [0, 1]);
  const style: MotionStyle & { "--relief-opacity": MotionValue<number>; "--header-opacity": MotionValue<number> } = {
    "--relief-opacity": backgroundOpacity,
    "--header-opacity": headerOpacity,
  };

  return (
    <motion.div ref={root} className="cf-landing-atmosphere" style={style}>
      {children}
      {hero && createPortal(<PointerBackground hero={hero} />, hero)}
    </motion.div>
  );
}

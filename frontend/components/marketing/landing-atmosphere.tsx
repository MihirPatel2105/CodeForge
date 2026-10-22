"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./landing-atmosphere.css";
import { useMotionPreference } from "@/lib/use-motion-preference";
import dynamic from "next/dynamic";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const AsciiBackground = dynamic(() => import("./ascii-background").then(module => module.AsciiBackground), { ssr: false });
import { motion, useScroll, useTransform, type MotionStyle, type MotionValue } from "motion/react";

export function LandingAtmosphere({ children }: { children: ReactNode }) {
  const reducedMotion = useMotionPreference();
  const [paused, setPaused] = useState(false);
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
    <motion.div ref={root} className="cf-landing-atmosphere cf-constellation cf-gradient-ascii" style={style}>
      {children}
      {hero && createPortal(<motion.div className="ascii-layer" aria-hidden="true" style={{ y: reducedMotion ? 0 : backgroundY, opacity: backgroundOpacity }}><AsciiBackground paused={paused || reducedMotion} /></motion.div>, hero)}
      {hero && createPortal(<Button className="ascii-motion-control" variant="ghost" size="sm" disabled={reducedMotion} aria-pressed={paused || reducedMotion} onClick={() => setPaused(value => !value)}>
        {paused || reducedMotion ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}{paused || reducedMotion ? "Background paused" : "Pause background"}
      </Button>, hero)}
    </motion.div>
  );
}

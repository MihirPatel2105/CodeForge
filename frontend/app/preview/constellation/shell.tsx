"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import "@/components/marketing/landing-atmosphere.css";
import "./style.css";
import { ConstellationBackground } from "@/components/marketing/constellation-background";


export function ConstellationShell({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [hero, setHero] = useState<HTMLElement | null>(null);
  const reduced = useMotionPreference();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 800], [0, 120]);
  const opacity = useTransform(scrollY, [0, 550], [1, 0]);
  useEffect(() => { setHero(root.current?.querySelector<HTMLElement>(".lp-hero") ?? null); }, []);
  return <div ref={root} className="cf-landing-atmosphere constellation-preview">{children}{hero && createPortal(<motion.div className="constellation-layer" style={{ y: reduced ? 0 : y, opacity }}><ConstellationBackground /></motion.div>, hero)}</div>;
}

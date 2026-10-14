"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
export function Magnetic({ children }: { children: ReactNode }) {
  const root = useRef<HTMLSpanElement>(null);
  const reduced = useMotionPreference();
  const x = useMotionValue(0), y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 240, damping: 24 });
  const springY = useSpring(y, { stiffness: 240, damping: 24 });
  useEffect(() => { if (reduced) { x.jump(0); y.jump(0); springX.jump(0); springY.jump(0); } }, [reduced, x, y, springX, springY]);
  return <span ref={root} className="inline-flex" onPointerMove={event => {
    if (reduced || event.pointerType !== "mouse" || !matchMedia("(pointer:fine)").matches) return;
    const box = root.current?.getBoundingClientRect(); if (!box) return;
    x.set(Math.max(-5, Math.min(5, (event.clientX - box.left - box.width / 2) * .06)));
    y.set(Math.max(-4, Math.min(4, (event.clientY - box.top - box.height / 2) * .08)));
  }} onPointerLeave={() => { x.set(0); y.set(0); }} onBlur={() => { x.set(0); y.set(0); }}>
    <motion.span className="inline-flex" style={{ x: reduced ? 0 : springX, y: reduced ? 0 : springY }}>{children}</motion.span>
  </span>;
}

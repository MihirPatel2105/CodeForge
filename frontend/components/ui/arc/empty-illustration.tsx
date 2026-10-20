"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { FRAMES, KINDS, VIEW, shapePath, type SceneId } from "./empty-states-art";

// Extracted illustration scenes from Arc's free Empty States; no simulated actions or copy.
export function EmptyIllustration({ scene = "search", animateMap = false }: { scene?: SceneId; animateMap?: boolean }) {
  const routeClip = useId();
  const reduced = useMotionPreference();
  const frame = FRAMES[scene].idle;
  return <motion.svg aria-hidden="true" width="160" height="108" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .25 }} className="max-w-full shrink-0">
    <defs><clipPath id={routeClip}><motion.rect x="0" y="0" height={VIEW.height} initial={{ width: animateMap && !reduced ? 0 : VIEW.width }} animate={{ width: animateMap && !reduced ? [0, VIEW.width, VIEW.width] : VIEW.width }} transition={{ duration: reduced ? 0 : 4, times: [0, .65, 1], repeat: animateMap && !reduced ? 2 : 0, repeatDelay: 1 }} /></clipPath></defs>
    <motion.g animate={{ y: animateMap && !reduced ? [0, -3, 0] : 0 }} transition={{ duration: reduced ? 0 : 5, repeat: animateMap && !reduced ? 2 : 0, ease: "easeInOut" }}>
    {frame.prims.map((primitive, index) => {
      const path = shapePath(KINDS[index], primitive.geo, primitive.fx[1], 0, 0);
      const filled = ["query", "bar", "dot"].includes(primitive.tone);
      const ink = ["outline", "shade", "dot", "ink", "accent"].includes(primitive.tone);
      return <path clipPath={animateMap && primitive.redraw ? `url(#${routeClip})` : undefined} key={index} d={path.d} opacity={primitive.fx[0]} strokeDasharray={path.dash} fill={filled ? "var(--fg-muted)" : primitive.kind === "tile" || primitive.kind === "body" ? "var(--surface)" : "none"} stroke={filled ? "none" : ink ? "var(--fg)" : "var(--fg-muted)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
    })}
    </motion.g>
  </motion.svg>;
}

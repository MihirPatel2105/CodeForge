"use client";
import { useId } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

/** Shared letter positions carry the heading between real stage changes. */
export function TextMorph({ children }: { children: string }) {
  const id = useId();
  const reduced = useMotionPreference();
  const counts = new Map<string, number>();
  if (reduced) return <span>{children}</span>;
  return <LayoutGroup id={id}><span className="sr-only">{children}</span><span aria-hidden className="inline-flex flex-wrap whitespace-pre-wrap"><AnimatePresence initial={false} mode="popLayout">
    {Array.from(children).map(letter => {
      const count = counts.get(letter) ?? 0; counts.set(letter, count + 1);
      return <motion.span key={`${letter}-${count}`} layout="position" initial={{ opacity: 0, y: 5, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -5, filter: "blur(2px)" }} transition={{ duration: .24 }} className="inline-block">{letter === " " ? "\u00a0" : letter}</motion.span>;
    })}</AnimatePresence></span></LayoutGroup>;
}

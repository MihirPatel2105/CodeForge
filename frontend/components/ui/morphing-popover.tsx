"use client";
import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "./popover";
import { Button } from "./button";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function MorphingPopover({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduced = useMotionPreference();
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button variant="outline" size="sm" />}>{label}</PopoverTrigger>
    <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] overflow-hidden p-4">
      <PopoverTitle>{title}</PopoverTitle>
      <motion.div layout={!reduced} initial={reduced ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .18 }}>{children}</motion.div>
    </PopoverContent>
  </Popover>;
}

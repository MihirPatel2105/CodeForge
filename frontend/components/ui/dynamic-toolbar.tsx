"use client";
import { useId, useState, type ReactNode } from "react";
import { LayoutGroup, motion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "./popover";
import { Button } from "./button";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function DynamicToolbar({ children, primary }: { children: ReactNode; primary: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduced = useMotionPreference();
  const id = useId();
  return <motion.div layout={!reduced} className="flex shrink-0 items-center gap-2" role="group" aria-label="Code actions">
    {primary}<LayoutGroup><Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="relative isolate" />}>{!open && <motion.span aria-hidden layoutId={reduced ? undefined : id} transition={{ duration: .2 }} className="absolute inset-0 -z-10 rounded-lg bg-surface-2" />}<SlidersHorizontal aria-hidden />View options</PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <motion.div layoutId={reduced ? undefined : id} initial={reduced ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>
          <PopoverTitle className="mb-3">Code view</PopoverTitle><div className="flex flex-wrap gap-2">{children}</div>
        </motion.div>
      </PopoverContent>
    </Popover></LayoutGroup>
  </motion.div>;
}

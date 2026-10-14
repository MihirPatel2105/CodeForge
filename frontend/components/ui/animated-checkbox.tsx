"use client";

import type { ComponentProps } from "react";
import { motion } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked"> & { checked: boolean };

export function AnimatedCheckbox({ checked, className, ...props }: Props) {
  const reduced = useMotionPreference();
  return (
    <span className={cn("relative inline-flex size-5 shrink-0 items-center justify-center align-middle", className)}>
      <input {...props} type="checkbox" checked={checked}
        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
      <span aria-hidden="true" className="pointer-events-none grid size-4 place-items-center rounded-[4px] border border-border-strong bg-surface text-accent-foreground transition-colors duration-150 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50 motion-reduce:transition-none">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="m3.5 8 3 3 6-6" initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.15, ease: "easeOut" }} />
        </svg>
      </span>
    </span>
  );
}

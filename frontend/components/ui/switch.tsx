"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { motion } from "motion/react"
import { useMotionPreference } from "@/lib/use-motion-preference"
import { motionSpring } from "@/lib/motion-tokens"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  const reducedMotion = useMotionPreference()
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-[background-color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3"
        render={(thumbProps, state) => (
          <span {...thumbProps}>
            <motion.span
              className="block size-full rounded-full bg-background ring-0 dark:group-data-checked/switch:bg-primary-foreground dark:group-data-unchecked/switch:bg-foreground"
              initial={false}
              animate={{ x: state.checked ? (size === "sm" ? 10 : 14) : 0 }}
              transition={reducedMotion ? { duration: 0 } : motionSpring}
            />
          </span>
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

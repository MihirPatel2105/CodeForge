"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { motion } from "motion/react";
import type { VariantProps } from "class-variance-authority";
import { buttonShape, buttonVariants, type ButtonShape } from "./button";
import { controlMotion } from "@/lib/motion-tokens";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { cn } from "@/lib/utils";

const MotionLink = motion.create(Link);
type Props = ComponentProps<typeof MotionLink> & VariantProps<typeof buttonVariants> & { shape?: ButtonShape };

export function ButtonLink({ variant = "default", size = "default", shape = buttonShape(size, variant), className, ...props }: Props) {
  const reduced = useMotionPreference();
  return <MotionLink {...props} {...controlMotion(reduced, props["aria-disabled"] === true || props["aria-disabled"] === "true")}
    data-slot="button-link" data-ui-shape={shape} data-ui-variant={variant} data-ui-size={size}
    className={cn(buttonVariants({ variant, size, className }))} />;
}

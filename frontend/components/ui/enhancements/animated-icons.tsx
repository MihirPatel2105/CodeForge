"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnimatedArrow({ className }: { className?: string }) {
  return <ArrowRight className={cn("size-4", className)} aria-hidden />;
}

export function AnimatedMenu({ open }: { open: boolean }) {
  const Icon = open ? X : Menu;
  return <Icon size={20} aria-hidden />;
}

"use client";

// Adapted from Vengeance UI. MIT license: docs/vendor/vengeance-ui.md.
import type { ComponentProps } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GenerateButton({ isGenerating, className, disabled, ...props }:
  Omit<ComponentProps<typeof Button>, "children"> & { isGenerating: boolean }) {
  return (
    <Button {...props} disabled={disabled || isGenerating} aria-busy={isGenerating}
      data-generating={isGenerating} className={cn("vui-generate h-12 w-full gap-2 rounded-xl text-[14px]", className)}>
      <span className="vui-generate-sheen" aria-hidden />
      <span className="relative">{isGenerating ? "Starting…" : "Start run"}</span>
      {isGenerating ? <LoaderCircle data-icon="inline-end" className="vui-generate-spinner" aria-hidden /> : <ArrowRight data-icon="inline-end" aria-hidden />}
    </Button>
  );
}

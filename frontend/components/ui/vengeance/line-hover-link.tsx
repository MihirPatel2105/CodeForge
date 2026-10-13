// Adapted from Vengeance UI's slide variant. MIT license: docs/vendor/vengeance-ui.md.
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function LineHoverLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={cn("vui-line-link", className)}><span>{children}</span></Link>;
}

"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
export function DemoPreviewLink({ slug, label, children, className }: { slug: string; label: string; children: ReactNode; className?: string }) {
  return <HoverCard><HoverCardTrigger render={<Link href={`/demo/${slug}`} className={className} />} delay={180}>{children}</HoverCardTrigger>
    <HoverCardContent side="top" className="w-80 max-w-[calc(100vw-32px)] overflow-hidden p-0">
      <Image src={`/demos/${slug}.png`} alt={`${label} recorded run preview`} width={640} height={400} className="h-auto w-full" />
      <div className="border-t border-border p-3"><p className="font-semibold">{label} API</p><p className="mt-1 text-xs text-fg-muted">Explore the recorded build, generated code, and test results.</p></div>
    </HoverCardContent>
  </HoverCard>;
}

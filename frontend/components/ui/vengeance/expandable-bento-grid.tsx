"use client";

// Adapted from Vengeance UI. MIT license: docs/vendor/vengeance-ui.md.
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Feature = { title: string; description: string; content: string; icon: LucideIcon };
export function ExpandableBentoGrid({ items }: { items: Feature[] }) {
  return (
    <div className="vui-feature-grid">
      {items.map(item => (
        <Dialog key={item.title}>
          <DialogTrigger render={<Button variant="ghost" className="vui-feature-card" />}>
            <span className="vui-feature-top"><item.icon size={26} strokeWidth={1.5} aria-hidden /><ArrowUpRight size={18} aria-hidden /></span>
            <span className="vui-feature-title">{item.title}</span>
            <span className="vui-feature-description">{item.description}</span>
            <span className="vui-feature-more">Explore details</span>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><span className="vui-feature-dialog-icon"><item.icon size={32} aria-hidden /></span>
              <DialogTitle>{item.title}</DialogTitle><DialogDescription>{item.description}</DialogDescription></DialogHeader>
            <p className="text-sm leading-7 text-fg-muted">{item.content}</p>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}

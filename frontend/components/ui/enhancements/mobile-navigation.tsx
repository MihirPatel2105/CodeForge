"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AnimatedArrow, AnimatedMenu } from "./animated-icons";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger aria-label="Open navigation menu" aria-expanded={open} render={<Button variant="ghost" size="icon" className="sm:hidden" />}><AnimatedMenu open={open} /></DialogTrigger>
    <DialogContent showCloseButton={false} className="sm:max-w-md">
      <DialogHeader><div className="flex items-center justify-between gap-3"><DialogTitle>Explore CodeForge</DialogTitle>
        <Button variant="ghost" size="icon" aria-label="Close navigation menu" onClick={() => setOpen(false)}><AnimatedMenu open /></Button></div></DialogHeader>
      <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
        {[['/how-it-works','How it works'],['/demo/library','Watch a demo'],['/about','About'],['/faq','FAQ'],['/contact','Contact'],['/login','Sign in']].map(([href,label]) =>
          <Link key={href} href={href} onClick={() => setOpen(false)} className="cf-mobile-nav-link flex min-h-12 items-center justify-between rounded-xl px-3 text-sm text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">{label}<AnimatedArrow /></Link>)}
      </nav>
    </DialogContent>
  </Dialog>;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NAV_GROUPS } from "@/components/marketing/launch-hero/nav-groups";
import { useSession } from "@/lib/use-current-user";
import { AnimatedArrow, AnimatedMenu } from "./animated-icons";

function MobileLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return <Link href={href} onClick={onNavigate} className="cf-mobile-nav-link flex min-h-12 items-center justify-between rounded-[var(--ui-radius-control)] px-3 text-sm text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">{label}<AnimatedArrow /></Link>;
}

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useSession();
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger aria-label="Open navigation menu" aria-expanded={open} render={<Button variant="ghost" size="icon" className="sm:hidden" />}><AnimatedMenu open={open} /></DialogTrigger>
    <DialogContent showCloseButton={false} className="sm:max-w-md">
      <DialogHeader><div className="flex items-center justify-between gap-3"><DialogTitle>Explore CodeForge</DialogTitle>
        <Button variant="ghost" size="icon" aria-label="Close navigation menu" onClick={() => setOpen(false)}><AnimatedMenu open /></Button></div></DialogHeader>
      <nav aria-label="Mobile navigation" className="flex max-h-[70dvh] flex-col gap-5 overflow-y-auto">
        {/* Signed in, the phone bar has no room for Projects, so it leads the menu instead. */}
        {user && <MobileLink href="/projects" label="Projects" onNavigate={() => setOpen(false)} />}
        {NAV_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`mobile-nav-${group.id}`}>
            <p id={`mobile-nav-${group.id}`} className="px-3 pb-1 font-mono text-[11px] font-[500] uppercase tracking-[.08em] text-fg-muted">{group.label}</p>
            {group.links.map(({ href, label }) => <MobileLink key={href} href={href} label={label} onNavigate={() => setOpen(false)} />)}
          </section>
        ))}
        {!user && !loading && <MobileLink href="/login" label="Sign in" onNavigate={() => setOpen(false)} />}
      </nav>
    </DialogContent>
  </Dialog>;
}

import Link from "next/link";
import { ArrowRight, House } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";

export default function NotFound() {
  return (
    <div className="cf-not-found flex min-h-screen flex-col bg-surface">
      <SiteHeader />

      <main className="flex flex-1 items-center border-b border-rule">
        <div className="mx-auto grid w-full max-w-[1536px] gap-12 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-center lg:gap-20 lg:px-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-lg border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[11px] font-[700] tracking-[0.08em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              Page not found
            </span>

            <h1 className="font-display mt-8 max-w-[12ch] text-[42px] font-[650] leading-[1.06] tracking-[-0.065em] text-fg sm:text-[54px] lg:text-[64px]">
              This page isn&apos;t here.
            </h1>
            <p className="mt-6 max-w-[48ch] text-[16px] leading-[1.7] text-fg-muted sm:text-[17px]">
              The address may have changed, or the link may be incorrect. Head back to CodeForge and keep exploring.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[14px] font-[650] text-surface transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                <House className="h-4 w-4" aria-hidden />
                Go home
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-6 text-[14px] font-[650] text-fg transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                How it works
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-[0_28px_80px_rgba(22,24,28,0.07)]" aria-hidden>
            <div className="flex items-center justify-between border-b border-rule px-6 py-4">
              <span className="font-mono text-[11px] font-[700] tracking-[0.1em] text-fg-faint">CodeForge navigation</span>
              <span className="flex items-center gap-2 font-mono text-[11px] font-[650] text-fg-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                Missing
              </span>
            </div>
            <div className="px-6 py-12 sm:px-10 sm:py-16">
              <p className="font-display text-[clamp(6rem,18vw,11rem)] font-[700] leading-none tracking-[-0.1em] text-fg">404</p>
              <div className="mt-9 flex items-center gap-3 border-t border-rule pt-5 font-mono text-[11px] text-fg-faint sm:text-[12px]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-warn" />
                The requested path could not be found.
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

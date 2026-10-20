import Link from "next/link";
import { ArrowRight, House } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";
import { EmptyIllustration } from "@/components/ui/arc/empty-illustration";

export default function NotFound() {
  return (
    <div className="cf-not-found flex min-h-screen flex-col bg-surface">
      <SiteHeader />
      <main className="flex min-h-[calc(100svh-4rem)] flex-1 items-center justify-center border-b border-rule px-6 py-8 sm:py-20">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
          <div className="mb-5 flex justify-center [&_svg]:h-auto [&_svg]:w-[220px] sm:[&_svg]:w-[260px]">
            <EmptyIllustration scene="map" />
          </div>
          <p aria-hidden="true" className="font-display text-[clamp(6rem,15vw,10rem)] font-[650] leading-none tracking-[-0.08em] text-fg">404</p>
          <h1 className="font-display mt-6 text-[clamp(1.75rem,4vw,2.75rem)] font-[650] leading-[1.15] tracking-[-0.05em] text-fg">
            <span className="sr-only">Page not found. </span>This page is off the map.
          </h1>
          <p className="mt-4 max-w-[38ch] text-[15px] leading-7 text-fg-muted sm:text-base">
            The link may have changed, or the page no longer exists.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/projects" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-accent px-5 text-[14px] font-[600] text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              Back to projects<ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-[14px] font-[600] text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              <House className="size-4" aria-hidden />Go home
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

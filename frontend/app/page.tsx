import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { RunWalkthrough } from "@/components/marketing/run-walkthrough";
import { ClosingBanner, SiteFooter } from "@/components/marketing/marketing-actions";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { OutcomeShowcase } from "@/components/marketing/outcome-showcase";

export const metadata: Metadata = {
  title: "CodeForge — five AI agents build and test your API",
  description:
    "Describe an API in plain English. PM, Architect, Coder, Reviewer and Tester agents build it, review it, and run its tests for real in an isolated container.",
};

export default function LandingPage() {
  return (
    <div className="cf-home min-h-screen bg-bg">
      <SiteHeader />

      {/* Start with the prompt and the tested output it produces. */}
      <section className="cf-home-hero cf-grid border-b border-rule">
        <div className="relative mx-auto grid w-full max-w-[1536px] items-center gap-x-16 gap-y-12 px-6 py-14 md:px-10 md:py-20 lg:min-h-[min(820px,calc(100svh-64px))] lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:px-14">
          <HeroDemo />
        </div>
      </section>

      {/* One run, unfolded. */}
      <section id="how" className="cf-home-walkthrough border-b border-rule py-20 md:py-24">
        <RunWalkthrough />
      </section>

      <OutcomeShowcase />

      {/* Close */}
      <section className="cf-home-closing">
        <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
          <div className="grid gap-x-14 lg:grid-cols-[11rem_1fr]">
            <div aria-hidden className="hidden lg:block" />
            <ClosingBanner />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

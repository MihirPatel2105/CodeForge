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

const STACK = [
  { label: "generated_apps", value: "FastAPI · MongoDB · Beanie · pytest" },
  { label: "orchestration", value: "LangGraph, durable checkpointer" },
  { label: "execution", value: "Docker, networking disabled" },
  { label: "cost", value: "$0 — free-tier providers only" },
] as const;

const TAG = "text-[12px] font-[650] text-fg-muted";

export default function LandingPage() {
  return (
    <div className="cf-home min-h-screen bg-bg">
      <SiteHeader />

      {/* Start with the prompt and the tested output it produces. */}
      <section className="cf-home-hero cf-grid border-b border-rule">
        <div className="relative mx-auto grid min-h-[calc(100svh-58px)] w-full max-w-[1536px] items-center gap-x-16 gap-y-12 px-6 py-16 md:px-10 lg:grid-cols-[1fr_29rem] lg:px-14">
          <HeroDemo />
        </div>
      </section>

      {/* One run, unfolded. */}
      <section id="how" className="cf-home-walkthrough border-b border-rule py-20 md:py-24">
        <RunWalkthrough />
      </section>

      <OutcomeShowcase />

      {/* Constraints, set as a spec sheet */}
      <section id="stack" className="cf-home-stack cf-invert cf-lift border-b border-rule bg-bg">
        <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
          <div className="grid gap-x-14 lg:grid-cols-[11rem_1fr]">
            <span className={TAG}>constraints</span>
            <div>
              <h2 className="font-display max-w-[24ch] text-[27px] font-[700] leading-[1.26] tracking-[-0.04em] text-fg md:text-[32px]">
                What it runs on
              </h2>
              <dl className="mt-9 border-t border-rule">
                {STACK.map((row) => (
                  <div
                    key={row.label}
                    className="group grid grid-cols-1 gap-x-10 gap-y-1 border-b border-rule px-4 py-5 transition-colors hover:bg-surface sm:grid-cols-[13rem_1fr]"
                  >
                    <dt className="font-mono text-[12px] text-fg-faint transition-colors group-hover:text-accent">{row.label}</dt>
                    <dd className="text-[15.5px] leading-[1.5] text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

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

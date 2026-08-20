import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { RunWalkthrough } from "@/components/marketing/run-walkthrough";
import { ClosingBanner, SiteFooter } from "@/components/marketing/marketing-actions";
import { HeroPulse } from "@/components/marketing/hero-pulse";

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

const TAG = "font-mono text-[11px] font-[600] uppercase tracking-[0.16em] text-fg-faint";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />

      {/* The page opens where a run opens: at the prompt. The sentence in the frame is
          the same one the walkthrough below then executes, so the hero is the first
          step of the story rather than a banner sitting on top of it. */}
      {/* Exactly one screen, so the prompt is all you see on arrival and the walkthrough
          starts on a deliberate scroll rather than peeking in at the fold. `svh` rather
          than `vh`: on mobile the retracting browser chrome makes `vh` overflow.
          `min-h` rather than `h` so a short window grows instead of clipping. */}
      <section className="cf-grid border-b border-rule">
        {/* Centred with symmetric padding, so the space above the first line matches the
            space below the last. The scroll cue is positioned absolutely rather than
            sitting in the flow — otherwise it adds height to the bottom only and pulls
            the block visibly off centre. */}
        <div className="relative mx-auto flex min-h-[calc(100svh-58px)] w-full flex-col justify-center px-6 py-16 md:px-10 lg:px-14">
          <span className={TAG}>[ multi-agent sdlc automation ]</span>

          <h1 className="font-display mt-9 max-w-[24ch] text-[29px] font-[600] leading-[1.22] tracking-[-0.05em] text-fg sm:text-[36px] md:text-[42px]">
            Describe an API. Watch a team build it.
          </h1>

          {/* No call to action here. The header already carries one — "Get started" when
              signed out, "Go to projects" when signed in — and a second pair below the
              prompt only duplicated it, while the signed-out wording ("Sign in") was
              wrong for anyone already authenticated. */}
          <div className="mt-11">
            <div className="cf-frame border border-border bg-surface px-5 py-[18px]">
              <span className={TAG}>your prompt</span>
              <p className="cf-caret mt-3 font-mono text-[14.5px] leading-[1.6] text-fg">
                I want an API to manage a personal library of books — title, author, ISBN,
                genre, and whether I&apos;ve read it.
              </p>
            </div>
            {/* Prompt on the left, the pipeline moving on the right. A static list of
                the files it returns filled the space but sat there dead; the fold is
                the first thing anyone sees, so it should have a pulse. */}
            <div className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-[1fr_20rem]">
              <p className="max-w-[54ch] text-[15.5px] leading-[1.65] text-fg-muted">
                Five role-based agents take it from there — planning, writing, reviewing
                and testing it, executed for real inside an isolated container, paused
                twice for your approval.
              </p>

              <div className="md:border-l md:border-rule md:pl-12">
                <HeroPulse label={TAG} />
              </div>
            </div>
          </div>

          {/* With the hero filling the screen there is no longer any content visible
              below the fold to imply the page continues, so it has to say so. */}
          <a
            href="#how"
            /* Left offset tracks the shell's responsive padding so the cue stays on the
               same line as the copy above it rather than drifting into the gutter. */
            className="absolute bottom-9 left-6 hidden items-center gap-[9px] font-mono text-[11px] font-[600] uppercase tracking-[0.14em] text-fg-faint transition-colors hover:text-fg md:left-10 md:inline-flex lg:left-14"
          >
            <span aria-hidden>↓</span>
            watch a run
          </a>
        </div>
      </section>

      {/* One run, unfolded. */}
      <section id="how" className="border-b border-rule py-20 md:py-24">
        <RunWalkthrough />
      </section>

      {/* Constraints, set as a spec sheet */}
      <section id="stack" className="border-b border-rule">
        <div className="mx-auto w-full px-6 md:px-10 lg:px-14 py-20 md:py-24">
          <div className="grid gap-x-14 lg:grid-cols-[11rem_1fr]">
            <span className={TAG}>constraints</span>
            <div>
              <h2 className="font-display max-w-[24ch] text-[24px] font-[600] leading-[1.26] tracking-[-0.035em] text-fg md:text-[28px]">
                What it runs on
              </h2>
              <dl className="mt-9 border-t border-rule">
                {STACK.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-1 gap-x-10 gap-y-1 border-b border-rule py-[17px] sm:grid-cols-[13rem_1fr]"
                  >
                    <dt className="font-mono text-[12px] text-fg-faint">{row.label}</dt>
                    <dd className="text-[15.5px] leading-[1.5] text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Close */}
      <section>
        <div className="mx-auto w-full px-6 py-20 md:px-10 md:py-24 lg:px-14">
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

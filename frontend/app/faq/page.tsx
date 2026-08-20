import type { Metadata } from "next";
import Link from "next/link";
import { HeaderFacts } from "@/components/marketing/header-facts";
import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata: Metadata = {
  title: "FAQ · CodeForge",
  description:
    "What CodeForge can build, whether the generated code really runs, what it costs, what happens when an agent fails, and who can see your runs.",
};

/** Answers are written against what the system actually does today — the scope limits,
 * the loop caps, the sandbox, the free-tier fallback chains — rather than what it might
 * do later. An FAQ that overstates is worse than none. */
const FAQ = [
  {
    q: "What kinds of APIs can it build?",
    a: "CRUD REST APIs over one or two entities: FastAPI, MongoDB via Beanie, and a pytest suite. The scope is locked there on purpose — reliability on a narrow target is worth more than breadth that works occasionally. It does not generate front-ends, authentication, or arbitrary application types.",
  },
  {
    q: "Does it actually run the generated code?",
    a: "Yes. Every run ends in a Docker container with networking disabled, running MongoDB alongside the generated app, executing the generated pytest suite. The pass/fail you see is the interpreter's result, not a model's opinion of the code.",
  },
  {
    q: "What does it cost to run?",
    a: "Nothing. Every model in the pipeline is a free tier — Groq and OpenRouter, with a local model as the final fallback. Each agent has an ordered chain, so a rate limit moves the request down the chain instead of failing the run.",
  },
  {
    q: "What happens when an agent gets something wrong?",
    a: "It goes back. A blocking review finding, or a failing test, returns the code to the Coder with the specific problem attached, and the pipeline runs again from there. Each of those loops is capped at three attempts, counted separately, so a run always terminates with something to show.",
  },
  {
    q: "Do I have to approve anything?",
    a: "Twice. Once on the requirements the PM extracted, once on the Architect's design. The run pauses and waits — those are the two cheapest points at which to catch a misunderstanding, both before any code exists.",
  },
  {
    q: "What if the tests don't all pass?",
    a: "You still get everything: the generated files, the review findings, and the real pytest output. A run whose code works but whose tests partly fail is reported as partial, and one that exhausts its fix attempts is reported as a loop limit — a designed stop, never dressed up as success.",
  },
  {
    q: "Can anyone else see my projects and runs?",
    a: "No. Projects and runs are scoped to your account, and the API checks ownership on every request — including the live event stream — so a run id alone is not enough to read someone else's work.",
  },
  {
    q: "How long does a run take?",
    a: "Typically a few minutes, most of it spent waiting on free-tier models. The two approval pauses are open-ended: the pipeline waits for you rather than timing out.",
  },
  {
    q: "What is the 'example library' toggle?",
    a: "Retrieval. With it on, the agents are shown a handful of hand-written reference APIs alongside your prompt. It exists so runs can be compared with and without retrieval — the difference is one of the project's reported measurements.",
  },
] as const;

/** The five answers most people arrive wanting, readable without opening anything. */
const AT_A_GLANCE = [
  { k: "scope", v: "CRUD REST APIs over one or two entities" },
  { k: "execution", v: "Real, in a container with networking disabled" },
  { k: "cost", v: "$0 — free-tier models only" },
  { k: "approvals", v: "Two: the requirements, then the design" },
  { k: "fix attempts", v: "Three per loop, counted separately" },
] as const;

export default function FaqPage() {
  return (
    <MarketingPage
      eyebrow="faq"
      title="Questions worth asking before you trust it."
      lede="Short answers about what CodeForge builds, what it refuses to build, and what happens when the models underneath it misbehave."
      aside={<HeaderFacts label="at a glance" rows={AT_A_GLANCE} />}
    >
      <div>
        {/* One column, not two. Side-by-side cells share a grid row, so the row grows to
            the taller of the pair — opening a question on the left silently inflated the
            blank space under its neighbour on the right, which reads as both having
            opened. A single stack also keeps the reading order the obvious one.
            The horizontal space is instead taken by the margin label, matching the
            `[01]` notation the other marketing pages use. */}
        <div className="grid gap-x-14 gap-y-5 lg:grid-cols-[11rem_1fr]">
          <span className="font-mono text-[11px] font-[600] uppercase tracking-[0.14em] text-fg-faint lg:pt-6">
            [01] COMMON QUESTIONS
          </span>

          <dl className="border-t border-rule">
            {FAQ.map((item) => (
              <div key={item.q} className="border-b border-rule">
                {/* <details> rather than a JS accordion: keyboard and screen-reader
                    behaviour comes for free, and it still works if scripting fails. */}
                <details className="cf-disclose group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-[16px] font-[600] leading-[1.45] text-fg transition-colors hover:text-fg-muted [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden
                      className="mt-[3px] shrink-0 font-mono text-[15px] text-fg-faint transition-transform duration-[320ms] ease-[cubic-bezier(.22,.7,.28,1)] group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-[76ch] pb-7 pr-10 text-[15px] leading-[1.7] text-fg-muted">
                    {item.a}
                  </p>
                </details>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center rounded-[2px] bg-fg px-7 py-[15px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em] text-surface transition-opacity hover:opacity-88"
          >
            How it works
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center rounded-[2px] border border-border-strong px-7 py-[15px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em] text-fg transition-colors hover:bg-surface-2"
          >
            About the project
          </Link>
        </div>
      </div>
    </MarketingPage>
  );
}

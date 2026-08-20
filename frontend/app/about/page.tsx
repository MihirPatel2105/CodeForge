import type { Metadata } from "next";
import { HeaderFacts } from "@/components/marketing/header-facts";
import { Columns, MarketingPage, Section } from "@/components/marketing/marketing-page";

export const metadata: Metadata = {
  title: "About · CodeForge",
  description:
    "CodeForge maps five role-based AI agents onto the software development lifecycle, with a conditional feedback loop between review, testing and code.",
};

const P = "text-[16.5px] leading-[1.72] text-fg-muted";

/** The page calls this a research project, so the header says what it measures. These are
 * the figures the work is actually judged on, none of which the prose states outright. */
const MEASURES = [
  { k: "generation", v: "Share of prompts that produce runnable code" },
  { k: "tests", v: "Share of generated suites that pass in the sandbox" },
  { k: "the loop", v: "How often a review catches a real defect" },
  { k: "iterations", v: "Average attempts before a run succeeds" },
  { k: "retrieval", v: "Success rate with the example library against without it" },
] as const;

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow="about"
      title="A software team, decomposed into agents."
      lede="CodeForge is a research project asking a narrow question: if you give AI agents distinct roles and let their work travel backwards when something is wrong, does the output get more reliable than asking one model for the whole thing?"
      aside={<HeaderFacts label="what it measures" rows={MEASURES} />}
    >
      <Section index="01" heading="the idea" wide>
        <Columns>
          <p className={P}>
            Most code generation is a single request and a single answer. CodeForge splits the work
            the way a team does — a PM turning a request into requirements, an Architect designing
            the surface, a Coder writing files, a Reviewer checking them against a fixed checklist,
            a Tester writing the suite, and a sandbox that executes it all for real.
          </p>
          <p className={P}>
            Every handoff between those stages is a validated schema rather than free text, so a
            stage cannot quietly pass along something malformed for the next one to misinterpret.
          </p>
        </Columns>
      </Section>

      <Section index="02" heading="the differentiator" wide>
        <Columns>
          <p className={P}>
            The part that matters is the loop. When the Reviewer reports a blocking finding — or the
            sandbox reports a failing test — the work returns to the Coder with the specific problem
            attached, and the pipeline runs again from there. That cycle, not the generation, is the
            contribution.
          </p>
          <p className={P}>
            Both loops are capped independently, so a slow-converging review cannot consume the
            budget the sandbox needs. A run always terminates with something to show: the code, the
            outstanding findings and the real test output.
          </p>
        </Columns>
      </Section>

      <Section index="03" heading="constraints">
        <p className={P}>
          Three constraints shape everything. The scope is locked to CRUD REST APIs, because
          reliability on a narrow target is worth more than breadth that works sometimes. Generated
          code is executed in a container with networking disabled, so a result is a fact rather
          than a claim. And it runs at no cost — every model is a free tier, with a fallback chain
          per agent so a rate limit degrades a run instead of ending it.
        </p>
      </Section>

      <Section index="04" heading="honesty">
        <p className={P}>
          Free-tier models fail in ordinary ways: rate limits, truncated output, a model answering
          in prose instead of calling a tool. The interface reports those as what they are. A run
          that hits the loop cap is shown as a designed stop, not a crash; a run whose code works
          but whose tests partly fail is shown as partial, never as success.
        </p>
      </Section>
    </MarketingPage>
  );
}

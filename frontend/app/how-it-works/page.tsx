import type { Metadata } from "next";
import Link from "next/link";
import { Columns, MarketingPage, Section } from "@/components/marketing/marketing-page";
import { PipelineDiagram } from "@/components/marketing/pipeline-diagram";

export const metadata: Metadata = {
  title: "How it works · CodeForge",
  description:
    "The six stages of a CodeForge run, the two approval checkpoints, the review-and-test feedback loop, and how the generated code is executed for real.",
};

const P = "text-[16.5px] leading-[1.72] text-fg-muted";

/** Quoted from docs/UI_BRIEF.md §5 so the marketing pages, the pipeline strip and the
 * agent cards all describe the agents in exactly the same words. */
const AGENTS = [
  {
    name: "pm",
    job: "Turns the request into structured requirements",
    detail:
      "Entities, their fields and the operations you asked for, as a schema-validated object rather than prose.",
  },
  {
    name: "architect",
    job: "Designs the endpoints and data models",
    detail:
      "Paths, methods, status codes, request and response models, and the four files the Coder will write.",
  },
  {
    name: "coder",
    job: "Writes the application code",
    detail:
      "One file per model call. A whole-tree request breaches the free tier's per-minute token ceiling, so the tree is assembled a file at a time.",
  },
  {
    name: "reviewer",
    job: "Checks the code against a fixed checklist",
    detail:
      "The same checks every run, so a review is comparable between runs rather than a matter of mood. Only blocking findings send work back.",
  },
  {
    name: "tester",
    job: "Writes the test suite",
    detail:
      "A pytest suite against the generated API, written without sight of the Reviewer's opinion of it.",
  },
  {
    name: "sandbox",
    job: "Runs the code and its tests for real",
    detail:
      "A Docker container with networking disabled and its own MongoDB. Its verdict is the authoritative one — the Reviewer has an opinion, the interpreter has a result.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <MarketingPage
      eyebrow="how it works"
      title="One sentence in, through six stages, out as a tested API."
      lede="Each stage has one job and hands a validated result to the next. You approve the work twice along the way, and anything the Reviewer or the tests reject travels back to the Coder."
      aside={<PipelineDiagram />}
    >
      {/* The stages are the page's substance, so they get its full width. Each row splits
          into what the stage is (left) and why it works that way (right), which uses the
          space for a real distinction rather than just setting longer lines. */}
      <Section index="01" heading="the stages" wide>
        <ol className="border-t border-rule">
          {AGENTS.map((agent, i) => (
            <li
              key={agent.name}
              className="grid gap-x-12 gap-y-3 border-b border-rule py-7 lg:grid-cols-[1fr_1.1fr]"
            >
              <div className="flex items-baseline gap-5">
                <span className="font-mono text-[12.5px] text-fg-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-mono text-[17px] font-[600] tracking-[-0.02em] text-fg">
                    {agent.name}
                  </h3>
                  <p className="mt-2 text-[16.5px] leading-[1.5] text-fg">{agent.job}</p>
                </div>
              </div>
              <p className="text-[15.5px] leading-[1.65] text-fg-muted lg:pt-[26px]">
                {agent.detail}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section index="02" heading="your two checkpoints" wide>
        <Columns>
          <p className={P}>
            The pipeline stops twice and waits for a person. The first pause is after the PM, on the
            requirements it extracted; the second is after the Architect, on the design. Nothing
            proceeds until you approve, and rejecting ends the run rather than pushing ahead with
            something you disagreed with.
          </p>
          <p className={P}>
            The checkpoints exist because the two cheapest mistakes to catch are a misunderstood
            request and a wrong design — both before any code is written.
          </p>
        </Columns>
      </Section>

      <Section index="03" heading="the loop" wide>
        <Columns>
          <p className={P}>
            Two edges send work backwards. A blocking review finding returns the code to the Coder
            with the finding attached; a failing test does the same with the failure attached. The
            Coder rewrites only the files the problems point at, rather than regenerating a tree in
            which most files already work.
          </p>
          <p className={P}>
            Each loop is capped at three attempts, counted separately, so a review that takes a
            while to converge cannot spend the budget the sandbox needs. When a cap is reached the
            run stops deliberately and keeps everything it produced — reported as a loop limit, not
            as a crash.
          </p>
        </Columns>
      </Section>

      <Section index="04" heading="when providers fail">
        <p className={P}>
          Every agent has an ordered chain of models, ending at one running locally. A rate limit, a
          retired model or a truncated response moves the request down the chain rather than failing
          the run. Free-tier limits are normal operation here, not an exception.
        </p>
      </Section>

      <Section index="05" heading="see it">
        <p className={P}>
          The landing page replays a real recorded run, including the blocking finding that triggers
          the loop and the pytest output at the end.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/#how"
            className="inline-flex items-center justify-center rounded-[2px] bg-fg px-7 py-[15px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em] text-surface transition-opacity hover:opacity-88"
          >
            Watch a run
          </Link>
          <Link
            href="/faq"
            className="inline-flex items-center justify-center rounded-[2px] border border-border-strong px-7 py-[15px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em] text-fg transition-colors hover:bg-surface-2"
          >
            Read the FAQ
          </Link>
        </div>
      </Section>
    </MarketingPage>
  );
}

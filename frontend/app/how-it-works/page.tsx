import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  Boxes,
  FileCode2,
  GitBranch,
  Pause,
  ScanSearch,
  SquareTerminal,
  TestTube2,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { ClosingBanner, SiteFooter } from "@/components/marketing/marketing-actions";
import { HowRunRoute } from "@/components/marketing/how-run-route";

export const metadata: Metadata = {
  title: "How it works · CodeForge",
  description:
    "Follow a CodeForge request through six specialized stages, two human approvals, review and test feedback loops, and real sandbox execution.",
};

const STAGES = [
  {
    icon: ScanSearch,
    name: "PM",
    job: "Turns your request into structured requirements",
    input: "plain-English prompt",
    output: "entities · fields · operations",
  },
  {
    icon: Boxes,
    name: "Architect",
    job: "Designs the API surface and data models",
    input: "approved requirements",
    output: "routes · schemas · status codes",
  },
  {
    icon: FileCode2,
    name: "Coder",
    job: "Writes the application one file at a time",
    input: "approved design",
    output: "FastAPI project files",
  },
  {
    icon: ScanSearch,
    name: "Reviewer",
    job: "Checks the code against a fixed checklist",
    input: "generated source",
    output: "findings · blocking repairs",
  },
  {
    icon: TestTube2,
    name: "Tester",
    job: "Writes a pytest suite independently",
    input: "requirements and design",
    output: "executable test suite",
  },
  {
    icon: SquareTerminal,
    name: "Sandbox",
    job: "Runs the application and tests for real",
    input: "code and tests",
    output: "exit code · passed · failed",
  },
] as const;

const STOPS = [
  {
    icon: Pause,
    label: "Approval 01",
    title: "Confirm the requirements",
    body: "Check that the PM understood your entities, fields and requested operations before any design work begins.",
  },
  {
    icon: Pause,
    label: "Approval 02",
    title: "Confirm the architecture",
    body: "Review the routes, models and status codes before the Coder commits the design to files.",
  },
  {
    icon: GitBranch,
    label: "Repair loop",
    title: "Send evidence back",
    body: "A blocking finding or failed test returns to the Coder with the exact problem attached. Each loop is capped independently.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="cf-subpage min-h-screen bg-bg">
      <SiteHeader />
      <main>
        <section className="cf-subpage-hero border-b border-rule">
          <div className="relative z-10 mx-auto grid min-h-[calc(88svh-64px)] w-full max-w-[1536px] items-center gap-14 px-6 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(430px,0.8fr)] lg:px-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-accent">
                <GitBranch className="h-3.5 w-3.5" aria-hidden />
                how it works
              </span>
              <h1 className="font-display mt-8 max-w-[14ch] text-[42px] font-[650] leading-[1.05] tracking-[-0.065em] text-fg sm:text-[52px] lg:text-[60px]">
                One request. Six focused jobs. A result that ran.
              </h1>
              <p className="mt-7 max-w-[60ch] text-[16px] leading-[1.72] text-fg-muted sm:text-[17px]">
                Work moves forward through specialized agents. You approve the two
                decisions that shape everything else, and concrete failures send the
                work back to the Coder.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="#stages" className="inline-flex items-center gap-2 rounded-lg bg-fg px-6 py-[14px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em] text-surface transition-all hover:-translate-y-0.5 hover:opacity-90">
                  Follow the run
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <Link href="/#how" className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface/70 px-6 py-[14px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em] text-fg transition-all hover:-translate-y-0.5 hover:bg-surface">
                  Watch it move
                </Link>
              </div>
            </div>
            <HowRunRoute />
          </div>
        </section>

        <section id="stages" className="border-b border-rule bg-surface">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[11rem_1fr]">
              <SectionLabel index="01" label="the six stages" />
              <div>
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <h2 className="font-display max-w-[18ch] text-[30px] font-[650] leading-[1.18] tracking-[-0.05em] text-fg md:text-[40px]">Each agent owns one decision.</h2>
                  <p className="max-w-[47ch] text-[14px] leading-[1.68] text-fg-muted">Every handoff is validated data, so the next agent receives a contract instead of an ambiguous conversation.</p>
                </div>
                <ol className="mt-12 grid border-l border-t border-rule md:grid-cols-2 xl:grid-cols-3">
                  {STAGES.map(({ icon: Icon, name, job, input, output }, index) => (
                    <li key={name} className="group border-b border-r border-rule p-6 transition-colors hover:bg-bg md:p-7">
                      <div className="flex items-center justify-between">
                        <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-bg text-accent group-hover:border-accent-bd group-hover:bg-accent-soft"><Icon className="h-4 w-4" aria-hidden /></span>
                        <span className="font-mono text-[9px] font-[700] tracking-[0.12em] text-fg-faint">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <h3 className="font-display mt-7 text-[19px] font-[650] tracking-[-0.04em] text-fg">{name}</h3>
                      <p className="mt-2 min-h-[48px] text-[14px] leading-[1.6] text-fg-muted">{job}</p>
                      <dl className="mt-7 border-t border-rule pt-4">
                        <div className="grid grid-cols-[4rem_1fr] gap-3"><dt className="font-mono text-[8px] font-[700] uppercase tracking-[0.12em] text-fg-faint">input</dt><dd className="font-mono text-[10px] text-fg">{input}</dd></div>
                        <div className="mt-3 grid grid-cols-[4rem_1fr] gap-3"><dt className="font-mono text-[8px] font-[700] uppercase tracking-[0.12em] text-fg-faint">output</dt><dd className="font-mono text-[10px] text-fg">{output}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="cf-invert cf-how-control border-b border-rule bg-bg">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[11rem_1fr]">
              <SectionLabel index="02" label="control points" />
              <div>
                <h2 className="font-display max-w-[20ch] text-[30px] font-[650] leading-[1.18] tracking-[-0.05em] text-fg md:text-[40px]">The run pauses for judgment and loops on evidence.</h2>
                <div className="mt-12 grid overflow-hidden rounded-xl border border-border bg-surface/25 md:grid-cols-3">
                  {STOPS.map(({ icon: Icon, label, title, body }) => (
                    <article key={label} className="border-b border-r border-border p-6 last:border-b-0 md:border-b-0 md:p-8">
                      <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-accent" aria-hidden /><span className="font-mono text-[8px] font-[700] uppercase tracking-[0.14em] text-accent">{label}</span></div>
                      <h3 className="font-display mt-7 text-[18px] font-[650] tracking-[-0.035em] text-fg">{title}</h3>
                      <p className="mt-4 text-[13px] leading-[1.65] text-fg-muted">{body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-rule">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[11rem_1fr]">
              <SectionLabel index="03" label="the finish line" />
              <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div>
                  <span className="inline-flex items-center gap-2 font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" />sandbox verdict</span>
                  <h2 className="font-display mt-5 max-w-[15ch] text-[30px] font-[650] leading-[1.18] tracking-[-0.05em] text-fg md:text-[38px]">The final answer comes from execution.</h2>
                  <p className="mt-5 max-w-[48ch] text-[15px] leading-[1.72] text-fg-muted">The generated application and pytest suite run together inside Docker with networking disabled. Whether the run succeeded, partially passed or reached a loop limit stays visible with every file and event.</p>
                </div>
                <TerminalProof />
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14"><div className="grid gap-x-14 lg:grid-cols-[11rem_1fr]"><div aria-hidden className="hidden lg:block" /><ClosingBanner /></div></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return <div className="flex items-baseline gap-3 lg:flex-col lg:gap-2"><span className="font-mono text-[11px] font-[700] text-fg">[{index}]</span><span className="font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-fg-faint">{label}</span></div>;
}

function TerminalProof() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-term-bg shadow-[0_24px_70px_rgba(22,24,28,0.12)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className="font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-term-dim">sandbox output</span><span className="h-2 w-2 rounded-full bg-term-pass" /></div>
      <div className="space-y-3 px-5 py-6 font-mono text-[12px] leading-[1.55]"><p className="text-term-dim">$ pytest -q</p><p className="text-term-fg">........</p><p className="text-term-pass">8 passed in 1.42s</p><p className="border-t border-white/10 pt-4 text-[10px] uppercase tracking-[0.11em] text-term-dim">process exited with code 0</p></div>
      <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 font-mono text-[8px] font-[700] uppercase tracking-[0.11em]"><span className="text-term-dim">network disabled</span><span className="flex items-center gap-2 text-term-pass"><span className="h-1.5 w-1.5 rounded-full bg-term-pass" />verified</span></div>
    </div>
  );
}

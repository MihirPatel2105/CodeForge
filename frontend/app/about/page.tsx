import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Code2,
  Eye,
  GitBranch,
  ShieldCheck,
  SquareTerminal,
  TestTube2,
  UserCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { ClosingBanner, SiteFooter } from "@/components/marketing/marketing-actions";
import { AboutProcessProof } from "@/components/marketing/about-process-proof";

export const metadata: Metadata = {
  title: "About · CodeForge",
  description:
    "CodeForge turns API generation into an inspectable software process: specialized agents, two human approvals, review feedback, generated tests and real sandbox execution.",
};

const PRINCIPLES = [
  {
    icon: GitBranch,
    index: "01",
    title: "Separate the responsibilities",
    body: "Requirements, design, implementation, review and testing are different kinds of work. Each agent gets one role, one input contract and one output contract.",
  },
  {
    icon: UserCheck,
    index: "02",
    title: "Put people before code",
    body: "The run pauses after requirements and architecture. Those are the cheapest moments to catch a misunderstanding, before the Coder writes a file.",
  },
  {
    icon: SquareTerminal,
    index: "03",
    title: "Make the runtime decide",
    body: "A reviewer can reason about code. Only an interpreter can prove it runs. The final verdict comes from generated tests executed inside an isolated container.",
  },
] as const;

const CONSTRAINTS = [
  {
    label: "scope",
    value: "CRUD REST APIs over one or two entities",
    why: "A narrow target makes quality measurable instead of anecdotal.",
  },
  {
    label: "stack",
    value: "FastAPI · MongoDB · Beanie · pytest",
    why: "Every run shares enough structure to be reviewed consistently.",
  },
  {
    label: "execution",
    value: "Docker container · network disabled",
    why: "Generated code is tested without reaching the outside world.",
  },
  {
    label: "models",
    value: "Free-tier providers with per-agent fallbacks",
    why: "A rate limit changes the route, not the definition of success.",
  },
] as const;

const EVIDENCE = [
  { icon: Code2, title: "Generated source", body: "Every file, its size and the pass in which it changed." },
  { icon: ShieldCheck, title: "Review evidence", body: "Each finding, its severity and the repair sent to the Coder." },
  { icon: TestTube2, title: "Test suite", body: "The tests written independently from the implementation." },
  { icon: SquareTerminal, title: "Runtime output", body: "The real sandbox command, exit code and test result." },
] as const;

const PRIMARY_ACTION =
  "inline-flex items-center justify-center gap-2 rounded-[3px] bg-fg px-6 py-[14px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em] text-surface transition-all hover:-translate-y-0.5 hover:opacity-90";
const SECONDARY_ACTION =
  "inline-flex items-center justify-center gap-2 rounded-[3px] border border-border-strong bg-surface/70 px-6 py-[14px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em] text-fg transition-all hover:-translate-y-0.5 hover:bg-surface";

export default function AboutPage() {
  return (
    <div className="cf-about min-h-screen bg-bg">
      <SiteHeader />
      <main>
        <section className="cf-about-hero relative border-b border-rule">
          <div className="relative z-10 mx-auto grid min-h-[calc(100svh-58px)] w-full max-w-[1536px] items-center gap-14 px-6 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] lg:px-14">
            <div className="max-w-[690px]">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-accent">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                about codeforge
              </span>
              <h1 className="font-display mt-8 max-w-[14ch] text-[42px] font-[650] leading-[1.04] tracking-[-0.065em] text-fg sm:text-[54px] lg:text-[62px]">
                Code generation should be a process you can inspect.
              </h1>
              <p className="mt-7 max-w-[58ch] text-[16px] leading-[1.72] text-fg-muted sm:text-[17px]">
                CodeForge asks a focused question: can specialized AI agents, human
                checkpoints and real execution produce a more trustworthy API than one
                model answering once?
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/#how" className={PRIMARY_ACTION}>
                  Watch a run
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <Link href="/how-it-works" className={SECONDARY_ACTION}>
                  Read the process
                </Link>
              </div>
              <dl className="mt-12 grid max-w-[610px] grid-cols-3 border-y border-rule">
                {[
                  ["06", "stages"],
                  ["02", "approvals"],
                  ["01", "shared result"],
                ].map(([value, label]) => (
                  <div key={label} className="border-r border-rule px-4 py-5 first:pl-0 last:border-r-0">
                    <dt className="font-display text-[20px] font-[650] tracking-[-0.04em] text-fg sm:text-[24px]">{value}</dt>
                    <dd className="mt-1 font-mono text-[8px] font-[700] uppercase tracking-[0.14em] text-fg-faint sm:text-[9px]">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <AboutProcessProof />
          </div>
        </section>

        <section className="border-b border-rule bg-surface">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[11rem_1fr]">
              <SectionLabel index="01" label="the thesis" />
              <div>
                <h2 className="font-display max-w-[20ch] text-[30px] font-[650] leading-[1.17] tracking-[-0.05em] text-fg md:text-[40px]">
                  The model should never be the only thing checking the model.
                </h2>
                <div className="mt-12 grid border-l border-t border-rule md:grid-cols-3">
                  {PRINCIPLES.map(({ icon: Icon, index, title, body }) => (
                    <article key={index} className="group border-b border-r border-rule p-6 transition-colors hover:bg-bg md:p-8">
                      <div className="flex items-center justify-between">
                        <span className="grid h-10 w-10 place-items-center rounded-[4px] border border-border bg-bg text-accent transition-colors group-hover:border-accent-bd group-hover:bg-accent-soft">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="font-mono text-[9px] font-[700] tracking-[0.13em] text-fg-faint">{index}</span>
                      </div>
                      <h3 className="font-display mt-8 text-[18px] font-[650] leading-[1.3] tracking-[-0.035em] text-fg">{title}</h3>
                      <p className="mt-4 text-[14px] leading-[1.7] text-fg-muted">{body}</p>
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
              <SectionLabel index="02" label="designed limits" />
              <div className="grid gap-12 xl:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <h2 className="font-display max-w-[16ch] text-[28px] font-[650] leading-[1.2] tracking-[-0.045em] text-fg md:text-[34px]">Constraints make the experiment useful.</h2>
                  <p className="mt-5 max-w-[48ch] text-[15px] leading-[1.72] text-fg-muted">
                    CodeForge keeps its promise deliberately narrow. Every limit removes
                    a variable, gives every run the same standard, and makes failure
                    easier to explain.
                  </p>
                </div>
                <dl className="overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_20px_55px_rgba(22,24,28,0.055)]">
                  {CONSTRAINTS.map((item, index) => (
                    <div key={item.label} className="grid gap-3 border-b border-rule px-5 py-5 last:border-b-0 sm:grid-cols-[3rem_7rem_1fr] sm:items-start sm:gap-5 md:px-6">
                      <span className="font-mono text-[9px] font-[700] tracking-[0.13em] text-fg-faint">{String(index + 1).padStart(2, "0")}</span>
                      <dt className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-accent">{item.label}</dt>
                      <dd>
                        <p className="font-display text-[14px] font-[600] tracking-[-0.02em] text-fg">{item.value}</p>
                        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-fg-muted">{item.why}</p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section className="cf-invert cf-about-evidence border-b border-rule bg-bg">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[11rem_1fr]">
              <SectionLabel index="03" label="what remains" />
              <div>
                <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-ok">
                      <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                      run complete
                    </span>
                    <h2 className="font-display mt-5 max-w-[19ch] text-[30px] font-[650] leading-[1.18] tracking-[-0.05em] text-fg md:text-[40px]">Nothing disappears when the agents finish.</h2>
                  </div>
                  <p className="max-w-[48ch] text-[14px] leading-[1.7] text-fg-muted">
                    Success is more useful when you can audit how it happened. Failure is
                    more useful when it leaves enough evidence to continue the work.
                  </p>
                </div>
                <div className="mt-12 grid overflow-hidden rounded-[6px] border border-border bg-surface/30 sm:grid-cols-2 xl:grid-cols-4">
                  {EVIDENCE.map(({ icon: Icon, title, body }) => (
                    <article key={title} className="border-b border-r border-border p-6 last:border-b-0 xl:border-b-0">
                      <Icon className="h-5 w-5 text-accent" aria-hidden />
                      <h3 className="font-display mt-7 text-[16px] font-[650] tracking-[-0.03em] text-fg">{title}</h3>
                      <p className="mt-3 text-[12.5px] leading-[1.6] text-fg-muted">{body}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-border pt-7">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">generated files · findings · tests · terminal output</p>
                  <Link href="/#outcome" className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-fg transition-colors hover:text-accent">
                    Inspect an example
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-rule bg-surface">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[11rem_1fr]">
              <SectionLabel index="04" label="the standard" />
              <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
                <blockquote className="font-display max-w-[22ch] text-[30px] font-[650] leading-[1.22] tracking-[-0.05em] text-fg md:text-[42px]">“A result should be a fact you can inspect, not a claim you have to trust.”</blockquote>
                <div className="border-l border-rule pl-6 md:pl-8">
                  <p className="text-[15px] leading-[1.72] text-fg-muted">That rule shapes the whole product: explicit roles, validated handoffs, visible approvals, capped loops and a real runtime verdict.</p>
                  <div className="mt-6 flex items-center gap-3 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-ok">
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-ok-bd bg-ok-soft"><Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /></span>
                    evidence over confidence
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-x-14 lg:grid-cols-[11rem_1fr]">
              <div aria-hidden className="hidden lg:block" />
              <ClosingBanner />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 lg:flex-col lg:gap-2">
      <span className="font-mono text-[11px] font-[700] text-fg">[{index}]</span>
      <span className="font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-fg-faint">{label}</span>
    </div>
  );
}

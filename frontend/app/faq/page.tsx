import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Box, CircleHelp, Clock3, Coins, MessageSquare, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";
import { FaqColumn } from "@/components/marketing/faq-column";

export const metadata: Metadata = {
  title: "FAQ · CodeForge",
  description:
    "Clear answers about what CodeForge builds, how the agents recover from mistakes, what runs in the sandbox, and what every project costs.",
};

const FAQ = [
  {
    category: "building",
    q: "What kinds of APIs can it build?",
    a: "CRUD REST APIs over one or two entities: FastAPI, MongoDB through Beanie, and a pytest suite. The scope is locked there deliberately. CodeForge does not currently generate frontends, authentication systems, or arbitrary application types.",
  },
  {
    category: "execution",
    q: "Does it actually run the generated code?",
    a: "Yes. Every run ends in a Docker container with networking disabled. MongoDB runs beside the generated application, and the generated pytest suite executes against it. The pass or fail you see is the interpreter's result.",
  },
  {
    category: "cost",
    q: "What does it cost to run?",
    a: "Nothing. The pipeline uses free-tier providers, with an ordered fallback chain for each agent. A rate limit moves that stage to its next provider instead of immediately ending the run.",
  },
  {
    category: "recovery",
    q: "What happens when an agent gets something wrong?",
    a: "A blocking review finding or a failing test returns the code to the Coder with the specific evidence attached. The relevant files are rewritten and the pipeline continues from there. Review and sandbox loops are capped separately at three attempts.",
  },
  {
    category: "control",
    q: "Do I have to approve anything?",
    a: "Twice. The first approval confirms the requirements extracted by the PM. The second confirms the Architect's routes and models. The run waits at both checkpoints because these are the cheapest places to catch a misunderstanding.",
  },
  {
    category: "results",
    q: "What if the tests do not all pass?",
    a: "You still keep the generated files, review findings and real pytest output. A run with some failed tests is reported as partial. A run that exhausts its repair attempts is reported as a loop limit, which is a deliberate stop rather than a crash.",
  },
  {
    category: "privacy",
    q: "Can anyone else see my projects and runs?",
    a: "No. Projects and runs are scoped to your account, and the API checks ownership on every request, including the live event stream. Knowing a run ID is not enough to read another account's work.",
  },
  {
    category: "timing",
    q: "How long does a run take?",
    a: "Usually a few minutes, with most of that time spent waiting on free-tier models. The two approval pauses are open-ended: the pipeline waits for you instead of timing out.",
  },
  {
    category: "retrieval",
    q: "What is the example library toggle?",
    a: "It enables retrieval. With it on, the agents receive a small set of hand-written reference APIs alongside your prompt. That makes it possible to compare runs with and without examples while keeping the rest of the pipeline the same.",
  },
] as const;

const QUICK_FACTS = [
  { icon: Box, value: "1–2", label: "entities per API" },
  { icon: ShieldCheck, value: "02", label: "human approvals" },
  { icon: Clock3, value: "03", label: "attempts per loop" },
  { icon: Coins, value: "$0", label: "free-tier models" },
] as const;

export default function FaqPage() {
  return (
    <div className="cf-subpage min-h-screen bg-bg">
      <SiteHeader />
      <main>
        <section className="cf-subpage-hero border-b border-rule">
          <div className="relative z-10 mx-auto grid w-full max-w-[1536px] items-center gap-14 px-6 py-16 md:px-10 md:py-20 lg:min-h-[620px] lg:grid-cols-[minmax(0,0.9fr)_minmax(430px,0.75fr)] lg:px-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-accent"><CircleHelp className="h-3.5 w-3.5" aria-hidden />frequently asked</span>
              <h1 className="font-display mt-8 max-w-[13ch] text-[42px] font-[650] leading-[1.05] tracking-[-0.065em] text-fg sm:text-[52px] lg:text-[60px]">Questions worth asking before you trust a run.</h1>
              <p className="mt-7 max-w-[58ch] text-[16px] leading-[1.72] text-fg-muted sm:text-[17px]">Clear answers about what CodeForge builds, where it stops, what it costs and what happens when the agents underneath it misbehave.</p>
              <Link href="#questions" className="mt-9 inline-flex items-center gap-2 rounded-[3px] bg-fg px-6 py-[14px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em] text-surface transition-all hover:-translate-y-0.5 hover:opacity-90">Browse the answers<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>

            <div className="grid grid-cols-2 overflow-hidden rounded-[7px] border border-border bg-surface shadow-[0_28px_80px_rgba(22,24,28,0.09)]">
              {QUICK_FACTS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="border-b border-r border-rule p-6 sm:p-7">
                  <Icon className="h-4 w-4 text-accent" aria-hidden />
                  <p className="font-display mt-8 text-[28px] font-[650] tracking-[-0.05em] text-fg">{value}</p>
                  <p className="mt-1 font-mono text-[8px] font-[700] uppercase tracking-[0.12em] text-fg-faint">{label}</p>
                </div>
              ))}
              <div className="col-span-2 flex items-center justify-between gap-4 bg-fg px-6 py-4 text-surface">
                <span className="font-mono text-[8px] font-[700] uppercase tracking-[0.13em]">scope before scale</span>
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              </div>
            </div>
          </div>
        </section>

        <section id="questions" className="border-b border-rule bg-surface">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[11rem_1fr]">
              <div className="flex items-baseline gap-3 lg:flex-col lg:gap-2"><span className="font-mono text-[11px] font-[700] text-fg">[01]</span><span className="font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-fg-faint">the answers</span></div>
              <div>
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <h2 className="font-display max-w-[18ch] text-[30px] font-[650] leading-[1.18] tracking-[-0.05em] text-fg md:text-[40px]">Everything the product promises, plainly.</h2>
                  <p className="max-w-[44ch] text-[14px] leading-[1.68] text-fg-muted">Open as many answers as you need. Every statement describes current behavior.</p>
                </div>
                <div className="mt-12 grid gap-x-10 lg:grid-cols-2">
                  <FaqColumn items={FAQ.slice(0, 5)} start={1} />
                  <FaqColumn items={FAQ.slice(5)} start={6} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cf-invert cf-how-control border-b border-rule bg-bg">
          <div className="mx-auto grid w-full max-w-[1536px] gap-10 px-6 py-16 md:px-10 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14 lg:py-20">
            <div>
              <span className="font-mono text-[9px] font-[700] uppercase tracking-[0.14em] text-accent">still uncertain?</span>
              <h2 className="font-display mt-4 max-w-[22ch] text-[28px] font-[650] leading-[1.2] tracking-[-0.045em] text-fg md:text-[36px]">Ask about your use case or report a surprising run.</h2>
              <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.7] text-fg-muted">Specific prompts, unexpected agent decisions and confusing failures are the most useful messages.</p>
            </div>
            <Link href="/contact" className="inline-flex w-fit items-center gap-2 rounded-[3px] bg-fg px-6 py-[14px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-85"><MessageSquare className="h-4 w-4" aria-hidden />Contact us</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

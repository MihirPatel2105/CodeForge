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
    <div className="cf-subpage cf-premium-marketing min-h-screen bg-surface">
      <SiteHeader />
      <main>
        <section className="cf-faq-stage">
          <div className="cf-entrance-copy mx-auto max-w-[960px] px-6 py-20 text-center md:px-10 md:py-28">
            <span className="inline-flex items-center gap-2 text-[13px] font-[650] text-accent"><CircleHelp size={16} aria-hidden />Frequently asked questions</span>
            <h1 className="font-display mx-auto mt-6 max-w-[16ch] text-[48px] font-[700] leading-[1.04] tracking-[-0.065em] text-fg md:text-[76px]">A little more clarity.</h1>
            <p className="mx-auto mt-6 max-w-[52ch] text-[17px] leading-7 text-fg-muted">What you can build, how the agents work, and what happens next. All the details, in one place.</p>
            <Link href="#questions" className="cf-marketing-action cf-marketing-primary mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 text-[14px] font-[650] text-surface hover:bg-accent/90">Explore the answers<ArrowRight size={16} aria-hidden /></Link>
          </div>
          <dl className="cf-faq-facts mx-auto grid max-w-[960px] grid-cols-2 gap-6 px-6 pb-14 sm:grid-cols-4 md:px-10">
            {QUICK_FACTS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center">
                <Icon className="mx-auto size-5 text-accent" aria-hidden />
                <dd className="mt-4 text-[32px] font-[650] tracking-[-.05em] text-fg">{value}</dd>
                <dt className="mt-1 text-[13px] text-fg-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section id="questions" className="bg-bg">
          <div className="cf-faq-reading mx-auto w-full max-w-[960px] px-6 py-16 md:px-10 md:py-24">
            <h2 className="font-display text-[32px] font-[650] tracking-[-.05em] text-fg">The details that matter.</h2>
            <div className="mt-8"><FaqColumn items={FAQ} start={1} /></div>
          </div>
        </section>

        <section className="cf-invert cf-how-control border-b border-rule bg-bg">
          <div className="mx-auto grid w-full max-w-[1536px] gap-10 px-6 py-16 md:px-10 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14 lg:py-20">
            <div>
              <span className="text-[12px] font-[650] text-accent">Still uncertain?</span>
              <h2 className="font-display mt-4 max-w-[22ch] text-[28px] font-[650] leading-[1.2] tracking-[-0.045em] text-fg md:text-[36px]">Ask about your use case or report a surprising run.</h2>
              <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.7] text-fg-muted">Specific prompts, unexpected agent decisions and confusing failures are the most useful messages.</p>
            </div>
            <Link href="/contact" className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-accent px-6 text-[14px] font-[650] text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"><MessageSquare className="h-4 w-4" aria-hidden />Contact us</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

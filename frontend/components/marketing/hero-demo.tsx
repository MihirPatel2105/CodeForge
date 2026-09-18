"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowRight, Boxes, LibraryBig, PackageSearch } from "lucide-react";
import { HeroOutput, type HeroOutputDemo } from "@/components/marketing/hero-output";
import { DEMO_RUNS } from "@/lib/demo-runs";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const ICONS = {
  library: LibraryBig,
  inventory: Boxes,
  support: PackageSearch,
} as const;

const EXAMPLES: Array<{
  id: string;
  label: string;
  icon: typeof LibraryBig;
  prompt: string;
  output: HeroOutputDemo;
}> = DEMO_RUNS.map((demo) => ({
  id: demo.slug,
  label: demo.label,
  icon: ICONS[demo.slug as keyof typeof ICONS],
  prompt: demo.prompt,
  output: demo.preview,
}));

const RUN_FACTS = [
  { value: "05", label: "specialist agents" },
  { value: "02", label: "human approvals" },
  { value: "01", label: "feedback loop" },
] as const;

const TAG =
  "font-mono text-[11px] font-[600] uppercase tracking-[0.16em] text-fg-faint";

export function HeroDemo() {
  const [activeId, setActiveId] = useState(EXAMPLES[0].id);
  const user = useCurrentUser();
  const active = EXAMPLES.find((example) => example.id === activeId) ?? EXAMPLES[0];

  return (
    <>
      <div className="relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-accent">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]"
            aria-hidden
          />
          multi-agent sdlc automation
        </span>

        <h1 className="font-display mt-7 max-w-[22ch] text-[34px] font-[650] leading-[1.12] tracking-[-0.06em] text-fg sm:text-[42px] md:text-[50px] xl:text-[56px]">
          <span className="block">Describe an API.</span>
          <span className="cf-home-title-accent block">Watch a team build it.</span>
        </h1>

        <div className="cf-home-prompt cf-frame mt-7 max-w-[46rem] overflow-hidden border border-border bg-surface/90 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
            <span className={TAG}>try an example</span>
            <div
              className="flex items-center gap-1"
              role="tablist"
              aria-label="Example API prompts"
            >
              {EXAMPLES.map((example) => {
                const Icon = example.icon;
                const selected = example.id === active.id;
                return (
                  <button
                    key={example.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveId(example.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.08em] transition-colors",
                      selected
                        ? "bg-fg text-surface"
                        : "text-fg-faint hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    <span>{example.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={active.id}
            className="px-5 py-4 motion-safe:animate-[cfFade_.24s_ease-out]"
          >
            <p className="cf-caret min-h-[3.2em] font-mono text-[14px] leading-[1.6] text-fg sm:text-[14.5px]">
              {active.prompt}
            </p>
          </div>
        </div>

        <p className="mt-5 max-w-[57ch] text-[15px] leading-[1.62] text-fg-muted">
          Five specialist agents plan, write, review and test the project. A locked-down
          sandbox then runs the generated code and returns the evidence.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={user ? "/projects" : "/signup"}
            className="inline-flex items-center gap-2 rounded-[3px] bg-fg px-5 py-3 font-mono text-[10.5px] font-[700] uppercase tracking-[0.1em] text-surface transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90"
          >
            {user ? "Start a project" : "Build your first API"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href={`/demo/${active.id}`}
            className="inline-flex items-center gap-2 rounded-[3px] border border-border bg-surface/70 px-5 py-3 font-mono text-[10.5px] font-[700] uppercase tracking-[0.1em] text-fg transition-colors hover:border-border-strong hover:bg-surface"
          >
            Watch {active.label} Full Run
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <dl className="mt-6 grid max-w-[37rem] grid-cols-3 gap-3 border-t border-rule pt-4">
          {RUN_FACTS.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="font-display text-[17px] font-[700] tracking-[-0.04em] text-fg">
                {fact.value}
              </dt>
              <dd className="mt-1 font-mono text-[8.5px] font-[600] uppercase tracking-[0.1em] text-fg-faint sm:text-[9.5px]">
                {fact.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <HeroOutput key={active.id} label={TAG} demo={active.output} />
    </>
  );
}

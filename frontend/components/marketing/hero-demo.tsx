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

const TAG = "text-[12px] font-[650] text-fg-muted";

export function HeroDemo() {
  const [activeId, setActiveId] = useState(EXAMPLES[0].id);
  const user = useCurrentUser();
  const active = EXAMPLES.find((example) => example.id === activeId) ?? EXAMPLES[0];

  return (
    <>
      <div className="relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 text-[12px] font-[650] text-accent">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]"
            aria-hidden
          />
          An AI team for your next API
        </span>

        <h1 className="font-display mt-7 max-w-[18ch] text-[38px] font-[700] leading-[1.07] tracking-[-0.065em] text-fg sm:text-[58px] xl:text-[68px]">
          <span className="block">Describe an API.</span>
          <span className="cf-home-title-accent block">Watch a team build it.</span>
        </h1>

        <div className="cf-home-prompt mt-8 max-w-[46rem] overflow-hidden rounded-2xl border border-border bg-surface">
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
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-[650] transition-colors",
                      selected
                        ? "bg-accent-soft text-accent"
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
            <p className="cf-caret min-h-[3.2em] text-[15px] leading-[1.65] text-fg sm:text-[16px]">
              {active.prompt}
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-[57ch] text-[16px] leading-[1.65] text-fg-muted">
          Five specialist agents plan, write, review and test the project. A locked-down
          sandbox then runs the generated code and returns the evidence.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={user ? "/projects" : "/signup"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-fg px-5 py-3 text-[14px] font-[650] text-surface shadow-[0_8px_22px_rgba(23,32,51,.13)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(23,32,51,.18)] motion-reduce:transform-none"
          >
            {user ? "Start a project" : "Build your first API"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href={`/demo/${active.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-5 py-3 text-[14px] font-[650] text-fg transition-colors hover:border-accent-bd hover:bg-accent-soft/40"
          >
            Watch a full run
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

      </div>

      <HeroOutput key={active.id} label={TAG} demo={active.output} />
    </>
  );
}

import Link from "next/link";
import { ArrowUpRight, Check, Code2, GitPullRequestArrow, Sparkles } from "lucide-react";

const STEPS = [
  { icon: Sparkles, title: "Describe your API", detail: "Start with a plain-English request." },
  { icon: GitPullRequestArrow, title: "Review the work", detail: "Approve requirements and design as the agents build." },
  { icon: Code2, title: "Inspect the result", detail: "See generated files and real sandbox tests." },
] as const;

export function AuthEntryProof() {
  return (
    <aside className="cf-auth-proof relative hidden min-w-0 flex-col border-l border-border px-9 py-11 lg:flex xl:px-11 xl:py-14" aria-label="How CodeForge works">
      <div className="relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-white px-3 py-1.5 text-[12px] font-[650] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Your workspace, step by step
        </span>
        <h2 className="mt-7 max-w-[15ch] font-display text-[30px] font-[700] leading-[1.14] tracking-[-0.045em] text-fg xl:text-[34px]">
          From an idea to a tested API.
        </h2>
        <p className="mt-3 max-w-[38ch] text-[14px] leading-[1.65] text-fg-muted">
          Follow each agent, review key decisions, and see the code pass its tests.
        </p>

        <ol className="mt-9 space-y-5">
          {STEPS.map(({ icon: Icon, title, detail }, index) => (
            <li key={title} className="flex gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-bd/70 bg-white text-accent">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="pt-0.5">
                <p className="text-[13.5px] font-[700] text-fg">{title}</p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-fg-muted">{detail}</p>
              </div>
              <span className="ml-auto pt-1 font-mono text-[10px] text-fg-faint" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative z-10 mt-auto pt-10">
        <div className="rounded-[20px] border border-border bg-white/85 p-4 shadow-[0_12px_32px_rgba(54,69,120,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-mono text-[11px] text-fg-muted">library-api / run 01</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-1 text-[11px] font-[700] text-ok">
              <Check className="h-3 w-3" aria-hidden /> Passed
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
            <ProofMetric value="5" label="files" />
            <ProofMetric value="8/8" label="tests" />
            <ProofMetric value="1" label="review loop" />
          </div>
        </div>
        <Link href="/demo/library" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-[650] text-accent hover:underline hover:underline-offset-4">
          Explore a sample run <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}

function ProofMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[17px] font-[700] tracking-[-0.04em] text-fg">{value}</p>
      <p className="mt-0.5 text-[11px] text-fg-muted">{label}</p>
    </div>
  );
}

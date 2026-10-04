import Link from "next/link";
import { ArrowRight, Check, FileCode2, Terminal } from "lucide-react";
import { DEMO_RUNS } from "@/lib/demo-runs";
import { tokenizePythonLine } from "@/lib/python-highlight";

const TOKEN_CLASS = {
  kw: "text-code-kw",
  str: "text-code-str",
  com: "text-code-com",
  fn: "text-code-fn",
  num: "text-code-num",
};

export function AboutProcessProof() {
  const demo = DEMO_RUNS.find((item) => item.slug === "library")!;
  const lines = demo.finalFiles["main.py"].trimEnd().split("\n");

  return (
    <section aria-label="Library demo source and test result" className="cf-about-proof mx-auto w-full min-w-0 max-w-[680px] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_20px_50px_-30px_rgba(22,24,28,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4">
        <span className="text-[13px] font-[650] text-fg">An API you can inspect.</span>
        <span className="text-[12px] text-fg-muted">Library demo · Example output</span>
      </div>
      <div className="flex items-center justify-between gap-3 bg-bg px-5 py-3 text-[12px] text-fg-muted">
        <span className="inline-flex items-center gap-2"><FileCode2 size={16} aria-hidden /><span className="font-mono">main.py</span></span>
        <span>Source excerpt</span>
      </div>
      <pre className="m-0 whitespace-pre-wrap break-words bg-code-bg px-5 py-6 font-mono text-[12px] leading-[1.9] text-code-fg"><code>{lines.map((line, index) => <span key={index} className="block">{tokenizePythonLine(line).map((token, tokenIndex) => <span key={tokenIndex} className={token.cls ? TOKEN_CLASS[token.cls] : undefined}>{token.text}</span>)}{line.length === 0 && " "}</span>)}</code></pre>
      <div className="border-t border-rule px-5 py-5">
        <p className="flex items-center gap-2 text-[12px] font-[600] text-fg-muted"><Terminal size={16} aria-hidden />Example test result</p>
        <p className="mt-3 flex items-center gap-2 font-mono text-[14px] font-[600] text-ok"><Check size={16} aria-hidden />{demo.preview.result}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-fg-muted">Source, review feedback, and test output stay available together.</p>
      </div>
      <Link href={`/demo/${demo.slug}`} className="flex min-h-12 items-center justify-between gap-3 border-t border-rule px-5 py-4 text-[13px] font-[600] text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent">Inspect the library demo<ArrowRight size={16} aria-hidden /></Link>
    </section>
  );
}

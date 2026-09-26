"use client";

import { useEffect, useState } from "react";
import { Check, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokenizePythonLine } from "@/lib/python-highlight";

/**
 * The hero's right half: what a run actually hands back.
 *
 * Replaces a strip that cycled the six stage names. That was a second telling of the
 * pipeline, which the walkthrough further down the page already covers properly — and
 * naming stages is a claim about process, not a result. This shows the artefact instead:
 * real generated code appearing a line at a time, then the pytest line underneath it.
 * The product's whole argument is that the verdict comes from an interpreter rather
 * than a model's opinion, so the last thing to land is the passing suite.
 *
 * Lines are the shape the Coder genuinely emits, including the `BookOut(id=str(doc.id))`
 * response model — the detail that keeps Mongo's ObjectId out of a response, and the
 * project's most-predicted generated-code failure (CLAUDE.md §8).
 *
 * Syntax colours come from `tokenizePythonLine`, the same highlighter the dashboard's
 * code panel uses, so this is the real thing rather than a hand-coloured mock.
 */

export type HeroOutputDemo = {
  id: string;
  file: string;
  lines: readonly string[];
  result: string;
};

const TOKEN_CLASS: Record<string, string> = {
  kw: "text-code-kw",
  str: "text-code-str",
  com: "text-code-com",
  fn: "text-code-fn",
  num: "text-code-num",
};

/** Per-line cadence, and the beat the finished state holds for before looping. */
const LINE_MS = 260;
const HOLD_MS = 3400;

export function HeroOutput({
  label,
  demo,
}: {
  label: string;
  demo: HeroOutputDemo;
}) {
  // -1 keeps the card empty for one beat before the first line lands, so the sequence
  // reads as starting rather than as already half-done on arrival.
  const [shown, setShown] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const done = reduceMotion || shown >= demo.lines.length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(
      () => setShown((n) => (n >= demo.lines.length ? 0 : n + 1)),
      done ? HOLD_MS : LINE_MS,
    );
    return () => clearTimeout(timer);
  }, [shown, done, demo.lines.length, reduceMotion]);

  return (
    <div className="cf-home-output relative w-full overflow-hidden rounded-[28px] border border-border bg-white p-4 shadow-[0_28px_70px_rgba(34,48,78,0.12),0_3px_12px_rgba(34,48,78,0.04)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <span className={label}>Generated output</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-[650] transition-colors duration-500",
            done ? "border-ok-bd bg-ok-soft text-ok" : "border-accent-bd bg-accent-soft text-accent",
          )}
        >
          {done ? <Check className="h-3 w-3" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[cfDot_1s_ease-in-out_infinite]" aria-hidden />}
          {done ? "Tests passed" : "Writing code"}
        </span>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-border bg-white shadow-[0_2px_8px_rgba(35,50,81,0.035)]">
        <div className="flex items-center justify-between gap-3 border-b border-rule bg-surface-2/70 px-4 py-3">
          <span className="inline-flex min-w-0 items-center gap-2.5 text-[12px] font-[650] text-fg">
            <FileCode2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="truncate font-mono">{demo.file}</span>
          </span>
          <span className="shrink-0 text-[11px] text-fg-faint">Python · {demo.lines.length} lines</span>
        </div>

        {/* Fixed height so the card never resizes as lines land — a hero that jumps
            while you read the headline beside it is worse than one that sits still. */}
        <div className="h-[254px] overflow-x-auto bg-code-bg px-4 py-3.5">
          <ol className="min-w-max font-mono text-[12.5px] leading-[1.8]">
            {demo.lines.map((line, i) => {
              const visible = reduceMotion || i < shown;
              const newest = i === shown - 1;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex gap-4 transition-opacity duration-300",
                    visible ? "opacity-100" : "opacity-0",
                  )}
                >
                  <span className="w-[18px] shrink-0 select-none text-right text-code-com">{i + 1}</span>
                  <span className="text-code-fg">
                    {tokenizePythonLine(line).map((token, t) => (
                      <span key={t} className={token.cls ? TOKEN_CLASS[token.cls] : undefined}>
                        {token.text}
                      </span>
                    ))}
                    {newest && !done && (
                      <span className="ml-[1px] inline-block h-[13px] w-[7px] translate-y-[2px] bg-code-fg motion-safe:animate-[cfBlink_1s_step-end_infinite]" />
                    )}
                    {line.length === 0 && " "}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The verdict. Only meaningful once the file exists, so it stays reserved
            rather than absent — the card keeps one height either way. */}
        <div className={cn("flex min-h-12 items-center gap-2.5 border-t border-rule px-4 py-3", done ? "bg-ok-soft/55" : "bg-surface-2/55")}>
          <span
            aria-hidden
            className={cn(
              "h-[6px] w-[6px] shrink-0 rounded-full transition-colors duration-500",
              done ? "bg-ok" : "bg-border-strong",
            )}
          />
          <span
            className={cn(
              "text-[12px] font-[650] transition-colors duration-500",
              done ? "font-[600] text-ok" : "text-fg-faint",
            )}
          >
            {done ? demo.result : "running the suite…"}
          </span>
        </div>
      </div>
    </div>
  );
}

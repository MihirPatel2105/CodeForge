"use client";

import { useEffect, useState } from "react";
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
  const done = shown >= demo.lines.length;

  useEffect(() => {
    const timer = setTimeout(
      () => setShown((n) => (n >= demo.lines.length ? 0 : n + 1)),
      done ? HOLD_MS : LINE_MS,
    );
    return () => clearTimeout(timer);
  }, [shown, done, demo.lines.length]);

  return (
    <div className="cf-invert cf-lift cf-home-output relative w-full overflow-hidden rounded-[6px] border border-border bg-bg p-4 shadow-[0_28px_80px_rgba(22,24,28,0.18)] sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" aria-hidden />
      <div className="mb-4 flex items-baseline justify-between">
        <span className={label}>what it writes</span>
        <span
          className={cn(
            "font-mono text-[10.5px] font-[600] uppercase tracking-[0.12em] transition-colors duration-500",
            done ? "text-ok" : "text-fg-faint",
          )}
        >
          {done ? "passed" : "writing"}
        </span>
      </div>

      <div className="cf-frame overflow-hidden border border-border bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center justify-between border-b border-rule px-4 py-[9px]">
          <span className="font-mono text-[12px] font-[600] text-fg">{demo.file}</span>
          <span className="font-mono text-[11px] text-fg-faint">
            {String(Math.min(shown, demo.lines.length)).padStart(2, "0")}/{demo.lines.length}
          </span>
        </div>

        {/* Fixed height so the card never resizes as lines land — a hero that jumps
            while you read the headline beside it is worse than one that sits still. */}
        <div className="h-[236px] bg-code-bg px-4 py-3">
          <ol className="font-mono text-[12.5px] leading-[1.85]">
            {demo.lines.map((line, i) => {
              const visible = i < shown;
              const newest = i === shown - 1;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex gap-3 transition-opacity duration-300",
                    visible ? "opacity-100" : "opacity-0",
                  )}
                >
                  <span className="w-[14px] shrink-0 text-right text-code-com">{i + 1}</span>
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
        <div className="flex items-center gap-[9px] border-t border-rule px-4 py-[11px]">
          <span
            aria-hidden
            className={cn(
              "h-[6px] w-[6px] shrink-0 rounded-full transition-colors duration-500",
              done ? "bg-ok" : "bg-border-strong",
            )}
          />
          <span
            className={cn(
              "font-mono text-[12px] transition-colors duration-500",
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

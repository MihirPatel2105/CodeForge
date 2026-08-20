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

const FILE = "main.py";

const LINES = [
  'from fastapi import FastAPI',
  'from models import Book',
  "",
  "app = FastAPI()",
  "",
  '@app.post("/books", status_code=201)',
  "async def create(book: BookIn):",
  "    doc = Book(**book.model_dump())",
  "    await doc.insert()",
  "    return BookOut(id=str(doc.id))",
] as const;

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

export function HeroOutput({ label }: { label: string }) {
  // -1 keeps the card empty for one beat before the first line lands, so the sequence
  // reads as starting rather than as already half-done on arrival.
  const [shown, setShown] = useState(0);
  const done = shown >= LINES.length;

  useEffect(() => {
    const timer = setTimeout(() => setShown((n) => (n >= LINES.length ? 0 : n + 1)), done ? HOLD_MS : LINE_MS);
    return () => clearTimeout(timer);
  }, [shown, done]);

  return (
    <div className="w-full">
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

      <div className="cf-frame overflow-hidden border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-rule px-4 py-[9px]">
          <span className="font-mono text-[12px] font-[600] text-fg">{FILE}</span>
          <span className="font-mono text-[11px] text-fg-faint">
            {String(Math.min(shown, LINES.length)).padStart(2, "0")}/{LINES.length}
          </span>
        </div>

        {/* Fixed height so the card never resizes as lines land — a hero that jumps
            while you read the headline beside it is worse than one that sits still. */}
        <div className="h-[236px] bg-code-bg px-4 py-3">
          <ol className="font-mono text-[12.5px] leading-[1.85]">
            {LINES.map((line, i) => {
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
            {done ? "8 passed in 1.42s" : "running the suite…"}
          </span>
        </div>
      </div>
    </div>
  );
}

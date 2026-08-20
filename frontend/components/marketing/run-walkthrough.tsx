"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The landing page's spine: one real run, unfolded down the page, with the pipeline
 * pinned beside it tracking where you are.
 *
 * The structure is the argument. A hero followed by three feature panels is the shape
 * every product site has, and it says nothing about this one — whereas scrolling
 * *through* a run, watching the rail advance and then jump backwards when the Reviewer
 * finds a defect, is the product. By the time a visitor reaches the bottom they have
 * seen the loop happen rather than read a claim that it exists.
 *
 * Every line is from the recorded run in docs/UI_BRIEF.md §4.2 — including the
 * ObjectId/response-model defect CLAUDE.md §8 names as the predicted #1 failure mode,
 * and the pytest output the sandbox actually printed.
 */

type Line = { text: string; kind?: "plain" | "blocking" | "pass" | "meta" };

type Step = {
  id: string;
  /** Index into STAGES; the rail highlights this while the step is in view. */
  stage: number;
  eyebrow: string;
  title: string;
  body: string;
  lines?: Line[];
  code?: { caption: string; content: string };
  terminal?: string;
  loop?: boolean;
};

const STAGES = ["pm", "architect", "coder", "reviewer", "tester", "sandbox"] as const;

const STEPS: Step[] = [
  {
    id: "pm",
    stage: 0,
    eyebrow: "01 · pm",
    title: "It reads the request like a product manager",
    body: "The prompt becomes structured requirements — entities, fields and operations — validated against a schema before anything downstream sees it.",
    lines: [
      { text: "Identified entity: Book (title, author, year, genres)" },
      { text: "Completed — 1 entity, 4 operations", kind: "meta" },
    ],
  },
  {
    id: "architect",
    stage: 1,
    eyebrow: "02 · architect",
    title: "Then designs the API surface",
    body: "Endpoints, collections and response models. This is where the run pauses the first time and waits for you.",
    lines: [
      { text: "5 endpoints designed, all with explicit response models" },
      { text: "Waiting for your approval", kind: "meta" },
    ],
  },
  {
    id: "coder",
    stage: 2,
    eyebrow: "03 · coder",
    title: "The Coder writes the tree, one file at a time",
    body: "Four files, each generated on its own call — a whole-tree request breaches the free tier's token ceiling.",
    lines: [
      { text: "Wrote database.py (289 bytes)" },
      { text: "Wrote models.py (542 bytes)" },
      { text: "Wrote main.py (2,318 bytes)" },
    ],
    code: {
      caption: "main.py",
      content: `@app.delete("/books/{book_id}", status_code=204)
async def delete_book(book_id: str):
    book = await Book.get(book_id)
    if book is None:
        raise HTTPException(404, "Book not found")
    await book.delete()`,
    },
  },
  {
    id: "reviewer",
    stage: 3,
    eyebrow: "04 · reviewer",
    title: "The Reviewer reads it against a fixed checklist",
    body: "Same checks, every run — so the review is comparable rather than a matter of mood. Here it finds a real defect.",
    lines: [
      {
        text: "DELETE /books/{id} returns the Document directly — ObjectId is not serialisable",
        kind: "blocking",
      },
      { text: "3 findings, 2 blocking", kind: "meta" },
    ],
  },
  {
    id: "loop",
    stage: 2,
    eyebrow: "⟳ the loop",
    title: "So the work goes back",
    body: "This is the part that makes it more than code generation. The finding travels back to the Coder with the specific problem attached, and the pipeline runs again from there. The cycle is capped, so a run always ends with something to show.",
    lines: [{ text: "Iteration 1 — sending 2 blocking findings back to the Coder" }],
    loop: true,
  },
  {
    id: "fix",
    stage: 2,
    eyebrow: "05 · coder, second pass",
    title: "The Coder fixes only what was flagged",
    body: "One file, rewritten against the finding — not a fresh tree that would discard the three files already working.",
    lines: [
      { text: "Rewrote main.py — added BookResponse to the DELETE route" },
      { text: "1 finding, 0 blocking — passed", kind: "pass" },
    ],
  },
  {
    id: "sandbox",
    stage: 5,
    eyebrow: "06 · tester + sandbox",
    title: "Then it runs for real",
    body: "The Tester writes a pytest suite and the Sandbox executes it inside a container with networking disabled. The Reviewer has an opinion; the interpreter has a result.",
    terminal: `$ pytest -q
collected 8 items

test_main.py ........                    [100%]

8 passed in 1.42s`,
  },
];

export function RunWalkthrough() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    // Whichever step owns the upper third of the viewport drives the rail. A plain
    // "most visible" test flickers between neighbours on a fast scroll.
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).at(0);
        if (!hit) return;
        const index = refs.current.indexOf(hit.target as HTMLElement);
        if (index >= 0) setActive(STEPS[index].stage);
      },
      { rootMargin: "-12% 0px -68% 0px", threshold: 0 },
    );
    for (const el of refs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto w-full px-6 md:px-10 lg:px-14">
      <div className="grid gap-x-14 lg:grid-cols-[11rem_1fr]">
        {/* The pipeline, pinned. It advances as you read and drops back to the Coder at
            the loop — the one movement the whole product is built around. */}
        <nav aria-label="Pipeline position" className="hidden lg:block">
          <ol className="sticky top-[124px] flex flex-col gap-[10px]">
            {STAGES.map((stage, i) => {
              const isActive = i === active;
              return (
                <li key={stage} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "h-[7px] w-[7px] shrink-0 rounded-full transition-colors duration-300",
                      isActive ? "bg-fg" : "bg-border-strong",
                    )}
                  />
                  <span
                    className={cn(
                      "font-mono text-[11px] font-[600] uppercase tracking-[0.12em] transition-colors duration-300",
                      isActive ? "text-fg" : "text-fg-faint",
                    )}
                  >
                    {stage}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        <div>
          {STEPS.map((step, i) => (
            <section
              key={step.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className={cn(
                "border-t border-rule py-16 first:border-t-0 first:pt-0 md:py-20",
                step.loop && "border-loop-bd",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[11px] font-[600] uppercase tracking-[0.16em]",
                  step.loop ? "text-loop" : "text-fg-faint",
                )}
              >
                {step.eyebrow}
              </span>

              <h3
                className={cn(
                  "font-display mt-5 max-w-[24ch] text-[24px] font-[600] leading-[1.26] tracking-[-0.035em] md:text-[28px]",
                  step.loop ? "text-loop" : "text-fg",
                )}
              >
                {step.title}
              </h3>

              <p className="mt-4 max-w-[58ch] text-[15.5px] leading-[1.62] text-fg-muted">
                {step.body}
              </p>

              {step.lines && (
                <ul className="mt-7 flex flex-col gap-[10px]">
                  {step.lines.map((line) => (
                    <li key={line.text} className="flex gap-[11px]">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full",
                          step.loop
                            ? "bg-loop"
                            : line.kind === "blocking"
                              ? "bg-danger"
                              : line.kind === "pass"
                                ? "bg-ok"
                                : "bg-border-strong",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[14.5px] leading-[1.5]",
                          step.loop
                            ? "font-[600] text-loop"
                            : line.kind === "blocking"
                              ? "text-danger"
                              : line.kind === "pass"
                                ? "font-[600] text-ok"
                                : line.kind === "meta"
                                  ? "font-[600] text-fg"
                                  : "text-fg-muted",
                        )}
                      >
                        {line.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {step.code && (
                <figure className="mt-8 border border-border bg-code-bg">
                  <figcaption className="border-b border-border px-4 py-[9px] font-mono text-[11px] font-[600] uppercase tracking-[0.12em] text-fg-faint">
                    {step.code.caption}
                  </figcaption>
                  <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.6] text-code-fg">
                    {step.code.content}
                  </pre>
                </figure>
              )}

              {step.terminal && (
                <figure className="mt-8 bg-term-bg">
                  <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.65] text-term-fg">
                    {step.terminal}
                  </pre>
                </figure>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

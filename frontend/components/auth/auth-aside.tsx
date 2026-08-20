"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * The left half of the auth screens: one claim, and a run to back it up.
 *
 * Deliberately spare. An earlier version also carried a six-stage pipeline diagram and
 * a drawn return arc, which duplicated what the run below already shows — the agents
 * appear in it by name, and the loop appears as its own violet line — while competing
 * with the form for attention.
 *
 * What is left is built as a spotlight rather than a log: the newest line is set large
 * and in full colour, earlier lines recede behind it, and a rail underneath shows how
 * far through the run we are. A flat list of six identical grey lines was honest but
 * inert; this gives the panel a rhythm, and an ending worth waiting for — the run
 * finishes on `8 passed in 1.42s`.
 *
 * The content is a real recorded run: the exact lines from docs/UI_BRIEF.md §4.2,
 * including the blocking finding and the LOOP entry it triggers. §8 forbids placeholder
 * copy for precisely the reason it matters here — the Reviewer's finding is two lines
 * long, and a panel designed around one-line lorem would break on it.
 *
 * `--loop` is spent on the LOOP entry, one of the four uses globals.css reserves it
 * for, and it is the thing a first-time visitor should carry away: work goes
 * *backwards* to the Coder and around again.
 */

type Kind = "plain" | "meta" | "approval" | "blocking" | "loop" | "pass" | "done";

type Entry = {
  time: string;
  agent: string;
  text: string;
  kind: Kind;
};

const RUN: Entry[] = [
  {
    time: "10:00:04",
    agent: "PM",
    text: "Identified entity: Book (title, author, year, genres)",
    kind: "plain",
  },
  { time: "10:00:06", agent: "PM", text: "Completed — 1 entity, 4 operations", kind: "meta" },
  { time: "10:00:06", agent: "—", text: "Waiting for your approval", kind: "approval" },
  { time: "10:00:20", agent: "—", text: "Approved", kind: "plain" },
  {
    time: "10:00:28",
    agent: "Architect",
    text: "5 endpoints designed, all with explicit response models",
    kind: "plain",
  },
  { time: "10:00:52", agent: "Coder", text: "Wrote database.py (289 bytes)", kind: "plain" },
  { time: "10:00:56", agent: "Coder", text: "Wrote main.py (2,318 bytes)", kind: "plain" },
  {
    time: "10:01:03",
    agent: "Reviewer",
    text: "DELETE /books/{id} returns the Document directly — ObjectId is not serialisable",
    kind: "blocking",
  },
  {
    time: "10:01:04",
    agent: "⟳ Loop",
    text: "Iteration 1 — sending 2 blocking findings back to the Coder",
    kind: "loop",
  },
  {
    time: "10:01:15",
    agent: "Coder",
    text: "Rewrote main.py — added BookResponse to the DELETE route",
    kind: "plain",
  },
  { time: "10:01:21", agent: "Reviewer", text: "1 finding, 0 blocking — passed", kind: "pass" },
  { time: "10:01:41", agent: "Sandbox", text: "8 passed in 1.42s", kind: "pass" },
  { time: "10:01:42", agent: "—", text: "Run completed in 1m 42s", kind: "done" },
];

/** The spotlight line plus three receding behind it. */
const VISIBLE = 4;

const ACCENT: Record<Kind, string> = {
  plain: "text-fg-faint",
  meta: "text-fg-faint",
  approval: "text-warn",
  blocking: "text-danger",
  loop: "text-loop",
  pass: "text-ok",
  done: "text-ok",
};

const RAIL: Record<Kind, string> = {
  plain: "bg-border-strong",
  meta: "bg-border-strong",
  approval: "bg-warn",
  blocking: "bg-danger",
  loop: "bg-loop",
  pass: "bg-ok",
  done: "bg-ok",
};

const BODY: Record<Kind, string> = {
  plain: "text-fg",
  meta: "text-fg",
  approval: "text-warn",
  blocking: "text-danger",
  loop: "text-loop",
  pass: "text-ok",
  done: "text-fg",
};

export function AuthAside() {
  // The panel is centred as one composition rather than pinned top-and-bottom: with the
  // copy this short, anchoring the two blocks to opposite edges left a void through the
  // middle of a full-height panel.
  //
  // Starts mid-run, and wraps back to mid-run rather than to zero, so the panel is full
  // on the first frame and stays full. Every entry is still seen — they pass through the
  // spotlight on the way down.
  const [step, setStep] = useState(VISIBLE - 1);

  useEffect(() => {
    // Holds on the final frame: the run ends on a pass, and the ending is the point.
    const last = step === RUN.length - 1;
    const timer = setTimeout(
      () => setStep((s) => (s + 1 >= RUN.length ? VISIBLE - 1 : s + 1)),
      last ? 4200 : 1600,
    );
    return () => clearTimeout(timer);
  }, [step]);

  const start = Math.max(0, step + 1 - VISIBLE);
  // Newest first: the spotlight sits at the top of the stack and history reads downward,
  // so the line you are meant to read never moves.
  const shown = RUN.slice(start, step + 1)
    .map((entry, i) => ({ entry, id: start + i }))
    .reverse();
  const progress = ((step + 1) / RUN.length) * 100;

  return (
    <aside className="cf-invert cf-lift relative hidden flex-col justify-center overflow-hidden bg-bg px-10 py-9 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[52%] xl:w-[54%]">
      <div className="shrink-0">
        {/* A wordmark is expected to be the way home; this one was inert, leaving the
            auth screens with no route back to the landing page at all. */}
        <Link
          href="/"
          aria-label="CodeForge home"
          className="inline-flex w-fit items-center gap-[9px] transition-opacity hover:opacity-80"
        >
          <LogoMark className="h-6 w-6 rounded-[2px]" />
          <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
            codeforge
          </span>
        </Link>

        <h1 className="font-display mt-10 max-w-[20ch] text-[27px] font-[600] leading-[1.24] tracking-[-0.04em] text-fg">
          Five AI agents build your API. You approve the work.
        </h1>
        <p className="mt-5 max-w-[44ch] text-[14.5px] leading-[1.6] text-fg-muted">
          One plain-English sentence in. A tested API out —{" "}
          <em className="not-italic font-[650] text-fg">run for real</em> in an isolated
          container while you watch.
        </p>
      </div>

      <div className="mt-12 shrink-0">
        <div className="mb-5 flex items-center justify-between">
          {/* Labelled honestly: this is a recording on a loop, not a live run. */}
          <span className="font-mono text-[10.5px] font-[600] uppercase tracking-[0.14em] text-fg-faint">
            A recorded run
          </span>
          <span className="flex items-center gap-[6px] font-mono text-[10.5px] font-[600] uppercase tracking-[0.1em] text-fg-faint">
            <span className="h-[5px] w-[5px] rounded-full bg-ok motion-safe:animate-[cfDot_1.4s_ease-in-out_infinite]" />
            replaying
          </span>
        </div>

        {/* Progress rail. Small, but it is what turns a loop of messages into something
            with a beginning and an end — and the end is a pass. */}
        <div className="mb-6 h-[2px] w-full overflow-hidden bg-surface-2">
          <div
            className="h-full bg-fg-muted transition-[width] duration-[600ms] ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="flex h-[196px] flex-col gap-[13px]">
          {shown.map(({ entry, id }, i) => {
            const isCurrent = i === 0;
            return (
              <li
                key={id}
                className={cn(
                  "flex gap-[11px] transition-opacity duration-500",
                  // Earlier lines recede rather than disappear, so the spotlight has
                  // somewhere to have come from.
                  isCurrent ? "opacity-100" : i === 1 ? "opacity-55" : "opacity-25",
                  isCurrent && "motion-safe:animate-[cfFade_.34s_ease-out]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[5px] h-[3px] w-[3px] shrink-0 rounded-full",
                    isCurrent ? RAIL[entry.kind] : "bg-border-strong",
                  )}
                />
                <div className="min-w-0">
                  {isCurrent && (
                    <span
                      className={cn(
                        "mb-[3px] block font-mono text-[10px] font-[600] uppercase tracking-[0.14em]",
                        ACCENT[entry.kind],
                      )}
                    >
                      {entry.agent}
                    </span>
                  )}
                  <p
                    className={cn(
                      "leading-[1.45]",
                      isCurrent
                        ? cn("text-[15px] font-[600]", BODY[entry.kind])
                        : "text-[13px] text-fg-muted",
                    )}
                  >
                    {entry.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

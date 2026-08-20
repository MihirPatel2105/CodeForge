"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import type { TestsSnapshot } from "@/lib/run-reducer";
import type { MockTestFailure } from "@/lib/mock-test-failures";

export interface TestsPanelProps {
  tests: TestsSnapshot | null;
  /** Per-test assertion detail for the failure cards — not part of the wire contract
   * (`tests.result` carries only aggregate totals); see lib/mock-test-failures.ts. */
  failures?: MockTestFailure[];
}

/** Eight bars read as a score from across the room (design_handoff/README.md "Tests
 * panel"). Deliberately renders nothing until `tests.result` arrives — the wire
 * contract has no per-test count before then, only the Tester's free-text summary. */
export function TestsPanel({ tests, failures = [] }: TestsPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const scoreTone = tests == null ? "text-fg-faint" : tests.failed === 0 ? "text-ok" : "text-warn";

  return (
    <div className="flex min-h-[196px] w-[300px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className={cn(typeScale.label, "text-fg-faint")}>TESTS</span>
        <span className={cn("font-mono text-[18px] font-bold", scoreTone)}>
          {tests ? `${tests.passed}/${tests.total}` : "—"}
        </span>
      </div>

      {tests && (
        <div className="flex gap-[3px]">
          {Array.from({ length: tests.total }, (_, i) => (
            <div
              key={i}
              className={cn("h-[9px] flex-1 rounded-full", i < tests.passed ? "bg-ok" : "bg-danger")}
            />
          ))}
        </div>
      )}

      <p className="text-[12.5px] leading-[1.35] text-fg-muted">
        {tests == null
          ? "Tests will run after the Sandbox executes."
          : tests.failed === 0
            ? "Every test the Tester wrote passes against the running container."
            : `${tests.failed} of ${tests.total} tests fail. The code runs — the behaviour is wrong in ${
                tests.failed === 1 ? "one place" : `${tests.failed} places`
              }.`}
      </p>

      {tests && tests.failed > 0 && failures.length > 0 && (
        <div className="flex flex-col gap-[6px]">
          {failures.map((f) => {
            const isOpen = expanded.has(f.name);
            return (
              <div key={f.name} className="rounded-[2px] border border-danger-bd bg-danger-soft p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12.5px] font-[650] text-danger">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => toggle(f.name)}
                    className="shrink-0 text-[11.5px] font-bold text-fg-muted underline-offset-2 hover:underline"
                  >
                    {isOpen ? "hide" : "show"}
                  </button>
                </div>
                {isOpen && (
                  <pre className="mt-[6px] font-mono text-[12px] whitespace-pre-wrap text-fg-muted">
                    {f.location}
                    {"\n"}
                    {f.detail}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

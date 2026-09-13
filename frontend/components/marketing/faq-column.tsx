"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type FaqItem = {
  category: string;
  q: string;
  a: string;
};

export function FaqColumn({ items, start }: { items: readonly FaqItem[]; start: number }) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  function toggleItem(question: string) {
    setOpenItems((current) =>
      current.includes(question)
        ? current.filter((item) => item !== question)
        : [...current, question],
    );
  }

  return (
    <div className="border-t border-rule">
      {items.map((item, index) => {
        const isOpen = openItems.includes(item.q);
        const panelId = `faq-answer-${start + index}`;
        const questionId = `faq-question-${start + index}`;

        return (
          <div key={item.q} className="group border-b border-rule">
            <button
              type="button"
              id={questionId}
              onClick={() => toggleItem(item.q)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="grid w-full cursor-pointer grid-cols-[2.25rem_1fr_auto] items-start gap-3 py-6 text-left"
            >
              <span className="pt-0.5 font-mono text-[9px] font-[700] text-fg-faint">
                {String(start + index).padStart(2, "0")}
              </span>
              <span>
                <span className="block font-mono text-[8px] font-[700] uppercase tracking-[0.13em] text-accent">
                  {item.category}
                </span>
                <span className="mt-2 block text-[15px] font-[650] leading-[1.45] text-fg transition-colors group-hover:text-fg-muted">
                  {item.q}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "mt-3 grid h-6 w-6 place-items-center rounded-full border border-border font-mono text-[15px] leading-none text-fg-faint transition-[transform,border-color,color,background-color] duration-300",
                  isOpen && "rotate-45 border-accent-bd bg-accent-soft text-accent",
                )}
              >
                +
              </span>
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={questionId}
              aria-hidden={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-[360ms] ease-[cubic-bezier(0.22,0.7,0.28,1)] motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <p
                  className={cn(
                    "pb-7 pl-[3.25rem] pr-10 text-[14px] leading-[1.72] text-fg-muted transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                    isOpen ? "translate-y-0 opacity-100 delay-75" : "-translate-y-1 opacity-0",
                  )}
                >
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

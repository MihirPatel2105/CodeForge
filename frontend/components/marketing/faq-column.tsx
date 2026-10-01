"use client";

import { motion } from "motion/react";
import { MotionCollapse } from "@/components/ui/motion-collapse";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type FaqItem = {
  category: string;
  q: string;
  a: string;
};

export function FaqColumn({ items, start }: { items: readonly FaqItem[]; start: number }) {
  const reducedMotion = useMotionPreference();
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
              className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-start gap-3 py-6 text-left"
            >
              <span>
                <span className="block text-[12px] font-[650] text-accent">
                  {item.category}
                </span>
                <span className="mt-2 block text-[18px] font-[600] leading-[1.45] text-fg transition-colors group-hover:text-fg-muted">
                  {item.q}
                </span>
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={reducedMotion ? { duration: 0 } : undefined}
                aria-hidden
                className={cn(
                  "mt-3 grid h-6 w-6 place-items-center rounded-full border border-border font-mono text-[15px] leading-none text-fg-faint transition-[border-color,color,background-color] duration-300",
                  isOpen && "border-accent-bd bg-accent-soft text-accent",
                )}
              >
                <ChevronDown size={16} aria-hidden />
              </motion.span>
            </button>

            <MotionCollapse open={isOpen} id={panelId} role="region" aria-labelledby={questionId}>
              <p className="pb-7 pr-10 text-[14px] leading-[1.72] text-fg-muted">{item.a}</p>
            </MotionCollapse>
          </div>
        );
      })}
    </div>
  );
}

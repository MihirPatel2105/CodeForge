"use client";

// Adapted from Vengeance UI. MIT license: docs/vendor/vengeance-ui.md.
import { useId, useState } from "react";
import { MotionCollapse } from "@/components/ui/motion-collapse";
import { cn } from "@/lib/utils";

type FaqItem = { question: string; answer: string; category?: string };
export function FaqAccordion({ items, className }: { items: readonly FaqItem[]; className?: string }) {
  const id = useId();
  const [openItems, setOpenItems] = useState<string[]>([]);
  return (
    <div className={cn("vui-faq", className)}>
      {items.map((item, index) => {
        const open = openItems.includes(item.question);
        const triggerId = `${id}-question-${index}`, panelId = `${id}-answer-${index}`;
        return (
          <div key={item.question} className="vui-faq-item" data-open={open}>
            <h3><button type="button" id={triggerId} aria-expanded={open} aria-controls={panelId}
              onClick={() => setOpenItems(current => open ? current.filter(q => q !== item.question) : [...current, item.question])}>
              <span className="vui-faq-symbol" aria-hidden>{open ? "−" : "+"}</span>
              <span>{item.category && <span className="vui-faq-category">{item.category}</span>}{item.question}</span>
            </button></h3>
            <MotionCollapse open={open} id={panelId} role="region" aria-labelledby={triggerId}>
              <p>{item.answer}</p>
            </MotionCollapse>
          </div>
        );
      })}
    </div>
  );
}

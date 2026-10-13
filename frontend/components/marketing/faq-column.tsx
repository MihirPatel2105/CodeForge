"use client";

import { FaqAccordion } from "@/components/ui/vengeance/faq-accordion";

type FaqItem = { category: string; q: string; a: string };
export function FaqColumn({ items }: { items: readonly FaqItem[]; start: number }) {
  return <FaqAccordion items={items.map(item => ({ category: item.category, question: item.q, answer: item.a }))} />;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DEMO_RUNS } from "@/lib/demo-runs";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function DemoSearchCell() {
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, { once: true, amount: .5 });
  const reduced = useMotionPreference();
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState("");
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    if (!visible || reduced || interacted) return;
    let index = 0;
    const sample = "Search Library";
    const timer = setInterval(() => { index++; setHint(sample.slice(0, index)); if (index >= sample.length) clearInterval(timer); }, 85);
    return () => clearInterval(timer);
  }, [visible, reduced, interacted]);
  const results = DEMO_RUNS.filter(demo => `${demo.label} ${demo.prompt}`.toLowerCase().includes(query.toLowerCase()));
  return <div ref={root} className="mb-8 rounded-2xl border border-border bg-surface p-5 sm:p-6" role="search" aria-label="Search example APIs">
    <p className="mb-3 text-sm font-semibold">Find an example to explore</p>
    <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden /><Input type="search" aria-label="Search example APIs" placeholder={hint || "Search Library, Inventory, or Support"} value={query} onFocus={() => setInteracted(true)} onChange={event => { setInteracted(true); setQuery(event.target.value); }} className="pl-10" /></div>
    <motion.div layout={!reduced} className="mt-3 flex flex-wrap gap-2"><AnimatePresence initial={false}>{results.map(demo => <motion.div key={demo.slug} layout={!reduced} initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18 }}><Link className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2" href={`/demo/${demo.slug}`}>{demo.label}<ArrowUpRight className="size-3" aria-hidden /></Link></motion.div>)}</AnimatePresence></motion.div>
    <p className="mt-3 text-xs text-fg-muted" role="status">{results.length ? `${results.length} recorded examples to explore` : "No matching examples. Try Library, Inventory, or Support."}</p>
  </div>;
}

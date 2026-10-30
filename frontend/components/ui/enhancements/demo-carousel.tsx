"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Boxes, Check, ChevronLeft, ChevronRight, FileCode2, LifeBuoy, type LucideIcon } from "lucide-react";
import { DEMO_RUNS } from "@/lib/demo-runs";
import { Button } from "@/components/ui/button";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { ScrollReveal } from "@/components/ui/react-bits/scroll-reveal";
import { AnimatedArrow } from "./animated-icons";
import { tokenizePythonLine } from "@/lib/python-highlight";
import "./demo-gallery.css";

const examples = [...DEMO_RUNS.filter(demo => demo.slug !== "library"), ...DEMO_RUNS.filter(demo => demo.slug === "library")];

const icons: Record<string, LucideIcon> = { library: BookOpen, inventory: Boxes, support: LifeBuoy };

export function DemoCarousel() {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useMotionPreference();
  useEffect(() => {
    const list = viewport.current;
    if (!list) return;
    const observer = new IntersectionObserver(records => {
      const visible = records.filter(record => record.isIntersecting && record.intersectionRatio >= .6);
      for (const record of visible) {
        const index = Array.from(list.children).indexOf(record.target);
        if (index >= 0) setActive(index);
      }
    }, { root: list, threshold: .6 });
    for (const card of list.children) observer.observe(card);
    return () => observer.disconnect();
  }, []);

  function go(index: number) {
    const list = viewport.current;
    const card = list?.children.item(index) as HTMLElement | null;
    const first = list?.firstElementChild as HTMLElement | null;
    if (!list || !card || !first) return;
    list.scrollTo({ left: card.offsetLeft - first.offsetLeft, behavior: reduced ? "instant" : "smooth" });
  }
  return <div id="example-apis" className="cf-demo-gallery" role="region" aria-roledescription="carousel" aria-label="Example APIs">
    <div className="cf-demo-gallery-heading"><div><p>Explore the examples</p><ScrollReveal>See what a finished API looks like.</ScrollReveal></div>
      <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous API example" disabled={active === 0} onClick={() => go(active - 1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" aria-label="Next API example" disabled={active === examples.length - 1} onClick={() => go(active + 1)}><ChevronRight /></Button></div></div>
    <div ref={viewport} className="cf-demo-slides" tabIndex={0} aria-label="Swipe through API examples"
      onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); go(Math.max(0,Math.min(examples.length - 1, active + (event.key === "ArrowRight" ? 1 : -1)))); } }}>
      {examples.map((demo, index) => {
        const Icon = icons[demo.slug] ?? FileCode2;
        const files = Array.from(new Set([...Object.keys(demo.finalFiles), demo.testFile.path]));
        const lines = demo.finalFiles["main.py"].trimEnd().split("\n");
        return <div key={demo.slug} className="cf-demo-slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${examples.length}: ${demo.label}`}>
          <div className="cf-demo-brief"><div className="cf-demo-slide-top"><span className="cf-demo-case-icon"><Icon size={22} strokeWidth={1.5} aria-hidden /></span><span>Example API / 0{index + 1}</span></div>
            <span className="cf-demo-case-label">{demo.label} / Sample replay</span><h3>{demo.title}</h3><p>{demo.prompt}</p>
            <div className="cf-demo-facts"><span><FileCode2 size={13} aria-hidden />{files.length} generated files</span><span><Check size={13} aria-hidden />{demo.tests} tests passed</span></div>
            <Link href={`/demo/${demo.slug}`} className="cf-demo-slide-link">Explore {demo.label} API<span><AnimatedArrow /></span></Link>
          </div>
          <div className="cf-demo-artifact"><div className="cf-demo-editor"><div className="cf-demo-editor-top"><span className="cf-demo-editor-dots" aria-hidden><i /><i /><i /></span><span>main.py</span><span>Source preview</span></div><pre aria-label={`${demo.label} example generated code`}><code>{lines.map((line, lineIndex) => <span className="cf-demo-code-line" key={lineIndex}><span className="cf-demo-line-number" aria-hidden>{String(lineIndex + 1).padStart(2, "0")}</span><span>{tokenizePythonLine(line).map((token, tokenIndex) => <span key={tokenIndex} data-token={token.cls ?? undefined}>{token.text}</span>)}</span></span>)}</code></pre><div className="cf-demo-editor-files" aria-label="Example generated files">{files.slice(0, 3).map(file => <span key={file}><FileCode2 size={11} aria-hidden />{file}</span>)}</div></div>
            <div className="cf-demo-test-result"><span className="cf-demo-test-check"><Check size={16} aria-hidden /></span><div><span>Recorded sandbox result</span><strong>{demo.preview.result}</strong></div><span className="cf-demo-test-tag">pytest</span></div>
          </div>
        </div>;
      })}
    </div>
    <div className="cf-demo-gallery-footer"><span className="cf-demo-progress" aria-hidden="true">{examples.map((demo, index) => <i key={demo.slug} data-active={active === index} />)}</span><p className="cf-demo-position" aria-live="polite" aria-atomic="true">Example {active + 1} of {examples.length}</p></div>
  </div>;
}

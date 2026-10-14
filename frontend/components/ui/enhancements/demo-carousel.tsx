"use client";

// Adapted from Skiper UI 48's swipe/navigation pattern. See docs/vendor/skiper-ui.md.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileCode2 } from "lucide-react";
import { DEMO_RUNS } from "@/lib/demo-runs";
import { Button } from "@/components/ui/button";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { AnimatedArrow } from "./animated-icons";

export function DemoCarousel() {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useMotionPreference();
  useEffect(() => {
    const root = viewport.current;
    if (!root) return;
    const update = () => {
      const cards = Array.from(root.children) as HTMLElement[];
      let closest = 0;
      let distance = Infinity;
      for (let index = 0; index < cards.length; index++) {
        const offset = Math.abs(cards[index].getBoundingClientRect().left - root.getBoundingClientRect().left);
        if (offset < distance) { distance = offset; closest = index; }
      }
      setActive(closest);
    };
    root.addEventListener("scroll", update, { passive: true });
    return () => root.removeEventListener("scroll", update);
  }, []);
  function go(index: number) {
    const root = viewport.current;
    const target = root?.children[index] as HTMLElement | undefined;
    if (!root || !target) return;
    root.scrollTo({ left: root.scrollLeft + target.getBoundingClientRect().left - root.getBoundingClientRect().left, behavior: reduced ? "instant" : "smooth" });
  }
  return <div className="cf-demo-gallery" role="region" aria-roledescription="carousel" aria-label="Example APIs">
    <div className="cf-demo-gallery-heading"><div><p>Explore the examples</p><h2>See what a finished API looks like.</h2></div>
      <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous API example" disabled={active === 0} onClick={() => go(active - 1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" aria-label="Next API example" disabled={active === DEMO_RUNS.length - 1} onClick={() => go(active + 1)}><ChevronRight /></Button></div></div>
    <div ref={viewport} className="cf-demo-slides" tabIndex={0} aria-label="Swipe through API examples"
      onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); go(Math.max(0,Math.min(DEMO_RUNS.length - 1, active + (event.key === "ArrowRight" ? 1 : -1)))); } }}>
      {DEMO_RUNS.map((demo, index) => <article key={demo.slug} className="cf-demo-slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${DEMO_RUNS.length}: ${demo.label}`}>
        <div className="cf-demo-slide-top"><FileCode2 size={24} aria-hidden /><span>Example API / 0{index + 1}</span></div>
        <h3>{demo.title}</h3><p>{demo.prompt}</p>
        <Link href={`/demo/${demo.slug}`} className="cf-demo-slide-link">Explore {demo.label} API<AnimatedArrow /></Link>
      </article>)}
    </div>
    <p className="cf-demo-position" aria-live="polite" aria-atomic="true">Example {active + 1} of {DEMO_RUNS.length}</p>
  </div>;
}

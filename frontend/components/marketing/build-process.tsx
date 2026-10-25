"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Code2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { scrollToSection } from "@/components/layout/app-scroll";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { ApprovalPreview, CodePreview, OutcomePreview } from "./control-previews";

const steps = [
  { label: "Describe your API", title: "Start with a sentence.", detail: "Tell the agents what you want to manage and what your API should do. A focused brief gives the whole team a direction." },
  { label: "Review the plan", title: "See the plan. Make it yours.", detail: "The PM defines the requirements. The Architect maps the routes and data. You approve both before the build moves on." },
  { label: "Build and improve", title: "Watch the work take shape.", detail: "The Coder creates the application. The Reviewer checks it and can send blocking findings back for another pass." },
  { label: "Inspect the result", title: "Built. Checked. Yours.", detail: "The Tester writes the checks and the Sandbox runs them. Inspect the actual outcome, explore the files, and take them with you." },
];

export function BuildProcess({ startHref }: { startHref: string }) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useMotionPreference();
  useEffect(() => {
    const sections = root.current?.querySelectorAll<HTMLElement>("[data-process-step]");
    if (!sections) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => Math.abs(a.boundingClientRect.top - innerHeight * .25) - Math.abs(b.boundingClientRect.top - innerHeight * .25));
      if (visible[0]) setActive(Number((visible[0].target as HTMLElement).dataset.processStep));
    }, { rootMargin: "-20% 0px -35% 0px", threshold: 0 });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return <section ref={root} className="ol-process lp-section" id="build-story" aria-labelledby="cf-story-title">
    <header className="ol-section-heading"><span className="ol-mini-label">Working process</span><h2 id="cf-story-title">From your first idea<br />to a working API.</h2><p>One Library example. Every step in the open.</p></header>
    <div className="ol-process-layout"><nav className="ol-process-nav" aria-label="Walkthrough chapters">{steps.map((step, index) => <Button key={step.label} variant="ghost" className="ol-process-button" aria-label={`0${index + 1} ${["Describe", "Plan", "Build", "Verify"][index]}`} aria-current={active === index ? "step" : undefined} aria-controls={`process-${index}`} onClick={() => { setActive(index); const target = document.getElementById(`process-${index}`); if (target) scrollToSection(target, reduced || !document.documentElement.classList.contains("lenis")); }}><span>{step.label}<small>0{index + 1}</small></span><span className="ol-process-reveal" aria-hidden={active !== index}><span className="ol-process-description"><span>{step.detail}</span></span></span></Button>)}<Link className="ol-process-demo" href="/demo/library">Inspect the Library demo<ArrowRight size={16} aria-hidden /></Link></nav>
      <div className="ol-process-panels">{steps.map((step, index) => <article key={step.label} id={`process-${index}`} data-process-step={index} className="ol-process-panel"><span className="ol-mini-label">0{index + 1} / {step.label}</span><h3>{step.title}</h3><div className={`ol-process-artifact ol-process-artifact-${index}`} aria-hidden="true">{index === 0 ? <div className="ol-prompt-card"><span><Code2 size={20} />The brief</span><p>I want an API to manage a personal library of <strong>books</strong> — title, author, ISBN, genre, and whether I’ve read it.</p><span>One prompt. A place to start.<ArrowRight size={18} /></span></div> : index === 1 ? <ApprovalPreview /> : index === 2 ? <CodePreview /> : <OutcomePreview />}</div><p className="ol-process-mobile-detail">{step.detail}</p>{index === 3 && <Link href={startHref} className="lp-button">{startHref === "/projects" ? "Start a project" : "Build your first API"}<ArrowRight size={16} aria-hidden /></Link>}</article>)}</div>
    </div>
  </section>;
}

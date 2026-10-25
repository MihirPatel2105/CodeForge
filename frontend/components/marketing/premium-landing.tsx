"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { ScrollReveal } from "@/components/ui/react-bits/scroll-reveal";
import { BlurHeadline, pointerLight } from "@/components/ui/premium-effects";
import { DemoCarousel } from "@/components/ui/enhancements/demo-carousel";
import { FaqAccordion } from "@/components/ui/vengeance/faq-accordion";
import { AgentBentoGrid } from "@/components/ui/vengeance/agent-bento-grid";
import { useMotionPreference } from "@/lib/use-motion-preference";
import Link from "next/link";
import "./premium-landing.css";
import "./landing-showcase.css";
import "./ostack-landing.css";
import { ArrowRight, Check, Code2, Layers3, RotateCcw, ShieldCheck, Terminal } from "lucide-react";
import { SiteHeader } from "./site-header";
import { HeroLightRays } from "./hero-light-rays";
import { LandingProductPreview } from "./landing-product-preview";
import { BuildProcess } from "./build-process";
import { SiteFooter } from "./marketing-actions";
import { useCurrentUser } from "@/lib/use-current-user";

const agents = [
  { name: "PM", verb: "Your idea. Made specific.", detail: "Defines the scope and expected behavior.", icon: Layers3, artifact: "Requirements", lines: ["Entities and fields", "Supported operations", "Acceptance criteria"], note: "Your approval before design" },
  { name: "Architect", verb: "A clear plan. Before the code.", detail: "Maps the routes, data models, and application structure.", icon: Layers3, artifact: "API design", lines: ["Routes and methods", "Data models", "Project structure"], note: "Your approval before implementation" },
  { name: "Coder", verb: "The plan becomes working code.", detail: "Implements the approved design.", icon: Code2, artifact: "Application", lines: ["Routes and handlers", "Validation schemas", "Database connection"] },
  { name: "Reviewer", verb: "A second look. A stronger API.", detail: "Checks the implementation against the plan.", icon: ShieldCheck, artifact: "Review checklist", lines: ["Requirements match", "Code quality", "Blocking findings"] },
  { name: "Tester", verb: "Turn the plan into test cases.", detail: "Writes checks for expected behavior and edge cases.", icon: Terminal, artifact: "Test coverage", lines: ["Route behavior", "Input validation", "Failure cases"] },
  { name: "Sandbox", verb: "Run it. See what holds up.", detail: "Executes the application and captures the real output.", icon: Terminal, artifact: "Isolated execution", lines: ["Start the application", "Run the generated tests", "Capture logs and results"] },
];
const questions = [
  { title: "What can I build?", answer: "CodeForge focuses on CRUD REST APIs: applications that create, read, update, and delete data. Start with a library, inventory, support ticket system, or a similar data-driven API." },
  { title: "Do I get to approve the plan?", answer: "Yes. You review the requirements and the architecture at two checkpoints before the agents continue. You can inspect the live work throughout the run." },
  { title: "What happens when a test fails?", answer: "Review findings and sandbox test failures can go back to the Coder for repair. The run has a bounded retry loop; it can also stop with an actionable failure instead of claiming success." },
  { title: "What do I get at the end?", answer: "Generated application files, review feedback, and the test output. You can inspect and download the artifacts. A completed run shows its actual outcome, including any unresolved problems." },
];

export function PremiumLanding() {
  const user = useCurrentUser();
  const reducedMotion = useMotionPreference();
  const { scrollY } = useScroll();
  // Lenis already smooths the page position; follow it without adding a second spring.
  const heroTransform = useTransform(scrollY, [0, 600], ["translateY(0px)", "translateY(-48px)"]);
  const heroOpacity = useTransform(scrollY, [0, 240, 600], [1, 1, 0]);
  const start = user ? "/projects" : "/signup";
  const entrance = (delay: number) => ({
    initial: { opacity: 0, transform: "translateY(12px)" },
    animate: { opacity: 1, transform: "none" },
    transition: reducedMotion ? { duration: 0, delay: 0 } : { duration: 1.5, delay, ease: [0.22, 0.61, 0.36, 1] as const },
  });

  const reveal = {
    initial: { opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 18 },
    animate: reducedMotion ? { opacity: 1, y: 0 } : undefined,
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: reducedMotion ? 0 : 0.55 },
  };

  return (
    <div className="cf-premium cf-ostack">
      <a className="lp-skip" href="#landing-content">Skip to content</a>
      <SiteHeader />
      <main id="landing-content">
        <section id="overview" className="lp-hero lp-hero-dark" aria-labelledby="landing-title">
          <HeroLightRays />
          <motion.div className="lp-hero-copy" style={{ transform: reducedMotion ? "none" : heroTransform, opacity: reducedMotion ? 1 : heroOpacity }}>
            <motion.p {...entrance(0.12)} className="lp-intro"><span className="ol-hero-mark"><Code2 size={14} aria-hidden /></span>Five agents. Two checkpoints. Your API.</motion.p>
            <BlurHeadline />
            <motion.p {...entrance(0.5)} className="lp-lead">Describe your API. Watch a team of AI agents plan,<br className="lp-desktop-break" /> build, review, and test it—with you in control.</motion.p>
            <motion.div {...entrance(0.7)} className="lp-actions">
              <Link className="lp-button cf-specular" onPointerMove={pointerLight} href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link>
              <Link className="lp-text-link" href="/how-it-works">How CodeForge works<ArrowRight size={18} aria-hidden /></Link>
            </motion.div>
          </motion.div>
          <LandingProductPreview />
        </section>
        <section className="ol-technology" aria-label="Built with open-source tools"><p>Real tools. Working together behind your API.</p><div className="ol-tech-track">{[0, 1].map(copy => <div className="ol-tech-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>{["Python", "FastAPI", "MongoDB", "LangGraph", "Docker", "pytest"].map(tool => <span key={tool}>{tool}</span>)}</div>)}</div></section>

        <section className="lp-team lp-section" id="how" aria-labelledby="team-title">
          <span className="lp-section-label">Meet the team</span>
          <motion.div {...reveal} className="lp-section-intro"><ScrollReveal id="team-title">{"Five specialists.\nOne real sandbox."}</ScrollReveal><p>A clear responsibility for every role.</p></motion.div>
          <AgentBentoGrid agents={agents} />
        </section>

        <BuildProcess />

        <section id="repair-loop" className="lp-loop-section" aria-labelledby="loop-title">
          <div className="lp-loop-inner"><motion.div {...reveal} className="lp-loop-copy"><span className="lp-section-label"><RotateCcw size={15} strokeWidth={1.5} aria-hidden /> Built to take a second look</span><ScrollReveal id="loop-title">{"The first draft\nis just the start."}</ScrollReveal><p>A review finds an issue. A test catches a failure. The feedback returns to the Coder, and the next version gets another check.</p><Link href="/how-it-works" className="lp-light-link">See how the loop works<span><ArrowRight size={18} aria-hidden /></span></Link><div className="lp-loop-sequence" aria-label="Review, repair, recheck"><span>01 Review</span><span>02 Repair</span><span>03 Recheck</span></div></motion.div>
            <div className="lp-loop-visual" aria-label="Example repair: Reviewer finds a missing response model, Coder adds it, then tests pass">
              <div className="lp-loop-workspace-head"><span className="lp-preview-dots" aria-hidden><i /><i /><i /></span><span>Library API / Review loop</span><span>Pass 02</span></div>
              <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : 0.55, delay: 0 }} className="lp-finding"><span><ShieldCheck size={18} aria-hidden />Reviewer<span className="lp-review-badge">Change requested</span></span><p>Update route needs a response model.</p><span className="lp-loop-state">Sent back for repair</span></motion.div>
              <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.15 }} className="lp-return-path"><RotateCcw size={18} aria-hidden /><span>Feedback becomes the next change</span></motion.div>
              <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.3 }} className="lp-repair"><span><Code2 size={18} aria-hidden />Coder<span className="lp-repair-file">main.py</span></span><div className="lp-repair-diff"><span>− @app.patch(&quot;/books/{"{id}"}&quot;)</span><code>+ response_model=BookOut</code></div><div><Check size={17} aria-hidden />Fix reviewed. Tests passed.</div></motion.div>
              <p className="lp-loop-caption">Illustrative repair from the Library demo. Runs can also stop at their retry limit.</p>
            </div>
          </div>
        </section>

        <section className="lp-section lp-examples-section" aria-label="Explore example APIs"><DemoCarousel /></section>

        <motion.section {...reveal} id="questions" className="lp-faq lp-section" aria-labelledby="faq-title"><ScrollReveal id="faq-title">{"A little more clarity."}</ScrollReveal><FaqAccordion items={questions.map(question => ({ question: question.title, answer: question.answer }))} /></motion.section>
        <motion.section {...reveal} id="start-building" className="lp-closing"><span className="lp-section-label">From an idea to something you can inspect</span><ScrollReveal>{"What will you build?"}</ScrollReveal><p>Start with one sentence. Follow it all the way through.</p><Link className="lp-button cf-specular" onPointerMove={pointerLight} href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link></motion.section>
      </main>
      <SiteFooter />
    </div>
  );
}

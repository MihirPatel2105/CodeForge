"use client";

import { motion } from "motion/react";
import { ScrollReveal } from "@/components/ui/react-bits/scroll-reveal";
import { BlurHeadline, pointerLight } from "@/components/ui/premium-effects";
import { DemoCarousel } from "@/components/ui/enhancements/demo-carousel";
import { FaqAccordion } from "@/components/ui/vengeance/faq-accordion";
import { AgentBentoGrid } from "@/components/ui/vengeance/agent-bento-grid";
import { ExpandableBentoGrid } from "@/components/ui/vengeance/expandable-bento-grid";
import { useMotionPreference } from "@/lib/use-motion-preference";
import Link from "next/link";
import "./premium-landing.css";
import "./landing-showcase.css";
import { ApprovalPreview, CodePreview, OutcomePreview } from "./control-previews";
import { ArrowDown, ArrowRight, Check, Code2, Layers3, RotateCcw, ShieldCheck, Terminal } from "lucide-react";
import { LandingScrollNav } from "./landing-scroll-nav";
import { SiteHeader } from "./site-header";
import { ProductScrollPreview } from "./product-scroll-preview";
import { ScrollStory } from "./scroll-story";
import { SiteFooter } from "./marketing-actions";
import { useCurrentUser } from "@/lib/use-current-user";

const agents = [
  { name: "PM", verb: "Your idea. Made specific.", detail: "Turn a prompt into a focused set of requirements, so every agent builds toward the same goal.", icon: Layers3, artifact: "Library requirements", lines: ["Entity: Book", "Fields: title, author, ISBN, genre, read", "Create, list, update, and delete books", "Checkpoint: your approval"], note: "You approve the requirements" },
  { name: "Architect", verb: "A clear plan. Before the code.", detail: "See the routes, data models, and structure. Approve the design before your API takes shape.", icon: Layers3, artifact: "Library API", lines: ["POST /books", "GET /books", "GET /books/{id}", "PATCH /books/{id}", "DELETE /books/{id}"], note: "You approve the design", model: "title, author, ISBN, genre, read" },
  { name: "Coder", verb: "The plan becomes working code.", detail: "Generate the routes, models, and application files from your approved design. Inspect the files as the work happens.", icon: Code2, artifact: "Generated files", lines: ["main.py — application routes", "models.py — stored data", "schemas.py — validation", "database.py — database connection", "requirements.txt — dependencies"], note: "Built from the approved plan" },
  { name: "Reviewer", verb: "A second look. A stronger API.", detail: "Review the implementation against the plan. When blocking changes are needed, the feedback goes back to the Coder.", icon: ShieldCheck, artifact: "Example review", lines: ["Check the update route", "Add an explicit response model", "Return a validated BookOut response", "Requested change → Coder"], note: "Feedback can trigger a repair" },
  { name: "Tester", verb: "Turn the plan into test cases.", detail: "Write tests for the routes, validation, and expected behavior. The Sandbox then executes them against the generated API.", icon: Terminal, artifact: "Example test coverage", lines: ["Create a book", "Read the collection", "Update the book", "Delete the book", "Reject invalid input"], note: "Failures can trigger another repair" },
  { name: "Sandbox", verb: "Run it. See what holds up.", detail: "Execute the generated API and tests in an isolated environment. Failures can return to the Coder for another repair.", icon: Terminal, artifact: "Illustrative test result", lines: ["Application starts", "Create / read / update / delete", "Invalid input rejected", "Tests passed → inspect your API"], note: "Actual results determine the run outcome" },
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
    <div className="cf-premium">
      <a className="lp-skip" href="#landing-content">Skip to content</a>
      <SiteHeader />
      <LandingScrollNav />
      <main id="landing-content">
        <section id="overview" className="lp-hero" aria-labelledby="landing-title">
          <motion.p {...entrance(0.12)} className="lp-intro">Five agents. One API. You in control.</motion.p>
          <BlurHeadline />
          <motion.p {...entrance(0.5)} className="lp-lead">Describe your API. Watch a team of AI agents plan,<br className="lp-desktop-break" /> build, review, and test it—with you in control.</motion.p>
          <motion.div {...entrance(0.7)} className="lp-actions">
            <Link className="lp-button cf-specular" onPointerMove={pointerLight} href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link>
            <Link className="lp-text-link" href="/how-it-works">How CodeForge works<ArrowRight size={18} aria-hidden /></Link>
          </motion.div>
          <ProductScrollPreview>
            <Link href="#build-story" className="lp-product lp-brief-preview" aria-label="Follow the Library build">
              <div className="lp-brief-icon"><Code2 size={24} strokeWidth={1.4} aria-hidden /></div>
              <div className="lp-brief-copy"><span>Personal Library · Example brief</span><p>“An API for my books, authors, and reading list.”</p></div>
              <span className="lp-brief-follow">Follow this build<span><ArrowDown size={16} aria-hidden /></span></span>
            </Link>
          </ProductScrollPreview>
        </section>

        <ScrollStory startHref={start} />

        <section className="lp-section lp-examples-section" aria-label="Explore example APIs"><DemoCarousel /></section>

        <section className="lp-team lp-section" id="how" aria-labelledby="team-title">
          <span className="lp-section-label">The team behind your API / 01—06</span>
          <motion.div {...reveal} className="lp-section-intro"><ScrollReveal id="team-title">{"Five specialists.\nOne real sandbox."}</ScrollReveal><p>Every role has a purpose.<br />Every handoff leaves something to inspect.</p></motion.div>
          <AgentBentoGrid agents={agents} />
        </section>

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

        <section id="control" className="lp-control lp-section" aria-labelledby="control-title"><span className="lp-section-label">Inside the product</span><motion.div {...reveal} className="lp-section-intro"><ScrollReveal id="control-title">{"AI does the work.\nYou call the shots."}</ScrollReveal><p>Keep the decisions that matter.<br />Leave the repetitive work to the agents.</p></motion.div><ExpandableBentoGrid items={[
          { title: "Approve before it builds.", description: "Review the requirements and architecture before the agents move forward.", icon: ShieldCheck, preview: <ApprovalPreview />, content: "Your run pauses at two checkpoints. Read the requirements first, then inspect the system design. Approve or request changes before implementation continues. These are decisions you make during the real run." },
          { title: "See inside the process.", description: "Follow agent decisions, inspect generated files, and read the review feedback.", icon: Code2, preview: <CodePreview />, content: "The live timeline shows agent activity and repair loops. Open the generated files to inspect code, compare available versions, and follow Problems links when a trustworthy file and line are recorded." },
          { title: "Get the actual outcome.", description: "Tests run in an isolated sandbox. See the output and download the artifacts.", icon: Terminal, preview: <OutcomePreview />, content: "Inspect passed and failed tests along with the generated files. A run can stop at its repair limit or fail because a service is unavailable. CodeForge reports that result so you can decide what to do next; it does not treat every completed attempt as a working API." },
        ]} /><p className="lp-preview-caption">Illustrative screens from the Library example. Each run reports its own result.</p></section>

        <motion.section {...reveal} id="questions" className="lp-faq lp-section" aria-labelledby="faq-title"><ScrollReveal id="faq-title">{"A little more clarity."}</ScrollReveal><FaqAccordion items={questions.map(question => ({ question: question.title, answer: question.answer }))} /></motion.section>
        <motion.section {...reveal} id="start-building" className="lp-closing"><span className="lp-section-label">From an idea to something you can inspect</span><ScrollReveal>{"What will you build?"}</ScrollReveal><p>Start with one sentence. Follow it all the way through.</p><Link className="lp-button cf-specular" onPointerMove={pointerLight} href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link></motion.section>
      </main>
      <SiteFooter />
    </div>
  );
}

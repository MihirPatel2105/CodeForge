"use client";

import { motion } from "motion/react";
import { MotionCollapse } from "@/components/ui/motion-collapse";
import { useMotionPreference } from "@/lib/use-motion-preference";
import Link from "next/link";
import "./premium-landing.css";
import { useId, useState } from "react";
import { ArrowRight, Check, ChevronDown, Code2, Layers3, Play, RotateCcw, ShieldCheck, Terminal } from "lucide-react";
import { LandingScrollNav } from "./landing-scroll-nav";
import { SiteHeader } from "./site-header";
import { AgentScrollStack } from "./agent-scroll-stack";
import { ProductScrollPreview } from "./product-scroll-preview";
import { PipelineWalkthrough } from "./pipeline-walkthrough";
import { SiteFooter } from "./marketing-actions";
import { DEMO_RUNS } from "@/lib/demo-runs";
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
  const [example, setExample] = useState(0);
  const demo = DEMO_RUNS[example];
  const start = user ? "/projects" : "/signup";
  const entrance = (delay: number) => ({
    initial: { opacity: 0, transform: "translateY(16px)" },
    animate: { opacity: 1, transform: "none" },
    transition: reducedMotion ? { duration: 0, delay: 0 } : { duration: 0.9, delay, ease: [0.22, 0.68, 0.25, 1] as const },
  });

  const reveal = {
    initial: { opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 18 },
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
          <motion.p {...entrance(0)} className="lp-intro">Five agents. One API. You in control.</motion.p>
          <motion.h1 {...entrance(0.08)} id="landing-title">Your idea.<br />A working API.</motion.h1>
          <motion.p {...entrance(0.16)} className="lp-lead">Describe your API. Watch a team of AI agents plan,<br className="lp-desktop-break" /> build, review, and test it—with you in control.</motion.p>
          <motion.div {...entrance(0.24)} className="lp-actions">
            <Link className="lp-button" href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link>
            <Link className="lp-text-link" href={`/demo/${demo.slug}`}><Play size={15} aria-hidden />Watch a full run</Link>
          </motion.div>
          <ProductScrollPreview>
            <div className="lp-product lp-pipeline">
              <PipelineWalkthrough key={demo.slug} demo={demo} example={example} onExampleChange={setExample} />
            </div>
          </ProductScrollPreview>
          <a className="lp-explore" href="#how">Meet your build team<ChevronDown size={17} aria-hidden /></a>
        </section>

        <section className="lp-team lp-section" id="how" aria-labelledby="team-title">
          <motion.div {...reveal} className="lp-section-intro"><h2 id="team-title">Five specialists.<br />One real sandbox.</h2><p>Explore each stage of the same API.<br />From your first idea to the final test.</p></motion.div>
          <AgentScrollStack agents={agents} />
        </section>

        <section id="repair-loop" className="lp-loop-section" aria-labelledby="loop-title">
          <div className="lp-loop-inner"><motion.div {...reveal} className="lp-loop-copy"><RotateCcw size={34} strokeWidth={1.4} aria-hidden /><h2 id="loop-title">The first draft<br />is just the start.</h2><p>A review finds an issue. A test catches a failure. The feedback returns to the Coder, and the next version gets another check.</p><Link href="/how-it-works" className="lp-light-link">See how the loop works<ArrowRight size={18} aria-hidden /></Link></motion.div>
            <div className="lp-loop-visual" aria-label="Example repair: Reviewer finds a missing response model, Coder adds it, then tests pass">
              <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : 0.55, delay: 0 }} className="lp-finding"><span><ShieldCheck size={18} aria-hidden />Reviewer</span><p>Update route needs a response model.</p><span className="lp-loop-state">Sent back for repair</span></motion.div>
              <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : 0.55, delay: 0.15 }} className="lp-return-path"><RotateCcw size={18} aria-hidden /><span>Feedback becomes the next change</span></motion.div>
              <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : 0.55, delay: 0.3 }} className="lp-repair"><span><Code2 size={18} aria-hidden />Coder</span><code>response_model=BookOut</code><div><Check size={17} aria-hidden />Fix reviewed. Tests passed.</div></motion.div>
              <p className="lp-loop-caption">Illustrative repair from the Library demo. Runs can also stop at their retry limit.</p>
            </div>
          </div>
        </section>

        <section id="control" className="lp-control lp-section" aria-labelledby="control-title"><motion.div {...reveal} className="lp-section-intro"><h2 id="control-title">AI does the work.<br />You call the shots.</h2><p>Keep the decisions that matter.<br />Leave the repetitive work to the agents.</p></motion.div><div className="lp-control-grid"><motion.article {...reveal}><ShieldCheck size={28} strokeWidth={1.5} aria-hidden /><h3>Approve before it builds.</h3><p>Review the requirements and architecture before the agents move forward.</p></motion.article><motion.article {...reveal}><Code2 size={28} strokeWidth={1.5} aria-hidden /><h3>See inside the process.</h3><p>Follow agent decisions, inspect generated files, and read the review feedback.</p></motion.article><motion.article {...reveal}><Terminal size={28} strokeWidth={1.5} aria-hidden /><h3>Get the actual outcome.</h3><p>Tests run in an isolated sandbox. See the output and download the artifacts.</p></motion.article></div></section>

        <motion.section {...reveal} id="questions" className="lp-faq lp-section" aria-labelledby="faq-title"><h2 id="faq-title">A little more clarity.</h2><div>{questions.map(question => <LandingFaqItem key={question.title} title={question.title} answer={question.answer} />)}</div></motion.section>
        <motion.section {...reveal} id="start-building" className="lp-closing"><h2>What will you build?</h2><p>Start with one sentence. Follow it all the way through.</p><Link className="lp-button" href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link></motion.section>
      </main>
      <SiteFooter />
    </div>
  );
}

function LandingFaqItem({ title, answer }: { title: string; answer: string }) {
  const reducedMotion = useMotionPreference();
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="lp-faq-item" data-open={open}>
      <h3>
        <button
          type="button"
          id={`${id}-question`}
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={reducedMotion ? { duration: 0 } : undefined} className="inline-flex" aria-hidden><ChevronDown size={20} /></motion.span>
        </button>
      </h3>
      <MotionCollapse
        className="lp-faq-answer"
        open={open}
        id={`${id}-answer`}
        aria-labelledby={`${id}-question`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="lp-faq-answer-inner"><p>{answer}</p></div>
      </MotionCollapse>
    </div>
  );
}

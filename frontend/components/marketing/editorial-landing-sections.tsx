"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Code2, RotateCcw, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { getDemoRun } from "@/lib/demo-runs";
import { LoopArt, PromptArt, StagesArt } from "./editorial-landing-art";

/** A slow fade and small rise as a block enters; none at all under reduced motion. */
export function useReveal() {
  const reduced = useMotionPreference();
  return {
    initial: reduced ? false : { opacity: 0, y: 14 },
    // Reduced motion can settle after hydration; showing the block outright never leaves it hidden.
    animate: reduced ? { opacity: 1, y: 0 } : undefined,
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: reduced ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] },
  } as const;
}

const STAGES = [
  { n: "01", name: "PM", group: "Planning", text: "Turns your sentence into entities, fields and the operations the API must support.", makes: "Requirements", gate: "Your approval" },
  { n: "02", name: "Architect", group: "Planning", text: "Maps routes, data models and project structure before a line of code exists.", makes: "API design", gate: "Your approval" },
  { n: "03", name: "Coder", group: "Building", text: "Implements the approved design, and repairs it when the review or the tests push back.", makes: "Application files", gate: "Automatic" },
  { n: "04", name: "Reviewer", group: "Checking", text: "Reads the code against a fixed checklist and blocks anything that would break.", makes: "Findings", gate: "Can send back" },
  { n: "05", name: "Tester", group: "Checking", text: "Writes tests for expected behaviour, bad input and missing records.", makes: "Test suite", gate: "Automatic" },
  { n: "06", name: "Sandbox", group: "Running", text: "Starts the API in an isolated container with no network and runs every test.", makes: "Real results", gate: "Can send back" },
];

export function StagesSection() {
  const reveal = useReveal();
  return (
    <section className="el-section" id="how" aria-labelledby="el-stages-title">
      <motion.header {...reveal} className="el-head">
        <StagesArt />
        <h2 id="el-stages-title">Six stages. One clear job each.</h2>
        <p>Every role is named, every hand-off is visible, and nothing moves on without its check.</p>
      </motion.header>
      <ol className="el-cards">
        {STAGES.map((stage, index) => (
          <motion.li key={stage.name} {...reveal} transition={{ ...reveal.transition, delay: reveal.initial ? index * 0.05 : 0 }} className="el-card">
            <span className="el-meta"><span className="el-pill">{stage.n}</span>{stage.group}</span>
            <h3>{stage.name}</h3>
            <p>{stage.text}</p>
            <dl className="el-rows">
              <div><dt>Produces</dt><dd>{stage.makes}</dd></div>
              <div><dt>Moves on</dt><dd>{stage.gate}</dd></div>
            </dl>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

const STEPS = [
  { lead: "You describe it.", text: "One plain-English sentence about the data you want to manage: books, tickets, stock.", meta: "Prompt" },
  { lead: "You approve the plan.", text: "The requirements and the API design wait for you before any code is written.", meta: "Two checkpoints" },
  { lead: "The agents build and check it.", text: "Review findings and failing tests go back to the Coder for repair, up to three times.", meta: "Review and repair loop" },
  { lead: "You get something that runs.", text: "Download the project, try every endpoint in the browser, or publish it behind a key.", meta: "Download · Try · Publish" },
];

export function StepsSection() {
  const reveal = useReveal();
  return (
    <section className="el-section el-split" id="build-story" aria-labelledby="el-steps-title">
      <motion.div {...reveal} className="el-split-head">
        <h2 id="el-steps-title">How a run works</h2>
        <p>From a sentence to a tested API, with you at every decision that matters.</p>
        <Link href="/how-it-works" className="el-link">Read the full walkthrough <ArrowRight size={16} aria-hidden /></Link>
      </motion.div>
      <ol className="el-steps">
        {STEPS.map(step => (
          <motion.li key={step.lead} {...reveal}>
            <p><strong>{step.lead}</strong> {step.text}</p>
            <span className="el-step-meta">{step.meta}</span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

export function LoopSection() {
  const reveal = useReveal();
  return (
    <section className="el-section" id="repair-loop" aria-labelledby="el-loop-title">
      <motion.header {...reveal} className="el-head">
        <LoopArt />
        <h2 id="el-loop-title">The first draft is just the start.</h2>
        <p>A review finds an issue or a test fails. The feedback returns to the Coder, and the next version is checked again.</p>
      </motion.header>
      <motion.figure {...reveal} className="el-loop" aria-label="Example repair from the Library demo">
        <div className="el-loop-row"><ShieldCheck size={18} aria-hidden /><div><span className="el-meta">Reviewer · Change requested</span><p>The update route returns a raw database document. It needs a response model.</p></div></div>
        <div className="el-loop-row el-loop-return"><RotateCcw size={18} aria-hidden /><div><span className="el-meta">Sent back to the Coder</span><p>The finding becomes the next change.</p></div></div>
        <div className="el-loop-row"><Code2 size={18} aria-hidden /><div><span className="el-meta">Coder · main.py</span><p><code>response_model=BookOut</code> added to the update route.</p></div></div>
        <div className="el-loop-row el-loop-pass"><Check size={18} aria-hidden /><div><span className="el-meta">Recheck</span><p>Review passed. 8 of 8 tests passed.</p></div></div>
        <figcaption>Illustrative repair from the Library demo. A run can also stop at its retry limit and say so.</figcaption>
      </motion.figure>
    </section>
  );
}

export function ExamplesSection() {
  const reveal = useReveal();
  const examples = ["library", "inventory", "support"].map(getDemoRun);
  return (
    <section className="el-section" id="example-apis" aria-labelledby="el-examples-title">
      <motion.div {...reveal} className="el-row-head">
        <h2 id="el-examples-title">Start from an example</h2>
        <p>Each one is a full run, replayed: the plan, the code, the review and the tests.</p>
      </motion.div>
      <ul className="el-cards el-cards-three">
        {examples.map(example => (
          <motion.li key={example.slug} {...reveal} className="el-card">
            <span className="el-meta"><span className="el-pill">{example.label}</span>Sample replay</span>
            <h3>{example.title}</h3>
            <p className="el-quote">“{example.prompt}”</p>
            <dl className="el-rows"><div><dt>Result</dt><dd>{example.preview.result}</dd></div></dl>
            <ButtonLink variant="secondary" href={`/demo/${example.slug}`} className="el-quiet-button">Watch the replay <ArrowRight size={15} aria-hidden /></ButtonLink>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

const QUESTIONS = [
  { q: "What can I build?", a: "CRUD REST APIs: applications that create, read, update and delete data. A library, an inventory, a support desk or anything shaped like them." },
  { q: "Do I get to approve the plan?", a: "Yes. The requirements and the API design each wait for your approval, and you can follow the live work throughout the run." },
  { q: "What happens when a test fails?", a: "Review findings and failing tests go back to the Coder for repair. The loop is bounded, so a run can stop with a clear, actionable failure instead of claiming success." },
  { q: "What do I get at the end?", a: "The generated files, the review feedback and the real test output. You can download the project, try it in the browser or publish it." },
];

export function QuestionsSection() {
  const reveal = useReveal();
  return (
    <section className="el-section el-split" id="questions" aria-labelledby="el-faq-title">
      <motion.div {...reveal} className="el-split-head"><h2 id="el-faq-title">Questions</h2><p>The short answers. The how-it-works page has the long ones.</p></motion.div>
      <div className="el-faq">
        {QUESTIONS.map(item => <FaqItem key={item.q} question={item.q} answer={item.a} />)}
      </div>
    </section>
  );
}

/**
 * One question. The answer's row animates from 0fr to 1fr and fades, so it opens and closes
 * smoothly in both directions without measuring heights; reduced motion is handled in CSS.
 */
export function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="el-faq-item" data-open={open}>
      <h3>
        <button type="button" id={`${id}-q`} aria-expanded={open} aria-controls={`${id}-a`} onClick={() => setOpen(value => !value)}>
          {question}<ChevronDown size={18} aria-hidden />
        </button>
      </h3>
      <div id={`${id}-a`} role="region" aria-labelledby={`${id}-q`} className="el-faq-answer" inert={!open}>
        <div><p>{answer}</p></div>
      </div>
    </div>
  );
}

export function ClosingSection({ href, label }: { href: string; label: string }) {
  const reveal = useReveal();
  return (
    <motion.section {...reveal} className="el-section el-closing" id="start-building" aria-labelledby="el-closing-title">
      <PromptArt />
      <h2 id="el-closing-title">What will you build?</h2>
      <p>Start with one sentence. Follow it all the way to a tested API.</p>
      <div className="el-closing-actions">
        <ButtonLink href={href} className="el-primary">{label}<ArrowRight size={16} aria-hidden /></ButtonLink>
        <p className="el-prompt"><span aria-hidden>›</span> <span className="sr-only">For example: </span>An API for my book club’s reading list</p>
      </div>
    </motion.section>
  );
}

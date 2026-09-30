"use client";

import Link from "next/link";
import "./premium-landing.css";
import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Code2, FileCode2, Layers3, Play, RotateCcw, ShieldCheck, Terminal } from "lucide-react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./marketing-actions";
import { DEMO_RUNS } from "@/lib/demo-runs";
import { useCurrentUser } from "@/lib/use-current-user";
import { tokenizePythonLine } from "@/lib/python-highlight";

const agents = [
  { name: "PM", verb: "Understands the idea.", detail: "Turns your request into a clear scope: the data you need, the operations to support, and what success looks like.", icon: Layers3, artifact: "Requirements", lines: ["Entity: Book", "Fields: title, author, ISBN, genre, read", "Operations: create, read, update, delete", "Checkpoint: your approval"] },
  { name: "Architect", verb: "Makes a plan.", detail: "Maps the endpoints, data models, and application structure. You approve the design before the code takes shape.", icon: Layers3, artifact: "API design", lines: ["POST    /books", "GET     /books", "GET     /books/{id}", "PATCH   /books/{id}", "DELETE  /books/{id}"] },
  { name: "Coder", verb: "Builds the API.", detail: "Writes the application and its data contracts. The generated files are visible as the work happens.", icon: Code2, artifact: "Generated files", lines: ["main.py", "models.py", "schemas.py", "database.py", "requirements.txt"] },
  { name: "Reviewer", verb: "Looks closer.", detail: "Checks the code against the plan. Blocking findings go back to the Coder for another pass.", icon: ShieldCheck, artifact: "Review feedback", lines: ["main.py · update route", "Add an explicit response model.", "Return a validated BookOut response.", "Send finding back to Coder."] },
  { name: "Tester", verb: "Puts it to the test.", detail: "Writes tests for the API. An isolated sandbox runs them, and failures can send the code back for repair.", icon: Terminal, artifact: "Test coverage", lines: ["Create a book", "Read the collection", "Update the book", "Delete the book", "Validate invalid input"] },
];
const questions = [
  { title: "What can I build?", answer: "CodeForge focuses on CRUD REST APIs: applications that create, read, update, and delete data. Start with a library, inventory, support ticket system, or a similar data-driven API." },
  { title: "Do I get to approve the plan?", answer: "Yes. You review the requirements and the architecture at two checkpoints before the agents continue. You can inspect the live work throughout the run." },
  { title: "What happens when a test fails?", answer: "Review findings and sandbox test failures can go back to the Coder for repair. The run has a bounded retry loop; it can also stop with an actionable failure instead of claiming success." },
  { title: "What do I get at the end?", answer: "Generated application files, review feedback, and the test output. You can inspect and download the artifacts. A completed run shows its actual outcome, including any unresolved problems." },
];

export function PremiumLanding() {
  const user = useCurrentUser();
  const [example, setExample] = useState(0);
  const [agent, setAgent] = useState(0);
  const demo = DEMO_RUNS[example];
  const chosen = agents[agent];
  const AgentIcon = chosen.icon;
  const start = user ? "/projects" : "/signup";

  return (
    <div className="cf-premium">
      <a className="lp-skip" href="#landing-content">Skip to content</a>
      <SiteHeader />
      <main id="landing-content">
        <section className="lp-hero" aria-labelledby="landing-title">
          <p className="lp-intro">Your idea. Five agents. One API.</p>
          <h1 id="landing-title">Good ideas deserve<br />to be built.</h1>
          <p className="lp-lead">Describe your API. Watch a team of AI agents plan,<br className="lp-desktop-break" /> build, review, and test it—with you in control.</p>
          <div className="lp-actions">
            <Link className="lp-button" href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link>
            <Link className="lp-text-link" href={`/demo/${demo.slug}`}><Play size={15} aria-hidden />Watch a full run</Link>
          </div>
          <div className="lp-product" aria-label="Interactive example API output">
            <div className="lp-product-head"><span><span className="lp-status-dot" />From request to result</span><span>Example preview</span></div>
            <div className="lp-product-grid">
              <div className="lp-request">
                <div className="lp-example-switch" aria-label="Choose an example">
                  {DEMO_RUNS.map((item, i) => <button key={item.slug} type="button" aria-pressed={example === i} onClick={() => setExample(i)}>{item.label}</button>)}
                </div>
                <p key={demo.slug} className="lp-prompt lp-change" aria-live="polite" aria-atomic="true">{demo.prompt}</p>
                <div className="lp-request-foot"><span>Plain English in.</span><ArrowRight size={20} aria-hidden /></div>
              </div>
              <div className="lp-code-panel">
                <div className="lp-code-title"><span><FileCode2 size={16} aria-hidden />{demo.preview.file}</span><span>Python</span></div>
                <pre key={demo.slug} className="lp-code lp-change"><code>{demo.preview.lines.map((line, i) => <span className="lp-code-line" key={i}><span className="lp-line-number" aria-hidden>{i + 1}</span><span>{tokenizePythonLine(line).map((token, n) => <span key={n} className={`lp-syntax-${token.cls}`}>{token.text}</span>)}</span></span>)}</code></pre>
                <div className="lp-test-result"><Check size={17} aria-hidden /><span>{demo.preview.result}</span><span className="lp-result-note">Example result</span></div>
              </div>
            </div>
            <div className="lp-product-bottom"><span>Planned. Reviewed. Tested.</span><span>Code you can inspect.</span></div>
          </div>
          <a className="lp-explore" href="#how">Meet your build team<ChevronDown size={17} aria-hidden /></a>
        </section>

        <section className="lp-team lp-section" id="how" aria-labelledby="team-title">
          <div className="lp-section-intro"><h2 id="team-title">A team behind<br />every build.</h2><p>Each agent has a job. Every decision has a trail.<br />You see the work, from the first plan to the final test.</p></div>
          <div className="lp-team-layout">
            <div className="lp-agent-list" aria-label="Explore the five agents">
              {agents.map((item, i) => <button key={item.name} type="button" onClick={() => setAgent(i)} aria-pressed={agent === i}><span className="lp-agent-number" aria-hidden>0{i + 1}</span><span><strong>{item.name}</strong><span>{item.verb}</span></span><ArrowRight size={20} aria-hidden /></button>)}
            </div>
            <div className="lp-agent-feature" aria-live="polite" aria-atomic="true" key={chosen.name}>
              <div className="lp-agent-detail lp-change"><AgentIcon size={28} strokeWidth={1.5} aria-hidden /><h3>{chosen.verb}</h3><p>{chosen.detail}</p></div>
              <div className="lp-artifact lp-change"><div><span>{chosen.artifact}</span><span>Library example</span></div><ul>{chosen.lines.map(line => <li key={line}>{line}</li>)}</ul></div>
            </div>
          </div>
        </section>

        <section className="lp-loop-section" aria-labelledby="loop-title">
          <div className="lp-loop-inner"><div className="lp-loop-copy"><RotateCcw size={34} strokeWidth={1.4} aria-hidden /><h2 id="loop-title">The first draft<br />is just the start.</h2><p>A review finds an issue. A test catches a failure. The feedback returns to the Coder, and the next version gets another check.</p><Link href="/how-it-works" className="lp-light-link">See how the loop works<ArrowRight size={18} aria-hidden /></Link></div>
            <div className="lp-loop-visual" aria-label="Example repair: Reviewer finds a missing response model, Coder adds it, then tests pass">
              <div className="lp-finding"><span><ShieldCheck size={18} aria-hidden />Reviewer</span><p>Update route needs a response model.</p><span className="lp-loop-state">Sent back for repair</span></div>
              <div className="lp-return-path"><RotateCcw size={18} aria-hidden /><span>Feedback becomes the next change</span></div>
              <div className="lp-repair"><span><Code2 size={18} aria-hidden />Coder</span><code>response_model=BookOut</code><div><Check size={17} aria-hidden />Fix reviewed. Tests passed.</div></div>
              <p className="lp-loop-caption">Illustrative repair from the Library demo. Runs can also stop at their retry limit.</p>
            </div>
          </div>
        </section>

        <section className="lp-control lp-section" aria-labelledby="control-title"><div className="lp-section-intro"><h2 id="control-title">AI does the work.<br />You call the shots.</h2><p>Keep the decisions that matter.<br />Leave the repetitive work to the agents.</p></div><div className="lp-control-grid"><article><ShieldCheck size={28} strokeWidth={1.5} aria-hidden /><h3>Approve before it builds.</h3><p>Review the requirements and architecture before the agents move forward.</p></article><article><Code2 size={28} strokeWidth={1.5} aria-hidden /><h3>See inside the process.</h3><p>Follow agent decisions, inspect generated files, and read the review feedback.</p></article><article><Terminal size={28} strokeWidth={1.5} aria-hidden /><h3>Get the actual outcome.</h3><p>Tests run in an isolated sandbox. See the output and download the artifacts.</p></article></div></section>

        <section className="lp-faq lp-section" aria-labelledby="faq-title"><h2 id="faq-title">A little more clarity.</h2><div>{questions.map(question => <details key={question.title}><summary>{question.title}<ChevronDown size={20} aria-hidden /></summary><p>{question.answer}</p></details>)}</div></section>
        <section className="lp-closing"><h2>What will you build?</h2><p>Start with one sentence. Follow it all the way through.</p><Link className="lp-button" href={start}>{user ? "Start a project" : "Build your first API"}<ArrowRight size={18} aria-hidden /></Link></section>
      </main>
      <SiteFooter />
    </div>
  );
}

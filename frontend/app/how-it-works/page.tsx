import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, RotateCcw } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";
import { HowRunRoute } from "@/components/marketing/how-run-route";
import "@/components/marketing/premium-landing.css";
import "@/components/marketing/editorial-pages.css";

export const metadata: Metadata = {
  title: "How it works · CodeForge",
  description: "Follow an API request through five agents, two human approvals, repair loops and real execution in an isolated sandbox.",
};

const stages = [
  { name: "PM", job: "Make the request precise.", body: "Your prompt becomes entities, fields, validation rules and operations. Review the requirements before the design begins.", input: "Your plain-English request", output: "Structured requirements", approval: "Approval 01 · Requirements" },
  { name: "Architect", job: "Give the API a shape.", body: "The Architect defines endpoints, request and response models, and status codes. You approve this plan before the Coder writes files.", input: "Approved requirements", output: "Routes, schemas and status codes", approval: "Approval 02 · Design" },
  { name: "Coder", job: "Turn the plan into files.", body: "The Coder writes the FastAPI application. Files appear in the run dashboard as they are produced, with later passes kept available for comparison.", input: "Approved architecture", output: "Application source files" },
  { name: "Reviewer", job: "Challenge the implementation.", body: "The Reviewer checks the source against a fixed checklist. Blocking findings return to the Coder; warnings remain visible for inspection.", input: "Generated application", output: "Findings and repair feedback" },
  { name: "Tester", job: "Write the checks independently.", body: "The Tester uses the requirements and design to write executable pytest cases for the API’s endpoints and behavior.", input: "Requirements and design", output: "A generated test suite" },
  { name: "Sandbox", job: "Let execution give the verdict.", body: "The code and tests run together in an isolated Docker container with networking disabled. Test failures return to the Coder for repair.", input: "Application and tests", output: "Runtime output and test results" },
];

export default function HowItWorksPage() {
  return (
    <div className="cf-premium cf-premium-marketing cf-editorial-page">
      <SiteHeader />
      <main>
        <section className="ed-wrap ed-hero ed-process-hero">
          <div className="ed-process-copy"><span className="ed-kicker">How CodeForge works</span><h1>One request.<br />Every step in view.</h1><p>A plan you approve. Code you can inspect. Tests that actually run. Follow the handoffs, including the moments when the work goes back.</p><div className="ed-actions"><Link href="#stages" className="lp-button">Follow the process <ArrowDown size={16} aria-hidden /></Link><Link href="/demo/library" className="lp-text-link">Open the demo <ArrowUpRight size={16} aria-hidden /></Link></div><span className="ed-small-note">Five agents. Two human checkpoints. One isolated sandbox.</span></div>
          <div className="ed-route-preview"><HowRunRoute /></div>
        </section>

        <section id="stages" className="ed-section ed-wrap ed-stage-grid">
          <div className="ed-section-intro ed-sticky"><span className="ed-kicker">From intent to execution</span><h2>A clear job<br />at every handoff.</h2><p>Open a stage to see what it receives, what it produces, and where you take control.</p><div className="ed-loop-note"><RotateCcw size={18} aria-hidden /><p>Review findings and failed tests return to the Coder. Each repair loop has its own limit of three attempts.</p></div></div>
          <ol className="ed-stages">{stages.map((stage, index) => <li key={stage.name}><details><summary><span className="ed-index">0{index + 1}</span><span><span className="ed-stage-name">{stage.name}</span><strong>{stage.job}</strong>{stage.approval && <span className="ed-approval-label">{stage.approval}</span>}</span><span className="ed-stage-expand" aria-hidden>+</span></summary><div className="ed-stage-body"><p>{stage.body}</p><dl><div><dt>Receives</dt><dd>{stage.input}</dd></div><div><dt>Produces</dt><dd>{stage.output}</dd></div></dl></div></details></li>)}</ol>
        </section>

        <section className="ed-section ed-tinted"><div className="ed-wrap ed-proof-grid">
          <div className="ed-section-intro"><span className="ed-kicker">The finish line</span><h2>Evidence comes<br />with the result.</h2><p>A passed run keeps its source, findings and test output together. If a run reaches a repair limit, you can still inspect what it produced and where it stopped.</p><Link href="/demo/library" className="lp-text-link">Inspect an example run <ArrowUpRight size={16} aria-hidden /></Link></div>
          <figure className="ed-verdict"><figcaption>Library demo / Example test output</figcaption><div className="ed-verdict-output"><p>$ pytest -q</p><p>........</p><strong>8 passed in 1.42s</strong><p>Process exited with code 0</p></div><div className="ed-verdict-notes"><p><strong>You decide twice.</strong> Approve requirements, then approve the architecture. Request changes if either misses your intent.</p><p><strong>The sandbox tests the result.</strong> Generated code executes with networking disabled. A passing suite reports what those tests checked.</p></div></figure>
        </div></section>

        <section id="technology" className="ed-section ed-wrap ed-tech-grid"><div className="ed-section-intro"><span className="ed-kicker">Under the surface</span><h2>The tools behind<br />each run.</h2></div><dl className="ed-tech">{[["Orchestration", "LangGraph with a durable checkpointer"], ["Generated API", "FastAPI, MongoDB and Beanie"], ["Verification", "pytest in an isolated Docker sandbox"], ["Run dashboard", "Source files, review findings and live event history"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>

        <section className="ed-wrap ed-closing"><div><span className="ed-kicker">See the handoffs happen</span><h2>Watch the work.<br />Inspect the result.</h2></div><Link href="/demo/library" className="lp-button">Explore the demo <ArrowRight size={16} aria-hidden /></Link></section>
      </main>
      <SiteFooter />
    </div>
  );
}

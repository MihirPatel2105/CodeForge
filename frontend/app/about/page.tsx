import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";
import { AboutProcessProof } from "@/components/marketing/about-process-proof";
import "@/components/marketing/premium-landing.css";
import "@/components/marketing/editorial-pages.css";

export const metadata: Metadata = {
  title: "About · CodeForge",
  description: "Why CodeForge brings specialized agents, human approval and real execution together to build inspectable REST APIs.",
};

const principles = [
  ["Separate the work.", "A single answer can hide a misunderstanding. CodeForge gives requirements, architecture, implementation, review and testing their own responsibilities. Each handoff gives the next agent a structured starting point."],
  ["Keep people in the loop.", "You approve the requirements and the design before the code is written. Catch a missing field or change a route while the decision is still easy to revisit."],
  ["Ask the runtime.", "A convincing explanation is not a test result. The application and its generated tests run in an isolated Docker sandbox. Findings and failed tests return to the Coder for another pass."],
];

export default function AboutPage() {
  return (
    <div className="cf-premium cf-premium-marketing cf-editorial-page">
      <SiteHeader />
      <main>
        <section className="ed-hero ed-wrap">
          <div className="ed-kicker">About CodeForge</div>
          <div className="ed-about-lead">
            <h1>Good code needs<br />more than a prompt.</h1>
            <div className="ed-hero-note"><p>CodeForge turns an API request into a process you can inspect. Five agents share the work. You make the key decisions. A sandbox runs the result.</p><div className="lp-actions"><Link href="/demo/library" className="lp-button">Watch a run <ArrowRight size={16} aria-hidden /></Link><Link className="lp-text-link" href="/how-it-works">How CodeForge works <ArrowRight size={16} aria-hidden /></Link></div></div>
          </div>

        </section>

        <section className="ed-section ed-tinted">
          <div className="ed-wrap ed-proof-grid">
            <div className="ed-section-intro"><span className="ed-kicker">The output, not just the answer</span><h2>A working API.<br />A visible build trail.</h2><p>Open the source. Read the review. Inspect the tests and terminal output. The result comes with the work that led to it.</p><p className="ed-small-note">The library example shows the format. Each generated run has its own code, findings and test results.</p><Link className="lp-text-link" href="/demo/library">Explore the recorded example <ArrowUpRight size={16} aria-hidden /></Link></div>
            <AboutProcessProof />
          </div>
        </section>

        <section className="ed-section ed-wrap ed-principle-grid">
          <div className="ed-section-intro"><span className="ed-kicker">Why it works this way</span><h2>The first answer<br />is a starting point.</h2><p>Generation is one step. Understanding the request, challenging the code and running the tests matter just as much.</p></div>
          <ol className="ed-principles">{principles.map(([title, body], index) => <li key={title}><span className="ed-index">0{index + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
        </section>

        <section className="ed-section ed-wrap ed-scope-grid">
          <div className="ed-section-intro"><span className="ed-kicker">A deliberate focus</span><h2>One clear promise.</h2><p>CodeForge builds CRUD REST APIs over one or two entities. That focus gives every run a consistent path from requirements to execution.</p></div>
          <div className="ed-scope"><div><span>Generated application</span><p>FastAPI · MongoDB · Beanie</p></div><div><span>Verification</span><p>pytest inside an isolated Docker sandbox</p></div><div><span>Your next step</span><p>Test in the browser, publish the API, or download the source.</p></div><Link className="lp-text-link" href="/how-it-works#technology">Explore the technology <ArrowUpRight size={16} aria-hidden /></Link></div>
        </section>

        <section className="ed-wrap ed-closing"><div><span className="ed-kicker">Make the process visible</span><h2>Follow an idea through<br />to its test result.</h2></div><Link href="/demo/library" className="lp-button">Explore the demo <ArrowRight size={16} aria-hidden /></Link></section>
      </main>
      <SiteFooter />
    </div>
  );
}

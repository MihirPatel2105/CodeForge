import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { EditorialPage, PageHead, SplitSection } from "@/components/marketing/editorial-marketing";
import { AboutProcessProof } from "@/components/marketing/about-process-proof";

export const metadata: Metadata = {
  title: "About · CodeForge",
  description: "Why CodeForge brings specialized agents, human approval and real execution together to build inspectable REST APIs.",
};

const principles = [
  ["Separate the work.", "A single answer can hide a misunderstanding. CodeForge gives requirements, architecture, implementation, review and testing their own responsibilities. Each handoff gives the next agent a structured starting point."],
  ["Keep people in the loop.", "You approve the requirements and the design before the code is written. Catch a missing field or change a route while the decision is still easy to revisit."],
  ["Ask the runtime.", "A convincing explanation is not a test result. The application and its generated tests run in an isolated Docker sandbox. Findings and failed tests return to the Coder for another pass."],
];

const SCOPE = [
  ["Generated application", "FastAPI · MongoDB · Beanie"],
  ["Verification", "pytest inside an isolated Docker sandbox"],
  ["Your next step", "Test in the browser, publish the API, or download the source"],
] as const;

export default function AboutPage() {
  return (
    <EditorialPage className="em-about-page">
      <PageHead
        label="About CodeForge"
        title={<>Build with AI. Know what you’re shipping.</>}
        lede="Code is easier to generate than it is to trust. CodeForge makes the work behind an API visible: the plan, the decisions, the review and the test result."
        actions={<>
          <ButtonLink href="/demo/library" className="el-primary">Watch a run<ArrowRight size={16} aria-hidden /></ButtonLink>
          <Link href="/how-it-works" className="el-link" style={{ marginTop: 0 }}>How CodeForge works <ArrowRight size={16} aria-hidden /></Link>
        </>}
      />
      <dl className="em-facts">
        <div><dt>Specialised agents</dt><dd>5</dd></div>
        <div><dt>Approval checkpoints for you</dt><dd>2</dd></div>
        <div><dt>Isolated sandbox per run</dt><dd>1</dd></div>
      </dl>

      <SplitSection
        id="product"
        title="A working API. A visible build trail."
        lede="Open the source. Read the review. Inspect the tests and terminal output. The result comes with the work that led to it."
        extra={<p className="el-step-meta">The Library example shows the format. Each generated run has its own code, findings and test results.</p>}
      >
        <AboutProcessProof />
      </SplitSection>

      <SplitSection id="approach" title="The first answer is a starting point." lede="Generation is one step. Understanding the request, challenging the code and running the tests matter just as much.">
        <ol className="el-steps">
          {principles.map(([title, text]) => <li key={title}><p><strong>{title}</strong> {text}</p></li>)}
        </ol>
      </SplitSection>

      <SplitSection
        id="focus"
        title="One clear promise."
        lede="CodeForge builds CRUD REST APIs over one or two entities. That focus gives every run a consistent path from requirements to execution."
        extra={<Link href="/how-it-works#technology" className="el-link">Explore the technology <ArrowRight size={16} aria-hidden /></Link>}
      >
        <dl className="em-list">{SCOPE.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </SplitSection>

      <section className="el-section el-closing" aria-labelledby="about-closing-title">
        <h2 id="about-closing-title">Follow an idea through to its test result.</h2>
        <p>Start with one sentence, or watch a finished run first.</p>
        <div className="el-closing-actions"><ButtonLink href="/demo/library" className="el-primary">Explore the demo<ArrowRight size={16} aria-hidden /></ButtonLink></div>
      </section>
    </EditorialPage>
  );
}

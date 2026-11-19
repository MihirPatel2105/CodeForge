import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, RotateCcw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { EditorialPage, PageHead, SplitSection } from "@/components/marketing/editorial-marketing";
import { HowRunRoute } from "@/components/marketing/how-run-route";

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

const TECHNOLOGY = [
  ["Orchestration", "LangGraph with a durable checkpointer"],
  ["Generated API", "FastAPI, MongoDB and Beanie"],
  ["Verification", "pytest in an isolated Docker sandbox"],
  ["Run dashboard", "Source files, review findings and live event history"],
] as const;

export default function HowItWorksPage() {
  return (
    <EditorialPage className="em-how-page">
      <PageHead
        label="How CodeForge works"
        title={<>From your idea to a tested API.</>}
        lede="A plan you approve. Code you can inspect. Tests that actually run. Follow the handoffs, including the moments when the work goes back."
        actions={<>
          <ButtonLink href="#stages" className="el-primary">Follow the process<ArrowDown size={16} aria-hidden /></ButtonLink>
          <Link href="/demo/library" className="el-link" style={{ marginTop: 0 }}>Open the demo <ArrowRight size={16} aria-hidden /></Link>
        </>}
        aside={<HowRunRoute />}
      />

      <SplitSection
        id="stages"
        title="A clear job at every handoff."
        lede="Each stage receives something and produces something. Two of them wait for you."
        extra={<p className="el-step-meta" style={{ display: "flex", gap: 10, marginTop: 28 }}><RotateCcw size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />Review findings and failed tests return to the Coder. Each repair loop has its own limit of three attempts.</p>}
      >
        <ol className="el-steps">
          {stages.map(stage => (
            <li key={stage.name}>
              <p><strong>{stage.name}. {stage.job}</strong> {stage.body}</p>
              <span className="el-step-meta">{stage.input} → {stage.output}{stage.approval ? ` · ${stage.approval}` : ""}</span>
            </li>
          ))}
        </ol>
      </SplitSection>

      <SplitSection
        id="evidence"
        title="Evidence comes with the result."
        lede="A passed run keeps its source, findings and test output together. If a run reaches a repair limit, you can still inspect what it produced and where it stopped."
        extra={<Link href="/demo/library" className="el-link">Inspect an example run <ArrowRight size={16} aria-hidden /></Link>}
      >
        <figure className="em-panel" style={{ margin: 0 }} aria-label="Example test output from the Library demo">
          <pre className="em-terminal"><span>$ pytest -q</span>{"\n"}........{"\n"}<strong>8 passed in 1.42s</strong>{"\n"}<span>Process exited with code 0</span></pre>
          <ol className="el-steps" style={{ marginTop: 24 }}>
            <li><p><strong>You decide twice.</strong> Approve the requirements, then the architecture. Request changes if either misses your intent.</p></li>
            <li><p><strong>The sandbox tests the result.</strong> Generated code runs with networking disabled. A passing suite reports what those tests checked.</p></li>
          </ol>
          <figcaption className="el-step-meta">Library demo · example test output</figcaption>
        </figure>
      </SplitSection>

      <SplitSection id="technology" title="The tools behind each run." lede="Open-source components, wired together so every step leaves a record.">
        <dl className="em-list">{TECHNOLOGY.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </SplitSection>

      <section className="el-section el-closing" aria-labelledby="how-closing-title">
        <h2 id="how-closing-title">Watch the work. Inspect the result.</h2>
        <p>A full run, replayed: the plan, the code, the review and the tests.</p>
        <div className="el-closing-actions"><ButtonLink href="/demo/library" className="el-primary">Explore the demo<ArrowRight size={16} aria-hidden /></ButtonLink></div>
      </section>
    </EditorialPage>
  );
}

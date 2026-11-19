import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { EditorialPage, PageHead, SplitSection } from "@/components/marketing/editorial-marketing";
import { FaqItem } from "@/components/marketing/editorial-landing-sections";

export const metadata: Metadata = {
  title: "FAQ · CodeForge",
  description:
    "Clear answers about what CodeForge builds, how the agents recover from mistakes, what runs in the sandbox, and what every project costs.",
};

const FAQ = [
  {
    category: "building",
    q: "What kinds of APIs can it build?",
    a: "CRUD REST APIs over one or two entities: FastAPI, MongoDB through Beanie, and a pytest suite. The scope is locked there deliberately. CodeForge does not currently generate frontends, authentication systems, or arbitrary application types.",
  },
  {
    category: "execution",
    q: "Does it actually run the generated code?",
    a: "Yes. Every run ends in a Docker container with networking disabled. MongoDB runs beside the generated application, and the generated pytest suite executes against it. The pass or fail you see is the interpreter's result.",
  },
  {
    category: "cost",
    q: "What does it cost to run?",
    a: "Nothing. The pipeline uses free-tier providers, with an ordered fallback chain for each agent. A rate limit moves that stage to its next provider instead of immediately ending the run.",
  },
  {
    category: "recovery",
    q: "What happens when an agent gets something wrong?",
    a: "A blocking review finding or a failing test returns the code to the Coder with the specific evidence attached. The relevant files are rewritten and the pipeline continues from there. Review and sandbox loops are capped separately at three attempts.",
  },
  {
    category: "control",
    q: "Do I have to approve anything?",
    a: "Twice. The first approval confirms the requirements extracted by the PM. The second confirms the Architect's routes and models. The run waits at both checkpoints because these are the cheapest places to catch a misunderstanding.",
  },
  {
    category: "results",
    q: "What if the tests do not all pass?",
    a: "You still keep the generated files, review findings and real pytest output. A run with some failed tests is reported as partial. A run that exhausts its repair attempts is reported as a loop limit, which is a deliberate stop rather than a crash.",
  },
  {
    category: "privacy",
    q: "Can anyone else see my projects and runs?",
    a: "No. Projects and runs are scoped to your account, and the API checks ownership on every request, including the live event stream. Knowing a run ID is not enough to read another account's work.",
  },
  {
    category: "timing",
    q: "How long does a run take?",
    a: "Usually a few minutes, with most of that time spent waiting on free-tier models. The two approval pauses are open-ended: the pipeline waits for you instead of timing out.",
  },
  {
    category: "retrieval",
    q: "What is the example library toggle?",
    a: "It enables retrieval. With it on, the agents receive a small set of hand-written reference APIs alongside your prompt. That makes it possible to compare runs with and without examples while keeping the rest of the pipeline the same.",
  },
] as const;

const QUICK_FACTS = [
  { value: "1–2", label: "Entities per API" },
  { value: "2", label: "Approvals by you" },
  { value: "3", label: "Attempts per repair loop" },
  { value: "$0", label: "Model cost" },
] as const;

const TOPICS = [
  { title: "Building and running", categories: ["building", "execution", "results", "timing"] },
  { title: "Control and recovery", categories: ["control", "recovery", "retrieval"] },
  { title: "Cost and privacy", categories: ["cost", "privacy"] },
] as const;

export default function FaqPage() {
  return (
    <EditorialPage className="em-faq-page">
      <PageHead
        label="Frequently asked questions"
        title="A little more clarity."
        lede="What you can build, how the agents work, and what happens when something goes wrong."
      />
      <dl className="em-facts" style={{ ["--em-cols" as string]: 4 }}>
        {QUICK_FACTS.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>

      <SplitSection id="questions" title="The details that matter." lede="Open a question for the short answer. The how-it-works page has the long ones.">
        <div className="el-faq">
          {TOPICS.map(topic => (
            <div key={topic.title} role="group" aria-label={topic.title}>
              <p className="em-topic" aria-hidden>{topic.title}</p>
              {FAQ.filter(item => (topic.categories as readonly string[]).includes(item.category)).map(item => <FaqItem key={item.q} question={item.q} answer={item.a} />)}
            </div>
          ))}
        </div>
      </SplitSection>

      <section className="el-section el-closing" aria-labelledby="faq-closing-title">
        <h2 id="faq-closing-title">Still uncertain?</h2>
        <p>Ask about your use case or report a run that surprised you. Specific prompts and confusing failures are the most useful messages.</p>
        <div className="el-closing-actions"><ButtonLink href="/contact" className="el-primary">Contact us<ArrowRight size={16} aria-hidden /></ButtonLink></div>
      </section>
    </EditorialPage>
  );
}

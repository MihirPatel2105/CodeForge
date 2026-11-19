import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/contact-details";
import { EditorialPage, PageHead } from "./editorial-marketing";

/** Privacy and Terms: a serif title, then sticky contents beside a single reading column. */
export function LegalPage({ title, intro, sections }: {
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <EditorialPage className="em-legal-page">
      <PageHead label="Last updated October 3, 2026" title={title} lede={intro} />
      <div className="em-legal">
        <nav className="em-toc" aria-label={`${title} sections`}>
          <p>On this page</p>
          <ol>
            {sections.map((section, index) => <li key={section.title}><a href={`#section-${index + 1}`}>{section.title}</a></li>)}
            <li><a href="#section-contact">Questions or requests</a></li>
          </ol>
        </nav>
        <div className="em-legal-body">
          {sections.map((section, index) => (
            <section key={section.title} id={`section-${index + 1}`}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
          <section id="section-contact">
            <h2>Questions or requests</h2>
            <p>
              Contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. For account requests, use your registered
              email so we can verify your identity. See also the <Link href="/privacy">Privacy Policy</Link> and
              the <Link href="/terms">Terms of Use</Link>.
            </p>
          </section>
        </div>
      </div>
    </EditorialPage>
  );
}

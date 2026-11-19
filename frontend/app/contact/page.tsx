import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/marketing/contact-form";
import { EditorialPage, PageHead } from "@/components/marketing/editorial-marketing";
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/contact-details";

export const metadata: Metadata = {
  title: "Contact · CodeForge",
  description:
    "Report a bug, ask whether CodeForge fits your API, or share a run that behaved in an unexpected way.",
};

const USEFUL_DETAILS = [
  { n: "01", title: "What happened", body: "The agent or stage where the run stopped making sense." },
  { n: "02", title: "What you expected", body: "The result you wanted from the same prompt or approval." },
  { n: "03", title: "What you saw", body: "An error, finding, test result or other evidence from the run." },
] as const;

export default function ContactPage() {
  return (
    <EditorialPage className="em-contact-page">
      <PageHead
        label="Contact"
        title="Let’s talk about your next build."
        lede="Report a bug, ask whether your API fits the current scope, or share an agent decision that surprised you. Specific evidence helps us answer faster."
        actions={<span className="em-open">We usually reply within two working days</span>}
        aside={
          <div className="em-panel em-contact-form" role="group" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title" className="em-panel-title">Send the details</h2>
            <ContactForm />
          </div>
        }
      />

      <section className="el-section el-split" aria-labelledby="contact-reach-title">
        <div className="el-split-head"><h2 id="contact-reach-title">Other ways to reach us</h2><p>Email is best for anything with a run, a prompt or a screenshot attached.</p></div>
        <dl className="em-list">
          <div><dt>Email</dt><dd><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd></div>
          <div><dt>Phone</dt><dd><a href={CONTACT_PHONE_HREF}>{CONTACT_PHONE}</a></dd></div>
          <div><dt>Address</dt><dd><address style={{ fontStyle: "normal" }}>{CONTACT_ADDRESS.map(line => <span key={line} style={{ display: "block" }}>{line}</span>)}</address></dd></div>
        </dl>
      </section>

      <section className="el-section" aria-labelledby="contact-report-title">
        <div className="el-row-head">
          <h2 id="contact-report-title">Three details are enough to start.</h2>
          <p>You don’t need to diagnose the problem first. Describe the gap and include what the interface showed you.</p>
        </div>
        <ol className="el-cards el-cards-three">
          {USEFUL_DETAILS.map(detail => (
            <li key={detail.title} className="el-card">
              <span className="el-meta"><span className="el-pill">{detail.n}</span>A useful report</span>
              <h3>{detail.title}</h3>
              <p>{detail.body}</p>
            </li>
          ))}
        </ol>
        <p className="em-lede" style={{ fontSize: 16 }}>Questions about supported APIs, cost and privacy may already be answered in the <Link href="/faq" className="el-link" style={{ marginTop: 0 }}>FAQ</Link>.</p>
      </section>
    </EditorialPage>
  );
}

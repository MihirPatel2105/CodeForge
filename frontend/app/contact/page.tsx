import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bug, Clock3, Mail, MapPin, MessageSquareText, Phone, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";
import { ContactForm } from "@/components/marketing/contact-form";
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/contact-details";

export const metadata: Metadata = {
  title: "Contact · CodeForge",
  description:
    "Report a bug, ask whether CodeForge fits your API, or share a run that behaved in an unexpected way.",
};

const USEFUL_DETAILS = [
  { icon: Bug, title: "What happened", body: "The agent or stage where the run stopped making sense." },
  { icon: Sparkles, title: "What you expected", body: "The result you wanted from the same prompt or approval." },
  { icon: MessageSquareText, title: "What you saw", body: "An error, finding, test result or other evidence from the run." },
] as const;

export default function ContactPage() {
  return (
    <div className="cf-contact cf-premium-marketing min-h-screen bg-surface">
      <SiteHeader />
      <main>
        <section className="cf-contact-hero cf-contact-stage">
          <div className="cf-entrance-grid relative z-10 mx-auto grid w-full max-w-[1536px] gap-14 px-6 py-14 md:px-10 md:py-18 lg:min-h-[calc(100svh-64px)] lg:grid-cols-[minmax(0,0.82fr)_minmax(460px,0.78fr)] lg:items-center lg:px-14 lg:py-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-xl border border-accent-bd bg-accent-soft px-3 py-1.5 text-[12px] font-[650] text-accent"><MessageSquareText className="h-3.5 w-3.5" aria-hidden />Contact CodeForge</span>
              <h1 className="font-display mt-8 max-w-[13ch] text-[42px] font-[650] leading-[1.05] tracking-[-0.065em] text-fg sm:text-[52px] lg:text-[58px]">Let’s talk about your next build.</h1>
              <p className="mt-7 max-w-[57ch] text-[16px] leading-[1.72] text-fg-muted">Report a bug, ask whether your API fits the current scope, or share an agent decision that surprised you. Specific evidence helps us answer faster.</p>

              <div className="cf-contact-methods mt-10 grid gap-6 sm:grid-cols-2">
                <a href={`mailto:${CONTACT_EMAIL}`} className="group border-b border-rule pb-6 transition-colors hover:border-accent">
                  <div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-bg text-accent"><Mail className="h-4 w-4" aria-hidden /></span><ArrowRight className="h-3.5 w-3.5 text-fg-faint transition-transform group-hover:translate-x-0.5" aria-hidden /></div>
                  <p className="mt-5 text-[12px] font-[650] text-fg-muted">Email</p>
                  <p className="mt-1 break-all text-[14px] font-[550] text-fg">{CONTACT_EMAIL}</p>
                </a>
                <a href={CONTACT_PHONE_HREF} className="group border-b border-rule pb-6 transition-colors hover:border-accent">
                  <div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-bg text-accent"><Phone className="h-4 w-4" aria-hidden /></span><ArrowRight className="h-3.5 w-3.5 text-fg-faint transition-transform group-hover:translate-x-0.5" aria-hidden /></div>
                  <p className="mt-5 text-[12px] font-[650] text-fg-muted">Phone</p>
                  <p className="mt-1 text-[14px] font-[550] text-fg">{CONTACT_PHONE}</p>
                </a>
              </div>

              <div className="mt-5 flex items-start gap-3 border-t border-rule pt-5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" aria-hidden />
                <address className="text-[13px] not-italic leading-[1.65] text-fg-muted">{CONTACT_ADDRESS.map((line) => <span key={line} className="block">{line}</span>)}</address>
              </div>
              <div className="mt-5 flex items-center gap-2 text-[13px] font-[600] text-ok"><Clock3 className="h-3.5 w-3.5" aria-hidden />We usually reply within two working days</div>
            </div>

            <div className="cf-contact-form-stage rounded-[32px] border border-border bg-surface p-6 sm:p-10">
              <div className="mb-7 flex items-center justify-between border-b border-rule pb-5">
                <div><span className="text-[12px] font-[650] text-accent">Get in touch</span><h2 className="font-display mt-2 text-[22px] font-[650] tracking-[-0.04em] text-fg">Send the details</h2></div>
                <span className="flex items-center gap-2 text-[12px] font-[600] text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Open</span>
              </div>
              <ContactForm />
            </div>
          </div>
        </section>

        <section className="border-b border-rule bg-surface">
          <div className="mx-auto w-full max-w-[1536px] px-6 py-18 md:px-10 md:py-20 lg:px-14">
            <div className="grid gap-12 ">
              <div className="text-[13px] font-[650] text-accent">A useful report</div>
              <div>
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><h2 className="font-display max-w-[18ch] text-[29px] font-[650] leading-[1.2] tracking-[-0.05em] text-fg md:text-[38px]">Three details are enough to start.</h2><p className="max-w-[46ch] text-[14px] leading-[1.68] text-fg-muted">You do not need to diagnose the problem first. Describe the gap and include what the interface showed you.</p></div>
                <div className="mt-10 grid gap-6 md:grid-cols-3">
                  {USEFUL_DETAILS.map(({ icon: Icon, title, body }, index) => (
                    <article key={title} className="rounded-3xl bg-bg p-7"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-accent" aria-hidden /><span className="font-mono text-[9px] font-[700] text-fg-faint">0{index + 1}</span></div><h3 className="font-display mt-7 text-[17px] font-[650] tracking-[-0.035em] text-fg">{title}</h3><p className="mt-3 text-[13.5px] leading-[1.65] text-fg-muted">{body}</p></article>
                  ))}
                </div>
                <p className="mt-8 text-[13.5px] leading-[1.6] text-fg-muted">Questions about supported APIs, cost and privacy may already be answered in the <Link href="/faq" className="font-[650] text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">FAQ</Link>.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

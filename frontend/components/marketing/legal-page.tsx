import Link from "next/link";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./marketing-actions";
import { CONTACT_EMAIL } from "@/lib/contact-details";

export function LegalPage({ title, intro, sections }: {
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-[860px] px-6 py-14 md:py-20">
        <p className="text-[13px] font-semibold text-accent">CodeForge · Last updated October 3, 2026</p>
        <h1 className="mt-4 text-[36px] font-semibold tracking-tight md:text-[44px]">{title}</h1>
        <p className="mt-5 text-[16px] leading-7 text-fg-muted">{intro}</p>
        <nav aria-label={`${title} sections`} className="my-9 flex flex-wrap gap-x-5 gap-y-3 border-y border-rule py-5 text-[13px]">
          {sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`} className="text-accent underline-offset-4 hover:underline">{section.title}</a>)}
        </nav>
        {sections.map((section, index) => (
          <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-28 py-5">
            <h2 className="text-[21px] font-semibold tracking-tight">{section.title}</h2>
            <p className="mt-3 text-[15px] leading-7 text-fg-muted">{section.body}</p>
          </section>
        ))}
        <section className="mt-8 rounded-2xl border border-rule p-6">
          <h2 className="text-[20px] font-semibold">Questions or requests</h2>
          <p className="mt-3 leading-7 text-fg-muted">Contact <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. For account requests, use your registered email so we can verify your identity.</p>
          <div className="mt-5 flex gap-5 text-sm text-accent"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

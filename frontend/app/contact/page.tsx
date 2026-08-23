import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";
import { ContactForm } from "@/components/marketing/contact-form";
import {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_HREF,
} from "@/lib/contact-details";

export const metadata: Metadata = {
  title: "Contact · CodeForge",
  description:
    "Report a bug, ask what CodeForge can build, or tell us about a run that failed in a way it should not have.",
};

/** Where to reach the people who built this.
 *
 * The details are a plain definition list rather than cards — an address is reference
 * material, read once and copied, and giving each line a box would be decoration
 * pretending to be structure. */
const DETAILS: { label: string; lines: readonly string[]; href?: string }[] = [
  { label: "address", lines: CONTACT_ADDRESS },
  { label: "phone", lines: [CONTACT_PHONE], href: CONTACT_PHONE_HREF },
  { label: "email", lines: [CONTACT_EMAIL], href: `mailto:${CONTACT_EMAIL}` },
];

/**
 * Contact.
 *
 * The one marketing page that does not use `MarketingPage`'s banded header, and
 * deliberately so: that band runs the full width and costs roughly 400px before any
 * content starts, which on a laptop pushed the send button below the fold. A form the
 * visitor cannot see is a form they do not fill in. Here the heading shares the left
 * column with the address and the form sits beside it, so the whole exchange — what
 * this page is for, how else to reach us, and the field to type in — is one screen.
 *
 * Chrome still comes from `SiteHeader` and `SiteFooter`, so only the header band is
 * given up, not the consistency.
 */
export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />

      <main className="mx-auto grid w-full gap-x-16 gap-y-12 px-6 py-12 md:px-10 md:py-14 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)] lg:px-14">
        <div>
          <span className="font-mono text-[11px] font-[600] uppercase tracking-[0.16em] text-fg-faint">
            [ contact ]
          </span>
          <h1 className="font-display mt-6 max-w-[18ch] text-[27px] font-[600] leading-[1.18] tracking-[-0.045em] text-fg sm:text-[31px]">
            Tell us what broke, or what is missing.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.65] text-fg-muted">
            Bug reports, questions about what CodeForge can build, or a run that failed in
            a way it should not have — all of it reaches the people who built this.
          </p>

          <dl className="mt-9 flex flex-col">
            {DETAILS.map((detail) => (
              <div
                key={detail.label}
                className="border-b border-rule py-5 first:border-t first:border-rule"
              >
                <dt className="font-mono text-[10.5px] font-[600] uppercase tracking-[0.16em] text-fg-faint">
                  {detail.label}
                </dt>
                <dd className="mt-[9px] font-mono text-[13px] leading-[1.7] text-fg">
                  {detail.href ? (
                    <a
                      href={detail.href}
                      className="underline decoration-1 decoration-border-strong underline-offset-[4px] transition-colors hover:decoration-fg"
                    >
                      {detail.lines[0]}
                    </a>
                  ) : (
                    detail.lines.map((line) => <div key={line}>{line}</div>)
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-7 max-w-[44ch] text-[13.5px] leading-[1.6] text-fg-muted">
            Before you write: the{" "}
            <Link
              href="/faq"
              className="font-[600] text-fg underline decoration-1 decoration-border-strong underline-offset-[4px] hover:decoration-fg"
            >
              FAQ
            </Link>{" "}
            covers what CodeForge can build, what it costs, and what happens when an agent
            gets something wrong.
          </p>
        </div>

        <ContactForm />
      </main>

      <SiteFooter />
    </div>
  );
}

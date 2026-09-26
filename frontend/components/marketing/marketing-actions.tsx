"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
import { LogoMark } from "@/components/brand/logo-mark";
import { CONTACT_ADDRESS, CONTACT_EMAIL } from "@/lib/contact-details";

/**
 * The two auth-sensitive blocks at the foot of the landing page.
 *
 * Both are client components purely so they can see the token: the page itself stays a
 * server component. Signed out they sell; signed in they get out of the way and point
 * at the app instead of inviting somebody to create a second account.
 */

const ACTION =
  "inline-flex items-center justify-center rounded-lg bg-fg px-7 py-[15px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em] text-surface transition-opacity hover:opacity-88";

export function ClosingBanner() {
  const user = useCurrentUser();

  return (
    <div className="cf-frame flex flex-col items-start gap-7 border border-border px-8 py-10 md:flex-row md:items-center md:justify-between md:px-10">
      <h2 className="font-display max-w-[20ch] text-[24px] font-[600] leading-[1.28] tracking-[-0.035em] text-fg md:text-[28px]">
        {user ? "Your agents are standing by." : "One sentence in. A tested API out."}
      </h2>
      <Link href={user ? "/projects" : "/signup"} className={`${ACTION} shrink-0`}>
        {user ? "Go to projects" : "Create an account"}
      </Link>
    </div>
  );
}

export function SiteFooter() {
  const user = useCurrentUser();

  return (
    // `cf-invert` re-declares the palette on this element, so every `text-fg-muted`,
    // `border-rule` and `bg-fg` inside resolves against the dark values — the same
    // mechanism the auth panel uses. Nothing in here needed changing to suit a dark
    // ground.
    <footer className="cf-invert border-t border-rule bg-bg">
      <div className="mx-auto w-full px-6 py-14 md:px-10 lg:px-14">
        <div className="grid gap-x-12 gap-y-12 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-[6px]">
              <LogoMark className="h-8 w-8" />
              <span className="cf-wordmark text-fg">Code<span className="cf-wordmark__forge">Forge</span></span>
            </Link>
            <p className="mt-4 max-w-[34ch] text-[13.5px] leading-[1.55] text-fg-muted">
              Five role-based AI agents mapped onto the software development lifecycle,
              with a feedback loop between review, testing and code.
            </p>

            {/* Address in the footer as well as on the contact page: it is the one
                detail someone looks for without wanting to navigate for it. */}
            <address className="mt-6 flex flex-col gap-[3px] font-mono text-[12.5px] not-italic leading-[1.7] text-fg-faint">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="w-fit transition-colors hover:text-fg-muted"
              >
                {CONTACT_EMAIL}
              </a>
              {CONTACT_ADDRESS.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          </div>

          <FooterColumn
            heading="product"
            links={[
              { href: "/how-it-works", label: "how it works" },
              { href: "/#how", label: "watch a run" },
              { href: "/#stack", label: "what it runs on" },
            ]}
          />

          {/* The two "I need a person" destinations, grouped as such. An FAQ answers the
              question when it is common; the form exists for when it is not. */}
          <FooterColumn
            heading="support"
            links={[
              { href: "/faq", label: "faq" },
              { href: "/contact", label: "contact" },
              { href: "/about", label: "about" },
            ]}
          />

          {/* Account column follows the session, like everything else on the page.
              Each side lists exactly the destinations that make sense in that state —
              "settings" only exists once there is an account to configure, and
              "forgot password" only matters before you are signed in. */}
          <FooterColumn
            heading="account"
            links={
              user
                ? [
                    { href: "/projects", label: "projects" },
                    { href: "/profile", label: "profile" },
                    { href: "/profile/settings", label: "settings" },
                  ]
                : [
                    { href: "/login", label: "sign in" },
                    { href: "/signup", label: "create account" },
                    { href: "/forgot-password", label: "forgot password" },
                  ]
            }
          />
        </div>

        <div className="mt-14 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-rule pt-7">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-fg-faint">
            © {new Date().getFullYear()} CodeForge
          </p>
          <p className="font-mono text-[11.5px] text-fg-faint">
            $0 — free-tier providers only
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="font-mono text-[10.5px] font-[600] uppercase tracking-[0.16em] text-fg-faint">
        {heading}
      </h2>
      <ul className="mt-4 flex flex-col gap-[10px]">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-mono text-[12.5px] text-fg-muted transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

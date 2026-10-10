"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { CONTACT_ADDRESS, CONTACT_EMAIL } from "@/lib/contact-details";

/**
 * The two auth-sensitive blocks at the foot of the landing page.
 *
 * Both are client components purely so they can see the token: the page itself stays a
 * server component. Signed out they sell; signed in they get out of the way and point
 * at the app instead of inviting somebody to create a second account.
 */

export function ClosingBanner() {
  const user = useCurrentUser();

  return (
    <div className="cf-closing-banner flex flex-col items-start gap-7 rounded-3xl border border-border px-7 py-9 sm:px-9 md:flex-row md:items-center md:justify-between md:gap-10 md:px-10 md:py-10">
      <h2 className="font-display max-w-[22ch] text-[25px] font-[600] leading-[1.2] tracking-[-0.04em] text-fg md:text-[30px]">
        {user ? "Your agents are standing by." : "One sentence in. A tested API out."}
      </h2>
      <Link href={user ? "/projects" : "/signup"} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-accent px-6 text-[14px] font-[600] text-surface shadow-sm transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:translate-y-0">
        {user ? "Go to projects" : "Create an account"}
      </Link>
    </div>
  );
}

export function SiteFooter() {
  const user = useCurrentUser();

  return (
    <footer className="cf-invert cf-site-footer border-t border-rule bg-bg">
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-7 pt-14 md:px-10 md:pt-16 lg:px-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:gap-x-14">
          <div className="col-span-2 border-b border-rule pb-9 md:col-span-3 lg:col-span-1 lg:border-0 lg:pb-0">
            <Link
              href="/"
              aria-label="CodeForge home"
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <LogoLockup variant="dark" className="h-9 w-auto" />
            </Link>
            <p className="mt-6 text-[20px] font-[550] leading-[1.4] tracking-[-0.025em] text-fg">From idea to tested API.</p>
            <p className="mt-3 max-w-[32ch] text-[14px] leading-[1.75] text-fg-muted">
              A team of agents. A visible process. You stay in control of the build.
            </p>
            <address className="mt-6 flex flex-col items-start gap-2 not-italic">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-rule px-4 text-[12px] font-[550] text-fg transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {CONTACT_EMAIL}
                <ArrowUpRight className="h-3.5 w-3.5 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </a>
              {CONTACT_ADDRESS.map((line) => (
                <span key={line} className="text-[12.5px] text-fg-faint">{line}</span>
              ))}
            </address>
          </div>

          <FooterColumn
            heading="Product"
            links={[
              { href: "/how-it-works", label: "How it works" },
              { href: "/playground/agent-city", label: "Agent City playground" },
              { href: "/demo/library", label: "Watch a run" },
              { href: "/how-it-works#technology", label: "Technology" },
              { href: "/about", label: "About" },
            ]}
          />

          <FooterColumn
            heading="Help"
            links={[
              { href: "/faq", label: "FAQ" },
              { href: "/contact", label: "Contact" },
              { href: "/privacy", label: "Privacy Policy" },
              { href: "/terms", label: "Terms of Use" },
            ]}
          />

          <div className="col-span-2 md:col-span-1">
            <FooterColumn
              heading="Account"
              links={
                user
                  ? [
                      { href: "/projects", label: "Projects" },
                      { href: "/profile", label: "Profile" },
                      { href: "/profile/settings", label: "Settings" },
                    ]
                  : [
                      { href: "/login", label: "Sign in" },
                      { href: "/signup", label: "Create account" },
                      { href: "/forgot-password", label: "Forgot password" },
                    ]
              }
            />
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-rule pt-6 text-[12px] text-fg-faint sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p>
            © {new Date().getFullYear()} CodeForge
          </p>
          <p>
            Plan. Build. Review. Test.
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
    <nav aria-label={`${heading} links`}>
      <h2 className="text-[12px] font-[650] tracking-[0.02em] text-fg">
        {heading}
      </h2>
      <ul className="mt-3 flex flex-col gap-0.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-sm text-[14px] leading-6 text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

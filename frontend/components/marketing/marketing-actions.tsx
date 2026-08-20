"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * The two auth-sensitive blocks at the foot of the landing page.
 *
 * Both are client components purely so they can see the token: the page itself stays a
 * server component. Signed out they sell; signed in they get out of the way and point
 * at the app instead of inviting somebody to create a second account.
 */

const ACTION =
  "inline-flex items-center justify-center rounded-[2px] bg-fg px-7 py-[15px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em] text-surface transition-opacity hover:opacity-88";

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
            <Link href="/" className="inline-flex items-center gap-[9px]">
              <LogoMark className="h-6 w-6 rounded-[2px]" />
              <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
                codeforge
              </span>
            </Link>
            <p className="mt-4 max-w-[34ch] text-[13.5px] leading-[1.55] text-fg-muted">
              Five role-based AI agents mapped onto the software development lifecycle,
              with a feedback loop between review, testing and code.
            </p>
            <p className="mt-4 font-mono text-[11.5px] text-fg-faint">
              $0 — free-tier providers only
            </p>
          </div>

          <FooterColumn
            heading="product"
            links={[
              { href: "/how-it-works", label: "how it works" },
              { href: "/faq", label: "faq" },
              { href: "/about", label: "about" },
            ]}
          />

          <FooterColumn
            heading="explore"
            links={[
              { href: "/#how", label: "watch a run" },
              { href: "/#stack", label: "what it runs on" },
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

        <div className="mt-14 border-t border-rule pt-7">
          <p className="font-mono text-[11.5px] text-fg-faint">
            codeforge — multi-agent platform for the software development lifecycle
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

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { cn } from "@/lib/utils";

const pages = [
  { href: "/profile/settings/password", label: "Password", icon: KeyRound },
  { href: "/profile/settings/passkeys", label: "Passkeys", icon: Fingerprint },
  { href: "/profile/settings/2fa", label: "Two-factor", icon: ShieldCheck },
] as const;

export function SecuritySettingsLayout({
  current,
  title,
  description,
  children,
}: {
  current: (typeof pages)[number]["href"];
  title: string;
  description: string;
  children: ReactNode;
}) {
  const active = pages.find((page) => page.href === current)!;
  const Icon = active.icon;

  return (
    <div className="cf-account cf-security-settings min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-6 md:px-10 md:py-12 lg:px-14">
        <Link
          href="/profile/settings"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg text-[13px] font-[650] text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to settings
        </Link>

        <header className="cf-account-hero relative mt-4 flex flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:flex-row sm:items-start sm:p-8 md:p-10">
          <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-bd bg-accent-soft text-accent">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="relative z-10">
            <p className="text-[12px] font-[650] text-accent">
              Account security / {active.label}
            </p>
            <h1 className="font-display mt-2 text-[28px] font-[600] leading-[1.2] tracking-[-0.035em] text-fg md:text-[32px]">
              {title}
            </h1>
            <p className="mt-3 max-w-[70ch] text-[14px] leading-6 text-fg-muted">
              {description}
            </p>
          </div>
        </header>

        <nav aria-label="Security settings" className="mt-5 flex flex-wrap gap-2">
          {pages.map(({ href, label, icon: NavIcon }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-[650] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                href === current
                  ? "border-accent-bd bg-accent-soft text-accent"
                  : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <NavIcon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}

/** Public chrome stays visible while the session is checked; account controls stay gated. */
export function SecuritySettingsLoading({ current }: { current: (typeof pages)[number]["href"] }) {
  const content = {
    "/profile/settings/password": {
      title: "Change your password",
      description: "Choose a new password for your account. This browser stays signed in; all other sessions are signed out.",
    },
    "/profile/settings/passkeys": {
      title: "Passkeys",
      description: "Use a passkey to sign in directly, or as the second step after your password. Direct passkey sign-in does not need an extra authenticator code.",
    },
    "/profile/settings/2fa": {
      title: "Two-factor authentication",
      description: "Use an authenticator code after password sign-in. If you also have a passkey, you can choose either method; direct passkey sign-in needs no extra code.",
    },
  }[current];

  return (
    <SecuritySettingsLayout current={current} {...content}>
      <div role="status" aria-label="Loading security settings" className="grid items-start gap-5 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} aria-hidden="true" className="space-y-5 rounded-3xl border border-border bg-surface p-6 motion-safe:animate-pulse">
            <div className="h-3 w-24 rounded bg-border" />
            <div className="h-6 w-3/5 rounded bg-border" />
            <div className="h-3 w-4/5 rounded bg-border" />
            <div className="h-11 rounded-xl bg-bg" />
            <div className="h-11 rounded-xl bg-bg" />
          </div>
        ))}
        <span className="sr-only">Loading security settings…</span>
      </div>
    </SecuritySettingsLayout>
  );
}

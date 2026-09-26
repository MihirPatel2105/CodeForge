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
    <div className="cf-account min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1200px] px-6 py-9 md:px-10 md:py-12 lg:px-14">
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-fg-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to settings
        </Link>

        <header className="mt-6 flex flex-col gap-5 border-b border-rule pb-8 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-accent-bd bg-accent-soft text-accent">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-accent">
              Account security / {active.label}
            </p>
            <h1 className="font-display mt-2 text-[32px] font-[650] leading-[1.08] tracking-[-0.055em] text-fg md:text-[42px]">
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
                "inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 font-mono text-[10px] font-[700] uppercase tracking-[0.1em] transition-colors",
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

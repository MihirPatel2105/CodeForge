import Link from "next/link";
import { Clock3, KeyRound, ShieldOff } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * The left half of the reset-password screen specifically — not the shared
 * `AuthAside`'s run replay, which has nothing to do with the task on this page.
 *
 * The claim is about the mechanism this feature actually has, not a borrowed security
 * aphorism: the link is single-use, short-lived, and ends every other session the
 * moment it is spent. Stating that plainly is more CodeForge than a mood — the product's
 * whole position is that a result is a fact rather than a claim, and the same discipline
 * applies to what this panel says about itself.
 */
export function ResetPasswordAside() {
  const steps = [
    {
      icon: Clock3,
      index: "01",
      title: "Verify the link",
      detail: "A short-lived token proves this reset was requested from your inbox.",
    },
    {
      icon: KeyRound,
      index: "02",
      title: "Replace the password",
      detail: "The same four account rules are checked before anything is changed.",
    },
    {
      icon: ShieldOff,
      index: "03",
      title: "Close old sessions",
      detail: "Every previous session ends when the new password is accepted.",
    },
  ];

  return (
    <aside className="cf-auth-aside cf-invert cf-lift relative hidden flex-col justify-center overflow-hidden bg-bg px-10 py-9 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[52%] xl:w-[54%]">
      <div className="relative z-10 mx-auto w-full max-w-[640px]">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="CodeForge home"
            className="inline-flex w-fit items-center gap-[9px] transition-opacity hover:opacity-80"
          >
            <LogoMark className="h-6 w-6 rounded-[2px]" />
            <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
              codeforge
            </span>
          </Link>
          <span className="rounded-full border border-border px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-fg-faint">
            single-use link
          </span>
        </div>

        <h1 className="font-display mt-12 max-w-[18ch] text-[31px] font-[650] leading-[1.22] tracking-[-0.05em] text-fg xl:text-[35px]">
          One secure path back into your account.
        </h1>
        <p className="mt-5 max-w-[50ch] text-[14px] leading-[1.7] text-fg-muted">
          The reset flow verifies the request, replaces the credential, and closes
          access from every older session.
        </p>

        <div className="mt-10 overflow-hidden rounded-[6px] border border-border bg-surface/40">
          {steps.map(({ icon: Icon, index, title, detail }) => (
            <div
              key={index}
              className="grid grid-cols-[44px_1fr_auto] items-start gap-4 border-b border-border px-5 py-5 last:border-b-0"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[4px] border border-border bg-surface/50 text-fg-muted">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="font-display text-[15px] font-[600] tracking-[-0.02em] text-fg">
                  {title}
                </p>
                <p className="mt-1.5 max-w-[42ch] text-[12.5px] leading-[1.55] text-fg-faint">
                  {detail}
                </p>
              </div>
              <span className="pt-1 font-mono text-[9px] font-[700] tracking-[0.12em] text-fg-faint">
                {index}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

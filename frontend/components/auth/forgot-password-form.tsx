"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { AuthAside } from "@/components/auth/auth-aside";
import { LogoMark } from "@/components/brand/logo-mark";

const FIELD =
  "h-12 rounded-[3px] border-border-strong bg-bg px-[14px] text-[14px] " +
  "transition-colors focus-visible:border-accent focus-visible:ring-0 focus-visible:ring-offset-0";

const LABEL = "font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint";

/**
 * Request a reset link.
 *
 * The response is the same sentence whether or not the address has an account, and the
 * screen after submitting is identical either way too — there is no branch in this
 * component for "that email doesn't exist". Anything else would let this form be used to
 * check who has signed up.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      // A network or server failure is the only thing worth showing here — the API
      // itself never reports "no such account" as an error.
      setError(
        err instanceof ApiError
          ? err.message || "Something went wrong. Try again."
          : "Couldn't reach the server. Check that the backend is running, then try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cf-auth relative flex min-h-screen bg-bg">
      <AuthAside />

      <main className="cf-auth-main flex flex-1 items-center justify-center p-5 py-10 sm:p-8 lg:p-10">
        <div className="w-full max-w-[450px] rounded-[7px] border border-border bg-surface p-7 shadow-[0_24px_70px_rgba(22,24,28,0.08)] sm:p-9">
          <Link href="/" className="mb-8 flex items-center gap-[9px] lg:hidden">
            <LogoMark className="h-6 w-6 rounded-[2px]" />
            <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
              codeforge
            </span>
          </Link>

          {sent ? (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-[5px] border border-ok-bd bg-ok-soft text-ok">
                <MailCheck className="h-5 w-5" aria-hidden />
              </span>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-ok-bd bg-ok-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-ok">
                reset requested
              </span>
              <h1 className="font-display mt-5 text-[32px] font-[650] leading-[1.12] tracking-[-0.05em] text-fg">
                Check your inbox.
              </h1>
              <p className="mt-4 text-[14px] leading-[1.65] text-fg-muted">
                If that address has an account, a reset link is on its way. Open the
                email to choose a new password.
              </p>
              <div className="mt-6 rounded-[4px] border border-rule bg-bg/70 px-4 py-3">
                <p className="text-[12.5px] leading-[1.55] text-fg-muted">
                  The link works once and expires after 10 minutes. Existing sessions
                  stay active until the password is changed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.11em] text-fg-faint transition-colors hover:text-fg"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Try another address
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
                <KeyRound className="h-3.5 w-3.5" aria-hidden />
                password recovery
              </span>
              <h1 className="font-display mt-5 text-[32px] font-[650] leading-[1.12] tracking-[-0.05em] text-fg">
                Reset your password
              </h1>
              <p className="mt-4 text-[14px] leading-[1.65] text-fg-muted">
                Enter the email connected to your account. We&apos;ll send a private,
                one-time link for choosing a new password.
              </p>
              <p className="mt-3 text-[13px] leading-[1.5] text-fg-muted">
                Remembered it?{" "}
                <Link
                  href="/login"
                  className="font-[600] text-fg underline underline-offset-[4px] decoration-1 decoration-border-strong hover:decoration-fg"
                >
                  Sign in
                </Link>
              </p>

              <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-[6px]">
                  <Label htmlFor="email" className={LABEL}>
                    EMAIL
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={FIELD}
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-[2px] border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 h-[50px] w-full rounded-[3px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em]"
                >
                  {submitting ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-rule pt-5">
            <ShieldCheck className="h-3.5 w-3.5 text-fg-faint" aria-hidden />
            <p className="font-mono text-[9px] font-[600] uppercase tracking-[0.11em] text-fg-faint">
              Private recovery request
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

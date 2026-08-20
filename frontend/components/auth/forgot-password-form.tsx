"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { AuthAside } from "@/components/auth/auth-aside";
import { LogoMark } from "@/components/brand/logo-mark";

const FIELD =
  "h-11 rounded-[2px] border-border-strong bg-surface px-[13px] text-[14.5px] " +
  "focus-visible:border-fg focus-visible:ring-0 focus-visible:ring-offset-0";

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
    <div className="relative flex min-h-screen bg-bg">
      <AuthAside />

      <main className="flex flex-1 items-center justify-center p-6 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="mb-8 flex items-center gap-[9px] lg:hidden">
            <LogoMark className="h-6 w-6 rounded-[2px]" />
            <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
              codeforge
            </span>
          </Link>

          {sent ? (
            <>
              <span className={LABEL}>[ check your email ]</span>
              <h1 className="font-display mt-5 text-[28px] font-[600] leading-[1.18] tracking-[-0.04em] text-fg">
                If that address has an account, a link is on its way.
              </h1>
              <p className="mt-[18px] text-[14.5px] leading-[1.6] text-fg-muted">
                Open the email and follow the link to choose a new password. It expires
                in 10 minutes and works once.
              </p>
              <p className="mt-6 text-[14px] text-fg-muted">
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="font-[600] text-fg underline underline-offset-[4px] decoration-1 decoration-border-strong hover:decoration-fg"
                >
                  Try again
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-[30px] font-[600] leading-[1.15] tracking-[-0.04em] text-fg">
                Reset your password
              </h1>
              <p className="mt-[18px] text-[14.5px] leading-[1.5] text-fg-muted">
                Remembered it?{" "}
                <Link
                  href="/login"
                  className="font-[600] text-fg underline underline-offset-[4px] decoration-1 decoration-border-strong hover:decoration-fg"
                >
                  Sign in
                </Link>
              </p>

              <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit}>
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
                  className="mt-2 h-[52px] w-full rounded-[2px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em]"
                >
                  {submitting ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

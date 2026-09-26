"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { AuthEntryShell } from "@/components/auth/auth-entry-shell";

const FIELD =
  "h-12 rounded-xl border-border-strong bg-white px-4 text-[16px] text-fg " +
  "focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 focus-visible:ring-offset-0";

const LABEL = "text-[13px] font-[650] text-fg";

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
    <AuthEntryShell label={sent ? "Reset link requested" : "Request a password reset"} proof="recovery">
          {sent ? (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-ok-bd bg-ok-soft text-ok">
                <MailCheck className="h-5 w-5" aria-hidden />
              </span>
              <span className="mt-7 inline-flex items-center gap-2 text-[12px] font-[650] text-ok">
                Reset requested
              </span>
              <h1 className="font-display mt-4 text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">
                Check your inbox
              </h1>
              <p className="mt-3 text-[15px] leading-6 text-fg-muted">
                If that address has an account, a reset link is on its way. Open the
                email to choose a new password.
              </p>
              <div className="mt-6 rounded-2xl border border-border bg-surface-2/60 px-4 py-3">
                <p className="text-[13px] leading-5 text-fg-muted">
                  The link works once and expires after 10 minutes. Existing sessions
                  stay active until the password is changed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-[13px] font-[650] text-accent hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Try another address
              </button>
            </>
          ) : (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent"><KeyRound className="h-5 w-5" aria-hidden /></span>
              <div className="mt-7 flex items-center gap-2.5 text-[12px] font-[650] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> Account recovery</div>
              <h1 className="font-display mt-4 text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">
                Reset your password
              </h1>
              <p className="mt-3 text-[15px] leading-6 text-fg-muted">
                Enter the email connected to your account. We&apos;ll send a private,
                one-time link for choosing a new password.
              </p>
              <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className={LABEL}>
                    Email
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
                    className="rounded-xl border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 h-12 w-full rounded-xl text-[14px] font-[650]"
                >
                  {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {submitting ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-7 border-t border-border pt-5 text-center text-[13px] text-fg-muted">
            Remembered it? <Link href="/login" className="font-[700] text-accent hover:underline hover:underline-offset-4">Sign in</Link>
          </p>
    </AuthEntryShell>
  );
}

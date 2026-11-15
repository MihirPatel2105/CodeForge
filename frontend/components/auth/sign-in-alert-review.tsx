"use client";

import { Notice } from "@/components/ui/notice";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { api, clearToken, ApiError } from "@/lib/api";
import { AuthEntryShell } from "@/components/auth/auth-entry-shell";

export function SignInAlertReview({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"me" | "not_me" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(answer: "me" | "not_me") {
    setPending(true);
    setError(null);
    try {
      await api.respondToSignInAlert(token, answer);
      if (answer === "not_me") clearToken();
      setResult(answer);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not review this sign-in. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthEntryShell label="Review sign-in alert" proof="security">
        {result === "not_me" ? (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-[var(--ui-radius-control)] border border-border bg-bg text-danger"><ShieldAlert className="h-5 w-5" aria-hidden /></span>
            <h1 className="mt-6 font-display text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">All sessions ended</h1>
            <p className="mt-3 text-[15px] leading-6 text-fg-muted">Your account has been signed out on every device. Reset your password before signing in again.</p>
            <ButtonLink href="/forgot-password" size="lg" className="mt-7 h-[52px] w-full rounded-[var(--ui-radius-control)]">Reset password <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
          </>
        ) : result === "me" ? (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-[var(--ui-radius-control)] border border-border bg-bg text-ok"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
            <h1 className="mt-6 font-display text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">Sign-in confirmed</h1>
            <p className="mt-3 text-[15px] leading-6 text-fg-muted">No account sessions were changed.</p>
            <Link href="/profile/settings" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--ui-radius-control)] text-[13px] font-[650] text-fg hover:underline hover:underline-offset-4">Review your devices <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </>
        ) : (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-[var(--ui-radius-control)] border border-border bg-bg text-fg"><ShieldAlert className="h-5 w-5" aria-hidden /></span>
            <h1 className="mt-6 font-display text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">Was this sign-in you?</h1>
            <p className="mt-3 text-[15px] leading-6 text-fg-muted">A new browser signed in to your account. Review the activity and choose what to do.</p>
            <div className="mt-7 flex flex-col gap-3">
              <Button type="button" size="lg" disabled={pending} onClick={() => void respond("me")} className="h-[52px] w-full rounded-[var(--ui-radius-control)] text-[14px] font-[650]">{pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Yes, it was me</Button>
              <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => void respond("not_me")} className="h-[52px] w-full rounded-[var(--ui-radius-control)] border-danger-bd text-[14px] font-[650] text-danger hover:bg-danger-soft">No, sign out all devices</Button>
            </div>
            <p className="mt-5 text-[13px] leading-5 text-fg-muted">This link works once and expires after 24 hours. If this wasn&apos;t you, all sessions will end and you&apos;ll need to reset your password.</p>
            {error ? <Notice className="mt-4">{error}</Notice> : null}
          </>
        )}
    </AuthEntryShell>
  );
}

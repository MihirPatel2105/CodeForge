"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-danger-bd bg-danger-soft text-danger"><ShieldAlert className="h-5 w-5" aria-hidden /></span>
            <span className="mt-7 flex items-center gap-2.5 text-[12px] font-[650] text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden /> Account security</span>
            <h1 className="mt-4 font-display text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">All sessions ended</h1>
            <p className="mt-3 text-[15px] leading-6 text-fg-muted">Your account has been signed out on every device. Reset your password before signing in again.</p>
            <Link href="/forgot-password" className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-fg px-5 text-[14px] font-[650] text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Reset password <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </>
        ) : result === "me" ? (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-ok-bd bg-ok-soft text-ok"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
            <span className="mt-7 flex items-center gap-2.5 text-[12px] font-[650] text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden /> Account security</span>
            <h1 className="mt-4 font-display text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">Sign-in confirmed</h1>
            <p className="mt-3 text-[15px] leading-6 text-fg-muted">No account sessions were changed.</p>
            <Link href="/profile/settings" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-[13px] font-[650] text-accent hover:underline hover:underline-offset-4">Review your devices <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent"><ShieldAlert className="h-5 w-5" aria-hidden /></span>
            <span className="mt-7 flex items-center gap-2.5 text-[12px] font-[650] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> Account security</span>
            <h1 className="mt-4 font-display text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">Was this sign-in you?</h1>
            <p className="mt-3 text-[15px] leading-6 text-fg-muted">A new browser signed in to your account. Review the activity and choose what to do.</p>
            <div className="mt-7 flex flex-col gap-3">
              <Button type="button" disabled={pending} onClick={() => void respond("me")} className="h-12 w-full rounded-xl text-[14px] font-[650]">{pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Yes, it was me</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => void respond("not_me")} className="h-12 w-full rounded-xl border-danger-bd text-[14px] font-[650] text-danger hover:bg-danger-soft">No, sign out all devices</Button>
            </div>
            <p className="mt-5 text-[13px] leading-5 text-fg-muted">This link works once and expires after 24 hours. If this wasn&apos;t you, all sessions will end and you&apos;ll need to reset your password.</p>
            {error ? <p role="alert" className="mt-4 rounded-xl border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger">{error}</p> : null}
          </>
        )}
    </AuthEntryShell>
  );
}

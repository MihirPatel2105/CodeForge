"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, clearToken, ApiError } from "@/lib/api";

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-14">
      <section className="w-full max-w-xl rounded-[6px] border border-border bg-surface p-7 shadow-[0_24px_70px_rgba(22,24,28,0.07)] md:p-10">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-accent">CodeForge · account security</span>
        {result === "not_me" ? (
          <>
            <ShieldAlert className="mt-7 h-8 w-8 text-danger" aria-hidden />
            <h1 className="mt-4 font-display text-[30px] font-[650] tracking-[-0.05em] text-fg">All sessions ended</h1>
            <p className="mt-3 text-[14px] leading-6 text-fg-muted">Your account has been signed out on every device. Reset your password before signing in again.</p>
            <Link href="/forgot-password" className="mt-6 inline-flex h-11 items-center rounded-[3px] bg-fg px-5 font-mono text-[11px] font-[700] uppercase tracking-[0.1em] text-bg">Reset password</Link>
          </>
        ) : result === "me" ? (
          <>
            <ShieldCheck className="mt-7 h-8 w-8 text-accent" aria-hidden />
            <h1 className="mt-4 font-display text-[30px] font-[650] tracking-[-0.05em] text-fg">Sign-in confirmed</h1>
            <p className="mt-3 text-[14px] leading-6 text-fg-muted">No account sessions were changed.</p>
            <Link href="/profile/settings" className="mt-6 inline-block text-[13px] text-accent underline">Review your devices</Link>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-[30px] font-[650] tracking-[-0.05em] text-fg">Was this sign-in you?</h1>
            <p className="mt-3 text-[14px] leading-6 text-fg-muted">A new browser signed in to your account. Choose an action below. This link can be used once and expires after 24 hours.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button type="button" disabled={pending} onClick={() => void respond("me")} className="h-11 rounded-[3px]">Yes, it was me</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => void respond("not_me")} className="h-11 rounded-[3px] border-danger-bd text-danger">No, sign out all devices</Button>
            </div>
            <p className="mt-5 text-[12px] leading-5 text-fg-muted">If it was not you, sign out all devices here, then reset your password.</p>
            {error ? <p role="alert" className="mt-4 text-[12px] text-danger">{error}</p> : null}
          </>
        )}
      </section>
    </main>
  );
}

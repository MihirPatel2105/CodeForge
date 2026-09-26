"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser";
import { ShieldCheck } from "lucide-react";
import { AuthAside } from "@/components/auth/auth-aside";
import { Button } from "@/components/ui/button";
import { api, ApiError, setToken } from "@/lib/api";
import { clearPendingPasswordMfa } from "@/lib/password-mfa";

export default function PasskeyLoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(token: string | null) {
    if (!token) throw new Error("The server did not return a session.");
    clearPendingPasswordMfa();
    setToken(token);
    const user = await api.me();
    router.replace(user.is_admin ? "/admin" : "/projects");
  }

  async function signIn() {
    setError(null);
    if (!browserSupportsWebAuthn()) {
      setError(
        "This browser does not support passkeys. Sign in with your password instead.",
      );
      return;
    }
    setBusy(true);
    try {
      const { challenge_id, options } = await api.passkeyLoginOptions();
      const credential = await startAuthentication({ optionsJSON: options });
      const result = await api.verifyPasskeyLogin(challenge_id, credential);
      await finish(result.access_token);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Passkey sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cf-auth relative flex min-h-screen bg-bg">
      <AuthAside />
      <main className="cf-auth-main flex flex-1 items-center justify-center p-5 py-10 sm:p-8 lg:p-10">
        <div className="w-full max-w-[450px] rounded-xl border border-border bg-surface p-7 shadow-[0_24px_70px_rgba(22,24,28,0.08)] sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            secure access
          </span>
          <h1 className="font-display mt-5 text-[32px] font-[650] tracking-[-0.05em] text-fg">
            Sign in with a passkey
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-fg-muted">
            Use your device unlock or password manager. No email, password, or extra authenticator code needed.
          </p>
          <Button
            type="button"
            onClick={signIn}
            disabled={busy}
            className="mt-7 h-[50px] w-full rounded-lg"
          >
            {busy ? "Waiting for passkey…" : "Continue with passkey"}
          </Button>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg border border-danger-bd bg-danger-soft p-3 text-[13px] text-danger"
            >
              {error}
            </p>
          )}
          <p className="mt-6 border-t border-rule pt-5 text-center text-[13px] text-fg-muted">
            <Link
              href="/login"
              className="font-[600] text-fg underline underline-offset-4"
            >
              Sign in with password
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser";
import { ArrowLeft, Fingerprint, LoaderCircle } from "lucide-react";
import { AuthEntryShell } from "@/components/auth/auth-entry-shell";
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
    <AuthEntryShell label="Passkey sign in">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent">
            <Fingerprint className="h-5 w-5" aria-hidden />
          </span>
          <div className="mt-7 flex items-center gap-2.5 text-[12px] font-[650] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> Your workspace</div>
          <h1 className="font-display mt-4 text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">
            Sign in with a passkey
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-fg-muted">
            Use a passkey saved on your device or password manager. Your device may ask for a PIN or biometric check.
          </p>
          <Button
            type="button"
            onClick={signIn}
            disabled={busy}
            className="mt-8 h-12 w-full gap-2 rounded-xl text-[14px] font-[650]"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "Waiting for passkey…" : "Continue with passkey"}
          </Button>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger"
            >
              {error}
            </p>
          )}
          <p className="mt-7 border-t border-border pt-5 text-center text-[13px] text-fg-muted">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg font-[650] text-accent hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Sign in with password
            </Link>
          </p>
    </AuthEntryShell>
  );
}

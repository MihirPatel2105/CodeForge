"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { AuthAside } from "@/components/auth/auth-aside";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, setToken } from "@/lib/api";
import {
  clearPendingPasswordMfa,
  loadPendingPasswordMfa,
  type PasswordMfaMethod,
  type PendingPasswordMfa,
} from "@/lib/password-mfa";
import { cn } from "@/lib/utils";

export default function VerifyLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingPasswordMfa | null>(null);
  const [method, setMethod] = useState<PasswordMfaMethod>("totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadPendingPasswordMfa();
    if (!saved) {
      router.replace("/login");
      return;
    }
    setPending(saved);
    setMethod(saved.methods[0]);
  }, [router]);

  async function finish(token: string | null) {
    if (!token) throw new Error("The server did not return a session.");
    setToken(token);
    clearPendingPasswordMfa();
    const user = await api.me();
    router.replace(user.is_admin ? "/admin" : "/projects");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!pending || code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.completePasswordLogin(pending.ticket, code);
      await finish(result.access_token);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Could not verify that code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPasskey() {
    if (!pending || busy) return;
    setError(null);
    if (!browserSupportsWebAuthn()) {
      setError("This browser does not support passkeys. Try an authenticator code or another browser.");
      return;
    }
    setBusy(true);
    try {
      const { challenge_id, options } = await api.passwordMfaPasskeyOptions(pending.ticket);
      const credential = await startAuthentication({ optionsJSON: options });
      const result = await api.verifyPasswordMfaPasskey(pending.ticket, challenge_id, credential);
      await finish(result.access_token);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Passkey verification failed.");
    } finally {
      setBusy(false);
    }
  }

  function startAgain() {
    clearPendingPasswordMfa();
    router.replace("/login");
  }

  if (!pending) return null;

  return (
    <div className="cf-auth relative flex min-h-screen bg-bg">
      <AuthAside />
      <main className="cf-auth-main flex flex-1 items-center justify-center p-5 py-10 sm:p-8 lg:p-10">
        <div className="w-full max-w-[450px] rounded-xl border border-border bg-surface p-7 shadow-[0_24px_70px_rgba(22,24,28,0.08)] sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
            <ShieldCheck className="h-3 w-3" aria-hidden /> second step
          </span>
          <h1 className="font-display mt-5 text-[32px] font-[650] tracking-[-0.05em] text-fg">Verify yourself</h1>
          <p className="mt-3 text-[14px] leading-6 text-fg-muted">
            Your password was correct. Complete sign-in for <span className="font-[600] text-fg">{pending.email}</span> using one of your saved methods.
          </p>

          {pending.methods.length > 1 ? (
            <div role="group" aria-label="Verification method" className="mt-7 grid grid-cols-2 gap-2">
              {pending.methods.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  aria-pressed={method === option}
                  disabled={busy}
                  onClick={() => { setMethod(option); setError(null); }}
                  className={cn("h-12 gap-2 rounded-lg text-[10px]", method === option && "border-accent-bd bg-accent-soft text-accent")}
                >
                  {option === "totp" ? <KeyRound className="h-4 w-4" aria-hidden /> : <Fingerprint className="h-4 w-4" aria-hidden />}
                  {option === "totp" ? "Authenticator code" : "Passkey"}
                </Button>
              ))}
            </div>
          ) : null}

          {method === "totp" ? (
            <form onSubmit={verifyCode} className="mt-7 space-y-4">
              <div>
                <Label htmlFor="login-verification-code">AUTHENTICATOR CODE</Label>
                <Input
                  id="login-verification-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="mt-2 h-12 rounded-lg border-border-strong bg-bg font-mono tracking-[0.2em]"
                />
                <p className="mt-2 text-[12px] leading-5 text-fg-muted">Enter the current six-digit code from your authenticator app.</p>
              </div>
              <Button type="submit" disabled={busy || code.length !== 6} className="h-[50px] w-full rounded-lg">
                {busy ? "Verifying…" : "Verify and sign in"}
              </Button>
            </form>
          ) : (
            <div className="mt-7">
              <p className="text-[12px] leading-5 text-fg-muted">Use a passkey saved to your device or password manager. Your device may ask for a PIN or biometric check.</p>
              <Button type="button" onClick={verifyPasskey} disabled={busy} className="mt-4 h-[50px] w-full gap-2 rounded-lg">
                <Fingerprint className="h-4 w-4" aria-hidden />
                {busy ? "Waiting for passkey…" : "Verify with passkey"}
              </Button>
            </div>
          )}

          {error ? <p role="alert" className="mt-5 rounded-lg border border-danger-bd bg-danger-soft p-3 text-[13px] text-danger">{error}</p> : null}
          <Button type="button" variant="ghost" onClick={startAgain} disabled={busy} className="mt-5 h-10 w-full rounded-lg text-fg-muted">Start sign-in again</Button>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { ArrowLeft, Fingerprint, KeyRound, LoaderCircle } from "lucide-react";
import { AuthEntryShell } from "@/components/auth/auth-entry-shell";
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
import { PASSKEY_NOT_COMPLETED, passkeyWasNotCompleted } from "@/lib/user-errors";

export default function VerifyLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingPasswordMfa | null>(null);
  const [method, setMethod] = useState<PasswordMfaMethod>("totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    const recovery = method === "recovery_code";
    if (!pending || busy || (recovery ? code.replace(/-/g, "").length !== 32 : code.length !== 6)) return;
    setBusy(true);
    setError(null);
    try {
      const result = recovery
        ? await api.completeRecoveryLogin(pending.ticket, code)
        : await api.completePasswordLogin(pending.ticket, code);
      await finish(result.access_token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify that code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPasskey() {
    if (!pending || busy) return;
    setError(null);
    setNotice(null);
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
      if (passkeyWasNotCompleted(err)) {
        setNotice(PASSKEY_NOT_COMPLETED);
      } else {
        setError(err instanceof ApiError ? err.message : "Passkey verification failed. Please try again.");
      }
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
    <AuthEntryShell label="Verify sign in">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent"><KeyRound className="h-5 w-5" aria-hidden /></span>
          <div className="mt-7 flex items-center gap-2.5 text-[12px] font-[650] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> One more step</div>
          <h1 className="font-display mt-4 text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">Verify yourself</h1>
          <p className="mt-3 text-[15px] leading-6 text-fg-muted">
            Complete sign-in for <span className="font-[650] text-fg">{pending.email}</span> using a method you saved.
          </p>

          {pending.methods.length > 1 ? (
            <div role="group" aria-label="Verification method" className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {pending.methods.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  aria-pressed={method === option}
                  disabled={busy}
                  onClick={() => { setMethod(option); setCode(""); setError(null); setNotice(null); }}
                  className={cn("h-auto min-h-[68px] flex-col gap-1.5 rounded-xl border-border-strong px-2 py-3 text-[12px] font-[650] sm:min-h-[76px] sm:flex-row sm:text-[13px]", method === option && "border-accent bg-accent-soft text-accent ring-2 ring-accent/10")}
                >
                  {option === "passkey" ? <Fingerprint className="h-4 w-4" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
                  {option === "totp" ? "Authenticator code" : option === "passkey" ? "Passkey" : "Recovery code"}
                </Button>
              ))}
            </div>
          ) : null}

          {method !== "passkey" ? (
            <form onSubmit={verifyCode} className="mt-7 space-y-5">
              <div>
                <Label htmlFor="login-verification-code" className="text-[13px] font-[650] text-fg">{method === "recovery_code" ? "Recovery code" : "Authenticator code"}</Label>
                <Input
                  id="login-verification-code"
                  inputMode={method === "recovery_code" ? "text" : "numeric"}
                  autoComplete={method === "recovery_code" ? "off" : "one-time-code"}
                  autoFocus
                  required
                  value={code}
                  onChange={(event) => setCode(method === "recovery_code" ? event.target.value.replace(/[^a-fA-F0-9-]/g, "").slice(0, 35) : event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={method === "recovery_code" ? "XXXX-XXXX-XXXX-XXXX" : "000000"}
                  className="mt-2 h-12 rounded-xl border-border-strong bg-white px-4 font-mono text-[16px] tracking-[0.2em] focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
                />
                <p className="mt-2 text-[12px] leading-5 text-fg-muted">{method === "recovery_code" ? "Use one saved recovery code. Each code works only once." : "Enter the current six-digit code from your authenticator app."}</p>
              </div>
              <Button type="submit" disabled={busy || (method === "recovery_code" ? code.replace(/-/g, "").length !== 32 : code.length !== 6)} className="h-12 w-full rounded-xl text-[14px] font-[650]">
                {busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {busy ? "Verifying…" : "Verify and sign in"}
              </Button>
            </form>
          ) : (
            <div className="mt-7">
              <p className="text-[13px] leading-5 text-fg-muted">Your device or password manager may ask for a PIN or biometric check.</p>
              <Button type="button" onClick={verifyPasskey} disabled={busy} className="mt-5 h-12 w-full gap-2 rounded-xl text-[14px] font-[650]">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Fingerprint className="h-4 w-4" aria-hidden />}
                {busy ? "Waiting for passkey…" : "Verify with passkey"}
              </Button>
            </div>
          )}

          {error ? <p role="alert" className="mt-5 rounded-xl border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger">{error}</p> : null}
          {notice ? <p role="status" className="mt-5 rounded-xl border border-accent-bd bg-accent-soft px-4 py-3 text-[13px] leading-5 text-accent">{notice}</p> : null}
          <button type="button" onClick={startAgain} disabled={busy} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-[13px] font-[650] text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"><ArrowLeft className="h-4 w-4" aria-hidden /> Start sign-in again</button>
    </AuthEntryShell>
  );
}

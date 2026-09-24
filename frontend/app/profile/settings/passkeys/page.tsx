"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/use-current-user";
import type { PasskeyInfo } from "@/lib/types";

export default function PasskeysPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    api
      .passkeys()
      .then(setPasskeys)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Could not load passkeys.",
        ),
      );
  }, [user]);

  async function addPasskey(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!browserSupportsWebAuthn()) {
      setError("This browser does not support passkeys.");
      return;
    }
    setBusy(true);
    try {
      const { challenge_id, options } = await api.passkeyRegistrationOptions(
        password,
        user?.totp_enabled ? totpCode : undefined,
      );
      const credential = await startRegistration({ optionsJSON: options });
      const saved = await api.registerPasskey(
        challenge_id,
        credential,
        label.trim(),
      );
      setPasskeys((current) => [...current, saved]);
      setLabel("");
      setPassword("");
      setTotpCode("");
      setMessage("Passkey added. You can now use it to sign in.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not add passkey.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string, name: string) {
    if (!window.confirm(`Remove “${name}” from this account?`)) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await api.deletePasskey(
        id,
        password,
        user?.totp_enabled ? totpCode : undefined,
      );
      setPasskeys((current) => current.filter((item) => item.id !== id));
      setMessage("Passkey removed.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not remove passkey.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="cf-account min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1320px] px-6 py-10 md:px-10 md:py-14 lg:px-14">
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-fg-faint hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to settings
        </Link>
        <header className="mt-5 border-b border-rule pb-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
            <KeyRound className="h-3 w-3" aria-hidden />
            account security
          </span>
          <h1 className="font-display mt-5 text-[32px] font-[650] tracking-[-0.055em] text-fg md:text-[42px]">
            Passkeys
          </h1>
          <p className="mt-3 max-w-[72ch] text-[14px] leading-6 text-fg-muted">
            Sign in with your device unlock instead of typing your password.
            Your password and recovery options remain available. If 2FA is
            enabled, you will still enter your authenticator code.
          </p>
        </header>
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={addPasskey}
            className="rounded-[6px] border border-border bg-surface p-6 shadow-[0_16px_45px_rgba(22,24,28,0.045)]"
          >
            <h2 className="font-display text-[21px] font-[650] text-fg">
              Add a passkey
            </h2>
            <p className="mt-2 text-[13px] text-fg-muted">
              Confirm your account, then follow your browser&apos;s prompt.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="passkey-label">PASSKEY NAME</Label>
                <Input
                  id="passkey-label"
                  required
                  maxLength={60}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="My laptop"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="passkey-password">CURRENT PASSWORD</Label>
                <Input
                  id="passkey-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2"
                />
              </div>
              {user.totp_enabled && (
                <div>
                  <Label htmlFor="passkey-totp">AUTHENTICATOR CODE</Label>
                  <Input
                    id="passkey-totp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(event) =>
                      setTotpCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    className="mt-2"
                  />
                </div>
              )}
              <Button
                type="submit"
                disabled={busy || passkeys.length >= 10}
                className="rounded-[3px]"
              >
                {busy ? "Working…" : "Add passkey"}
              </Button>
            </div>
          </form>
          <section className="rounded-[6px] border border-border bg-surface p-6 shadow-[0_16px_45px_rgba(22,24,28,0.045)]">
            <h2 className="font-display text-[21px] font-[650] text-fg">
              Your passkeys
            </h2>
            {passkeys.length === 0 ? (
              <p className="mt-4 text-[13px] text-fg-muted">No passkeys yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-rule">
                {passkeys.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <p className="text-[14px] font-[600] text-fg">
                        {item.label}
                      </p>
                      <p className="mt-1 text-[12px] text-fg-muted">
                        Added {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        busy || !password || (user.totp_enabled && !totpCode)
                      }
                      onClick={() => removePasskey(item.id, item.label)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 text-[12px] leading-5 text-fg-muted">
              To remove a passkey, enter your current password
              {user.totp_enabled ? " and authenticator code" : ""} in the form
              on the left.
            </p>
          </section>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-[3px] border border-danger-bd bg-danger-soft p-3 text-[13px] text-danger"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-5 rounded-[3px] border border-accent-bd bg-accent-soft p-3 text-[13px] text-accent"
          >
            {message}
          </p>
        )}
      </main>
    </div>
  );
}

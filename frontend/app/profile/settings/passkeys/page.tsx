"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, LockKeyhole, Plus, ShieldCheck } from "lucide-react";
import { SecuritySettingsLayout } from "@/components/auth/security-settings-layout";
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
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
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
      .catch((err) => {
        setLoadFailed(true);
        setError(
          err instanceof ApiError ? err.message : "Could not load passkeys.",
        );
      })
      .finally(() => setLoadingPasskeys(false));
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
    <SecuritySettingsLayout
      current="/profile/settings/passkeys"
      title="Passkeys"
      description="Sign in using your device unlock instead of typing your password. Your password remains available, and 2FA still applies when enabled."
    >
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form
            onSubmit={addPasskey}
            className="rounded-[6px] border border-border bg-surface px-6 py-7 shadow-[0_16px_45px_rgba(22,24,28,0.045)] md:px-7"
          >
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-accent">
              New passkey
            </span>
            <h2 className="font-display mt-2 text-[22px] font-[650] tracking-[-0.04em] text-fg">Add a passkey</h2>
            <p className="mt-2 text-[13px] leading-5 text-fg-muted">
              Confirm your account, then follow your browser&apos;s prompt.
            </p>
            <div className="mt-6 space-y-5">
              <div>
                <Label htmlFor="passkey-label">PASSKEY NAME</Label>
                <Input
                  id="passkey-label"
                  required
                  maxLength={60}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. My laptop"
                  className="mt-2 h-11 rounded-[3px] bg-bg"
                />
                <p className="mt-1.5 text-[11px] text-fg-faint">Only you can see this name.</p>
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
                  className="mt-2 h-11 rounded-[3px] bg-bg"
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
                    className="mt-2 h-11 rounded-[3px] bg-bg font-mono tracking-[0.2em]"
                  />
                </div>
              )}
              <p className="flex items-start gap-2 rounded-[4px] border border-rule bg-bg px-3 py-2.5 text-[12px] leading-5 text-fg-muted">
                <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                Your password confirms this change. The passkey stays on the device or password manager you choose.
              </p>
              <Button
                type="submit"
                disabled={busy || loadingPasskeys || loadFailed || passkeys.length >= 10}
                className="h-11 w-full gap-2 rounded-[3px] sm:w-auto"
              >
                {!busy && <Plus className="h-4 w-4" aria-hidden />}
                {busy ? "Adding passkey…" : "Add passkey"}
              </Button>
            </div>
          </form>
          <section className="rounded-[6px] border border-border bg-surface px-6 py-7 shadow-[0_16px_45px_rgba(22,24,28,0.045)] md:px-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-fg-faint">Saved methods</span>
                <h2 className="font-display mt-2 text-[22px] font-[650] tracking-[-0.04em] text-fg">Your passkeys</h2>
              </div>
              <span className="rounded-[3px] border border-border bg-bg px-2.5 py-1 font-mono text-[11px] font-[700] text-fg-muted">
                {passkeys.length} / 10
              </span>
            </div>
            {loadingPasskeys ? (
              <p role="status" className="mt-6 text-[13px] text-fg-muted">Loading passkeys…</p>
            ) : loadFailed ? (
              <p className="mt-6 text-[13px] leading-5 text-fg-muted">
                Passkeys could not be loaded. Refresh this page to try again.
              </p>
            ) : passkeys.length === 0 ? (
              <div className="mt-6 rounded-[5px] border border-dashed border-border-strong bg-bg px-5 py-8 text-center">
                <Fingerprint className="mx-auto h-7 w-7 text-fg-faint" aria-hidden />
                <p className="mt-3 text-[14px] font-[600] text-fg">No passkeys yet</p>
                <p className="mx-auto mt-1 max-w-[34ch] text-[12px] leading-5 text-fg-muted">
                  Add one on this page to use your device unlock at sign-in.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-rule">
                {passkeys.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border border-accent-bd bg-accent-soft text-accent">
                        <KeyRound className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-[14px] font-[600] text-fg">
                          {item.label}
                        </p>
                        <p className="mt-1 text-[12px] text-fg-muted">
                          Added {new Date(item.created_at).toLocaleDateString()}
                          {item.last_used_at && ` · Last used ${new Date(item.last_used_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !password || (user.totp_enabled && totpCode.length !== 6)}
                      onClick={() => removePasskey(item.id, item.label)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 flex items-start gap-2 border-t border-rule pt-4 text-[12px] leading-5 text-fg-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              To remove a passkey, first enter your current password
              {user.totp_enabled ? " and authenticator code" : ""} in the form.
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
    </SecuritySettingsLayout>
  );
}

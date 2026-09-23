"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  LockKeyhole,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, setToken } from "@/lib/api";
import { cn } from "@/lib/utils";

const LABEL = "font-mono text-[10px] font-[700] uppercase tracking-[0.14em]";

export function TotpSettings({
  initiallyEnabled,
  accountEmail,
}: {
  initiallyEnabled: boolean;
  accountEmail: string;
}) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enrolling = Boolean(secret && uri);
  const verificationReady = enrolling && code.length === 6;

  async function startSetup() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.setupTotp(password);
      setSecret(result.secret);
      setUri(result.provisioning_uri);
      setCopied(false);
      setCode("");
      setMessage("Setup key created. Add it to your authenticator, then verify one code.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start two-factor setup.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.verifyTotp(code);
      setEnabled(true);
      setSecret(null);
      setUri(null);
      setPassword("");
      setCode("");
      setCopied(false);
      setMessage("Two-factor authentication is now protecting this administrator account.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify that code.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.disableTotp(password, code);
      setToken(result.access_token);
      setEnabled(false);
      setPassword("");
      setCode("");
      setMessage("Two-factor authentication is disabled. You can enroll again at any time.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disable two-factor authentication.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setError(null);
    } catch {
      setCopied(false);
      setError("Could not copy the setup key. Select it and copy it manually.");
    }
  }

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "overflow-hidden rounded-[7px] border shadow-[0_18px_50px_rgba(22,24,28,0.05)]",
          enabled ? "border-ok-bd bg-ok-soft/45" : "border-border bg-surface",
        )}
      >
        <div className="flex flex-col justify-between gap-5 px-6 py-6 md:flex-row md:items-center md:px-7">
          <div className="flex items-start gap-4">
            <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-[5px] border", enabled ? "border-ok-bd bg-surface text-ok" : "border-border bg-bg text-fg-faint")}>
              {enabled ? <ShieldCheck className="h-5 w-5" aria-hidden /> : <ShieldOff className="h-5 w-5" aria-hidden />}
            </span>
            <div>
              <span className={cn(LABEL, enabled ? "text-ok" : "text-fg-faint")}>security status</span>
              <h2 className="font-display mt-1.5 text-[22px] font-[650] tracking-[-0.045em] text-fg">{enabled ? "Two-factor protection is active" : "Two-factor protection is off"}</h2>
              <p className="mt-2 max-w-[62ch] text-[13px] leading-5 text-fg-muted">{enabled ? "Password sign-in now requires a rotating code from your authenticator app." : "Add a rotating authenticator code so a stolen password alone cannot open the admin panel."}</p>
            </div>
          </div>
          <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em]", enabled ? "border-ok-bd bg-surface text-ok" : "border-warn-bd bg-warn-soft text-warn")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", enabled ? "bg-ok" : "bg-warn")} aria-hidden />
            {enabled ? "enabled" : "action recommended"}
          </span>
        </div>
      </section>

      {!enabled ? (
        <>
          <ol className="grid overflow-hidden rounded-[6px] border border-border bg-surface md:grid-cols-3" aria-label="Two-factor setup progress">
            <SetupStep number="01" label="Confirm identity" state={enrolling ? "complete" : "active"} />
            <SetupStep number="02" label="Add authenticator" state={verificationReady ? "complete" : enrolling ? "active" : "pending"} />
            <SetupStep number="03" label="Verify code" state={verificationReady ? "active" : "pending"} />
          </ol>

          {!enrolling ? (
            <section className="grid overflow-hidden rounded-[7px] border border-border bg-surface shadow-[0_18px_50px_rgba(22,24,28,0.045)] lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="px-6 py-7 md:px-8 md:py-8">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-[4px] border border-accent-bd bg-accent-soft text-accent"><LockKeyhole className="h-4 w-4" aria-hidden /></span>
                  <div><span className={cn(LABEL, "text-accent")}>step 01</span><h2 className="font-display mt-1 text-[21px] font-[650] tracking-[-0.04em] text-fg">Confirm your password</h2></div>
                </div>
                <p className="mt-5 max-w-[60ch] text-[13px] leading-6 text-fg-muted">Re-enter the current administrator password before CodeForge creates a new authenticator secret.</p>
                <label htmlFor="totp-current-password" className={cn(LABEL, "mt-6 block text-fg-faint")}>current password</label>
                <Input id="totp-current-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter current password" className="mt-2 h-12 max-w-xl rounded-[3px] bg-bg" />
                <Button onClick={startSetup} disabled={busy || !password} className="mt-4 h-11 gap-2 rounded-[3px] px-5">
                  {busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
                  {busy ? "Creating setup…" : "Continue securely"}
                </Button>
              </div>
              <aside className="border-t border-rule bg-bg px-6 py-7 lg:border-l lg:border-t-0">
                <span className={cn(LABEL, "text-fg-faint")}>before you begin</span>
                <ul className="mt-4 space-y-4 text-[12px] leading-5 text-fg-muted">
                  <SecurityNote text="Use Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app." />
                  <SecurityNote text="The setup key is shown only while enrollment is in progress." />
                  <SecurityNote text="Your password is verified by the backend and is never displayed here." />
                </ul>
              </aside>
            </section>
          ) : (
            <>
              <section className="rounded-[7px] border border-border bg-surface px-6 py-7 shadow-[0_18px_50px_rgba(22,24,28,0.045)] md:px-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <span className={cn(LABEL, "text-accent")}>step 02 · choose one option</span>
                    <h2 className="font-display mt-2 text-[22px] font-[650] tracking-[-0.045em] text-fg">Add CodeForge to your authenticator</h2>
                    <p className="mt-2 text-[13px] leading-5 text-fg-muted">Both options configure the same protected account: {accountEmail}</p>
                  </div>
                  <Button variant="ghost" onClick={startSetup} disabled={busy || !password} className="h-9 gap-2 rounded-[3px] text-fg-muted"><RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} aria-hidden />Generate new key</Button>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <div className="rounded-[6px] border border-accent-bd bg-accent-soft/55 p-5 md:p-6">
                    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-[4px] border border-accent-bd bg-surface text-accent"><QrCode className="h-4 w-4" aria-hidden /></span><div><span className={cn(LABEL, "text-accent")}>option A</span><h3 className="mt-1 text-[14px] font-[700] text-fg">Scan QR code</h3></div></div>
                    <p className="mt-4 text-[12px] leading-5 text-fg-muted">In Google Authenticator, tap <strong>+</strong>, choose <strong>Scan a QR code</strong>, then point the camera here.</p>
                    <div role="img" aria-label="CodeForge administrator two-factor setup QR code" className="mx-auto mt-5 w-fit rounded-[8px] border border-border bg-white p-4 shadow-sm"><QRCodeSVG value={uri!} size={210} level="M" marginSize={1} aria-hidden /></div>
                  </div>

                  <div className="rounded-[6px] border border-border bg-bg p-5 md:p-6">
                    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-[4px] border border-border bg-surface text-accent"><KeyRound className="h-4 w-4" aria-hidden /></span><div><span className={cn(LABEL, "text-fg-faint")}>option B</span><h3 className="mt-1 text-[14px] font-[700] text-fg">Enter setup key</h3></div></div>
                    <p className="mt-4 text-[12px] leading-5 text-fg-muted">Choose <strong>Enter a setup key</strong>, use account name <strong>CodeForge</strong>, and select <strong>Time based</strong>.</p>
                    <div className="mt-5 rounded-[4px] border border-border bg-surface p-4"><span className={cn(LABEL, "text-fg-faint")}>setup key</span><code className="mt-2 block break-all font-mono text-[15px] font-[700] leading-7 tracking-[0.12em] text-fg">{secret}</code></div>
                    <Button type="button" variant="outline" onClick={copySecret} className="mt-3 h-10 gap-2 rounded-[3px]">{copied ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? "Setup key copied" : "Copy setup key"}</Button>
                  </div>
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-[4px] border border-warn-bd bg-warn-soft px-4 py-3 text-[12px] leading-5 text-fg-muted"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />Treat the QR code and setup key like a password. Do not share or save them in screenshots.</div>
              </section>

              <section className="rounded-[7px] border border-border bg-surface px-6 py-7 shadow-[0_18px_50px_rgba(22,24,28,0.045)] md:px-8">
                <span className={cn(LABEL, "text-accent")}>step 03</span>
                <div className="mt-2 flex items-start gap-3"><Smartphone className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden /><div><h2 className="font-display text-[22px] font-[650] tracking-[-0.045em] text-fg">Verify the first code</h2><p id="totp-code-help" className="mt-2 text-[13px] leading-5 text-fg-muted">Enter the current six-digit code shown for CodeForge. Codes refresh every 30 seconds.</p></div></div>
                <label htmlFor="totp-verification-code" className={cn(LABEL, "mt-6 block text-fg-faint")}>six-digit authenticator code</label>
                <Input id="totp-verification-code" inputMode="numeric" autoComplete="one-time-code" aria-describedby="totp-code-help" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="mt-2 h-14 max-w-xs rounded-[3px] bg-bg text-center font-mono text-[22px] font-[700] tracking-[0.35em]" />
                <Button onClick={verify} disabled={busy || code.length !== 6} className="mt-4 h-11 gap-2 rounded-[3px] px-5"><ShieldCheck className="h-4 w-4" aria-hidden />{busy ? "Verifying…" : "Verify and enable 2FA"}</Button>
              </section>
            </>
          )}
        </>
      ) : (
        <section className="rounded-[7px] border border-danger-bd bg-surface shadow-[0_18px_50px_rgba(22,24,28,0.045)]">
          <div className="border-b border-danger-bd bg-danger-soft/45 px-6 py-5 md:px-8"><span className={cn(LABEL, "text-danger")}>sensitive action</span><h2 className="font-display mt-2 text-[21px] font-[650] tracking-[-0.04em] text-fg">Disable two-factor authentication</h2><p className="mt-2 max-w-[70ch] text-[12.5px] leading-5 text-fg-muted">This removes the second sign-in check. Confirm with both your password and a current authenticator code.</p></div>
          <div className="grid gap-4 px-6 py-6 md:grid-cols-2 md:px-8">
            <div><label htmlFor="totp-disable-password" className={cn(LABEL, "text-fg-faint")}>current password</label><Input id="totp-disable-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter current password" className="mt-2 h-11 rounded-[3px] bg-bg" /></div>
            <div><label htmlFor="totp-disable-code" className={cn(LABEL, "text-fg-faint")}>authenticator code</label><Input id="totp-disable-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="mt-2 h-11 rounded-[3px] bg-bg font-mono tracking-[0.2em]" /></div>
            <Button variant="outline" onClick={disable} disabled={busy || !password || code.length !== 6} className="h-11 gap-2 rounded-[3px] border-danger-bd text-danger md:col-span-2 md:w-fit"><ShieldOff className="h-4 w-4" aria-hidden />{busy ? "Disabling…" : "Disable 2FA"}</Button>
          </div>
        </section>
      )}

      {error ? <p role="alert" className="rounded-[4px] border border-danger-bd bg-danger-soft px-4 py-3 text-[12.5px] text-danger">{error}</p> : null}
      {message ? <p role="status" className="flex items-center gap-2 rounded-[4px] border border-ok-bd bg-ok-soft px-4 py-3 text-[12.5px] text-ok"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />{message}</p> : null}
    </div>
  );
}

function SetupStep({ number, label, state }: { number: string; label: string; state: "complete" | "active" | "pending" }) {
  return <li className="flex items-center gap-3 border-b border-rule px-5 py-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><span className={cn("grid h-8 w-8 place-items-center rounded-full border font-mono text-[10px] font-[700]", state === "complete" ? "border-ok-bd bg-ok-soft text-ok" : state === "active" ? "border-accent-bd bg-accent-soft text-accent" : "border-border bg-bg text-fg-faint")}>{state === "complete" ? <Check className="h-3.5 w-3.5" aria-hidden /> : number}</span><div><span className={cn(LABEL, state === "active" ? "text-accent" : state === "complete" ? "text-ok" : "text-fg-faint")}>{state}</span><p className="mt-0.5 text-[12px] font-[650] text-fg">{label}</p></div></li>;
}

function SecurityNote({ text }: { text: string }) {
  return <li className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden /><span>{text}</span></li>;
}

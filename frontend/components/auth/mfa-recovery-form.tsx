"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { AuthEntryShell } from "./auth-entry-shell";
import { VerificationCode } from "./verification-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/api";

export function MfaRecoveryForm({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ setup_token: string; secret: string; provisioning_uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (!token) { await api.requestMfaRecovery(email); setRequested(true); }
      else if (!setup) {
        setSetup(await api.verifyMfaRecovery(token, password, recovery));
        setPassword(""); setRecovery("");
      } else {
        const result = await api.completeMfaRecovery(setup.setup_token, code);
        setCodes(result.codes); setSetup(null); setCode("");
      }
    } catch (err) { setError(err instanceof ApiError && err.status === 401 ? "The link or verification details are invalid, expired, or already used. Check your details or request a new recovery link." : err instanceof ApiError ? err.message : "Recovery is unavailable. Please try again."); }
    finally { setBusy(false); }
  }

  return <AuthEntryShell label="Recover two-factor access" proof="recovery" compact>
    <p className="cf-auth-eyebrow">Account recovery</p>
    <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">{codes ? "Your authenticator is ready" : requested ? "Request received" : setup ? "Connect your new authenticator" : "Lost your authenticator?"}</h1>
    {codes ? <>
      <p className="mt-4 text-fg-muted">Save these new recovery codes somewhere safe. Each works once. Old codes and sessions no longer work. When signing in, wait for the next code from your new authenticator.</p>
      <pre className="mt-5 overflow-x-auto rounded-2xl border border-border bg-surface-2 p-4 text-xs" aria-label="New recovery codes">{codes.join("\n")}</pre>
      <Button className="mt-5" onClick={() => { const url = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "codeforge-recovery-codes.txt"; a.click(); URL.revokeObjectURL(url); }}>Download recovery codes</Button>
      <Link href="/login" className="mt-5 block underline">I saved my codes — sign in</Link>
    </> : requested ? <p role="status" className="mt-4 text-fg-muted">If this account is eligible, an administrator will review your request. After approval, check your registered email for a link that lasts 15 minutes. Support will never ask you to send your password or recovery codes.</p> : <>
      <p className="mt-4 text-sm leading-6 text-fg-muted">{setup ? "Scan the QR code or enter the setup key in your authenticator. Then enter a code from the new app. Keep this page open until you finish." : token ? "Enter your password and one unused recovery code. This link only allows authenticator recovery; it does not sign you in." : "Request an administrator review. You will need access to your registered email, your password, and an unused recovery code."}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {!token ? <div><Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-12" /></div> : !setup ? <>
          <div><Label htmlFor="recovery-password">Password</Label><Input id="recovery-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12" /></div>
          <div><Label htmlFor="recovery-backup">Unused recovery code</Label><Input id="recovery-backup" autoComplete="off" required value={recovery} onChange={e => setRecovery(e.target.value)} className="mt-2 h-12 font-mono" /></div>
        </> : <>
          <div className="mx-auto rounded-2xl bg-white p-5"><QRCodeSVG value={setup.provisioning_uri} size={176} /></div>
          <p className="text-xs text-fg-muted">Manual setup key</p><code className="break-all rounded-xl bg-surface-2 p-3 text-sm">{setup.secret}</code>
          <Label htmlFor="new-authenticator-code">New authenticator code</Label><VerificationCode id="new-authenticator-code" value={code} onChange={setCode} disabled={busy} />
        </>}
        {error && <><Notice>{error}</Notice>{token && !setup && <Link href="/recover-2fa" className="text-sm underline">Request a new recovery link</Link>}</>}
        <Button type="submit" disabled={busy || Boolean(setup && code.length !== 6)} className="mt-2 h-12 rounded-full">{busy ? "Please wait…" : !token ? "Request recovery review" : setup ? "Confirm new authenticator" : "Verify recovery details"}</Button>
      </form>
    </>}
    {!codes && <Link href="/login" className="mt-6 block text-sm underline">Back to sign in</Link>}
  </AuthEntryShell>;
}

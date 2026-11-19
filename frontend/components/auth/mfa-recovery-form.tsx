"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { AuthEntryShell } from "./auth-entry-shell";
import { VerificationCode } from "./verification-code";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/api";

export function MfaRecoveryForm({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ setup_token: string; secret: string; provisioning_uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true); setError("");
    try {
      if (!setup) {
        setSetup(await api.verifyMfaRecovery(token, password, recovery));
        setPassword(""); setRecovery("");
      } else {
        const result = await api.completeMfaRecovery(setup.setup_token, code);
        setCodes(result.codes); setSetup(null); setCode("");
      }
    } catch (err) { setError(err instanceof ApiError && err.status === 401 ? "The link or verification details are invalid, expired, or already used. Check your details or request a new recovery link." : err instanceof ApiError ? err.message : "Recovery is unavailable. Please try again."); }
    finally { setBusy(false); }
  }

  if (!token) return <AuthEntryShell label="Recovery support" proof="recovery" compact>
    <p className="cf-auth-eyebrow">Account support</p>
    <h1 className="mt-4 font-display text-[34px] leading-[1.12] text-fg sm:text-[40px]">Contact us about your authenticator</h1>
    <p className="mt-4 text-sm leading-6 text-fg-muted">First contact our team using the Contact page or email codeforge.sdlc@gmail.com. If you cannot sign in to use the Contact form, email us directly. Include your registered email and explain what happened. Never send your password or recovery codes.</p>
    <div className="mt-6 flex flex-wrap gap-4"><ButtonLink href="/contact" size="lg" className="h-11 rounded-[var(--ui-radius-action)]">Open Contact page</ButtonLink><a href="mailto:codeforge.sdlc@gmail.com?subject=Authenticator%20recovery%20help" className="inline-flex items-center text-sm underline">Email recovery support</a></div>
    <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6 text-fg-muted"><li>We manually review your support message.</li><li>If appropriate, we email a private invitation to request a recovery review.</li><li>Open that invitation and submit your registered email. Your request then appears in the admin dashboard.</li><li>After final approval, use a separate recovery link with your password and an unused recovery code to connect a new authenticator.</li></ol>
    <Link href="/login" className="mt-6 block text-sm underline">Back to sign in</Link>
  </AuthEntryShell>;

  return <AuthEntryShell label="Recover two-factor access" proof="recovery" compact>
    <p className="cf-auth-eyebrow">Account recovery</p>
    <h1 className="mt-4 font-display text-[34px] leading-[1.12] text-fg sm:text-[40px]">{codes ? "Your authenticator is ready" : setup ? "Connect your new authenticator" : "Lost your authenticator?"}</h1>
    {codes ? <>
      <p className="mt-4 text-fg-muted">Save these new recovery codes somewhere safe. Each works once. Old codes and sessions no longer work. When signing in, wait for the next code from your new authenticator.</p>
      <pre className="mt-5 overflow-x-auto rounded-[var(--ui-radius-control)] border border-border bg-bg p-4 text-xs" aria-label="New recovery codes">{codes.join("\n")}</pre>
      <Button className="mt-5" onClick={() => { const url = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = "codeforge-recovery-codes.txt"; a.click(); URL.revokeObjectURL(url); }}>Download recovery codes</Button>
      <Link href="/login" className="mt-5 block underline">I saved my codes — sign in</Link>
    </> : <>
      <p className="mt-4 text-sm leading-6 text-fg-muted">{setup ? "Scan the QR code or enter the setup key in your authenticator. Then enter a code from the new app. Keep this page open until you finish." : "Enter your password and one unused recovery code. This link only allows authenticator recovery; it does not sign you in."}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {!setup ? <>
          <div><Label htmlFor="recovery-password">Password</Label><Input id="recovery-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12" /></div>
          <div><Label htmlFor="recovery-backup">Unused recovery code</Label><Input id="recovery-backup" autoComplete="off" required value={recovery} onChange={e => setRecovery(e.target.value)} className="mt-2 h-12 font-mono" /></div>
        </> : <>
          <div className="mx-auto rounded-[var(--ui-radius-control)] border border-border bg-white p-5"><QRCodeSVG value={setup.provisioning_uri} size={176} /></div>
          <p className="text-xs text-fg-muted">Manual setup key</p><code className="break-all rounded-[var(--ui-radius-control)] border border-border bg-bg p-3 text-sm">{setup.secret}</code>
          <Label htmlFor="new-authenticator-code">New authenticator code</Label><VerificationCode id="new-authenticator-code" value={code} onChange={setCode} disabled={busy} />
        </>}
        {error && <><Notice>{error}</Notice>{token && !setup && <Link href="/recover-2fa" className="text-sm underline">Contact recovery support</Link>}</>}
        <Button type="submit" disabled={busy || Boolean(setup && code.length !== 6)} className="mt-2 h-11 rounded-[var(--ui-radius-action)]">{busy ? "Please wait…" : setup ? "Confirm new authenticator" : "Verify recovery details"}</Button>
      </form>
    </>}
    {!codes && <Link href="/login" className="mt-6 block text-sm underline">Back to sign in</Link>}
  </AuthEntryShell>;
}


export function RecoveryReviewRequest({ inviteToken }: { inviteToken: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try { await api.requestMfaRecovery(email, inviteToken); setSent(true); setEmail(""); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not submit the request. Try again."); }
    finally { setBusy(false); }
  }
  return <AuthEntryShell label="Request recovery review" proof="recovery" compact>
    <p className="cf-auth-eyebrow">Support invitation</p>
    <h1 className="mt-4 font-display text-[34px] leading-[1.12] text-fg sm:text-[40px]">{sent ? "Request received" : "Request a recovery review"}</h1>
    {sent ? <p role="status" className="mt-4 text-sm leading-6 text-fg-muted">If your email matches an active invitation, your request has been submitted to the admin dashboard. After review, we will email the recovery link to your registered address.</p> : <>
      <p className="mt-4 text-sm leading-6 text-fg-muted">Our team has reviewed your support message. Enter the registered email that received this invitation to submit your request. Invitations expire after 24 hours and work once.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Label htmlFor="review-request-email">Registered email</Label><Input id="review-request-email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={e => setEmail(e.target.value)} className="h-12" />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" disabled={busy} className="h-11 rounded-[var(--ui-radius-action)]">{busy ? "Submitting…" : "Submit recovery review request"}</Button>
      </form>
    </>}
    <Link href="/recover-2fa" className="mt-6 block text-sm underline">Need help? Contact support</Link>
  </AuthEntryShell>;
}

"use client";

import { useEffect, useState } from "react";
import { AdminShell, AdminPageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/api";

export default function RecoveryQueue() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteReason, setInviteReason] = useState("");
  const [items, setItems] = useState<{ id: string; email: string; created_at: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    try { setItems((await api.adminMfaRecovery()).items); }
    catch (err) { setNotice(err instanceof ApiError ? err.message : "Could not load requests."); }
  }
  useEffect(() => { void load(); }, []);
  async function review(approve: boolean) {
    if (!selected || busy) return;
    setBusy(true); setNotice("");
    try { const result = await api.reviewMfaRecovery(selected, approve, password, reason); setNotice(result.message); setSelected(null); setPassword(""); setReason(""); await load(); }
    catch (err) { setNotice(err instanceof ApiError ? err.message : "Review failed. Try again."); }
    finally { setBusy(false); }
  }
  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice("");
    try { const result = await api.inviteMfaRecovery(inviteEmail, invitePassword, inviteReason); setNotice(result.message); setInviteEmail(""); setInvitePassword(""); setInviteReason(""); }
    catch (err) { setNotice(err instanceof ApiError ? err.message : "Could not send the invitation."); }
    finally { setBusy(false); }
  }
  return <AdminShell><AdminPageHeader eyebrow="Account security" title="Recovery requests" description="First review the user’s Contact message or email to codeforge.sdlc@gmail.com. Send a private review invitation below. Submitted invitations appear in the queue for final approval." />
    {notice && <Notice className="mt-5">{notice}</Notice>}
    <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">Step 1 · Support reviewed</p>
      <h2 className="mt-2 text-xl font-semibold">Send a review invitation</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">Use this after manually checking the support issue. The invitation goes to the account’s registered email and does not appear as a pending request until the user submits their email through it.</p>
      <form onSubmit={invite} className="mt-5 grid max-w-xl gap-3">
        <Label htmlFor="invite-email">User’s registered email</Label><Input id="invite-email" type="email" autoComplete="off" required disabled={busy} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
        <Label htmlFor="invite-reason">Support review notes</Label><Input id="invite-reason" minLength={3} maxLength={240} required disabled={busy} value={inviteReason} onChange={e => setInviteReason(e.target.value)} />
        <Label htmlFor="invite-password">Confirm admin password</Label><Input id="invite-password" type="password" autoComplete="current-password" required disabled={busy} value={invitePassword} onChange={e => setInvitePassword(e.target.value)} />
        <Button type="submit" disabled={busy || !inviteEmail || !invitePassword || inviteReason.trim().length < 3} className="mt-2 w-fit">Send review invitation</Button>
      </form>
    </section>
    <h2 className="mt-8 text-xl font-semibold">Step 2 · User-submitted requests</h2>
    <p className="mt-2 text-sm text-fg-muted">Final approval emails a separate 15-minute recovery link. The user must then verify their password and an unused recovery code.</p>
    <Button variant="outline" className="mt-5" onClick={load} disabled={busy}>Refresh requests</Button>
    <div className="mt-5 space-y-4">{items.length === 0 ? <p role="status" className="text-fg-muted">No pending recovery requests.</p> : items.map(item => <section key={item.id} className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="break-all font-semibold">{item.email}</h2><p className="mt-1 text-sm text-fg-muted">Requested {new Date(item.created_at).toLocaleString()}</p>
      {selected !== item.id ? <Button className="mt-4" variant="outline" onClick={() => { setSelected(item.id); setPassword(""); setReason(""); }}>Review request</Button> : <div className="mt-5 grid max-w-lg gap-3">
        <Label htmlFor="review-reason">Review reason</Label><Input id="review-reason" value={reason} maxLength={240} onChange={e => setReason(e.target.value)} />
        <Label htmlFor="review-password">Your admin password</Label><Input id="review-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        <p className="text-xs text-fg-muted">Never ask for the user’s password or recovery code. You cannot approve your own request.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || !password || reason.trim().length < 3} onClick={() => review(true)}>Approve &amp; send recovery link</Button><Button variant="outline" disabled={busy || !password || reason.trim().length < 3} onClick={() => review(false)}>Reject request</Button><Button variant="ghost" disabled={busy} onClick={() => { setSelected(null); setPassword(""); }}>Cancel</Button></div>
      </div>}
    </section>)}</div>
  </AdminShell>;
}

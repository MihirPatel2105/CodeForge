"use client";

import { useEffect, useState } from "react";
import { AdminShell, AdminPageHeader } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/api";

export default function RecoveryQueue() {
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
  return <AdminShell><AdminPageHeader eyebrow="Account security" title="Recovery requests" description="Review lost-authenticator requests. Approval sends a limited recovery link to the existing registered address. The user must still prove their password and an unused recovery code." />
    {notice && <Notice className="mt-5">{notice}</Notice>}
    <Button variant="outline" className="mt-5" onClick={load} disabled={busy}>Refresh requests</Button>
    <div className="mt-5 space-y-4">{items.length === 0 ? <p role="status" className="text-fg-muted">No pending recovery requests.</p> : items.map(item => <section key={item.id} className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="break-all font-semibold">{item.email}</h2><p className="mt-1 text-sm text-fg-muted">Requested {new Date(item.created_at).toLocaleString()}</p>
      {selected !== item.id ? <Button className="mt-4" variant="outline" onClick={() => { setSelected(item.id); setPassword(""); setReason(""); }}>Review request</Button> : <div className="mt-5 grid max-w-lg gap-3">
        <Label htmlFor="review-reason">Review reason</Label><Input id="review-reason" value={reason} maxLength={240} onChange={e => setReason(e.target.value)} />
        <Label htmlFor="review-password">Your admin password</Label><Input id="review-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        <p className="text-xs text-fg-muted">Never ask for the user’s password or recovery code. You cannot approve your own request.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || !password || reason.trim().length < 3} onClick={() => review(true)}>Approve &amp; send link</Button><Button variant="outline" disabled={busy || !password || reason.trim().length < 3} onClick={() => review(false)}>Reject request</Button><Button variant="ghost" disabled={busy} onClick={() => { setSelected(null); setPassword(""); }}>Cancel</Button></div>
      </div>}
    </section>)}</div>
  </AdminShell>;
}

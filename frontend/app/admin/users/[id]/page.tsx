"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Ban, FolderKanban, Gauge, KeyRound, RefreshCw, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { ADMIN_LABEL, AdminPageHeader, AdminSectionHeading, AdminShell } from "@/components/admin/admin-shell";
import { AdminRunTable } from "@/components/admin/run-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, getToken } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import { DELETE_CONFIRMATION, type AdminUserDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [reason, setReason] = useState("");
  const [showAction, setShowAction] = useState<"revoke" | "suspend" | "restore" | "verify" | "delete" | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [projectLimit, setProjectLimit] = useState("");
  const [runLimit, setRunLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setDetail(await api.adminUser(id)); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.replace("/login");
      if (err instanceof ApiError && err.status === 403) return router.replace("/projects");
      setError(err instanceof ApiError ? err.message : "Could not load this user.");
    }
  }, [id, router]);
  useEffect(() => { if (!getToken()) return router.replace("/login"); void load(); }, [load, router]);

  const runAction = async () => {
    if (!showAction || reason.trim().length < 3) return setError("Add a short reason before continuing.");
    if (showAction === "delete" && !adminPassword) return setError("Enter your administrator password.");
    if (showAction === "delete" && deleteConfirmation.trim() !== DELETE_CONFIRMATION) return setError(`Type ${DELETE_CONFIRMATION} exactly to confirm deletion.`);
    setBusy(true); setError(null); setNotice(null);
    try {
      if (showAction === "delete") {
        await api.adminDeleteUser(id, adminPassword, deleteConfirmation.trim(), reason.trim());
        router.replace("/admin/users");
        return;
      }
      const method = showAction === "revoke" ? api.adminRevokeUserSessions : showAction === "suspend" ? api.adminSuspendUser : showAction === "restore" ? api.adminRestoreUser : api.adminVerifyUserEmail;
      const result = await method(id, reason.trim()); setNotice(result.message); setReason(""); setShowAction(null); await load();
    }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not complete this action."); }
    finally { setBusy(false); }
  };

  const saveLimits = async () => {
    if (reason.trim().length < 3) return setError("Add a short reason before changing limits.");
    setBusy(true); setError(null);
    try { const result = await api.adminSetUserLimits(id, projectLimit ? Number(projectLimit) : null, runLimit ? Number(runLimit) : null, reason.trim()); setNotice(result.message); setReason(""); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not update limits."); }
    finally { setBusy(false); }
  };

  if (!detail) return <AdminShell><Link href="/admin/users" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-muted"><ArrowLeft className="h-4 w-4" aria-hidden />Users</Link>{error ? <p role="alert" className="mt-6 text-[13px] text-danger">{error}</p> : <div className="flex min-h-[55vh] items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-accent" aria-label="Loading user" /></div>}</AdminShell>;
  const { user } = detail;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed user";

  return (
    <AdminShell>
      <Link href="/admin/users" className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.1em] text-fg-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden />Back to users</Link>
      <AdminPageHeader eyebrow={user.is_admin ? "administrator account" : user.is_suspended ? "suspended account" : "user account"} title={displayName} description={user.email} actions={!user.is_admin ? <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-10 gap-2 rounded-lg" onClick={() => setShowAction("revoke")}><KeyRound className="h-4 w-4" aria-hidden />Revoke sessions</Button>{!user.email_verified ? <Button variant="outline" className="h-10 gap-2 rounded-lg text-ok" onClick={() => setShowAction("verify")}><BadgeCheck className="h-4 w-4" aria-hidden />Verify email</Button> : null}<Button variant="outline" className="h-10 gap-2 rounded-lg border-danger-bd text-danger" onClick={() => setShowAction(user.is_suspended ? "restore" : "suspend")}>{user.is_suspended ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}{user.is_suspended ? "Restore account" : "Suspend account"}</Button><Button variant="outline" className="h-10 gap-2 rounded-lg border-danger-bd bg-danger-soft text-danger hover:bg-danger hover:text-white" onClick={() => setShowAction("delete")}><Trash2 className="h-4 w-4" aria-hidden />Delete user</Button></div> : undefined} />
      {error ? <p role="alert" className="mt-6 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}
      {notice ? <p role="status" className="mt-6 rounded-lg border border-ok-bd bg-ok-soft px-4 py-3 text-[13px] text-ok">{notice}</p> : null}
      {showAction ? <section className="mt-6 rounded-xl border border-danger-bd bg-danger-soft p-5" aria-labelledby="user-action-heading"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden /><div className="flex-1"><h2 id="user-action-heading" className="text-[14px] font-[700] capitalize text-fg">{showAction} user account</h2><p className="mt-1 text-[12px] leading-5 text-fg-muted">{showAction === "delete" ? `This permanently removes ${user.email}, every project, run, and generated artifact. This cannot be undone.` : "This sensitive action requires a reason and is written to the audit log."}</p><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for this action" className="mt-4 h-10 rounded-lg bg-surface" maxLength={240} />{showAction === "delete" ? <div className="mt-3 grid gap-3 md:grid-cols-2"><Input type="password" autoComplete="current-password" aria-label="Administrator password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Administrator password" className="h-10 rounded-lg bg-surface" /><Input autoComplete="off" aria-label={`Type ${DELETE_CONFIRMATION} to confirm`} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={`Type ${DELETE_CONFIRMATION} to confirm`} className="h-10 rounded-lg bg-surface font-mono" /></div> : null}<div className="mt-3 flex gap-2"><Button className="h-9 rounded-lg bg-danger text-white hover:bg-danger/90" disabled={busy || (showAction === "delete" && (!adminPassword || deleteConfirmation.trim() !== DELETE_CONFIRMATION))} onClick={runAction}>{busy ? "Working…" : showAction === "delete" ? "Permanently delete user" : "Confirm action"}</Button><Button variant="ghost" className="h-9 rounded-lg" disabled={busy} onClick={() => setShowAction(null)}>Cancel</Button></div></div></div></section> : null}

      <dl className="mt-7 grid overflow-hidden rounded-xl border border-border bg-surface sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Projects", value: user.project_count }, { label: "Runs", value: user.run_count }, { label: "Succeeded", value: user.succeeded_runs }, { label: "Joined", value: formatWhen(user.created_at) }].map(({ label, value }, index) => <div key={label} className={cn("p-5", index > 0 && "sm:border-l")}><dt className={ADMIN_LABEL}>{label}</dt><dd className="font-display mt-4 text-[21px] font-[650] tracking-[-0.04em] text-fg">{value}</dd></div>)}</dl>

      {!user.is_admin ? <section className="mt-7 rounded-xl border border-border bg-surface p-5"><div className="flex items-center gap-3"><Gauge className="h-5 w-5 text-accent" aria-hidden /><div><h2 className="text-[14px] font-[700] text-fg">Usage limits</h2><p className="text-[12px] text-fg-muted">Leave a field empty for unlimited access.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Input type="number" min="1" value={projectLimit} onChange={(event) => setProjectLimit(event.target.value)} placeholder={user.project_limit ? `Projects: ${user.project_limit}` : "Unlimited projects"} /><Input type="number" min="1" value={runLimit} onChange={(event) => setRunLimit(event.target.value)} placeholder={user.monthly_run_limit ? `Monthly runs: ${user.monthly_run_limit}` : "Unlimited monthly runs"} /><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for limit change" /></div><Button className="mt-3" disabled={busy} onClick={saveLimits}>Save limits</Button></section> : null}

      <section className="pt-10" aria-labelledby="projects-heading"><AdminSectionHeading eyebrow="01 / ownership" title="Projects" id="projects-heading" /><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detail.projects.map((project) => <div key={project.id} className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><FolderKanban className="h-4 w-4 text-accent" aria-hidden /><span className={ADMIN_LABEL}>{project.run_count} runs</span></div><h3 className="mt-4 text-[14px] font-[700] text-fg">{project.name}</h3><p className="mt-2 line-clamp-2 text-[12px] leading-5 text-fg-muted">{project.description || "No description"}</p></div>)}{detail.projects.length === 0 ? <p className="text-[13px] text-fg-faint">No projects yet.</p> : null}</div></section>
      <section className="pt-10" aria-labelledby="runs-heading"><AdminSectionHeading eyebrow="02 / activity" title="Recent runs" id="runs-heading" /><div className="mt-5"><AdminRunTable runs={detail.recent_runs} /></div></section>
    </AdminShell>
  );
}

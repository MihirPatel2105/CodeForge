"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  KeyRound,
  Laptop,
  LayoutDashboard,
  LogOut,
  ServerCog,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/dashboard/app-header";
import { DeleteAccountDialog } from "@/components/auth/delete-account-dialog";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { useSession } from "@/lib/use-current-user";
import { api, getToken, clearToken, ApiError } from "@/lib/api";

const LABEL =
  "font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-fg-faint";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [endingSessions, setEndingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    }
  }, [router]);

  async function handleSignOut() {
    setEndingSessions(true);
    setSessionError(null);
    try {
      await api.signOut();
      clearToken();
      router.replace("/login");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setSessionError("Couldn't reach the server, so you are still signed in. Try again.");
      setEndingSessions(false);
    }
  }

  async function handleSignOutEverywhere() {
    setEndingSessions(true);
    setSessionError(null);
    try {
      await api.signOutEverywhere();
      clearToken();
      router.replace("/login");
    } catch (err) {
      setSessionError(
        err instanceof ApiError
          ? err.message || "Couldn't end your sessions. Try again."
          : "Couldn't reach the server. Your sessions are unchanged.",
      );
      setEndingSessions(false);
    }
  }

  return (
    <div className="cf-account min-h-screen bg-bg">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1320px] px-6 py-10 md:px-10 md:py-14 lg:px-14">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-fg-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to profile
        </Link>

        <section className="cf-account-hero relative mt-5 overflow-hidden rounded-[7px] border border-border bg-surface px-7 py-8 shadow-[0_24px_70px_rgba(22,24,28,0.07)] md:px-10 md:py-10">
          <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {user?.is_admin ? "administrator security" : "account security"}
              </span>
              <h1 className="font-display mt-6 text-[32px] font-[650] leading-none tracking-[-0.055em] text-fg md:text-[42px]">
                {user?.is_admin ? "Admin settings" : "Settings"}
              </h1>
              <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.65] text-fg-muted">
                {user?.is_admin
                  ? "Protect the platform operator account, control its sessions, and review administrator access."
                  : "Update your password, control signed-in sessions, and manage the permanent state of your account."}
              </p>
            </div>

            <div className="rounded-[5px] border border-border bg-bg/75 px-4 py-3 backdrop-blur-sm">
              <span className={LABEL}>signed in as</span>
              <p className="mt-1.5 max-w-[28rem] truncate font-mono text-[11.5px] text-fg">
                {user?.email ?? "Loading account…"}
              </p>
            </div>
          </div>
        </section>

        {user?.is_admin ? (
          <section className="mt-6 overflow-hidden rounded-[6px] border border-accent-bd bg-accent-soft/55 shadow-[0_16px_45px_rgba(73,67,214,0.05)]">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex items-start gap-4 px-6 py-6 md:px-7">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border border-accent-bd bg-surface">
                  <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
                </span>
                <div>
                  <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-accent">
                    operator access
                  </span>
                  <h2 className="font-display mt-1.5 text-[20px] font-[650] tracking-[-0.04em] text-fg">
                    Platform administrator
                  </h2>
                  <p className="mt-2 max-w-[66ch] text-[13px] leading-[1.6] text-fg-muted">
                    This account is authorized by the server&apos;s admin email allowlist. Admin API access still requires a valid signed-in session.
                  </p>
                </div>
              </div>
              <div className="border-t border-accent-bd p-3 lg:border-l lg:border-t-0">
                <AdminSettingLink href="/admin" icon={LayoutDashboard} label="Control centre" />
                <AdminSettingLink href="/admin/system" icon={ServerCog} label="System health" />
                <AdminSettingLink href="/admin/audit" icon={ClipboardList} label="Audit log" />
                <AdminSettingLink href="/admin/security/2fa" icon={ShieldCheck} label={`Two-factor authentication · ${user.totp_enabled ? "On" : "Off"}`} />
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <section className="rounded-[6px] border border-border bg-surface shadow-[0_16px_45px_rgba(22,24,28,0.045)]">
            <div className="flex items-start gap-4 border-b border-rule px-6 py-5 md:px-7">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border border-border bg-bg">
                <KeyRound className="h-4 w-4 text-accent" aria-hidden />
              </span>
              <div>
                <span className={LABEL}>password</span>
                <h2 className="font-display mt-1.5 text-[21px] font-[650] tracking-[-0.04em] text-fg">
                  Change your password
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-fg-muted">
                  Your current password is required before a new one can be saved.
                </p>
              </div>
            </div>
            <div className="px-6 pb-7 md:px-7">
              <ChangePasswordForm />
            </div>
          </section>

          <section className="rounded-[6px] border border-border bg-surface shadow-[0_16px_45px_rgba(22,24,28,0.045)]">
            <div className="flex items-start gap-4 border-b border-rule px-6 py-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border border-border bg-bg">
                <Laptop className="h-4 w-4 text-accent" aria-hidden />
              </span>
              <div>
                <span className={LABEL}>session control</span>
                <h2 className="font-display mt-1.5 text-[21px] font-[650] tracking-[-0.04em] text-fg">
                  Active sessions
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-fg-muted">
                  Choose whether to end this browser session or revoke every session.
                </p>
              </div>
            </div>

            <div className="divide-y divide-rule px-6">
              <SessionAction
                icon={LogOut}
                title="This device"
                description="Ends this server session. Other devices stay signed in."
                buttonLabel={endingSessions ? "Signing out…" : "Sign out"}
                onClick={handleSignOut}
                disabled={endingSessions}
              />
              <SessionAction
                icon={ShieldOff}
                title="Every device"
                description="Revokes every active session immediately, including this one."
                buttonLabel={endingSessions ? "Ending sessions…" : "Sign out everywhere"}
                onClick={handleSignOutEverywhere}
                disabled={endingSessions}
              />
            </div>

            {sessionError && (
              <p
                role="alert"
                className="mx-6 mb-6 rounded-[3px] border border-danger-bd bg-danger-soft px-3 py-2.5 text-[12.5px] leading-[1.5] text-danger"
              >
                {sessionError}
              </p>
            )}
          </section>
        </div>

        <section className={user?.is_admin ? "mt-6 overflow-hidden rounded-[6px] border border-accent-bd bg-accent-soft/35 shadow-[0_16px_45px_rgba(73,67,214,0.04)]" : "mt-6 overflow-hidden rounded-[6px] border border-danger-bd bg-danger-soft/35 shadow-[0_16px_45px_rgba(190,35,29,0.04)]"}>
          <div className="flex flex-col justify-between gap-6 px-6 py-6 md:flex-row md:items-center md:px-7">
            <div className="flex items-start gap-4">
              <span className={user?.is_admin ? "grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border border-accent-bd bg-surface" : "grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border border-danger-bd bg-surface"}>
                {user?.is_admin ? <ShieldCheck className="h-4 w-4 text-accent" aria-hidden /> : <Trash2 className="h-4 w-4 text-danger" aria-hidden />}
              </span>
              <div>
                <span className={user?.is_admin ? "font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-accent" : "font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-danger"}>
                  {user?.is_admin ? "protected account" : "danger zone"}
                </span>
                <h2 className="font-display mt-1.5 text-[20px] font-[650] tracking-[-0.04em] text-fg">
                  {user?.is_admin ? "Administrator deletion is disabled" : "Delete this account"}
                </h2>
                <p className="mt-2 max-w-[66ch] text-[13px] leading-[1.6] text-fg-muted">
                  {user?.is_admin
                    ? "The configured operator account cannot delete itself while it controls platform administration. Change the server allowlist first if this account must be retired."
                    : "Permanently removes every project, run, and generated file owned by this account. Nothing can be recovered afterwards."}
                </p>
              </div>
            </div>

            {user?.is_admin ? (
              <Button disabled variant="outline" className="h-11 shrink-0 rounded-[3px] border-accent-bd px-6 font-mono text-[10.5px] font-[700] uppercase tracking-[0.12em]">
                Protected
              </Button>
            ) : (
              <Button onClick={() => setConfirming(true)} disabled={!user} className="h-11 shrink-0 rounded-[3px] bg-danger px-6 font-mono text-[10.5px] font-[700] uppercase tracking-[0.12em] text-surface hover:bg-danger/90">
                Delete account
              </Button>
            )}
          </div>
        </section>
      </main>

      {confirming && user && !user.is_admin && (
        <DeleteAccountDialog email={user.email} onClose={() => setConfirming(false)} />
      )}
    </div>
  );
}

function AdminSettingLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-[12.5px] font-[650] text-fg transition-colors hover:bg-surface">
      <Icon className="h-4 w-4 text-accent" aria-hidden />
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-fg-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function SessionAction({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onClick,
  disabled,
}: {
  icon: typeof LogOut;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="py-5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" aria-hidden />
        <div>
          <h3 className="text-[13.5px] font-[650] text-fg">{title}</h3>
          <p className="mt-1 max-w-[38ch] text-[12px] leading-[1.5] text-fg-muted">
            {description}
          </p>
        </div>
      </div>
      <Button
        onClick={onClick}
        variant="outline"
        disabled={disabled}
        className="mt-4 h-10 w-full justify-center rounded-[3px] border-border-strong px-4 font-mono text-[9.5px] font-[700] uppercase tracking-[0.1em]"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

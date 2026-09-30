"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, MonitorX, ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SecuritySettingsLayout } from "@/components/auth/security-settings-layout";
import { useSession } from "@/lib/use-current-user";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) return null;

  return (
    <SecuritySettingsLayout
      current="/profile/settings/password"
      title="Change your password"
      description="Choose a new password for your account. This browser stays signed in; all other sessions are signed out."
    >
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="rounded-3xl border border-border bg-surface px-6 py-7 md:px-8">
          <span className="text-[12px] font-[650] text-accent">
            Update credentials
          </span>
          <h2 className="font-display mt-2 text-[22px] font-[650] tracking-[-0.04em] text-fg">
            Set a new password
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-fg-muted">
            Confirm your current password, then choose a different one.
          </p>
          <ChangePasswordForm />
        </section>

        <aside className="overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="border-b border-rule bg-bg px-5 py-4">
            <p className="text-[12px] font-[650] text-fg-muted">
              After you save
            </p>
          </div>
          <ul className="divide-y divide-rule px-5">
            <li className="flex gap-3 py-4">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="text-[13px] leading-5 text-fg-muted">Your new password works immediately.</span>
            </li>
            <li className="flex gap-3 py-4">
              <MonitorX className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="text-[13px] leading-5 text-fg-muted">Other signed-in browsers must sign in again.</span>
            </li>
            <li className="flex gap-3 py-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span className="text-[13px] leading-5 text-fg-muted">Your passkeys and 2FA settings stay as they are.</span>
            </li>
          </ul>
          <div className="flex items-center gap-2 border-t border-rule bg-bg px-5 py-4 text-[12px] font-[650] text-fg-muted">
            Your current session remains active
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </div>
        </aside>
      </div>
    </SecuritySettingsLayout>
  );
}

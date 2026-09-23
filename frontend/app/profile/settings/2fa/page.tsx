"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { TotpSettings } from "@/components/auth/totp-settings";
import { AppHeader } from "@/components/dashboard/app-header";
import { useSession } from "@/lib/use-current-user";

export default function SettingsTwoFactorPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!user.is_admin) router.replace("/projects");
  }, [loading, router, user]);

  if (loading || !user?.is_admin) return null;

  return (
    <div className="cf-account min-h-screen bg-bg">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1320px] px-6 py-10 md:px-10 md:py-14 lg:px-14">
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-fg-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to settings
        </Link>

        <header className="mt-5 border-b border-rule pb-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            administrator security
          </span>
          <h1 className="font-display mt-5 text-[32px] font-[650] leading-none tracking-[-0.055em] text-fg md:text-[42px]">
            Two-factor authentication
          </h1>
          <p className="mt-4 max-w-[72ch] text-[14px] leading-6 text-fg-muted">
            Require a time-based authenticator code after the administrator password. Configure it using either a QR code or a manual setup key.
          </p>
        </header>

        <div className="pt-7">
          <TotpSettings initiallyEnabled={user.totp_enabled} accountEmail={user.email} />
        </div>
      </main>
    </div>
  );
}

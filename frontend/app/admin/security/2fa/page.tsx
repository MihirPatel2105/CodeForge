"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { TotpSettings } from "@/components/auth/totp-settings";
import { useSession } from "@/lib/use-current-user";

export default function AdminTwoFactorPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!user.is_admin) router.replace("/projects");
  }, [loading, router, user]);

  if (loading || !user?.is_admin) return null;

  return (
    <AdminShell>
      <Link href="/profile/settings" className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-fg-faint transition-colors hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Account settings
      </Link>
      <AdminPageHeader
        eyebrow="administrator security"
        title="Two-factor authentication"
        description="Require a time-based authenticator code after the administrator password. Configure it by QR code or manual setup key."
      />
      <div className="pt-7">
        <TotpSettings initiallyEnabled={user.totp_enabled} accountEmail={user.email} />
      </div>
    </AdminShell>
  );
}

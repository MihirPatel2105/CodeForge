"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SecuritySettingsLayout } from "@/components/auth/security-settings-layout";
import { TotpSettings } from "@/components/auth/totp-settings";
import { useSession } from "@/lib/use-current-user";

export default function SettingsTwoFactorPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) return null;

  return (
    <SecuritySettingsLayout
      current="/profile/settings/2fa"
      title="Two-factor authentication"
      description="Add a time-based authenticator code at sign-in, including passkey sign-in. Set it up with a QR code or a manual key."
    >
      <TotpSettings initiallyEnabled={user.totp_enabled} accountEmail={user.email} />
    </SecuritySettingsLayout>
  );
}

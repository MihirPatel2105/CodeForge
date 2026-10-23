"use client";
import { useParams } from "next/navigation";
import { MfaRecoveryForm } from "@/components/auth/mfa-recovery-form";
export default function RecoveryPage() {
  const { token } = useParams<{ token: string }>();
  return <MfaRecoveryForm token={token} />;
}

"use client";
import { useParams } from "next/navigation";
import { RecoveryReviewRequest } from "@/components/auth/mfa-recovery-form";
export default function RecoveryReviewRequestPage() {
  const { token } = useParams<{ token: string }>();
  return <RecoveryReviewRequest inviteToken={token} />;
}

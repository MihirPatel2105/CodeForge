"use client";

import { useParams } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  return <ResetPasswordForm token={params.token} />;
}

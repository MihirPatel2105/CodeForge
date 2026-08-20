import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password · CodeForge",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}

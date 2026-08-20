import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in · CodeForge",
};

export default function LoginPage() {
  return <AuthForm mode="signin" />;
}

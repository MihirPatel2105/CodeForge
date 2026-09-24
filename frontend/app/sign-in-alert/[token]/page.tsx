import type { Metadata } from "next";
import { SignInAlertReview } from "@/components/auth/sign-in-alert-review";

export const metadata: Metadata = { title: "Review sign-in · CodeForge" };

export default async function SignInAlertPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SignInAlertReview token={token} />;
}

import type { Metadata } from "next";
import { RedesignPreview } from "@/components/redesign-preview/preview-app";

export const metadata: Metadata = {
  title: "CodeForge — design preview",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ screen?: string[] }> }) {
  const { screen } = await params;
  return <RedesignPreview screen={screen?.join("/") ?? "home"} />;
}

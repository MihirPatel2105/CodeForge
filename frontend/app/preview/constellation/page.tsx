import type { Metadata } from "next";
import { PremiumLanding } from "@/components/marketing/premium-landing";
import { ConstellationShell } from "./shell";

export const metadata: Metadata = { title: "Constellation preview · CodeForge", robots: { index: false, follow: false } };
export default function Page() { return <ConstellationShell><PremiumLanding /></ConstellationShell>; }

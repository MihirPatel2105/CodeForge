import type { Metadata } from "next";
import Link from "next/link";
import { PremiumLanding } from "@/components/marketing/premium-landing";
import { PreviewShell } from "./preview-shell";
import "./preview.css";

export const metadata: Metadata = {
  title: "Interactive atmosphere hero preview · CodeForge",
  robots: { index: false, follow: false },
};

export default function HeroReliefPreview() {
  return (
    <PreviewShell>
      <PremiumLanding />
      <aside className="relief-preview-note" aria-label="Design preview">
        <span>Interactive atmosphere <span className="relief-preview-separator">/</span> Preview</span>
        <Link href="/" target="_blank" rel="noopener noreferrer">Compare current ↗</Link>
      </aside>
    </PreviewShell>
  );
}

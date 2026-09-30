import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { AuthEntryProof } from "@/components/auth/auth-entry-proof";
import "./auth-entry.css";

export function AuthEntryShell({ children, label, proof = "product" }: {
  children: ReactNode;
  label: string;
  proof?: "product" | "recovery" | "security";
}) {
  return (
    <div className="pa-auth">
      <header className="pa-header">
        <Link href="/" aria-label="CodeForge home"><LogoLockup className="h-9 w-auto" /></Link>
        <Link href="/" className="pa-back"><ArrowLeft size={16} aria-hidden /><span>Home</span></Link>
      </header>
      <main className="pa-stage">
        <AuthEntryProof variant={proof} />
        <section className="pa-form" aria-label={label}>
          <div className="pa-form-content">{children}</div>
        </section>
      </main>
      <footer className="pa-footer"><span>CodeForge</span><Link href="/contact">Need a hand?</Link></footer>
    </div>
  );
}

import type { ReactNode, Ref } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { AuthEntryProof } from "@/components/auth/auth-entry-proof";
import "./auth-entry.css";

export function AuthEntryShell({ children, label, proof = "product", entrance = false, shared = false, compact = false, formRef }: {
  children: ReactNode;
  label: string;
  proof?: "product" | "recovery" | "security";
  entrance?: boolean;
  shared?: boolean;
  compact?: boolean;
  formRef?: Ref<HTMLElement>;
}) {
  return (
    <div className={`pa-auth${entrance ? " pa-auth-entrance" : ""}${shared ? " pa-auth-shared" : ""}${compact ? " pa-auth-fit" : ""}`}>
      <header className="pa-header">
        <Link href="/" aria-label="CodeForge home"><LogoLockup className="h-9 w-auto" /></Link>
        <Link href="/" className="pa-back"><ArrowLeft size={16} aria-hidden /><span>Home</span></Link>
      </header>
      <main className="pa-stage">
        <AuthEntryProof variant={proof} />
        <section ref={formRef} className="pa-form" aria-label={label}>
          <div className="pa-form-content">{children}</div>
        </section>
      </main>
      <footer className="pa-footer"><span>CodeForge</span><Link href="/contact">Need a hand?</Link></footer>
    </div>
  );
}

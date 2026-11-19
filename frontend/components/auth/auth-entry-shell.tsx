"use client";

import type { ReactNode, Ref } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthHorizonPanel } from "@/components/auth/auth-horizon-panel";
import { stepsFor, type AuthProof } from "@/components/auth/auth-band-steps";
import "./auth-entry.css";
import "./auth-editorial.css";

/** The line on the dark band, chosen by what the page is for. */
function headlineFor(label: string, proof: AuthProof) {
  if (proof === "recovery") return "Back to your builds in a minute.";
  if (proof === "security") return "Your workspace, kept yours.";
  if (label === "Create account") return "Start your first build.";
  return "Your next idea starts here.";
}

/**
 * Auth layout: a black band carrying the landing's sunlit horizon, and the form straight on the
 * cream canvas in the Anthropic-style language (auth-editorial.css). The band stays mounted while
 * sign in, sign up and passkey swap the form.
 */
export function AuthEntryShell({ children, label, proof = "product", entrance = false, shared = false, compact = false, formRef }: {
  children: ReactNode;
  label: string;
  proof?: AuthProof;
  entrance?: boolean;
  shared?: boolean;
  compact?: boolean;
  formRef?: Ref<HTMLElement>;
}) {
  const modifiers = `${entrance ? " pa-auth-entrance" : ""}${shared ? " pa-auth-shared" : ""}${compact ? " pa-auth-fit" : ""}`;
  return (
    <div className={`pa-auth ah-auth ae-auth${modifiers}`}>
      <AuthHorizonPanel headline={headlineFor(label, proof)} steps={stepsFor(label, proof)} />
      <div className="ah-side">
        <Link href="/" className="pa-back ah-back"><ArrowLeft size={16} aria-hidden /><span>Home</span></Link>
        <main className="ah-main">
          <section ref={formRef} className="pa-form" aria-label={label}>
            <div className="pa-form-content">{children}</div>
          </section>
        </main>
        <footer className="pa-footer ah-footer"><span>CodeForge</span><Link href="/contact">Need a hand?</Link></footer>
      </div>
    </div>
  );
}

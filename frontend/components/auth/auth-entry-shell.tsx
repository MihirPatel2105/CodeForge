import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { AuthEntryProof } from "@/components/auth/auth-entry-proof";

export function AuthEntryShell({
  children,
  label,
  proof = "product",
}: {
  children: ReactNode;
  label: string;
  proof?: "product" | "recovery" | "security";
}) {
  return (
    <div className="cf-auth-entry min-h-dvh">
      <header className="cf-auth-header relative z-10 mx-auto flex h-[76px] max-w-[1160px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label="CodeForge home">
          <LogoMark className="h-8 w-8" />
          <span className="cf-wordmark text-fg">codeforge</span>
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] font-[600] text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Back to home</span>
          <span className="sm:hidden">Home</span>
        </Link>
      </header>

      <main className="cf-auth-stage relative z-10 mx-auto flex min-h-[calc(100dvh-76px)] max-w-[1160px] items-center px-4 pb-10 pt-2 sm:px-8 sm:pb-14">
        <div className="cf-auth-card grid w-full overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_28px_85px_rgba(31,46,77,0.09)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)]">
          <section className="cf-auth-form-pane min-w-0 px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-14" aria-label={label}>
            <div className="mx-auto w-full max-w-[430px]">{children}</div>
          </section>
          <AuthEntryProof variant={proof} />
        </div>
      </main>
    </div>
  );
}

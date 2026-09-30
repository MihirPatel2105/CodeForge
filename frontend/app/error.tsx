"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("CodeForge page failed", error);
  }, [error]);

  return (
    <main className="cf-error flex min-h-screen items-center justify-center bg-bg px-6">
      <div role="alert" className="w-full max-w-lg rounded-3xl border border-border bg-surface p-8 text-center">
        <span className="text-[13px] font-[600] text-danger">Page error</span>
        <h1 className="font-display mt-4 text-[28px] font-[700] tracking-[-0.045em] text-fg">This page could not load.</h1>
        <p className="mt-3 text-[14px] leading-6 text-fg-muted">Your saved work is still available. Try loading this page again.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/projects" className="rounded-lg px-4 py-2 text-[13px] font-[650] text-fg-muted hover:text-fg">Go to projects</Link>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { AppHeader } from "@/components/dashboard/app-header";
import { Notice } from "@/components/ui/notice";

export function AdminAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "locked" | "allowed" | "error">("checking");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    let expires: ReturnType<typeof setTimeout> | undefined;
    const lock = () => setState("locked");
    window.addEventListener("codeforge-admin-locked", lock);
    async function check() {
      try {
        const result = await api.adminAccess();
        if (disposed) return;
        const remaining = result.expires_at ? Date.parse(result.expires_at) - Date.now() : 0;
        setState(result.allowed && remaining > 0 ? "allowed" : "locked");
        clearTimeout(expires);
        if (result.allowed && remaining > 0) expires = setTimeout(lock, remaining);
      } catch (error) {
        if (disposed) return;
        if (error instanceof ApiError && error.status === 401) router.replace("/login");
        else if (error instanceof ApiError && error.status === 403) router.replace("/projects");
        else setState("error");
      }
    }
    const onVisible = () => { if (!document.hidden) void check(); };
    void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => { disposed = true; clearTimeout(expires); window.removeEventListener("codeforge-admin-locked", lock); document.removeEventListener("visibilitychange", onVisible); };
  }, [router, retry]);
  if (state === "allowed") return children;
  return <div className="min-h-screen bg-bg"><AppHeader /><main className="mx-auto max-w-lg px-6 py-16">
    <ShieldCheck className="mb-5 h-8 w-8 text-accent" aria-hidden />
    <h1 className="text-2xl font-semibold">{state === "checking" ? "Checking admin access…" : "Admin access is locked"}</h1>
    {state === "locked" && <><p className="mt-4 text-sm leading-6 text-fg-muted">Sign in with your authenticator or passkey to unlock admin controls for one hour. Password-only and recovery sessions cannot access admin data.</p><div className="mt-6 flex flex-wrap gap-5"><Link href="/login" className="font-semibold text-accent">Sign in securely →</Link><Link href="/profile/settings/2fa" className="text-sm text-fg-muted">Set up account security →</Link></div></>}
    {state === "error" && <><Notice className="mt-5">Could not verify access. Try again shortly.</Notice><button className="mt-5 text-sm font-semibold text-accent" onClick={() => { setState("checking"); setRetry(value => value + 1); }}>Retry check</button></>}
  </main></div>;
}

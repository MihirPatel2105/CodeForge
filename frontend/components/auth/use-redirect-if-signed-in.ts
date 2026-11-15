"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, clearToken, getToken } from "@/lib/api";

/**
 * Sends someone who is already signed in from /login or /signup to their workspace.
 *
 * The browser-visible session flag can outlive the real session (expired, or signed out on
 * another device), so the server confirms it before any redirect. A 401 clears the stale flag
 * and leaves the form in place; redirecting on the flag alone could bounce between /login and
 * /projects. Destinations match the post-sign-in rule: admins to /admin, everyone else to
 * /projects.
 */
export function useRedirectIfSignedIn(): void {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled) router.replace(user.is_admin ? "/admin" : "/projects");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) clearToken();
        // Any other failure (network, 5xx) leaves the form usable rather than guessing.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
}

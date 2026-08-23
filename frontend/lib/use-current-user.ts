"use client";

import { useEffect, useState } from "react";
import { api, getToken, clearToken } from "@/lib/api";
import type { UserResponse } from "@/lib/types";

export interface CurrentUser extends UserResponse {
  /** Full name when we have one, falling back to the email address. */
  displayName: string;
  /** One or two letters for the avatar. */
  initials: string;
}

/** "Tanmay Patel" -> "TP"; a single name -> its first letter; no name at all -> the
 * first letter of the email, so the avatar is never blank. */
function initialsFor(user: UserResponse): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) {
    return parts
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("");
  }
  return (user.email[0] ?? "?").toUpperCase();
}

/**
 * Who is looking at the page, or null when nobody is signed in.
 *
 * One implementation for every surface that needs it — both headers, the closing
 * banner, the footer and the profile page. Three copies of an auth check is three
 * chances for one of them to keep offering "Create an account" to somebody who
 * already has one.
 *
 * Always starts null and resolves after mount: the token lives in localStorage, which
 * does not exist during the server render, so returning a signed-in value on the first
 * client pass would guarantee a hydration mismatch against the server's markup.
 */
export interface Session {
  user: CurrentUser | null;
  /** True until the token has been checked. See `useSession` for why this matters. */
  loading: boolean;
}

/**
 * The session, including whether it is still being resolved.
 *
 * `user === null` is ambiguous on its own: it means both "signed out" and "we have not
 * looked yet", and the second is always true for one render because the token lives in
 * localStorage. Anything that *gates* on being signed in needs to tell those apart, or
 * it shows a signed-in visitor a "please sign in" screen for a moment before correcting
 * itself. Surfaces that merely swap a label can keep using `useCurrentUser`.
 */
export function useSession(): Session {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
        setUser({ ...u, displayName: name || u.email, initials: initialsFor(u) });
      })
      .catch(() => {
        // Expired or revoked: drop it rather than leave the UI in a signed-in state
        // that no longer works.
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

export function useCurrentUser(): CurrentUser | null {
  return useSession().user;
}

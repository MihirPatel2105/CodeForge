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
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!getToken()) return;
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
      });
  }, []);

  return user;
}

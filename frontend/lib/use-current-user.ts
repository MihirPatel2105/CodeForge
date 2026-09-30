"use client";

import { useEffect, useSyncExternalStore } from "react";
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

export interface Session {
  user: CurrentUser | null;
  loading: boolean;
}

const initialSession: Session = { user: null, loading: true };
let session = initialSession;
let generation = 0;
let pending = false;
const listeners = new Set<() => void>();
let listening = false;

function publish(next: Session) {
  session = next;
  listeners.forEach((listener) => listener());
}

function resolveSession() {
  if (!getToken()) {
    if (session.user || session.loading) {
      generation++;
      pending = false;
      publish({ user: null, loading: false });
    }
    return;
  }
  if (pending || session.user) return;
  pending = true;
  const requestGeneration = ++generation;
  api.me()
    .then((user) => {
      if (generation !== requestGeneration) return;
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
      publish({ user: { ...user, displayName: name || user.email, initials: initialsFor(user) }, loading: false });
    })
    .catch(() => {
      if (generation !== requestGeneration) return;
      clearToken();
    })
    .finally(() => {
      if (generation === requestGeneration) pending = false;
    });
}

function onSessionChange() {
  // A late response must not restore a user after sign-out or session replacement.
  generation++;
  pending = false;
  publish(initialSession);
  resolveSession();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!listening) {
    window.addEventListener("codeforge-session-change", onSessionChange);
    listening = true;
  }
  return () => {
    listeners.delete(listener);

  };
}

/** Reuse the verified session across routes; the server snapshot remains unknown. */
export function useSession(): Session {
  const current = useSyncExternalStore(subscribe, () => session, () => initialSession);
  useEffect(resolveSession, []);
  return current;
}

export function useCurrentUser(): CurrentUser | null {
  return useSession().user;
}

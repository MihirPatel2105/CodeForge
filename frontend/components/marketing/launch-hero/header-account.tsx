"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { retrySession, useSession } from "@/lib/use-current-user";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { AttentionInbox } from "@/components/dashboard/attention-inbox";
import { UserAvatar } from "@/components/user-avatar";

const WORKSPACE_PREFIXES = ["/projects", "/runs"] as const;

function currentIf(active: boolean): "page" | undefined {
  return active ? "page" : undefined;
}

// Each page mounts its own bar, so there is no surviving element to animate. Module
// scope survives client-side navigation: the new bar starts where the old one ended,
// then glides to its own state on the next frame.
let projectsWasCollapsed: boolean | null = null;

function useProjectsCollapsed(collapse: boolean): boolean {
  const [collapsed, setCollapsed] = useState(() => projectsWasCollapsed ?? collapse);
  useEffect(() => {
    projectsWasCollapsed = collapse;
    const frame = requestAnimationFrame(() => setCollapsed(collapse));
    return () => cancelAnimationFrame(frame);
  }, [collapse]);
  return collapsed;
}

/** The bar's right-hand group: account tools when signed in, the way in when not. */
export function HeaderAccount() {
  const { user, loading, error } = useSession();
  const pathname = usePathname() ?? "";
  const projectsCollapsed = useProjectsCollapsed(pathname === "/projects");

  if (error) {
    // A signed-in visitor must not be left looking signed out after one failed check.
    return (
      <>
        <span className="lh-account-note" title={error}>Account unavailable</span>
        <button type="button" className="lh-pill" onClick={retrySession}>Retry account</button>
      </>
    );
  }
  if (loading) {
    // Hold the space so the bar does not jump when the session resolves.
    return (
      <div role="status" aria-label="Loading account" className="lh-account-loading">
        <span aria-hidden /><span aria-hidden />
      </div>
    );
  }
  if (user) {
    const inWorkspace = WORKSPACE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    return (
      <>
        <CommandPalette key={`commands-${user.id}`} isAdmin={user.is_admin} />
        <AttentionInbox key={user.id} userId={user.id} />
        {user.is_admin && (
          <Link href="/admin" className="lh-pill lh-admin" aria-current={currentIf(pathname.startsWith("/admin"))}>
            Admin
          </Link>
        )}
        {/* On the list itself the button would only reload the page, so it folds away. */}
        <Link
          href="/projects"
          className="lh-pill lh-pill-solid lh-projects"
          aria-current={currentIf(inWorkspace)}
          data-collapsed={projectsCollapsed ? "" : undefined}
          aria-hidden={projectsCollapsed || undefined}
          tabIndex={projectsCollapsed ? -1 : undefined}
        >
          Projects
        </Link>
        <UserAvatar initials={user.initials} name={user.displayName} className="lh-avatar" />
      </>
    );
  }
  return (
    <>
      <Link href="/login" className="lh-pill lh-signin">Sign in</Link>
      <Link href="/signup" className="lh-pill lh-pill-solid">Get started</Link>
    </>
  );
}

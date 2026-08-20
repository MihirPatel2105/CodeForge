"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/dashboard/app-header";
import { DeleteAccountDialog } from "@/components/auth/delete-account-dialog";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { useCurrentUser } from "@/lib/use-current-user";
import { api, getToken, clearToken, ApiError } from "@/lib/api";

const LABEL = "font-mono text-[10.5px] font-[600] uppercase tracking-[0.14em] text-fg-faint";

/**
 * Account settings.
 *
 * Split from the profile page rather than bolted onto the bottom of it: profile is a
 * page you land on to read, and a destructive control sitting under a page people scroll
 * through casually is a control that eventually gets pressed. Reaching this one takes a
 * deliberate click.
 */
export default function SettingsPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [confirming, setConfirming] = useState(false);
  const [endingSessions, setEndingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      // `replace` so Back cannot return to a page this visitor cannot see.
      router.replace("/login");
    }
  }, [router]);

  async function handleSignOut() {
    setEndingSessions(true);
    setSessionError(null);
    try {
      // Told to the server, not just forgotten locally: without this the token stays
      // valid until it expires, so a copy lifted out of local storage would keep
      // working after the user believed they had signed out.
      await api.signOut();
      clearToken();
      router.replace("/login");
    } catch (err) {
      // A token the server has already rejected cannot be signed out again, and there
      // is nothing useful left to do with it — drop it and go. Refusing to sign out
      // because the session is already dead would be absurd.
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setSessionError("Couldn't reach the server, so you are still signed in. Try again.");
      setEndingSessions(false);
    }
  }

  async function handleSignOutEverywhere() {
    setEndingSessions(true);
    setSessionError(null);
    try {
      await api.signOutEverywhere();
      // Only after the server has actually revoked them. Clearing the token first would
      // leave no way to make the call if it failed.
      clearToken();
      router.replace("/login");
    } catch (err) {
      setSessionError(
        err instanceof ApiError
          ? err.message || "Couldn't end your sessions. Try again."
          : "Couldn't reach the server. Your sessions are unchanged.",
      );
      setEndingSessions(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />

      <div className="mx-auto w-full px-6 py-12 md:px-10 lg:px-14">
        <Link
          href="/profile"
          className="font-mono text-[11px] font-[600] uppercase tracking-[0.14em] text-fg-faint transition-colors hover:text-fg"
        >
          ← profile
        </Link>

        <h1 className="font-display mt-6 text-[26px] font-[600] tracking-[-0.04em] text-fg">
          Settings
        </h1>

        {/* Two columns: the thing you do here on the left, the things that end a
            session or an account on the right. Stacking them left the whole right half
            of the page empty, and pushed deletion far enough down that it read as an
            afterthought rather than a deliberate corner of the page.

            `items-start` so the two columns size to their own content — without it the
            grid stretches both to the taller one, and the danger panel would grow a
            tail of empty red. */}
        <div className="mt-11 grid items-start gap-x-14 gap-y-12 lg:grid-cols-2">
          <section>
            <h2 className={LABEL}>password</h2>
            <ChangePasswordForm />
          </section>

          <div className="flex flex-col gap-12">
            <section>
              <h2 className={LABEL}>session</h2>
              <div className="mt-4 flex flex-col gap-6 border-t border-rule pt-6">
                <div>
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    disabled={endingSessions}
                    className="h-11 gap-[7px] px-[15px]"
                  >
                    <LogOut className="h-[15px] w-[15px]" />
                    {endingSessions ? "Signing out…" : "Sign out"}
                  </Button>
                  <p className="mt-3 max-w-[52ch] text-[13px] leading-[1.6] text-fg-faint">
                    Ends this session on the server, so it cannot be reused even if the
                    token was copied. Other devices stay signed in.
                  </p>
                </div>

                {/* The honest counterpart to the button above. A normal sign-out never
                    reaches the server, so a token copied elsewhere keeps working until
                    it expires; this is the control for when that matters. */}
                <div>
                  <Button
                    onClick={handleSignOutEverywhere}
                    variant="outline"
                    disabled={endingSessions}
                    className="h-11 gap-[7px] px-[15px]"
                  >
                    <ShieldOff className="h-[15px] w-[15px]" />
                    {endingSessions ? "Ending sessions…" : "Sign out everywhere"}
                  </Button>
                  <p className="mt-3 max-w-[52ch] text-[13px] leading-[1.6] text-fg-faint">
                    Ends every session on every device immediately, including this one.
                    Your password does not change.
                  </p>
                  {sessionError && (
                    <p
                      role="alert"
                      className="mt-3 max-w-[52ch] rounded-[2px] border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
                    >
                      {sessionError}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Danger zone — the only red on the page */}
            <section>
              <h2 className="font-mono text-[10.5px] font-[600] uppercase tracking-[0.14em] text-danger">
                danger zone
              </h2>
              <div className="mt-4 rounded-[3px] border border-danger-bd bg-danger-soft/40 p-6">
                <h3 className="text-[15.5px] font-[600] text-fg">Delete this account</h3>
                <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.6] text-fg-muted">
                  Removes your account and everything it owns — every project, every run,
                  and every generated file stored against them. Nothing is archived and
                  nothing can be recovered afterwards.
                </p>
                <Button
                  onClick={() => setConfirming(true)}
                  disabled={!user}
                  className="mt-5 h-11 rounded-[2px] bg-danger px-6 font-mono text-[12px] font-[600] uppercase tracking-[0.12em] text-surface hover:bg-danger/90"
                >
                  Delete account
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {confirming && user && (
        <DeleteAccountDialog email={user.email} onClose={() => setConfirming(false)} />
      )}
    </div>
  );
}

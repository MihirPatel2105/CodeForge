"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, setToken, ApiError } from "@/lib/api";
import { ResetPasswordAside } from "@/components/auth/reset-password-aside";
import { PASSWORD_RULES, passwordMeetsAllRules } from "@/lib/password-rules";
import { LogoMark } from "@/components/brand/logo-mark";

const FIELD =
  "h-12 rounded-[3px] border-border-strong bg-bg px-[14px] text-[14px] " +
  "transition-colors focus-visible:border-accent focus-visible:ring-0 focus-visible:ring-offset-0";

const LABEL = "font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint";

/**
 * The far end of the reset link: pick a new password, get signed in with it.
 *
 * `token` is whatever the URL segment held — it is sent to the server exactly as
 * received and never inspected here. Validating its shape client-side would only teach
 * this component something about a format it should not need to know, and the only
 * verdict that matters is the server's.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const touched = password.length > 0;
  const passwordOk = passwordMeetsAllRules(password);
  const matches = confirm.length > 0 && confirm === password;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordOk) {
      setError("Your password does not meet all four requirements yet.");
      return;
    }
    if (!matches) {
      setError("The two passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const { access_token } = await api.resetPassword({ token, new_password: password });
      setToken(access_token);
      // A returning user with proof of the account, same as sign-in — straight to work.
      router.replace("/projects");
    } catch (err) {
      setError(messageFor(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="cf-auth relative flex min-h-screen bg-bg">
      <ResetPasswordAside />

      <main className="cf-auth-main flex flex-1 items-center justify-center p-5 py-10 sm:p-8 lg:p-10">
        <div className="w-full max-w-[450px] rounded-[7px] border border-border bg-surface p-7 shadow-[0_24px_70px_rgba(22,24,28,0.08)] sm:p-9">
          <Link href="/" className="mb-8 flex items-center gap-[6px] lg:hidden">
            <LogoMark className="h-8 w-8" />
            <span className="cf-wordmark text-fg">
              codeforge
            </span>
          </Link>

          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            secure reset
          </span>

          <h1 className="font-display mt-5 text-[32px] font-[650] leading-[1.12] tracking-[-0.05em] text-fg">
            Set a new password
          </h1>
          <p className="mt-4 text-[14px] leading-[1.65] text-fg-muted">
            Choose a strong password you have not used here before. You&apos;ll be
            signed in when the reset succeeds. Existing passkeys will be removed; you can add them again in Settings.
          </p>
          <p className="mt-3 text-[13px] leading-[1.5] text-fg-muted">
            Remembered it?{" "}
            <Link
              href="/login"
              className="font-[600] text-fg underline underline-offset-[4px] decoration-1 decoration-border-strong hover:decoration-fg"
            >
              Sign in
            </Link>
          </p>

          <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="new_password" className={LABEL}>
                NEW PASSWORD
              </Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(FIELD, "w-full pr-[68px]")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-[12px] top-1/2 -translate-y-1/2 font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint transition-colors hover:text-fg"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <ul
              className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-[4px] border border-rule bg-bg/70 p-4 sm:grid-cols-2"
              aria-live="polite"
            >
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li key={rule.id} className="flex items-center gap-[9px]">
                    <span
                      className={cn(
                        "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                        met ? "border-ok bg-ok text-surface" : "border-border-strong bg-transparent",
                      )}
                    >
                      {met && <Check className="h-[10px] w-[10px]" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] leading-[1.35] transition-colors",
                        met ? "text-fg" : touched ? "text-fg-muted" : "text-fg-faint",
                      )}
                    >
                      {rule.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="confirm_password" className={LABEL}>
                CONFIRM NEW PASSWORD
              </Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={cn(
                    FIELD,
                    "w-full pr-[68px]",
                    confirm.length > 0 && !matches && "border-danger-bd",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-[12px] top-1/2 -translate-y-1/2 font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint transition-colors hover:text-fg"
                >
                  {showConfirm ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-[2px] border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="mt-1 h-[50px] w-full rounded-[3px] font-mono text-[11px] font-[700] uppercase tracking-[0.12em]"
            >
              {submitting ? "Saving…" : "Save new password"}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-3 border-t border-rule pt-5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[3px] border border-border bg-bg text-fg-faint">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="pt-0.5 text-[12.5px] leading-[1.55] text-fg-faint">
              This link can be used once and expires ten minutes after it was sent.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't reach the server. Your password was not changed.";
  }
  if (err.status === 401) {
    return "This link is invalid or has expired. Request a new one.";
  }
  if (err.status === 422) {
    return "Check your password — it must meet all four requirements.";
  }
  return err.message || "Something went wrong. Your password was not changed.";
}

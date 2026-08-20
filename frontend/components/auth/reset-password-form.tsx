"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, setToken, ApiError } from "@/lib/api";
import { ResetPasswordAside } from "@/components/auth/reset-password-aside";
import { PASSWORD_RULES, passwordMeetsAllRules } from "@/lib/password-rules";
import { LogoMark } from "@/components/brand/logo-mark";

const FIELD =
  "h-11 rounded-[2px] border-border-strong bg-surface px-[13px] text-[14.5px] " +
  "focus-visible:border-fg focus-visible:ring-0 focus-visible:ring-offset-0";

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
    <div className="relative flex min-h-screen bg-bg">
      <ResetPasswordAside />

      <main className="flex flex-1 items-center justify-center p-6 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="mb-8 flex items-center gap-[9px] lg:hidden">
            <LogoMark className="h-6 w-6 rounded-[2px]" />
            <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
              codeforge
            </span>
          </Link>

          <h1 className="font-display text-[30px] font-[600] leading-[1.15] tracking-[-0.04em] text-fg">
            Set a new password
          </h1>
          <p className="mt-[18px] text-[14.5px] leading-[1.5] text-fg-muted">
            Remembered it?{" "}
            <Link
              href="/login"
              className="font-[600] text-fg underline underline-offset-[4px] decoration-1 decoration-border-strong hover:decoration-fg"
            >
              Sign in
            </Link>
          </p>

          <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit}>
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

            <ul className="flex flex-col gap-[7px]" aria-live="polite">
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
                        "text-[13px] transition-colors",
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
              className="mt-2 h-[52px] w-full rounded-[2px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em]"
            >
              {submitting ? "Saving…" : "Save new password"}
            </Button>
          </form>

          <p className="mt-6 text-[12.5px] text-fg-faint">
            This link can be used once and expires ten minutes after it was sent.
          </p>
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

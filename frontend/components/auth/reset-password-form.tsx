"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, setToken, ApiError } from "@/lib/api";
import { AuthEntryShell } from "@/components/auth/auth-entry-shell";
import { PASSWORD_RULES, passwordMeetsAllRules } from "@/lib/password-rules";

const FIELD =
  "h-12 rounded-xl border-border-strong bg-white px-4 text-[16px] text-fg " +
  "focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 focus-visible:ring-offset-0";

const LABEL = "text-[13px] font-[650] text-fg";

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
    <AuthEntryShell label="Set a new password" proof="recovery">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent"><KeyRound className="h-5 w-5" aria-hidden /></span>
          <div className="mt-7 flex items-center gap-2.5 text-[12px] font-[650] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> Account recovery</div>
          <h1 className="font-display mt-4 text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">
            Set a new password
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-fg-muted">
            Choose a strong password you have not used here before. You&apos;ll be
            signed in when the reset succeeds. Existing passkeys will be removed; you can add them again in Settings.
          </p>
          <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new_password" className={LABEL}>
                New password
              </Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  required
                  aria-describedby="reset-password-rules"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(FIELD, "w-full pr-[88px]")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide new password" : "Show new password"}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 inline-flex h-10 min-w-[76px] -translate-y-1/2 items-center justify-center gap-1.5 rounded-lg text-[12px] font-[650] text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div id="reset-password-rules" className="rounded-2xl border border-border bg-surface-2/60 px-4 py-3.5">
            <p className="mb-2.5 text-[12px] font-[650] text-fg-muted">Use a password with</p>
            <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2" aria-live="polite">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li key={rule.id} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors",
                        met ? "border-ok bg-ok text-white" : "border-border-strong bg-white",
                      )}
                    >
                      {met && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] leading-[18px] transition-colors",
                        met ? "text-ok" : touched ? "text-fg-muted" : "text-fg-faint",
                      )}
                    >
                      {rule.label}
                    </span>
                  </li>
                );
              })}
            </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm_password" className={LABEL}>
                Confirm new password
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
                    "w-full pr-[88px]",
                    confirm.length > 0 && !matches && "border-danger-bd",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                  aria-pressed={showConfirm}
                  className="absolute right-1 top-1/2 inline-flex h-10 min-w-[76px] -translate-y-1/2 items-center justify-center gap-1.5 rounded-lg text-[12px] font-[650] text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="mt-1 h-12 w-full rounded-xl text-[14px] font-[650]"
            >
              {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {submitting ? "Saving…" : "Save new password"}
            </Button>
          </form>

          <p className="mt-7 border-t border-border pt-5 text-center text-[13px] text-fg-muted">Remembered it? <Link href="/login" className="font-[700] text-accent hover:underline hover:underline-offset-4">Sign in</Link></p>
    </AuthEntryShell>
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

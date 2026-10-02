"use client";

import { Notice } from "@/components/ui/notice";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, setToken, ApiError } from "@/lib/api";
import { PASSWORD_RULES, passwordMeetsAllRules } from "@/lib/password-rules";

const FIELD =
  "h-12 rounded-xl border-border-strong bg-surface px-[14px] text-[14px] " +
  "transition-colors focus-visible:border-accent focus-visible:ring-0 focus-visible:ring-offset-0";

const FIELD_LABEL = "text-[13px] font-[650] text-fg";

/**
 * Changing the account password.
 *
 * The current password is asked for even though the caller is already signed in: the
 * session token is exactly what someone who found an unlocked laptop would have, and it
 * should not be enough to lock the owner out of their own account.
 *
 * The same four rules the sign-up form ticks off are shown here, from the same source,
 * so a rule can never be advertised in one place and enforced differently in another.
 */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const touched = next.length > 0;
  const ready = current.length > 0 && passwordMeetsAllRules(next);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;

    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const { access_token } = await api.changePassword({
        current_password: current,
        new_password: next,
      });
      // The server ends every session on a password change, including this one. Storing
      // the replacement it hands back is what keeps this browser signed in — without
      // this the next request would 401 and bounce the user to the login page.
      setToken(access_token);
      setCurrent("");
      setNext("");
      setDone(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="mt-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="current_password" className={FIELD_LABEL}>
            Current password
          </Label>
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="new_password" className={FIELD_LABEL}>
            New password
          </Label>
          <div className="relative">
            <Input
              id="new_password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={cn(FIELD, "w-full pr-[68px]")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-[12px] top-1/2 -translate-y-1/2 rounded-md px-1 py-1 text-[12px] font-[650] text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <ul
          className="grid gap-x-5 gap-y-2 rounded-lg border border-rule bg-bg/70 px-4 py-3 sm:grid-cols-2"
          aria-live="polite"
        >
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(next);
            return (
              <li key={rule.id} className="flex items-center gap-[9px]">
                <span
                  className={cn(
                    "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-lg border transition-colors",
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

        {error && (
          <Notice>
            {error}
          </Notice>
        )}

        {done && (
          <p
            role="status"
            className="rounded-lg border border-ok-bd bg-ok-soft px-3 py-2 text-[13px] leading-[1.45] text-ok"
          >
            Password changed. Anywhere else you were signed in has been signed out.
          </p>
        )}

        <Button
          type="submit"
          disabled={!ready || saving}
          className="h-11 w-full rounded-xl text-[13px] font-[650] sm:w-auto sm:self-start sm:px-7"
        >
          {saving ? "Saving…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't reach the server. Your password was not changed.";
  }
  if (err.status === 401) return "Your current password is not correct.";
  if (err.status === 409) return "That is already your password. Pick a different one.";
  if (err.status === 422) return "The new password does not meet all four requirements.";
  return err.message || "Something went wrong. Your password was not changed.";
}

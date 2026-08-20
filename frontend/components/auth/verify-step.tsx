"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, setToken, ApiError } from "@/lib/api";

const LENGTH = 6;

/** Seconds the server makes you wait before it will send another code. Mirrors
 * `OTP_RESEND_COOLDOWN_SECONDS`; the server enforces it either way, this only stops the
 * button offering something that is going to be refused. */
const RESEND_COOLDOWN = 60;

const LABEL = "font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint";

/**
 * Second half of sign-up: the code that proves the address is real.
 *
 * Six separate boxes rather than one field. A single input is less code, but it gives no
 * indication of how long the code is, no sense of progress while typing, and no obvious
 * place for the caret after a mistake. The cost is that every keyboard affordance a
 * single input gets for free — backspace, arrows, paste, autofill — has to be rebuilt
 * here deliberately.
 */
export function VerifyStep({
  email,
  expiresAt,
  onStartOver,
}: {
  email: string;
  expiresAt: string | null;
  onStartOver: () => void;
}) {
  const router = useRouter();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [expiry, setExpiry] = useState(expiresAt);
  const [resent, setResent] = useState(false);

  const code = digits.join("");

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  // One interval drives both countdowns; two would drift apart on screen.
  useEffect(() => {
    const timer = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = useCallback(
    async (value: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const { access_token } = await api.verifyEmail({ email, code: value });
        setToken(access_token);
        // A brand-new account lands on the landing page, not the dashboard: someone who
        // just signed up has no projects, so /projects would greet them with an empty
        // table. The landing page explains what the product does first, and its header
        // reads "Go to projects" once you are signed in.
        //
        // `replace`, not `push`: the code is spent, so going back to this screen could
        // only ever fail.
        router.replace("/");
      } catch (err) {
        setError(messageFor(err));
        setDigits(Array(LENGTH).fill(""));
        setSubmitting(false);
        // Focus is restored by the effect below, not here: the boxes are still
        // `disabled` at this point because React has not re-rendered yet, and focusing
        // a disabled input silently does nothing.
      }
    },
    [email, router],
  );

  // Submitting on completion rather than making you reach for a button — there is
  // exactly one thing to do with a finished code.
  useEffect(() => {
    if (code.length === LENGTH && !submitting) void submit(code);
  }, [code, submit, submitting]);

  // After a rejection, put the caret back where the retry starts. Runs once the boxes
  // are enabled again, which is the whole reason it is an effect.
  useEffect(() => {
    if (error && !submitting) inputs.current[0]?.focus();
  }, [error, submitting]);

  function write(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) return;

    setDigits((current) => {
      const next = [...current];
      // A paste lands in whichever box was focused and fills forward from there, which
      // is what pasting a whole code into the first box has to do.
      for (let i = 0; i < cleaned.length && index + i < LENGTH; i++) {
        next[index + i] = cleaned[i];
      }
      return next;
    });
    const landed = Math.min(index + cleaned.length, LENGTH - 1);
    inputs.current[landed]?.focus();
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setDigits((current) => {
        const next = [...current];
        // Backspace in an empty box clears the one before it and steps back, so holding
        // it deletes the whole code the way it would in a single field.
        if (next[index]) next[index] = "";
        else if (index > 0) {
          next[index - 1] = "";
          inputs.current[index - 1]?.focus();
        }
        return next;
      });
      setError(null);
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    try {
      const response = await api.resendCode(email);
      setExpiry(response.expires_at);
      setCooldown(RESEND_COOLDOWN);
      setDigits(Array(LENGTH).fill(""));
      setResent(true);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <div className="w-full max-w-[380px]">
      <span className={LABEL}>[ step 2 of 2 ]</span>

      <h1 className="font-display mt-5 text-[30px] font-[600] leading-[1.15] tracking-[-0.04em] text-fg">
        Check your email
      </h1>
      <p className="mt-[18px] text-[14.5px] leading-[1.55] text-fg-muted">
        We sent a {LENGTH}-digit code to{" "}
        <span className="font-mono text-[13.5px] text-fg">{email}</span>. It expires in{" "}
        <ExpiryCountdown expiresAt={expiry} />.
      </p>

      <div className="mt-8 flex flex-col gap-[6px]">
        <span className={LABEL}>VERIFICATION CODE</span>
        <div className="flex gap-[9px]" role="group" aria-label="Verification code">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={digit}
              onChange={(e) => write(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              disabled={submitting}
              // `numeric` brings up a number pad without the spinner and validation
              // baggage `type="number"` drags along.
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              maxLength={LENGTH}
              className={cn(
                "h-[54px] w-full min-w-0 rounded-[2px] border bg-surface text-center",
                "font-mono text-[20px] font-[600] text-fg outline-none transition-colors",
                "focus:border-fg disabled:opacity-60",
                error ? "border-danger-bd" : "border-border-strong",
              )}
            />
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-[2px] border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
        >
          {error}
        </p>
      )}

      {resent && !error && (
        <p
          role="status"
          className="mt-4 rounded-[2px] border border-ok-bd bg-ok-soft px-3 py-2 text-[13px] leading-[1.45] text-ok"
        >
          A new code is on its way. The previous one no longer works.
        </p>
      )}

      <Button
        type="button"
        disabled={submitting || code.length < LENGTH}
        onClick={() => void submit(code)}
        className="mt-6 h-[52px] w-full rounded-[2px] font-mono text-[12.5px] font-[600] uppercase tracking-[0.12em]"
      >
        {submitting ? "Verifying…" : "Verify and continue"}
      </Button>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0}
          className="font-mono text-[11.5px] font-[600] uppercase tracking-[0.11em] text-fg transition-colors hover:text-fg-muted disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:text-fg-faint"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="text-[13px] text-fg-muted underline decoration-1 decoration-border-strong underline-offset-[4px] transition-colors hover:decoration-fg hover:text-fg"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}

/** Counts the code's real lifetime down, so "it expires in 10 minutes" does not keep
 * claiming ten minutes five minutes later. */
function ExpiryCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (left === null) return <span className="text-fg">a few minutes</span>;
  if (left === 0) return <span className="text-fg">— it has expired</span>;

  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  return (
    <span className="font-mono text-[13.5px] text-fg">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't reach the server. Check your connection, then try again.";
  }
  // The API's own text carries the detail worth showing — how many attempts are left,
  // or that the code expired — so it is preferred over anything invented here.
  if (err.status === 401 || err.status === 404 || err.status === 429) {
    return err.message || "That code was not accepted.";
  }
  if (err.status === 422) return "Enter the six digits from the email.";
  return err.message || "Something went wrong. Try again.";
}

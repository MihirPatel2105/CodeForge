"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, setToken, ApiError } from "@/lib/api";
import { filterName } from "@/lib/input-filters";
import { AuthAside } from "@/components/auth/auth-aside";
import { PASSWORD_RULES, passwordMeetsAllRules } from "@/lib/password-rules";
import { VerifyStep } from "@/components/auth/verify-step";
import { LogoMark } from "@/components/brand/logo-mark";

type Mode = "signin" | "register";

const COPY = {
  signin: {
    title: "Sign in",
    subtitle: "Pick up where your last run left off.",
    submit: "Sign in",
    busy: "Signing in…",
    altPrompt: "New here?",
    altLabel: "Create an account",
    altHref: "/signup",
  },
  register: {
    title: "Create account",
    subtitle: "Free to use — it runs entirely on free-tier AI providers.",
    submit: "Create account",
    busy: "Creating account…",
    altPrompt: "Already registered?",
    altLabel: "Sign in",
    altHref: "/login",
  },
} as const;

// Square, hairline, and it goes solid black on focus rather than glowing — the field
// you are typing in should be the darkest thing on the page.
const FIELD =
  "h-12 rounded-[3px] border-border-strong bg-bg px-[14px] text-[14px] " +
  "transition-colors focus-visible:border-accent focus-visible:ring-0 focus-visible:ring-offset-0";

const LABEL = "font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint";

/** Sign in and Register share this component so the two screens cannot drift apart;
 * only the copy, the endpoint and the extra registration fields differ. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];
  const registering = mode === "register";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set only when the server asks for a code, which it does when it has SMTP configured.
  // Null keeps this screen on the details step, so a server without email verification
  // needs no special case here — it simply never sets it.
  const [pending, setPending] = useState<{ email: string; expiresAt: string | null } | null>(null);

  // Only after the field has been touched, so the list reads as guidance on arrival
  // rather than as four things already gone wrong.
  const touchedPassword = password.length > 0;
  const passwordOk = passwordMeetsAllRules(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (registering && !passwordOk) {
      setError("Your password does not meet all four requirements yet.");
      return;
    }

    setSubmitting(true);
    try {
      if (registering) {
        const result = await api.register({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email,
          password,
        });
        if (result.verification_required) {
          setPending({ email: result.email, expiresAt: result.expires_at });
          return;
        }
        // Verification is switched off on this server: sign-up completed in one step
        // and already handed back a session. Checked rather than asserted — a `!` here
        // would turn a server that disagrees with its own flag into a blank screen.
        if (!result.access_token) {
          setError("The server did not return a session. Try signing in.");
          return;
        }
        setToken(result.access_token);
      } else {
        const { access_token } = await api.login({ email, password });
        setToken(access_token);
      }
      // New accounts start on the landing page, returning users go straight to work.
      // Both paths that create an account agree on this — this one, and the OTP step
      // in `verify-step.tsx`.
      router.replace(registering ? "/" : "/projects");
    } catch (err) {
      setError(messageFor(err, mode));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cf-auth relative flex min-h-screen bg-bg">
      <AuthAside />

      <main className="cf-auth-main flex flex-1 items-center justify-center p-5 py-10 sm:p-8 lg:p-10">
        {pending ? (
          <div className="w-full max-w-[450px] rounded-[7px] border border-border bg-surface p-7 shadow-[0_24px_70px_rgba(22,24,28,0.08)] sm:p-9">
            <VerifyStep
              email={pending.email}
              expiresAt={pending.expiresAt}
              onStartOver={() => {
                setPending(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <div className="w-full max-w-[450px] rounded-[7px] border border-border bg-surface p-7 shadow-[0_24px_70px_rgba(22,24,28,0.08)] sm:p-9">
            {/* The brand only appears here when the aside is hidden, so the small-screen
              layout still identifies itself. */}
            <Link href="/" className="mb-8 flex items-center gap-[9px] lg:hidden">
              <LogoMark className="h-6 w-6 rounded-[2px]" />
              <span className="font-display text-[16px] font-[600] tracking-[-0.03em] text-fg">
                codeforge
              </span>
            </Link>

            <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 font-mono text-[9px] font-[700] uppercase tracking-[0.12em] text-accent">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {registering ? "new workspace" : "secure access"}
            </span>

            <h1 className="font-display mt-5 text-[32px] font-[650] leading-[1.1] tracking-[-0.05em] text-fg sm:text-[36px]">
              {copy.title}
            </h1>
            <p className="mt-3 text-[14px] leading-[1.55] text-fg-muted">
              {copy.subtitle}
            </p>
            <p className="mt-2 text-[13.5px] leading-[1.5] text-fg-muted">
              {copy.altPrompt}{" "}
              <Link
                href={copy.altHref}
                className="font-[600] text-fg underline underline-offset-[4px] decoration-1 decoration-border-strong hover:decoration-fg"
              >
                {copy.altLabel}
              </Link>
            </p>

            <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit}>
              {registering && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-[6px]">
                    <Label htmlFor="first_name" className={LABEL}>
                      FIRST NAME
                    </Label>
                    <Input
                      id="first_name"
                      autoComplete="given-name"
                      autoFocus
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(filterName(e.target.value))}
                      className={FIELD}
                    />
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <Label htmlFor="last_name" className={LABEL}>
                      LAST NAME
                    </Label>
                    <Input
                      id="last_name"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(filterName(e.target.value))}
                      className={FIELD}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-[6px]">
                <Label htmlFor="email" className={LABEL}>
                  EMAIL
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus={!registering}
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={FIELD}
                />
              </div>

              <div className="flex flex-col gap-[6px]">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password" className={LABEL}>
                    PASSWORD
                  </Label>
                  {/* Only on sign in — a forgotten password is not yet a thing to
                      recover for an account that does not exist. */}
                  {!registering && (
                    <Link
                      href="/forgot-password"
                      className="font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint underline decoration-1 underline-offset-[3px] decoration-border-strong transition-colors hover:text-fg hover:decoration-fg"
                    >
                      Forgot?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={registering ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(FIELD, "w-full pr-[68px]")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    // Never a submit button, and never focusable before the field itself.
                    className="absolute right-[12px] top-1/2 -translate-y-1/2 font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint transition-colors hover:text-fg"
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              {registering && (
                <ul
                  className="grid gap-x-4 gap-y-2 rounded-[4px] border border-rule bg-bg/70 px-4 py-3 sm:grid-cols-2"
                  aria-live="polite"
                >
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li key={rule.id} className="flex items-center gap-[9px]">
                        <span
                          className={cn(
                            "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                            met
                              ? "border-ok bg-ok text-surface"
                              : "border-border-strong bg-transparent",
                          )}
                        >
                          {met && <Check className="h-[10px] w-[10px]" strokeWidth={3} />}
                        </span>
                        <span
                          className={cn(
                            "text-[13px] transition-colors",
                            met ? "text-fg" : touchedPassword ? "text-fg-muted" : "text-fg-faint",
                          )}
                        >
                          {rule.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

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
                className="mt-1 h-[50px] w-full rounded-[3px] font-mono text-[11px] font-[700] uppercase tracking-[0.13em]"
              >
                {submitting ? copy.busy : copy.submit}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 border-t border-rule pt-5 text-center">
              <ShieldCheck className="h-3.5 w-3.5 text-ok" aria-hidden />
              <p className="font-mono text-[9px] font-[600] uppercase tracking-[0.1em] text-fg-faint">
                Protected account session
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** Turns a failed call into something a human can act on. The API's own message is
 * preferred when it has one; the fallbacks cover the cases where it does not. */
function messageFor(err: unknown, mode: Mode): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't reach the server. Check that the backend is running, then try again.";
  }
  if (err.status === 401) return "That email and password don't match.";
  if (err.status === 409) return "An account with that email already exists.";
  if (err.status === 422) {
    // FastAPI's validation errors do not use this app's `{error: {...}}` envelope, so
    // `err.message` here is the bare status text rather than anything readable.
    return mode === "register"
      ? "Check your details — the email must be valid and the password must meet all four requirements."
      : "Check the email address and try again.";
  }
  return err.message || "Something went wrong. Try again.";
}

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
import { filterName } from "@/lib/input-filters";
import { AuthEntryShell } from "@/components/auth/auth-entry-shell";
import { PASSWORD_RULES, passwordMeetsAllRules } from "@/lib/password-rules";
import { VerifyStep } from "@/components/auth/verify-step";
import { clearPendingPasswordMfa, savePendingPasswordMfa } from "@/lib/password-mfa";

type Mode = "signin" | "register";

const COPY = {
  signin: {
    title: "Sign in",
    subtitle: "Welcome back to your API workspace.",
    submit: "Sign in",
    busy: "Signing in…",
    altPrompt: "New here?",
    altLabel: "Create an account",
    altHref: "/signup",
  },
  register: {
    title: "Create account",
    subtitle: "Create your workspace and start building your first API.",
    submit: "Create account",
    busy: "Creating account…",
    altPrompt: "Already registered?",
    altLabel: "Sign in",
    altHref: "/login",
  },
} as const;

const FIELD =
  "h-12 rounded-xl border-border-strong bg-white px-4 text-[16px] text-fg shadow-none " +
  "placeholder:text-fg-faint focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 focus-visible:ring-offset-0";

const LABEL = "text-[13px] font-[650] text-fg";

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
        const result = await api.login({ email, password });
        if (result.mfa_required) {
          if (!result.mfa_ticket || !result.mfa_methods?.length) {
            setError("The server did not return a verification method. Try again.");
            return;
          }
          savePendingPasswordMfa({
            ticket: result.mfa_ticket,
            email,
            methods: result.mfa_methods,
          });
          setPassword("");
          router.push("/login/verify");
          return;
        }
        if (!result.access_token) {
          setError("The server did not return a session. Try again.");
          return;
        }
        const { access_token } = result;
        clearPendingPasswordMfa();
        setToken(access_token);
        // The backend decides whether this session is administrative. Do not branch on
        // the typed email here: ADMIN_EMAIL is configuration, and duplicating that
        // value in the browser would turn a server-side permission into UI folklore.
        const user = await api.me();
        router.replace(user.is_admin ? "/admin" : "/projects");
        return;
      }
      // New accounts start on the landing page. The OTP path in `verify-step.tsx`
      // follows the same rule.
      router.replace("/");
    } catch (err) {
      setError(messageFor(err, mode));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthEntryShell label={pending ? "Verify your email" : copy.title}>
              {pending ? (
                <VerifyStep
                  email={pending.email}
                  expiresAt={pending.expiresAt}
                  onStartOver={() => {
                    setPending(null);
                    setError(null);
                  }}
                />
              ) : (
                <>
                  <div className="mb-7 flex items-center gap-2.5 text-[12px] font-[650] text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                    {registering ? "Your new workspace" : "Your workspace"}
                  </div>
                  <h1 className="font-display text-[34px] font-[700] leading-[1.12] tracking-[-0.05em] text-fg sm:text-[40px]">
                    {copy.title}
                  </h1>
                  <p className="mt-3 text-[15px] leading-6 text-fg-muted">{copy.subtitle}</p>

                  <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
                    {registering && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="first_name" className={LABEL}>First name</Label>
                          <Input id="first_name" autoComplete="given-name" autoFocus required value={firstName} onChange={(e) => setFirstName(filterName(e.target.value))} className={FIELD} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="last_name" className={LABEL}>Last name <span className="font-normal text-fg-faint">(optional)</span></Label>
                          <Input id="last_name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(filterName(e.target.value))} className={FIELD} />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email" className={LABEL}>Email</Label>
                      <Input id="email" type="email" autoComplete="email" autoFocus={!registering} required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="password" className={LABEL}>Password</Label>
                        {!registering && <Link href="/forgot-password" className="rounded-md text-[12px] font-[650] text-accent hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent">Forgot password?</Link>}
                      </div>
                      <div className="relative">
                        <Input id="password" type={showPassword ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} aria-describedby={registering ? "password-rules" : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} className={cn(FIELD, "w-full pr-[88px]")} />
                        <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-1 top-1/2 inline-flex h-10 min-w-[76px] -translate-y-1/2 items-center justify-center gap-1.5 rounded-lg text-[12px] font-[650] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
                          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    {registering && (
                      <div id="password-rules" className="rounded-2xl border border-border bg-surface-2/60 px-4 py-3.5">
                        <p className="mb-2.5 text-[12px] font-[650] text-fg-muted">Use a password with</p>
                        <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2" aria-live="polite">
                          {PASSWORD_RULES.map((rule) => {
                            const met = rule.test(password);
                            return (
                              <li key={rule.id} className="flex items-start gap-2">
                                <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors", met ? "border-ok bg-ok text-white" : "border-border-strong bg-white")} aria-hidden>
                                  {met && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                </span>
                                <span className={cn("text-[12px] leading-[18px]", met ? "text-ok" : touchedPassword ? "text-fg-muted" : "text-fg-faint")}>{rule.label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {error && <p role="alert" className="rounded-xl border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] leading-5 text-danger">{error}</p>}

                    <Button type="submit" disabled={submitting} className="mt-1 h-12 w-full rounded-xl text-[14px] font-[650] shadow-sm transition-transform active:scale-[0.99]">
                      {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                      {submitting ? copy.busy : copy.submit}
                    </Button>
                  </form>

                  {!registering && (
                    <>
                      <div className="my-5 flex items-center gap-3 text-[12px] text-fg-faint"><span className="h-px flex-1 bg-border" /><span>or</span><span className="h-px flex-1 bg-border" /></div>
                      <Link href="/login/passkey" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border-strong bg-white text-[14px] font-[650] text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        <KeyRound className="h-4 w-4" aria-hidden /> Sign in with a passkey
                      </Link>
                    </>
                  )}

                  <p className="mt-7 text-center text-[13px] text-fg-muted">
                    {copy.altPrompt}{" "}
                    <Link href={copy.altHref} className="font-[700] text-accent hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent">{copy.altLabel}</Link>
                  </p>
                </>
              )}
    </AuthEntryShell>
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

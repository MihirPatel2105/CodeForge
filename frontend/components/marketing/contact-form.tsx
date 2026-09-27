"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/use-current-user";
import { filterDialCode, filterDigits } from "@/lib/input-filters";
import { CONTACT_EMAIL } from "@/lib/contact-details";

const FIELD =
  "h-12 rounded-lg border-border-strong bg-bg px-[14px] text-[14px] transition-colors " +
  "focus-visible:border-accent focus-visible:ring-0 focus-visible:ring-offset-0";

const LABEL = "text-[13px] font-[600] text-fg";

/** A value the account owns and the form only displays. */
const READONLY =
  "flex h-12 items-center rounded-lg border border-border bg-surface-2 px-[14px] " +
  "text-[14px] text-fg-muted";

const PANEL = "self-start rounded-xl border border-rule bg-bg/70 p-6";

const MAX_MESSAGE = 500;

/**
 * The contact form.
 *
 * Signing in is required, and the name and address are shown rather than typed: the
 * server reads both from the account, so the form cannot send a message claiming to be
 * somebody else. Before this the fields were editable, and whatever was typed became the
 * Reply-To on mail our server sent — which lets anyone have a message from CodeForge
 * arrive at an address they chose, carrying a name they chose.
 */
export function ContactForm() {
  const { user, loading } = useSession();

  const [dialCode, setDialCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSend = message.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.sendContactMessage({
        // Only send a number when one was typed — a bare dial code is not a phone
        // number, and it would arrive in the inbox looking like one.
        phone: phone.trim() ? `${dialCode.trim()} ${phone.trim()}` : "",
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not send that. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // One render always happens before the token has been checked. Showing the sign-in
  // panel during it would flash "you need an account" at people who have one.
  if (loading) {
    return (
      <div className={PANEL}>
        <span className={LABEL}>checking your session…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={PANEL}>
        <span className="inline-flex rounded-xl border border-accent-bd bg-accent-soft px-3 py-1.5 text-[12px] font-[650] text-accent">Sign in to continue</span>
        <h2 className="font-display mt-5 text-[23px] font-[650] leading-[1.2] tracking-[-0.04em] text-fg">
          Messages come from an account.
        </h2>
        <p className="mt-[18px] text-[14.5px] leading-[1.6] text-fg-muted">
          We reply to the address on your account rather than one typed into a form, so an
          answer always reaches a mailbox we know is yours. Sign in and the form fills
          itself in.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-fg px-6 py-[13px] text-[14px] font-[650] text-surface transition-opacity hover:opacity-88 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl border border-border-strong bg-surface px-6 py-[13px] text-[14px] font-[650] text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Create an account
          </Link>
        </div>
        <p className="mt-7 text-[13.5px] leading-[1.6] text-fg-muted">
          Rather not sign up just to ask something? Email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[13.5px] text-fg underline decoration-1 decoration-border-strong underline-offset-[4px] hover:decoration-fg"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          directly.
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className={PANEL}>
        <span className="inline-flex rounded-xl border border-ok-bd bg-ok-soft px-3 py-1.5 text-[12px] font-[650] text-ok">Message sent</span>
        <h2 className="font-display mt-5 text-[23px] font-[650] leading-[1.2] tracking-[-0.04em] text-fg">
          Thanks &mdash; we&rsquo;ve got it.
        </h2>
        <p className="mt-[18px] text-[14.5px] leading-[1.6] text-fg-muted">
          We&rsquo;ll reply within one or two working days, at{" "}
          <span className="text-[13.5px] text-fg">{user.email}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage("");
          }}
          className="mt-6 text-[13.5px] font-[600] text-fg underline decoration-1 decoration-border-strong underline-offset-[4px] hover:decoration-fg"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form className="flex h-full flex-col gap-5" onSubmit={handleSubmit}>
      {/* Shown, not entered. The server reads both from the account whatever the browser
          sends, so an editable field here would misrepresent what the message will say. */}
      <div className="flex flex-col gap-[6px]">
        <Label className={LABEL}>Your name</Label>
        <div className={READONLY}>{user.displayName}</div>
      </div>

      <div className="flex flex-col gap-[6px]">
        <Label className={LABEL}>Email</Label>
        <div className={READONLY}>{user.email}</div>
        <p className="text-[12.5px] leading-[1.5] text-fg-faint">
          From your verified account &mdash; this is where the reply goes.
        </p>
      </div>

      <div className="flex flex-col gap-[6px]">
        <Label htmlFor="contact-phone" className={LABEL}>
          Phone
        </Label>
        <div className="flex">
          <Input
            aria-label="Country dialling code"
            value={dialCode}
            onChange={(e) => setDialCode(filterDialCode(e.target.value))}
            maxLength={5}
            className={`${FIELD} w-[62px] shrink-0 rounded-r-none border-r-0 text-center font-mono text-[14px]`}
          />
          <Input
            id="contact-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={15}
            value={phone}
            onChange={(e) => setPhone(filterDigits(e.target.value))}
            className={`${FIELD} rounded-l-none`}
          />
        </div>
        <p className="text-[12.5px] leading-[1.5] text-fg-faint">
          Optional &mdash; digits only, in case a call is quicker.
        </p>
      </div>

      {/* `flex-1` here is what keeps the two columns level: this group absorbs the
          height difference between the form and the details beside it, so the textarea
          grows into the gap instead of leaving it empty. */}
      <div className="flex min-h-0 flex-1 flex-col gap-[6px]">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="contact-message" className={LABEL}>
            Message
          </Label>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              message.length >= MAX_MESSAGE ? "text-warn" : "text-fg-faint"
            }`}
          >
            {message.length}/{MAX_MESSAGE}
          </span>
        </div>
        <Textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={MAX_MESSAGE}
          placeholder="What happened, and what you expected instead"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[152px] flex-1 resize-y rounded-lg border-border-strong bg-bg px-[14px] py-3 text-[14px] leading-[1.6] transition-colors focus-visible:border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!canSend || submitting}
        className="mt-1 h-[50px] w-full rounded-xl text-[14px] font-[650]"
      >
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

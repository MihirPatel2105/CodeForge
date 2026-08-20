"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, clearToken, ApiError } from "@/lib/api";
import { DELETE_CONFIRMATION } from "@/lib/types";

const FIELD =
  "h-11 rounded-[2px] border-border-strong bg-surface px-[13px] text-[14.5px] " +
  "focus-visible:border-fg focus-visible:ring-0 focus-visible:ring-offset-0";

const LABEL = "font-mono text-[11px] font-[600] uppercase tracking-[0.11em] text-fg-faint";

/**
 * The confirmation for closing an account.
 *
 * Two locks, because they stop different mistakes. The password stops someone else
 * acting on a session left open on a shared machine — the bearer token alone is not
 * enough. Typing the word stops the account's own owner clearing a dialog by reflex,
 * which is the failure a single "Are you sure?" button invites.
 *
 * Both are re-checked by the server. These are here so the mistake is caught before the
 * request, not so the server can trust the client.
 */
export function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const armed = password.length > 0 && confirmation.trim() === DELETE_CONFIRMATION;

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!armed) return;

    setDeleting(true);
    setError(null);
    try {
      await api.deleteAccount({ password, confirmation: confirmation.trim() });
      // The account is gone, so the token in this browser now points at nothing.
      clearToken();
      router.replace("/");
    } catch (err) {
      setError(messageFor(err));
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/25 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      // Clicking the backdrop closes; clicking the panel must not, or every click
      // inside the form would dismiss it.
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-[3px] border border-border-strong bg-surface p-7"
      >
        <span className="font-mono text-[10.5px] font-[600] uppercase tracking-[0.16em] text-danger">
          [ permanent ]
        </span>
        <h2
          id="delete-account-title"
          className="font-display mt-4 text-[22px] font-[600] leading-[1.25] tracking-[-0.035em] text-fg"
        >
          Delete your account
        </h2>
        <p className="mt-3 text-[14px] leading-[1.6] text-fg-muted">
          This removes <span className="font-mono text-[13px] text-fg">{email}</span> along
          with every project, run and generated file it owns. Nothing is archived, and
          this cannot be undone.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleDelete}>
          <div className="flex flex-col gap-[6px]">
            <Label htmlFor="delete_password" className={LABEL}>
              CONFIRM YOUR PASSWORD
            </Label>
            <Input
              id="delete_password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <Label htmlFor="delete_confirmation" className={LABEL}>
              TYPE {DELETE_CONFIRMATION} TO CONFIRM
            </Label>
            <Input
              id="delete_confirmation"
              autoComplete="off"
              required
              placeholder={DELETE_CONFIRMATION}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className={cn(FIELD, "font-mono tracking-[0.08em]")}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-[2px] border border-danger-bd bg-danger-soft px-3 py-2 text-[13px] leading-[1.45] text-danger"
            >
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={!armed || deleting}
              className="h-11 flex-1 rounded-[2px] bg-danger font-mono text-[12px] font-[600] uppercase tracking-[0.12em] text-surface hover:bg-danger/90 disabled:opacity-45"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={deleting}
              className="h-11 rounded-[2px] px-6 font-mono text-[12px] font-[600] uppercase tracking-[0.12em]"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't reach the server. Nothing was deleted.";
  }
  if (err.status === 401) return "That password is not correct. Nothing was deleted.";
  if (err.status === 422) return `Type ${DELETE_CONFIRMATION} exactly to confirm.`;
  return err.message || "Something went wrong. Nothing was deleted.";
}

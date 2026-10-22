"use client";

import { Trash2 } from "lucide-react";
import { DeletionDialog } from "@/components/ui/deletion-dialog";
import { Notice } from "@/components/ui/notice";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, clearToken, ApiError } from "@/lib/api";
import { DELETE_CONFIRMATION } from "@/lib/types";

const FIELD =
  "h-11 rounded-lg border-border-strong bg-surface px-[13px] text-[14.5px] " +
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
    if (!armed || deleting) return;

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
    <DeletionDialog open onClose={onClose} busy={deleting} title="Delete your account"
      description="Permanently close your account and remove everything you have built in this workspace."
      target={email} targetLabel="Account to delete" impact="All your projects, runs, and generated files will be removed. This cannot be undone.">
        <form onSubmit={handleDelete}>
          <div className="cf-deletion-fields">
          <div className="cf-deletion-field">
            <Label htmlFor="delete_password" className={LABEL}>
              Confirm your password
            </Label>
            <Input
              id="delete_password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              disabled={deleting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
            />
          </div>

          <div className="cf-deletion-field">
            <Label htmlFor="delete_confirmation" className={LABEL}>
              Type {DELETE_CONFIRMATION} to confirm
            </Label>
            <Input
              id="delete_confirmation"
              autoComplete="off"
              required
              disabled={deleting}
              placeholder={DELETE_CONFIRMATION}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className={cn(FIELD, "font-mono tracking-[0.08em]")}
            />
          </div>

          {error && (
            <Notice>
              {error}
            </Notice>
          )}

          </div>
          <div className="cf-deletion-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
            <Button
              type="submit"
              disabled={!armed || deleting}
              className="cf-deletion-submit"
            >
              <Trash2 size={14} aria-hidden />{deleting ? "Deleting…" : "Delete account"}
            </Button>

          </div>
        </form>
    </DeletionDialog>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { pausePageScroll } from "@/components/layout/app-scroll";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, clearToken, ApiError } from "@/lib/api";
import { DELETE_CONFIRMATION } from "@/lib/types";
import "@/components/ui/axd-dialog.css";

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
 *
 * Styled like the project dialogs (the `axd` system); only the red submit and the impact
 * line mark it as destructive.
 */
export function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const armed = password.length > 0 && confirmation.trim() === DELETE_CONFIRMATION;

  useEffect(() => pausePageScroll(), []);

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
    <Dialog open onOpenChange={(next) => { if (!next && !deleting) onClose(); }}>
      <DialogContent className="cf-workspace-dialog axd p-0 sm:max-w-[480px]" data-lenis-prevent showCloseButton={!deleting}>
        <DialogHeader className="axd-head">
          <DialogTitle className="axd-title">Delete your account</DialogTitle>
          <DialogDescription className="axd-lede">
            Permanently close <strong className="font-[550] text-fg">{email}</strong> and remove everything you have built in this workspace.
          </DialogDescription>
        </DialogHeader>
        <form className="axd-form" onSubmit={handleDelete}>
          <p className="axd-impact"><AlertCircle size={16} aria-hidden /><span>All your projects, runs, and generated files will be removed. This cannot be undone.</span></p>

          <div className="axd-field">
            <Label htmlFor="delete_password" className="axd-label">Confirm your password</Label>
            <Input
              id="delete_password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              disabled={deleting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="axd-input"
            />
          </div>

          <div className="axd-field">
            <Label htmlFor="delete_confirmation" className="axd-label">Type <strong>{DELETE_CONFIRMATION}</strong> to confirm</Label>
            <Input
              id="delete_confirmation"
              autoComplete="off"
              required
              disabled={deleting}
              placeholder={DELETE_CONFIRMATION}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="axd-input"
            />
          </div>

          {error && <p role="alert" className="axd-error">{error}</p>}

          <div className="axd-actions">
            <Button type="button" variant="ghost" onClick={onClose} disabled={deleting}>Cancel</Button>
            <Button type="submit" disabled={!armed || deleting} className="axd-submit axd-danger">
              {deleting && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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

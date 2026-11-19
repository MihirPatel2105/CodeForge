"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { pausePageScroll } from "@/components/layout/app-scroll";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import "@/components/ui/axd-dialog.css";

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string };
  runCount: number;
  onDeleted: () => void;
}

function impactText(runCount: number): string {
  if (runCount === 0) return "Every generated file stored with this project will be removed. There is no undo.";
  return `${runCount} ${runCount === 1 ? "run" : "runs"}, generated code, and test output will be removed. There is no undo.`;
}

/**
 * Confirming a project deletion.
 *
 * Typing the name is deliberate friction, matching the account-deletion dialog. A plain
 * "are you sure?" is dismissed reflexively; having to reproduce the name makes you look
 * at which project you are about to destroy — which is the actual failure mode when two
 * projects are called something similar.
 *
 * Styled like the new/rename project dialogs (the `axd` system); only the red submit and
 * the impact line mark it as destructive.
 */
export function DeleteProjectDialog({ open, onOpenChange, project, runCount, onDeleted }: DeleteProjectDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmation.trim() === project.name;

  useEffect(() => {
    if (open) return pausePageScroll();
  }, [open]);

  function close() {
    onOpenChange(false);
    setConfirmation("");
    setError(null);
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    if (!matches || deleting) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteProject(project.id);
      setDeleting(false);
      close();
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete the project.");
      setDeleting(false);
    }
  }

  const inputId = `confirm-delete-${project.id}`;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !deleting) close(); }}>
      <DialogContent className="cf-workspace-dialog axd p-0 sm:max-w-[480px]" data-lenis-prevent showCloseButton={!deleting}>
        <DialogHeader className="axd-head">
          <DialogTitle className="axd-title">Delete this project?</DialogTitle>
          <DialogDescription className="axd-lede">
            Permanently remove <strong className="font-[550] text-fg">{project.name}</strong> and the work stored with it.
          </DialogDescription>
        </DialogHeader>
        <form className="axd-form" onSubmit={handleDelete}>
          <p className="axd-impact"><AlertCircle size={16} aria-hidden /><span>{impactText(runCount)}</span></p>
          <div className="axd-field">
            <Label htmlFor={inputId} className="axd-label">Type <strong>{project.name}</strong> to confirm</Label>
            <Input id={inputId} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={deleting} className="axd-input" />
          </div>
          {error && <p role="alert" className="axd-error">{error}</p>}
          <div className="axd-actions">
            <Button type="button" variant="ghost" onClick={close} disabled={deleting}>Cancel</Button>
            <Button type="submit" disabled={!matches || deleting} className="axd-submit axd-danger">
              {deleting && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {deleting ? "Deleting…" : "Delete project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

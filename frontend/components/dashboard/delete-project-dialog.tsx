"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeletionDialog } from "@/components/ui/deletion-dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/api";

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
 */
export function DeleteProjectDialog({ open, onOpenChange, project, runCount, onDeleted }: DeleteProjectDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmation.trim() === project.name;

  function close() {
    onOpenChange(false);
    setConfirmation("");
    setError(null);
  }

  async function handleDelete() {
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
    <DeletionDialog
      open={open}
      onClose={close}
      busy={deleting}
      title="Delete this project?"
      description="Permanently remove this project and the work stored with it."
      target={project.name}
      targetLabel="Project to delete"
      impact={impactText(runCount)}
    >
      <div className="cf-deletion-fields">
        <div className="cf-deletion-field">
          <label htmlFor={inputId}>Type <strong>{project.name}</strong> to confirm</label>
          <Input id={inputId} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" disabled={deleting} />
        </div>
        {error && <Notice>{error}</Notice>}
      </div>
      <div className="cf-deletion-actions">
        <Button type="button" variant="outline" onClick={close} disabled={deleting}>Cancel</Button>
        <Button type="button" onClick={handleDelete} disabled={!matches || deleting} className="cf-deletion-submit">
          <Trash2 size={14} aria-hidden />{deleting ? "Deleting…" : "Delete project"}
        </Button>
      </div>
    </DeletionDialog>
  );
}

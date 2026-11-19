"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { Archive, ArchiveRestore, Ellipsis, LoaderCircle, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse } from "@/lib/types";
import { DeleteProjectDialog } from "./delete-project-dialog";
import "@/components/ui/axd-dialog.css";

const ITEM =
  "flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-[550] text-fg outline-none data-[highlighted]:bg-surface-2";
const DANGER_ITEM =
  "flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-[550] text-danger outline-none data-[highlighted]:bg-danger/10";

type Editable = Pick<ProjectResponse, "id" | "name" | "description" | "archived">;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

interface ProjectActionsProps {
  project: Editable;
  /** Runs stored with the project, so the delete dialog can say what goes with it. */
  runCount: number;
  onChanged: () => void;
}

/** The "⋯" menu on a project row: start a run, rename, archive or restore, delete. */
export function ProjectActions({ project, runCount, onChanged }: ProjectActionsProps) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function setArchived(archived: boolean) {
    try {
      await api.updateProject(project.id, { name: project.name, description: project.description, archived });
      onChanged();
      toast.success(archived ? `${project.name} archived` : `${project.name} restored`, {
        action: {
          label: "Undo",
          onClick: () =>
            void api
              .updateProject(project.id, { name: project.name, description: project.description, archived: !archived })
              .then(onChanged)
              .catch((err: unknown) => toast.error(errorText(err, "Couldn't undo. Try again."))),
        },
      });
    } catch (err) {
      toast.error(errorText(err, "Couldn't update the project. Try again."));
    }
  }

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          aria-label={`Actions for ${project.name}`}
          className="relative z-10 grid size-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[popup-open]:bg-surface-2 data-[popup-open]:text-fg"
        >
          <Ellipsis className="size-4" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={12} className="z-50">
            <Menu.Popup className="min-w-[184px] rounded-xl border border-border bg-surface p-1.5 shadow-[0_16px_40px_rgba(22,24,28,0.14)] outline-none">
              {!project.archived && (
                <Menu.Item className={ITEM} onClick={() => router.push(`/projects/${project.id}`)}>
                  <Play className="size-3.5 text-fg-muted" aria-hidden />Start a new run
                </Menu.Item>
              )}
              <Menu.Item className={ITEM} onClick={() => setRenaming(true)}>
                <Pencil className="size-3.5 text-fg-muted" aria-hidden />Rename
              </Menu.Item>
              <Menu.Separator className="my-1 h-px bg-rule" />
              <Menu.Item className={ITEM} onClick={() => void setArchived(!project.archived)}>
                {project.archived ? (
                  <><ArchiveRestore className="size-3.5 text-fg-muted" aria-hidden />Restore</>
                ) : (
                  <><Archive className="size-3.5 text-fg-muted" aria-hidden />Archive</>
                )}
              </Menu.Item>
              <Menu.Item className={DANGER_ITEM} onClick={() => setDeleting(true)}>
                <Trash2 className="size-3.5" aria-hidden />Delete
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <RenameDialog project={project} open={renaming} onOpenChange={setRenaming} onSaved={onChanged} />
      <DeleteProjectDialog
        open={deleting}
        onOpenChange={setDeleting}
        project={project}
        runCount={runCount}
        onDeleted={() => {
          onChanged();
          toast.success(`${project.name} deleted`);
        }}
      />
    </>
  );
}

function RenameDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: {
  project: Editable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(project.name);
      setDescription(project.description);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateProject(project.id, { name: name.trim(), description: description.trim(), archived: Boolean(project.archived) });
      onSaved();
      onOpenChange(false);
      toast.success("Project renamed");
    } catch (err) {
      setError(errorText(err, "Couldn't rename the project. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="cf-workspace-dialog axd p-0 sm:max-w-[480px]">
        <DialogHeader className="axd-head">
          <DialogTitle className="axd-title">Rename project</DialogTitle>
        </DialogHeader>
        <form className="axd-form" onSubmit={handleSubmit}>
          <div className="axd-field">
            <Label htmlFor={`rename-${project.id}`} className="axd-label">Name</Label>
            <Input id={`rename-${project.id}`} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="axd-input" />
          </div>
          <div className="axd-field">
            <Label htmlFor={`describe-${project.id}`} className="axd-label">Description <span>optional</span></Label>
            <Textarea id={`describe-${project.id}`} value={description} onChange={(event) => setDescription(event.target.value)} className="axd-input" />
          </div>
          {error && <p role="alert" className="axd-error">{error}</p>}
          <div className="axd-actions">
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving} className="axd-submit">
              {saving && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

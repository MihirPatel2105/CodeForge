"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { Archive, ArchiveRestore, Ellipsis, LoaderCircle, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse } from "@/lib/types";

const ITEM =
  "flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-[550] text-fg outline-none data-[highlighted]:bg-surface-2";

type Editable = Pick<ProjectResponse, "id" | "name" | "description" | "archived">;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** The "⋯" menu on a project row: start a run, rename, archive or restore. */
export function ProjectActions({ project, onChanged }: { project: Editable; onChanged: () => void }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);

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
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <RenameDialog project={project} open={renaming} onOpenChange={setRenaming} onSaved={onChanged} />
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
      <DialogContent className="cf-workspace-dialog rounded-xl border-border p-0">
        <div className="border-b border-rule bg-surface-2 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-display text-[22px] tracking-[-0.04em]">Rename project</DialogTitle>
          </DialogHeader>
        </div>
        <form className="flex flex-col gap-4 px-6 pb-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rename-${project.id}`} className="text-[12px] font-[650] text-fg-muted">Name</Label>
            <Input id={`rename-${project.id}`} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`describe-${project.id}`} className="text-[12px] font-[650] text-fg-muted">Description (optional)</Label>
            <Textarea id={`describe-${project.id}`} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          <DialogFooter className="mt-2 border-t border-rule pt-5">
            <Button type="submit" disabled={saving} className="min-w-[120px]">
              {saving && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

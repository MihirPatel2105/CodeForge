"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatefulButton } from "@/components/ui/stateful-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "@/components/ui/axd-dialog.css";

export function ProjectSettings({ project, onSaved }: { project: ProjectResponse; onSaved: (project: ProjectResponse) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(archived: boolean) {
    setBusy(true); setError("");
    try {
      onSaved(await api.updateProject(project.id, { name: name.trim(), description, archived }));
      setOpen(false);
      toast.success(archived !== Boolean(project.archived) ? archived ? "Project archived." : "Project restored." : "Project saved.");
      return true;
    }
    catch (error) {
      setError(error instanceof ApiError ? error.message : "Could not update this project.");
      toast.error("Couldn't update this project. Please try again.");
      return false;
    }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" className="cf-manage-project mt-4" onClick={() => { setName(project.name); setDescription(project.description); setOpen(true); }}>Manage project{project.archived ? " · Archived" : ""}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="cf-workspace-dialog axd p-0 sm:max-w-[480px]">
        <DialogHeader className="axd-head">
          <DialogTitle className="axd-title">Manage project</DialogTitle>
          <DialogDescription className="axd-lede">
            Archiving moves this workspace out of your active list. Its runs and published APIs remain available.
          </DialogDescription>
        </DialogHeader>
        <div className="axd-form">
          <div className="axd-field">
            <Label htmlFor={`manage-name-${project.id}`} className="axd-label">Name</Label>
            <Input id={`manage-name-${project.id}`} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="axd-input" />
          </div>
          <div className="axd-field">
            <Label htmlFor={`manage-description-${project.id}`} className="axd-label">Description <span>optional</span></Label>
            <Textarea id={`manage-description-${project.id}`} value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} className="axd-input" />
          </div>
          {error && <p role="alert" className="axd-error">{error}</p>}
          <div className="axd-actions">
            <StatefulButton variant="ghost" label={project.archived ? "Restore project" : "Archive project"} pendingLabel="Saving…" disabled={busy || !name.trim()} onAction={() => save(!project.archived)} />
            <StatefulButton className="axd-submit" label="Save changes" pendingLabel="Saving…" successLabel="Saved" disabled={busy || !name.trim()} onAction={() => save(Boolean(project.archived))} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

"use client";
import { Notice } from "@/components/ui/notice";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatefulButton } from "@/components/ui/stateful-button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  return <><Button variant="outline" className="mt-4" onClick={() => { setName(project.name); setDescription(project.description); setOpen(true); }}>Manage project{project.archived ? " · Archived" : ""}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Manage project</DialogTitle></DialogHeader>
      <label className="text-sm">Project name<Input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></label>
      <label className="text-sm">Description<Textarea value={description} maxLength={2000} onChange={e => setDescription(e.target.value)} /></label>
      <p className="text-sm text-fg-muted">Archiving moves this workspace out of your active list. Its runs and published APIs remain available.</p>
      {error && <Notice>{error}</Notice>}
      <div className="flex flex-wrap gap-2"><StatefulButton label="Save changes" pendingLabel="Saving…" successLabel="Saved" disabled={busy || !name.trim()} onAction={() => save(Boolean(project.archived))} /><StatefulButton variant="outline" label={project.archived ? "Restore project" : "Archive project"} pendingLabel="Saving…" disabled={busy || !name.trim()} onAction={() => save(!project.archived)} /></div>
    </DialogContent></Dialog></>;
}

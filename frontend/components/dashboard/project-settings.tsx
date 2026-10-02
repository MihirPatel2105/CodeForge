"use client";
import { Notice } from "@/components/ui/notice";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
    try { onSaved(await api.updateProject(project.id, { name: name.trim(), description, archived })); setOpen(false); }
    catch (error) { setError(error instanceof ApiError ? error.message : "Could not update this project."); }
    finally { setBusy(false); }
  }
  return <><Button variant="outline" className="mt-4" onClick={() => { setName(project.name); setDescription(project.description); setOpen(true); }}>Manage project{project.archived ? " · Archived" : ""}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Manage project</DialogTitle></DialogHeader>
      <label className="text-sm">Project name<Input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></label>
      <label className="text-sm">Description<Textarea value={description} maxLength={2000} onChange={e => setDescription(e.target.value)} /></label>
      <p className="text-sm text-fg-muted">Archiving moves this workspace out of your active list. Its runs and published APIs remain available.</p>
      {error && <Notice>{error}</Notice>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !name.trim()} onClick={() => save(Boolean(project.archived))}>{busy ? "Saving…" : "Save changes"}</Button><Button variant="outline" disabled={busy || !name.trim()} onClick={() => save(!project.archived)}>{project.archived ? "Restore project" : "Archive project"}</Button></div>
    </DialogContent></Dialog></>;
}

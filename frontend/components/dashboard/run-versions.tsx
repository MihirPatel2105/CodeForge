"use client";
import { Notice } from "@/components/ui/notice";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { RunResponse } from "@/lib/types";
import { buildHunks } from "@/lib/diff";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedDisclosure } from "./animated-disclosure";
import { ApiCompatibility } from "./api-compatibility";

export function RunVersions({ id, completed }: { id: string; completed: boolean }) {
  const router = useRouter();
  const [run, setRun] = useState<RunResponse | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState<{ path: string; before: string; after: string }[]>([]);
  const [sourceTests, setSourceTests] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const current = await api.getRun(id);
        if (!active) return;
        setRun(current);
        if (current.parent_run_id) {
          const [before, after, parent] = await Promise.all([api.getRunFiles(current.parent_run_id), api.getRunFiles(id), api.getRun(current.parent_run_id)]);
          if (!active) return;
          setSourceTests(parent.metrics?.tests_passed ?? null);
          const paths = new Set([...before.files, ...after.files].map(file => file.path));
          setComparison([...paths].map(path => ({ path, before: before.files.find(file => file.path === path)?.content ?? "", after: after.files.find(file => file.path === path)?.content ?? "" })).filter(file => file.before !== file.after));
        }
      } catch { if (active) setError("Version details could not load. Refresh to try again."); }
    }
    void load(); return () => { active = false; };
  }, [id, completed]);
  async function improve() {
    if (!run || !note.trim()) return;
    setBusy(true); setError("");
    try { const next = await api.createRun({ project_id: run.project_id, prompt: note, parent_run_id: id, rag_enabled: run.state.rag_enabled !== false }); router.push(`/runs/${next.run_id}`); }
    catch (error) { setError(error instanceof ApiError ? error.message : "Could not start the revision."); setBusy(false); }
  }
  if (!run) return error ? <Notice className="mt-4">{error}</Notice> : null;
  return <section className="mt-5 space-y-4 rounded-3xl border border-border bg-surface p-5" aria-label="API versions">
    {run.parent_run_id && <><p className="text-sm">Based on <Link className="font-semibold text-accent underline" href={`/runs/${run.parent_run_id}`}>the previous version</Link>. {run.change_request}</p><p className="text-sm text-fg-muted">Source tests: {sourceTests === null ? "Unknown" : sourceTests ? "Passed" : "Not passed"} · This version: {completed ? run.metrics?.tests_passed ? "Tests passed" : "Tests not passed" : "In progress"}</p>{completed && <AnimatedDisclosure title={`${comparison.length} changed files compared with source`}><div className="space-y-3">{comparison.map(file => <div key={file.path}><h3 className="py-2 font-mono text-sm font-semibold">{file.path}{!file.before ? " · Added" : !file.after ? " · Removed" : ""}</h3><pre className="max-h-72 overflow-auto rounded-xl bg-term-bg p-3 text-xs text-term-fg">{buildHunks(file.before, file.after, 2).flatMap(hunk => hunk.lines).map((line, i) => <span key={i} className={`block ${line.kind === "added" ? "text-green-300" : line.kind === "removed" ? "text-red-300" : ""}`}>{line.kind === "added" ? "+ " : line.kind === "removed" ? "- " : "  "}{line.text}</span>)}</pre></div>)}</div></AnimatedDisclosure>}</>}
    {completed && run.status === "succeeded" && run.metrics?.tests_passed && run.parent_run_id && <ApiCompatibility id={id} sourceId={run.parent_run_id} />}
    {completed && run.status === "succeeded" && run.metrics?.tests_passed && <><h2 className="text-lg font-semibold">Improve this API</h2><label className="block text-sm">Describe a change<Textarea className="mt-2" value={note} maxLength={2000} onChange={event => setNote(event.target.value)} placeholder="Add a due-date field and reject dates in the past…" /></label><p className="text-sm text-fg-muted">Creates a separate version with approvals and new tests. Your previous version and published API stay available. Publish the new version explicitly after its tests pass.</p><Button onClick={improve} disabled={busy || !note.trim()}>{busy ? "Starting revision…" : "Build new version"}</Button></>}
    <Button variant="outline" onClick={() => { try { sessionStorage.setItem("codeforge:retry-prompt", JSON.stringify({ projectId: run.project_id, prompt: run.prompt, parentRunId: run.parent_run_id })); router.push(`/projects/${run.project_id}`); } catch { setError("Could not copy the prompt to your workspace."); } }}>Reuse this prompt</Button>
    {error && <Notice>{error}</Notice>}
  </section>;
}

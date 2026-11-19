"use client";

import "./workspace-design.css";
import "./project-editorial.css";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { runStats } from "@/lib/run-stats";
import { api, ApiError } from "@/lib/api";
import type { ProjectResponse, RunSummary } from "@/lib/types";
import { readLocal, writeLocal } from "@/lib/workspace-storage";
import { useSession } from "@/lib/use-current-user";
import { ProjectSettings } from "@/components/dashboard/project-settings";
import { AppHeader } from "@/components/dashboard/app-header";
import { PromptStudio } from "@/components/dashboard/prompt-studio";
import { RunHistoryList } from "@/components/dashboard/run-history-list";
import { ProjectRunSummary } from "@/components/dashboard/run-summary";

/** Project detail (design_handoff/README.md "Other screens"): prompt entry on the
 * left, run history on the right. "Start run" calls the real `POST /runs` and
 * navigates into the live Live Run screen. */
export function ProjectDetail({
  project,
  history,
  stats: serverStats,
  nextCursor,
  loadingMore,
  moreError,
  onLoadMore, onProjectSaved, query = "", outcome = "", onFilter, filtering = false,
}: {
  onProjectSaved: (project: ProjectResponse) => void;
  query?: string; outcome?: string; onFilter?: (query: string, outcome: string) => void; filtering?: boolean;
  project: ProjectResponse;
  history: RunSummary[];
  stats?: { total: number; succeeded: number; failed: number; avg_loops: number | null } | null;
  nextCursor?: string | null;
  loadingMore?: boolean;
  moreError?: string | null;
  onLoadMore?: () => void;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [ragEnabled, setRagEnabled] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSession();
  const draftKey = user ? `codeforge:draft:${user.id}:${project.id}` : null;
  const [loadedDraft, setLoadedDraft] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [parentRunId, setParentRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!draftKey) return;
    const draft = readLocal<{ prompt: string; rag: boolean; parentRunId?: string | null } | null>(draftKey, null);
    if (draft && typeof draft.prompt === "string") { setPrompt(draft.prompt); setRagEnabled(draft.rag !== false); setParentRunId(draft.parentRunId ?? null); }
    try {
      const retry = JSON.parse(sessionStorage.getItem("codeforge:retry-prompt") || "null");
      if (retry?.projectId === project.id && typeof retry.prompt === "string") { setPrompt(retry.prompt); setParentRunId(retry.parentRunId ?? null); sessionStorage.removeItem("codeforge:retry-prompt"); }
    } catch { /* A stored draft is optional. */ }
    setLoadedDraft(draftKey);
  }, [draftKey, project.id]);
  useEffect(() => {
    if (!draftKey || loadedDraft !== draftKey) return;
    setDraftStatus("Saving draft…");
    const save = () => writeLocal(draftKey, { prompt, rag: ragEnabled, parentRunId });
    const timer = setTimeout(() => setDraftStatus(save() ? "Draft saved on this device" : "Draft could not be saved on this device"), 400);
    window.addEventListener("pagehide", save);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", save); save(); };
  }, [prompt, ragEnabled, parentRunId, draftKey, loadedDraft]);

  const historyStats = runStats(history);
  const stats = serverStats ? { ...historyStats, ...serverStats, avgLoops: serverStats.avg_loops } : historyStats;

  async function startRun() {
    if (!prompt.trim()) return;
    setError(null);
    setStarting(true);
    try {
      const { run_id } = await api.createRun({
        project_id: project.id,
        prompt,
        rag_enabled: ragEnabled,
        ...(parentRunId ? { parent_run_id: parentRunId } : {}),
      });
      router.push(`/runs/${run_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the run.");
      setStarting(false);
    }
  }

  return (
    <div className="cf-project-detail min-h-screen bg-bg">
      <AppHeader />
      <main className="cf-page pb-20 pt-6 md:pt-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-[13px] font-[600] text-fg-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Projects
        </Link>

        <section className="cf-project-detail-hero mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="ax-hero relative px-6 py-6 md:px-9 md:py-7">
              <div className="ax-hero-main">
                <h1 className="font-display text-[36px] font-[700] tracking-[-0.055em] text-fg md:text-[42px]">
                  {project.name}
                </h1>
                <ProjectSettings project={project} onSaved={onProjectSaved} />
                {project.description && (
                  <p className="mt-2 max-w-[80ch] text-[14px] leading-[1.6] text-fg-muted md:text-[15px]">
                    {project.description}
                  </p>
                )}
              </div>
              {/* Counts come from the server so they include runs on later pages. */}
              <ProjectRunSummary stats={stats} />
            </div>
        </section>

        <div className="cf-project-workspace ax-workspace mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-start">
          <PromptStudio
            prompt={prompt}
            onPromptChange={setPrompt}
            ragEnabled={ragEnabled}
            onRagChange={setRagEnabled}
            parentRunId={parentRunId}
            onDetachParent={() => setParentRunId(null)}
            draftStatus={draftStatus}
            error={error}
            starting={starting}
            onStart={startRun}
          />
          <RunHistoryList
            history={history}
            stats={stats}
            query={query}
            outcome={outcome}
            filtering={filtering}
            onFilter={onFilter}
            onReuse={(run) => { setPrompt(run.prompt); setParentRunId(run.parent_run_id ?? null); }}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            moreError={moreError}
            onLoadMore={onLoadMore}
          />
        </div>
      </main>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, ApiError } from "@/lib/api";
import type { ProjectResponse, RunSummary, ProjectOverviewItem } from "@/lib/types";
import { ProjectDetail } from "@/components/dashboard/project-detail";
import { AppHeader } from "@/components/dashboard/app-header";
import { Button } from "@/components/ui/button";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [filtering, setFiltering] = useState(false);
  const generation = useRef(0);
  const previousFilters = useRef({ id, query, outcome });
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [stats, setStats] = useState<ProjectOverviewItem["stats"] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProject, page] = await Promise.all([api.getProject(id), api.projectRunPage(id)]);
      setProject(nextProject);
      setHistory(page.items);
      setStats(page.stats);
      setNextCursor(page.next_cursor);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Couldn't load this project.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    const previous = previousFilters.current;
    previousFilters.current = { id, query, outcome };
    // load() owns the initial page; only changed filters need a debounced refresh.
    if (previous.id === id && previous.query === query && previous.outcome === outcome) return;
    const current = ++generation.current;
    const timer = setTimeout(async () => {
      setFiltering(true); setMoreError(null);
      try { const page = await api.projectRunPage(id, undefined, query, outcome); if (current !== generation.current) return; setHistory(page.items); setStats(page.stats); setNextCursor(page.next_cursor); }
      catch (err) { if (current === generation.current) setMoreError(err instanceof ApiError ? err.message : "Could not search runs."); }
      finally { if (current === generation.current) setFiltering(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [id, query, outcome]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const current = generation.current;
      const page = await api.projectRunPage(id, nextCursor, query, outcome);
      if (current !== generation.current) return;
      setHistory((current) => [...current, ...page.items]);
      setStats(page.stats);
      setNextCursor(page.next_cursor);
    } catch (err) {
      setMoreError(err instanceof ApiError ? err.message : "Couldn't load more runs.");
    } finally {
      setLoadingMore(false);
    }
  }, [id, loadingMore, nextCursor, query, outcome]);

  useEffect(() => {
    if (!getToken()) {
      // `replace` so Back cannot return to a page this visitor cannot see.
      router.replace("/login");
      return;
    }
    void load();
  }, [load, router]);

  if (error) {
    return (
      <div className="cf-project-detail min-h-screen bg-bg">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[760px] flex-col items-center px-6 py-24 text-center">
          <span className="rounded-xl border border-danger-bd bg-danger-soft px-3 py-1.5 text-[12px] font-[650] text-danger">
            Project unavailable
          </span>
          <h1 className="font-display mt-5 text-[25px] font-[650] tracking-[-0.045em] text-fg">
            Couldn&apos;t open this workspace
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-fg-muted">{error}</p>
          <Button onClick={() => void load()} disabled={loading} className="mt-7">Try again</Button>
          <Link
            href="/projects"
            className="mt-4 text-[13px] font-[650] text-fg-muted hover:text-fg"
          >
            Back to projects
          </Link>
        </main>
      </div>
    );
  }

  if (!project || loading) {
    return (
      <div className="cf-project-detail min-h-screen bg-bg" aria-label="Loading project" aria-live="polite">
        <AppHeader />
        <main className="mx-auto w-full max-w-[1320px] px-6 pb-20 pt-8 md:px-10 lg:px-14">
          <div className="h-3 w-24 animate-pulse rounded bg-border" />
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="p-6 md:p-8">
              <div className="h-9 w-64 animate-pulse rounded bg-border" />
              <div className="mt-4 h-3 w-4/5 animate-pulse rounded bg-border" />
              <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-border" />
            </div>
            <div className="grid grid-cols-2 border-t border-rule bg-surface-2/65 sm:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="min-h-[86px] animate-pulse border-r border-rule p-5">
                  <div className="h-2 w-16 rounded bg-border" />
                  <div className="mt-4 h-7 w-10 rounded bg-border" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
            <div className="h-[430px] animate-pulse rounded-xl border border-border bg-surface" />
            <div className="h-[330px] animate-pulse rounded-xl border border-border bg-surface" />
          </div>
          <span className="sr-only">Loading project</span>
        </main>
      </div>
    );
  }

  return <ProjectDetail key={id} onProjectSaved={setProject} query={query} outcome={outcome} filtering={filtering} onFilter={(q, status) => { setQuery(q); setOutcome(status); }} project={project} history={history} stats={stats} nextCursor={nextCursor} loadingMore={loadingMore} moreError={moreError} onLoadMore={loadMore} />;
}

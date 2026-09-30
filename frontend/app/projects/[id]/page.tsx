"use client";

import { useCallback, useEffect, useState } from "react";
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

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api.projectRunPage(id, nextCursor);
      setHistory((current) => [...current, ...page.items]);
      setStats(page.stats);
      setNextCursor(page.next_cursor);
    } catch (err) {
      setMoreError(err instanceof ApiError ? err.message : "Couldn't load more runs.");
    } finally {
      setLoadingMore(false);
    }
  }, [id, loadingMore, nextCursor]);

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

  return <ProjectDetail project={project} history={history} stats={stats} nextCursor={nextCursor} loadingMore={loadingMore} moreError={moreError} onLoadMore={loadMore} />;
}

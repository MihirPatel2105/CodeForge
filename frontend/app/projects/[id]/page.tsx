"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, ApiError } from "@/lib/api";
import type { ProjectResponse, RunSummary } from "@/lib/types";
import { ProjectDetail } from "@/components/dashboard/project-detail";
import { AppHeader } from "@/components/dashboard/app-header";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      // `replace` so Back cannot return to a page this visitor cannot see.
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const [p, runs] = await Promise.all([api.getProject(id), api.listProjectRuns(id)]);
        setProject(p);
        setHistory(runs);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Couldn't load this project.");
      }
    })();
  }, [id, router]);

  if (error) {
    return (
      <div className="cf-project-detail min-h-screen bg-bg">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[760px] flex-col items-center px-6 py-24 text-center">
          <span className="rounded-full border border-danger-bd bg-danger-soft px-3 py-1.5 font-mono text-[9.5px] font-[650] uppercase tracking-[0.13em] text-danger">
            project unavailable
          </span>
          <h1 className="font-display mt-5 text-[25px] font-[650] tracking-[-0.045em] text-fg">
            Couldn&apos;t open this workspace
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-fg-muted">{error}</p>
          <Link
            href="/projects"
            className="mt-7 rounded-lg bg-fg px-5 py-3 font-mono text-[10.5px] font-[650] uppercase tracking-[0.12em] text-surface"
          >
            Back to projects
          </Link>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="cf-project-detail min-h-screen bg-bg" aria-label="Loading project" aria-live="polite">
        <AppHeader />
        <main className="mx-auto w-full max-w-[1320px] px-6 pb-20 pt-12 md:px-10 lg:px-14">
          <div className="h-3 w-24 animate-pulse rounded bg-border" />
          <div className="mt-6 grid min-h-[240px] overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[minmax(0,1.35fr)_minmax(390px,0.65fr)]">
            <div className="p-8 md:p-10">
              <div className="h-7 w-40 animate-pulse rounded-full bg-accent-soft" />
              <div className="mt-7 h-10 w-64 animate-pulse rounded bg-border" />
              <div className="mt-4 h-3 w-4/5 animate-pulse rounded bg-border" />
              <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-border" />
            </div>
            <div className="cf-invert grid grid-cols-2 bg-bg">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="min-h-[110px] animate-pulse border border-rule p-5">
                  <div className="h-2 w-16 rounded bg-border" />
                  <div className="mt-4 h-7 w-10 rounded bg-border" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-7 xl:grid-cols-[390px_minmax(0,1fr)]">
            <div className="h-[430px] animate-pulse rounded-xl border border-border bg-surface" />
            <div className="h-[330px] animate-pulse rounded-xl border border-border bg-surface" />
          </div>
          <span className="sr-only">Loading project</span>
        </main>
      </div>
    );
  }

  return <ProjectDetail project={project} history={history} />;
}

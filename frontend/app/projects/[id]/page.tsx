"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getToken, ApiError } from "@/lib/api";
import type { ProjectResponse, RunSummary } from "@/lib/types";
import { ProjectDetail } from "@/components/dashboard/project-detail";

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
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <p className="text-[13.5px] text-danger">{error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <p className="text-[13px] text-fg-faint">Loading…</p>
      </div>
    );
  }

  return <ProjectDetail project={project} history={history} />;
}

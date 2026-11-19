"use client";

import "@/components/dashboard/workspace-design.css";
import "@/components/dashboard/projects-editorial.css";
import "@/components/ui/axd-dialog.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/dashboard/app-header";
import { NeedsYouStrip } from "@/components/dashboard/needs-you-strip";
import { ProjectListHeader, ProjectListRow, ProjectsSummary, ProjectTile } from "@/components/dashboard/project-list-row";
import { ProjectsToolbar, type ProjectLayout } from "@/components/dashboard/projects-toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, getToken } from "@/lib/api";
import { hasLiveRun, type ProjectState } from "@/lib/project-insights";
import type { ProjectOverviewItem, ProjectResponse } from "@/lib/types";
import { useProjectListKeys } from "@/lib/use-project-list-keys";
import { readLocal, writeLocal } from "@/lib/workspace-storage";

const LAYOUT_KEY = "codeforge:projects:layout";
const PAGE_SIZE = 20;
const MAX_PAGE = 50;
/** How often the list re-reads itself while one of its projects has a run in flight. */
const LIVE_REFRESH_MS = 5000;
const SEARCH_DEBOUNCE_MS = 300;

interface Totals {
  projects: number;
  runs: number;
  succeeded: number;
}

/** Projects: a dense index of every API, ordered by latest activity. */
export default function ProjectsPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [projects, setProjects] = useState<ProjectOverviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [stateFilter, setStateFilter] = useState<ProjectState | null>(null);
  const [layout, setLayout] = useState<ProjectLayout>("list");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals>({ projects: 0, runs: 0, succeeded: 0 });
  const [matchingProjects, setMatchingProjects] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useProjectListKeys(searchRef);
  useEffect(() => setLayout(readLocal<ProjectLayout>(LAYOUT_KEY, "list") === "grid" ? "grid" : "list"), []);

  const load = useCallback(
    async ({ silent = false, limit = PAGE_SIZE }: { silent?: boolean; limit?: number } = {}) => {
      const currentRequest = ++requestId.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const page = await api.projectOverview({ q: search.trim(), archived, state: stateFilter, limit });
        if (currentRequest !== requestId.current) return;
        setProjects(page.items);
        setNextCursor(page.next_cursor);
        setTotals({ projects: page.total_projects, runs: page.total_runs, succeeded: page.total_succeeded });
        setMatchingProjects(page.matching_projects);
        setRefreshKey((key) => key + 1);
      } catch (err) {
        if (currentRequest !== requestId.current) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        // A background refresh that fails keeps the list on screen rather than blanking it.
        if (!silent) setError(err instanceof ApiError ? err.message : "Couldn't load projects.");
      } finally {
        if (currentRequest === requestId.current && !silent) setLoading(false);
      }
    },
    [router, search, archived, stateFilter],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const currentRequest = requestId.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await api.projectOverview({ cursor: nextCursor, q: search.trim(), archived, state: stateFilter });
      if (currentRequest !== requestId.current) return;
      setProjects((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err instanceof ApiError ? err.message : "Couldn't load more projects.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, search, archived, stateFilter]);

  useEffect(() => {
    if (!getToken()) {
      // `replace` so Back cannot return to a page this visitor cannot see.
      router.replace("/login");
      return;
    }
    const timer = setTimeout(() => void load(), search.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [router, load, search]);

  // Re-read the rows already on screen while a run is in flight, so a finishing run
  // changes its row without a reload. Stops by itself once nothing is running.
  const shownCount = projects?.length ?? 0;
  const live = projects != null && hasLiveRun(projects);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ silent: true, limit: Math.min(Math.max(shownCount, PAGE_SIZE), MAX_PAGE) });
      }
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, load, shownCount]);

  const refresh = useCallback(
    () => void load({ silent: true, limit: Math.min(Math.max(shownCount, PAGE_SIZE), MAX_PAGE) }),
    [load, shownCount],
  );

  function changeLayout(next: ProjectLayout) {
    setLayout(next);
    writeLocal(LAYOUT_KEY, next);
  }

  const projectNames = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project.name])),
    [projects],
  );
  const query = search.trim();
  const filtered = Boolean(query || stateFilter);

  return (
    <div className="cf-projects axp-page min-h-screen bg-bg">
      <AppHeader />
      <main className="cf-page pb-20 pt-8 md:pt-10">
        <header className="axp-head flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-fg">Projects</h1>
            {totals.projects > 0 && (
              <ProjectsSummary projects={totals.projects} runs={totals.runs} succeeded={totals.succeeded} />
            )}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="axp-new h-10 gap-2 rounded-xl px-4 text-[13.5px]" />}>
              <Plus className="size-4" aria-hidden />
              New project
            </DialogTrigger>
            <NewProjectDialogContent
              onCreated={() => {
                setSearch("");
                setStateFilter(null);
                toast.success("Project created.");
                setOpen(false);
                void load();
              }}
            />
          </Dialog>
        </header>

        <div className="mt-6 flex flex-col gap-4">
          <NeedsYouStrip projectNames={projectNames} refreshKey={refreshKey} />
          {(projects == null || projects.length > 0 || filtered || archived) && (
            <ProjectsToolbar
              archived={archived}
              onArchivedChange={setArchived}
              state={stateFilter}
              onStateChange={setStateFilter}
              search={search}
              onSearchChange={setSearch}
              layout={layout}
              onLayoutChange={changeLayout}
              searchRef={searchRef}
            />
          )}
        </div>

        {error && (
          <Notice className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>{error}</p>
              <Button type="button" variant="outline" onClick={() => void (nextCursor && projects ? loadMore() : load())} disabled={loading || loadingMore}>
                Try again
              </Button>
            </div>
          </Notice>
        )}

        {loading && projects == null ? (
          <LoadingState layout={layout} />
        ) : projects == null ? null : projects.length === 0 && !filtered && !archived ? (
          <EmptyState onNewProject={() => setOpen(true)} />
        ) : (
          <section className="axp-results" aria-label="Your projects">
            <p role="status" className="axp-count">
              {filtered
                ? `${projects.length} of ${matchingProjects} matching projects shown`
                : `${projects.length} of ${totals.projects} projects shown`}
            </p>
            {projects.length === 0 ? (
              <FilteredEmpty
                archived={archived}
                query={query}
                stateFilter={stateFilter}
                onClearSearch={() => setSearch("")}
                onClearState={() => setStateFilter(null)}
                onShowActive={() => setArchived(false)}
              />
            ) : layout === "list" ? (
              <div className="axp-list">
                <ProjectListHeader />
                <ul aria-label="Projects">
                  {projects.map((project) => (
                    <ProjectListRow key={project.id} project={project} onChanged={refresh} />
                  ))}
                </ul>
              </div>
            ) : (
              <ul aria-label="Projects" className="axp-grid">
                {projects.map((project) => (
                  <ProjectTile key={project.id} project={project} onChanged={refresh} />
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {nextCursor ? (
                <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more projects"}
                </Button>
              ) : <span />}
              {projects.length > 0 && (
                <p className="hidden text-[11.5px] text-fg-faint md:block">
                  <kbd className="font-mono">j</kbd> / <kbd className="font-mono">k</kbd> to move,{" "}
                  <kbd className="font-mono">Enter</kbd> to open, <kbd className="font-mono">/</kbd> to search
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}


function FilteredEmpty({
  archived,
  query,
  stateFilter,
  onClearSearch,
  onClearState,
  onShowActive,
}: {
  archived: boolean;
  query: string;
  stateFilter: ProjectState | null;
  onClearSearch: () => void;
  onClearState: () => void;
  onShowActive: () => void;
}) {
  const title = query
    ? archived ? "No archived projects found" : "No matching projects"
    : stateFilter ? "No projects in this state" : archived ? "No archived projects yet" : "No matching projects";
  const description = query
    ? "Try a different name or description."
    : stateFilter ? "Each project is filed by its latest run." : "Projects you archive will appear here.";
  return (
    <Empty className="border border-border bg-surface py-14">
      <EmptyHeader>
        <EmptyTitle><h3>{title}</h3></EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {query ? (
          <Button variant="outline" onClick={onClearSearch}>Clear search</Button>
        ) : stateFilter ? (
          <Button variant="outline" onClick={onClearState}>Show all projects</Button>
        ) : (
          <Button variant="outline" onClick={onShowActive}>Back to active projects</Button>
        )}
      </EmptyContent>
    </Empty>
  );
}

function EmptyState({ onNewProject }: { onNewProject: () => void }) {
  return (
    <Empty className="cf-project-empty mt-8 min-h-[360px] border border-border py-16">
      <EmptyHeader>
        <FolderPlus className="size-8 text-fg-muted" aria-hidden />
        <EmptyTitle><h2 className="font-display text-2xl font-semibold">Start your first API project</h2></EmptyTitle>
        <EmptyDescription>A project holds the runs for one API. Name it after the thing you are building.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onNewProject}><Plus aria-hidden />New project</Button>
      </EmptyContent>
    </Empty>
  );
}

/** Placeholders in the exact shape of the layout they stand in for, so nothing jumps. */
function LoadingState({ layout }: { layout: ProjectLayout }) {
  const rows = [0, 1, 2, 3];
  return (
    <div className="mt-5" aria-label="Loading projects" aria-live="polite">
      <div className="mb-3 h-3 w-36 animate-pulse rounded bg-border" />
      {layout === "list" ? (
        <div className="axp-list">
          <div className="axp-list-head h-[29px]" />
          {rows.map((row) => (
            <div key={row} className="axp-row grid">
              <div className="space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded bg-border" />
                <div className="h-3 w-56 max-w-full animate-pulse rounded bg-border/70" />
              </div>
              <div className="hidden h-3.5 w-16 animate-pulse rounded bg-border md:block" />
              <div className="hidden h-3 w-20 animate-pulse rounded bg-border md:block" />
              <div className="hidden h-3.5 w-24 animate-pulse rounded bg-border md:block" />
              <div className="hidden h-3.5 w-20 animate-pulse rounded bg-border md:block" />
            </div>
          ))}
        </div>
      ) : (
        <div className="axp-grid">
          {rows.map((row) => (
            <div key={row} className="axp-card h-[196px] animate-pulse" />
          ))}
        </div>
      )}
      <span className="sr-only">Loading projects</span>
    </div>
  );
}

function NewProjectDialogContent({ onCreated }: { onCreated: (project: ProjectResponse) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const project = await api.createProject({ name, description: description || undefined });
      setName("");
      setDescription("");
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the project.");
      toast.error("Couldn't create the project. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="cf-workspace-dialog axd p-0 sm:max-w-[480px]">
      <DialogHeader className="axd-head">
        <DialogTitle className="axd-title">New project</DialogTitle>
        <DialogDescription className="axd-lede">One project holds every run for one API. You can rename it later.</DialogDescription>
      </DialogHeader>
      <form className="axd-form" onSubmit={handleSubmit}>
        <div className="axd-field">
          <Label htmlFor="project-name" className="axd-label">
            Name
          </Label>
          <Input
            id="project-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Book Collection API"
            className="axd-input"
          />
        </div>
        <div className="axd-field">
          <Label htmlFor="project-description" className="axd-label">
            Description <span>optional</span>
          </Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this API for?"
            className="axd-input"
          />
        </div>
        {error && <p role="alert" className="axd-error">{error}</p>}
        <div className="axd-actions">
          <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
          <Button type="submit" disabled={submitting} className="axd-submit">
            {submitting && <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
            {submitting ? "Creating project…" : "Create project"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

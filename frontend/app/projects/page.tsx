"use client";

import "@/components/dashboard/workspace-design.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/dashboard/app-header";
import { NeedsYouStrip } from "@/components/dashboard/needs-you-strip";
import { LIST_COLUMNS, ProjectListRow, ProjectTile } from "@/components/dashboard/project-list-row";
import { ProjectsToolbar, type ProjectLayout } from "@/components/dashboard/projects-toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedNumber } from "@/components/ui/vengeance/animated-number";
import { api, ApiError, getToken } from "@/lib/api";
import { hasLiveRun, type ProjectState } from "@/lib/project-insights";
import type { ProjectOverviewItem, ProjectResponse } from "@/lib/types";
import { useProjectListKeys } from "@/lib/use-project-list-keys";
import { readLocal, writeLocal } from "@/lib/workspace-storage";
import { cn } from "@/lib/utils";

const LABEL = "text-[12px] font-[650] text-fg-muted";
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
  const passed = totals.runs > 0 ? Math.round((totals.succeeded / totals.runs) * 100) : null;

  return (
    <div className="cf-projects min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 md:px-10 md:pt-10">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-fg">Projects</h1>
            {totals.projects > 0 && (
              <dl className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[12.5px] text-fg-muted">
                <Total label="Projects" value={totals.projects} unit={totals.projects === 1 ? "project" : "projects"} />
                <Total label="Runs" value={totals.runs} unit={totals.runs === 1 ? "run" : "runs"} separated />
                <Total
                  label="Successful runs"
                  value={totals.succeeded}
                  unit="passed"
                  note={passed != null ? `(${passed}%)` : undefined}
                  separated
                />
              </dl>
            )}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="h-10 gap-2 rounded-xl px-4 text-[13.5px]" />}>
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
          <section className="mt-5" aria-label="Your projects">
            <p role="status" className="mb-3 text-[12px] font-[550] text-fg-muted">
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
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className={cn("hidden items-center gap-x-4 border-b border-rule bg-surface-2/70 px-5 py-2 text-[11.5px] font-[650] text-fg-faint md:grid", LIST_COLUMNS)} aria-hidden>
                  <span>Project</span>
                  <span>Status</span>
                  <span>Recent runs</span>
                  <span>Pass rate</span>
                  <span>Runs</span>
                  <span>Updated</span>
                  <span />
                </div>
                <ul aria-label="Projects">
                  {projects.map((project) => (
                    <ProjectListRow key={project.id} project={project} onChanged={refresh} />
                  ))}
                </ul>
              </div>
            ) : (
              <ul aria-label="Projects" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

function Total({
  label,
  value,
  unit,
  note,
  separated,
}: {
  label: string;
  value: number;
  unit: string;
  note?: string;
  separated?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="flex items-center gap-1.5">
        {separated && <span aria-hidden>·</span>}
        <span className="font-[650] text-fg"><AnimatedNumber value={value} /></span>
        <span aria-hidden>{unit}</span>
        {note && <span className="text-ok">{note}</span>}
      </dd>
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
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="hidden h-[33px] border-b border-rule bg-surface-2/70 md:block" />
          {rows.map((row) => (
            <div key={row} className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-4 border-b border-rule px-5 py-3.5 last:border-b-0", LIST_COLUMNS)}>
              <div className="flex items-center gap-3 md:col-span-1">
                <div className="size-9 shrink-0 animate-pulse rounded-[10px] bg-border" />
                <div className="hidden flex-1 space-y-2 md:block">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-border" />
                  <div className="h-3 w-56 max-w-full animate-pulse rounded bg-border/70" />
                </div>
              </div>
              <div className="space-y-2 md:hidden">
                <div className="h-3.5 w-40 animate-pulse rounded bg-border" />
                <div className="h-3 w-48 animate-pulse rounded bg-border/70" />
              </div>
              <div className="hidden h-6 w-20 animate-pulse rounded-full bg-border md:block" />
              <div className="hidden h-4 w-24 animate-pulse rounded bg-border md:block" />
              <div className="hidden h-3.5 w-10 animate-pulse rounded bg-border md:block" />
              <div className="hidden h-3.5 w-6 animate-pulse rounded bg-border md:block" />
              <div className="hidden h-3.5 w-20 animate-pulse rounded bg-border md:block" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row} className="h-[184px] animate-pulse rounded-2xl border border-border bg-surface" />
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
    <DialogContent className="cf-workspace-dialog rounded-xl border-border p-0 shadow-[0_30px_90px_rgba(22,24,28,0.2)]">
      <div className="border-b border-rule bg-surface-2 px-6 py-5">
        <DialogHeader>
          <span className={LABEL}>create workspace</span>
          <DialogTitle className="font-display mt-2 text-[22px] tracking-[-0.04em]">
            New project
          </DialogTitle>
        </DialogHeader>
      </div>
      <form className="flex flex-col gap-4 px-6 pb-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="project-name" className={LABEL}>
            Name
          </Label>
          <Input
            id="project-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Book Collection API"
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <Label htmlFor="project-description" className={LABEL}>
            Description (optional)
          </Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this API for?"
          />
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <DialogFooter className="mt-2 border-t border-rule pt-5">
          <Button type="submit" disabled={submitting} className="min-w-[136px]">
            {submitting && <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
            {submitting ? "Creating project…" : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

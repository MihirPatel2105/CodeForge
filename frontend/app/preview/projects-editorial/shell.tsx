"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ProjectListRow, ProjectTile } from "@/components/dashboard/project-list-row";
import { ProjectsToolbar, type ProjectLayout } from "@/components/dashboard/projects-toolbar";
import { Button } from "@/components/ui/button";
import { stateOf, type ProjectState } from "@/lib/project-insights";
import { useProjectListKeys } from "@/lib/use-project-list-keys";
import { cn } from "@/lib/utils";
import {
  EditorialListHeader, EditorialProjectCard, EditorialProjectRow, EditorialProjectsToolbar, ProjectsSummary,
} from "./editorial-projects";
import { SAMPLE_PROJECTS } from "./sample-projects";

type Version = "current" | "anthropic";

/** The projects page, current vs Anthropic-style, one mounted at a time (they share ids). */
export function ProjectsEditorialShell() {
  const [version, setVersion] = useState<Version>("anthropic");
  const [archived, setArchived] = useState(false);
  const [state, setState] = useState<ProjectState | null>(null);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<ProjectLayout>("grid");
  const searchRef = useRef<HTMLInputElement>(null);
  useProjectListKeys(searchRef);

  const inView = SAMPLE_PROJECTS.filter((p) => Boolean(p.archived) === archived);
  const needle = search.trim().toLowerCase();
  const shown = inView
    .filter((p) => !state || stateOf(p) === state)
    .filter((p) => !needle || `${p.name} ${p.description}`.toLowerCase().includes(needle));
  const active = SAMPLE_PROJECTS.filter((p) => !p.archived);
  const totals = {
    projects: active.length,
    runs: active.reduce((n, p) => n + p.stats.total, 0),
    succeeded: active.reduce((n, p) => n + p.stats.succeeded, 0),
  };
  const toolbar = {
    archived, onArchivedChange: setArchived, state, onStateChange: setState,
    search, onSearchChange: setSearch, layout, onLayoutChange: setLayout, searchRef,
  };
  const noop = () => {};
  const isEditorial = version === "anthropic";

  return (
    <div className={cn("cf-projects min-h-screen bg-bg", isEditorial && "axp-page")}>
      <div className="axp-switch" role="group" aria-label="Design version">
        {(["current", "anthropic"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={version === v} onClick={() => setVersion(v)}>
            {v === "current" ? "Current" : "Anthropic-style"}
          </button>
        ))}
      </div>
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 md:px-10 md:pt-10">
        <header className="axp-head flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-fg">Projects</h1>
            {isEditorial ? <ProjectsSummary {...totals} /> : (
              <p className="mt-2 font-mono text-[12.5px] text-fg-muted">
                {totals.projects} projects · {totals.runs} runs · {totals.succeeded} passed
              </p>
            )}
          </div>
          <Button className={cn("h-10 gap-2 rounded-xl px-4 text-[13.5px]", isEditorial && "axp-new")}>
            <Plus className="size-4" aria-hidden />
            New project
          </Button>
        </header>

        <div className="mt-6">
          {isEditorial ? <EditorialProjectsToolbar {...toolbar} /> : <ProjectsToolbar {...toolbar} />}
        </div>

        <section className={isEditorial ? "axp-results" : "mt-5"} aria-label="Your projects">
          <p role="status" className={isEditorial ? "axp-count" : "mb-3 text-[12px] font-[550] text-fg-muted"}>
            {shown.length} of {inView.length} {archived ? "archived " : ""}projects shown
          </p>
          {shown.length === 0 ? (
            <p className="axp-empty">No projects match. Try another status or search.</p>
          ) : isEditorial ? (
            layout === "grid" ? (
              <ul aria-label="Projects" className="axp-grid">
                {shown.map((p) => <EditorialProjectCard key={p.id} project={p} onChanged={noop} />)}
              </ul>
            ) : (
              <div className="axp-list">
                <EditorialListHeader />
                <ul aria-label="Projects">{shown.map((p) => <EditorialProjectRow key={p.id} project={p} onChanged={noop} />)}</ul>
              </div>
            )
          ) : layout === "grid" ? (
            <ul aria-label="Projects" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => <ProjectTile key={p.id} project={p} onChanged={noop} />)}
            </ul>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <ul aria-label="Projects">{shown.map((p) => <ProjectListRow key={p.id} project={p} onChanged={noop} />)}</ul>
            </div>
          )}
          <p className="axp-keys">
            <kbd>j</kbd> / <kbd>k</kbd> to move, <kbd>Enter</kbd> to open, <kbd>/</kbd> to search
          </p>
        </section>
      </main>
    </div>
  );
}

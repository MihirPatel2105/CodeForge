"use client";

import type { Ref } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import type { ProjectState } from "@/lib/project-insights";

export type ProjectLayout = "list" | "grid";

const STATES: { value: ProjectState | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "needs_you", label: "Needs you" },
  { value: "running", label: "Running" },
  { value: "failing", label: "Failing" },
  { value: "passing", label: "Passed" },
];

export interface ProjectsToolbarProps {
  archived: boolean;
  onArchivedChange: (archived: boolean) => void;
  state: ProjectState | null;
  onStateChange: (state: ProjectState | null) => void;
  search: string;
  onSearchChange: (search: string) => void;
  layout: ProjectLayout;
  onLayoutChange: (layout: ProjectLayout) => void;
  searchRef?: Ref<HTMLInputElement>;
}

/**
 * The projects toolbar as one quiet line: status as text tabs on the left; view, search and
 * layout on the right; a single hairline beneath.
 */
export function ProjectsToolbar({
  archived, onArchivedChange, state, onStateChange, search, onSearchChange, layout, onLayoutChange, searchRef,
}: ProjectsToolbarProps) {
  return (
    <div className="axp-toolbar">
      <div className="axp-tabs" role="group" aria-label="Filter by status">
        {STATES.map((option) => (
          <button key={option.label} type="button" aria-pressed={state === option.value} onClick={() => onStateChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="axp-tools">
        <div className="axp-view" role="group" aria-label="Project view">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={archived === value}
              aria-label={value ? "Archived projects" : "Active projects"}
              onClick={() => onArchivedChange(value)}
            >
              {value ? "Archived" : "Active"}
            </button>
          ))}
        </div>
        <label className="axp-search">
          <Search aria-hidden />
          <span className="sr-only">Search projects</span>
          <input
            ref={searchRef}
            id="project-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search projects"
            aria-keyshortcuts="/"
          />
          <kbd aria-hidden>/</kbd>
        </label>
        <div className="axp-layout" role="group" aria-label="Layout">
          {(["list", "grid"] as const).map((value) => {
            const Icon = value === "list" ? List : LayoutGrid;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={layout === value}
                aria-label={value === "list" ? "List layout" : "Grid layout"}
                onClick={() => onLayoutChange(value)}
              >
                <Icon aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

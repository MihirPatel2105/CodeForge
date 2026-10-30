"use client";

import type { Ref } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProjectState } from "@/lib/project-insights";
import { cn } from "@/lib/utils";

export type ProjectLayout = "list" | "grid";

const STATES: { value: ProjectState | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "needs_you", label: "Needs you" },
  { value: "running", label: "Running" },
  { value: "failing", label: "Failing" },
  { value: "passing", label: "Passing" },
];

const SEGMENT =
  "rounded-[9px] px-3 py-1.5 text-[13px] font-[600] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const SEGMENT_ON = "bg-surface text-fg shadow-[0_1px_2px_rgba(22,24,28,0.08)]";
const SEGMENT_OFF = "text-fg-muted hover:text-fg";

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

/** View, status filter, search and layout for the projects list, in one row. */
export function ProjectsToolbar({
  archived,
  onArchivedChange,
  state,
  onStateChange,
  search,
  onSearchChange,
  layout,
  onLayoutChange,
  searchRef,
}: ProjectsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1" role="group" aria-label="Project view">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={archived === value}
              onClick={() => onArchivedChange(value)}
              className={cn(SEGMENT, archived === value ? SEGMENT_ON : SEGMENT_OFF)}
            >
              {value ? "Archived projects" : "Active projects"}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <label htmlFor="project-search" className="sr-only">Search projects</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint" aria-hidden />
          <Input
            ref={searchRef}
            id="project-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search projects"
            aria-keyshortcuts="/"
            className="h-10 rounded-xl border-border-strong bg-surface pl-10 pr-10 text-[14px]"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border px-1.5 font-mono text-[11px] text-fg-faint" aria-hidden>
            /
          </kbd>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1" role="group" aria-label="Layout">
          {(["list", "grid"] as const).map((value) => {
            const Icon = value === "list" ? List : LayoutGrid;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={layout === value}
                aria-label={value === "list" ? "List layout" : "Grid layout"}
                onClick={() => onLayoutChange(value)}
                className={cn(SEGMENT, "px-2.5", layout === value ? SEGMENT_ON : SEGMENT_OFF)}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        {STATES.map((option) => {
          const active = state === option.value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => onStateChange(option.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] font-[600] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "border-accent-bd bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, CornerDownLeft, Folder, FolderOpen, LayoutGrid, Search, Settings2, ShieldCheck, TerminalSquare, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { SearchModal, type SearchScope } from "@/components/ui/vengeance/search-modal";
import { api } from "@/lib/api";
import type { ProjectResponse } from "@/lib/types";
import "./command-palette.css";

type Entry = { id: string; label: string; detail: string; href: string; group: string; icon: LucideIcon; keywords?: string };

function score(entry: Entry, query: string) {
  const label = entry.label.toLowerCase();
  const text = `${label} ${entry.detail} ${entry.keywords ?? ""}`.toLowerCase();
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let total = 0;
  for (const word of words) {
    if (label.startsWith(word)) total += 100;
    else if (label.includes(word)) total += 70;
    else if (text.includes(word)) total += 40;
    else {
      let cursor = 0;
      for (const character of label) if (character === word[cursor]) cursor++;
      if (cursor !== word.length) return 0;
      total += 10;
    }
  }
  return total;
}

export function CommandPalette({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [selected, setSelected] = useState(0);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  const listId = useId();

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcutLabel("⌘ K");
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) { setQuery(""); setScope("all"); setSelected(0); }
  }

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k" && !event.isComposing) {
        // Don't stack the palette over another modal's focus trap.
        if (!open && document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        event.preventDefault();
        if (!event.repeat) changeOpen(!open);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [open]);

  useEffect(() => {
    if (previousPath.current !== pathname) { setOpen(false); previousPath.current = pathname; }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setFailed(false);
    api.listProjects().then(items => {
      if (active) setProjects(items.filter(project => !project.archived));
    }).catch(() => {
      if (active) { setProjects([]); setFailed(true); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, attempt]);

  const entries = useMemo(() => {
    const run = pathname.match(/^\/runs\/([^/]+)/)?.[1];
    const items: Entry[] = [
      ...(run ? [
        { id: "run", label: "Open run dashboard", detail: "Agents, code and test results", href: `/runs/${run}`, group: "This API", icon: TerminalSquare, keywords: "failures tests timeline" },
        { id: "tester", label: "Open API tester", detail: "Send requests and inspect responses", href: `/runs/${run}/try`, group: "This API", icon: ArrowUpRight, keywords: "playground endpoints query" },
        { id: "use", label: "Use your API", detail: "Test, download or publish", href: `/runs/${run}/use`, group: "This API", icon: BookOpen },
      ] : []),
      { id: "projects", label: "All projects", detail: "Your APIs and agent runs", href: "/projects", group: "Workspace", icon: LayoutGrid, keywords: "home dashboard new create" },
      { id: "profile", label: "Your profile", detail: "Personal details and account", href: "/profile", group: "Workspace", icon: UserRound },
      { id: "settings", label: "Account settings", detail: "Security, devices and sign-in", href: "/profile/settings", group: "Workspace", icon: Settings2, keywords: "sessions password passkeys auth" },
      ...(isAdmin ? [{ id: "admin", label: "Admin dashboard", detail: "Manage platform activity", href: "/admin", group: "Workspace", icon: ShieldCheck }] : []),
      ...projects.map(project => ({ id: `project-${project.id}`, label: project.name, detail: project.description || "Open project workspace", href: `/projects/${encodeURIComponent(project.id)}`, group: "Projects", icon: FolderOpen })),
      { id: "help", label: "Help and FAQ", detail: "Answers about building with CodeForge", href: "/faq", group: "Resources", icon: BookOpen, keywords: "docs support" },
    ];
    return items;
  }, [pathname, projects, isAdmin]);
  const results = useMemo(() => entries
    .filter(entry => scope === "all" || (scope === "projects" ? entry.group === "Projects" : entry.group !== "Projects"))
    .map(entry => ({ entry, rank: score(entry, query) })).filter(item => item.rank > 0)
    .sort((a, b) => b.rank - a.rank).map(item => item.entry), [entries, query, scope]);
  const activeIndex = Math.min(selected, Math.max(0, results.length - 1));
  const activeEntry = results[activeIndex];

  useEffect(() => {
    if (open && activeEntry) document.getElementById(`${listId}-${activeEntry.id}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeEntry, listId]);

  function execute(entry: Entry) {
    changeOpen(false);
    router.push(entry.href);
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger ref={trigger} className="cf-command-trigger" aria-label="Open command palette" aria-keyshortcuts="Meta+K Control+K">
      <Search size={16} aria-hidden /><span className="hidden lg:inline">Search anything</span><kbd className="hidden sm:inline-flex">{shortcutLabel}</kbd>
    </DialogTrigger>
    <SearchModal query={query} onQueryChange={value => { setQuery(value); setSelected(0); }}
      scope={scope} onScopeChange={value => { setScope(value); setSelected(0); }} onClose={() => changeOpen(false)}
      inputRef={input} triggerRef={trigger} listId={listId} activeId={activeEntry ? `${listId}-${activeEntry.id}` : undefined}
      resultCount={results.length} shortcut={shortcutLabel}
      onQueryKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setSelected(results.length ? (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);
            } else if (event.key === "Enter" && activeEntry) { event.preventDefault(); execute(activeEntry); }
          }}>
      <div className="cf-command-results" data-lenis-prevent>
        <div id={listId} role="listbox" aria-label="Commands and projects" aria-busy={loading}>
          {results.map((entry, index) => {
            const Icon = entry.icon;
            return <div key={entry.id}>
              {(index === 0 || results[index - 1].group !== entry.group) && <div className="cf-command-group" aria-hidden>{entry.group === "Workspace" ? "Quick actions" : entry.group}</div>}
              <div id={`${listId}-${entry.id}`} role="option" aria-selected={index === activeIndex} className="cf-command-option" onPointerMove={() => setSelected(index)} onMouseDown={event => event.preventDefault()} onClick={() => execute(entry)}>
                <span className="cf-command-icon"><Icon size={19} strokeWidth={1.65} aria-hidden /></span>
                <span className="cf-command-copy"><span className="cf-command-label">{entry.label}</span><span className="cf-command-detail">{entry.detail}</span></span>
                <span className="cf-command-enter" aria-hidden><CornerDownLeft size={15} /></span>
              </div>
            </div>;
          })}
        </div>
        {!results.length && <div className="cf-command-empty"><span className="cf-command-empty-icon"><Search size={24} strokeWidth={1.5} /></span><p>No matches found</p><span>Try a project name or an action like “settings”.</span><button onClick={() => { setQuery(""); setSelected(0); input.current?.focus(); }}>Clear search</button></div>}
        {loading && <p className="cf-command-notice" role="status"><Folder size={14} aria-hidden /> Finding your projects…</p>}
        {failed && <div className="cf-command-notice" role="status">Projects couldn&apos;t load. <button onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
      </div>
    </SearchModal>
  </Dialog>;
}

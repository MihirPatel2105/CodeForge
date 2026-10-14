"use client";

import type { KeyboardEventHandler, ReactNode, RefObject } from "react";
import { Command, CornerDownLeft, FolderOpen, Search, X } from "lucide-react";
import { DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type SearchScope = "all" | "projects" | "actions";

interface SearchModalProps {
  query: string;
  onQueryChange: (query: string) => void;
  onQueryKeyDown: KeyboardEventHandler<HTMLInputElement>;
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  listId: string;
  activeId?: string;
  resultCount: number;
  shortcut: string;
  children: ReactNode;
}

/** Vengeance UI Search Modal adaptation; source and MIT license in docs/vendor/vengeance-ui.md. */
export function SearchModal({ query, onQueryChange, onQueryKeyDown, scope, onScopeChange, onClose,
  inputRef, triggerRef, listId, activeId, resultCount, shortcut, children }: SearchModalProps) {
  return (
    <DialogContent className="cf-command-dialog vui-search-modal translate-x-0 translate-y-0" showCloseButton={false} initialFocus={inputRef} finalFocus={triggerRef}>
      <DialogTitle className="sr-only">Go anywhere</DialogTitle>
      <DialogDescription className="sr-only">Search projects and actions. Use the arrow keys to choose a result and Enter to open it.</DialogDescription>
      <div className="cf-command-search">
        <Search size={20} strokeWidth={1.7} aria-hidden />
        <input ref={inputRef} role="combobox" aria-label="Search commands and projects" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeId}
          placeholder="Search projects and actions…" value={query} autoComplete="off" spellCheck={false}
          onChange={event => onQueryChange(event.target.value)} onKeyDown={onQueryKeyDown} />
        <kbd className="cf-command-hotkey" aria-hidden>{shortcut}</kbd>
        <button type="button" className="cf-command-dismiss" onClick={onClose} aria-label="Close command palette"><X size={16} aria-hidden /></button>
      </div>
      <div className="cf-command-scopes">
        <span>Search in</span>
        <div role="group" aria-label="Search scope">
          {([["all", "All", Search], ["projects", "Projects", FolderOpen], ["actions", "Actions", Command]] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" aria-pressed={scope === value} onClick={() => onScopeChange(value)}>
              <Icon size={13} aria-hidden />{label}
            </button>
          ))}
        </div>
      </div>
      {children}
      <footer className="cf-command-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd><CornerDownLeft size={12} aria-hidden /></kbd> Open</span>
        <span><kbd>esc</kbd> Close</span>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">{resultCount} results</div>
    </DialogContent>
  );
}

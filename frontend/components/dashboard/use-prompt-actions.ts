"use client";

import { useState, type KeyboardEvent } from "react";
import { API_TEMPLATES } from "@/lib/workspace-storage";
import type { PromptStudioProps } from "./prompt-studio";

type Actions = Pick<PromptStudioProps, "prompt" | "onPromptChange" | "onDetachParent" | "starting" | "onStart">;

/**
 * Behaviour shared by every prompt-card design: templates never silently replace a typed
 * draft, and ⌘/Ctrl + Enter starts the run.
 */
export function usePromptActions({ prompt, onPromptChange, onDetachParent, starting, onStart }: Actions) {
  const [pendingTemplate, setPendingTemplate] = useState<number | null>(null);

  function applyTemplate(index: number) {
    onPromptChange(API_TEMPLATES[index].prompt);
    onDetachParent();
  }

  function chooseTemplate(index: number) {
    const draft = prompt.trim();
    if (draft && draft !== API_TEMPLATES[index].prompt) {
      setPendingTemplate(index);
      return;
    }
    applyTemplate(index);
  }

  // The confirm bar's buttons unmount on answer, so focus goes back to the writing surface.
  const refocusPrompt = () => requestAnimationFrame(() => document.getElementById("prompt")?.focus());

  function applyPending() {
    if (pendingTemplate == null) return;
    applyTemplate(pendingTemplate);
    setPendingTemplate(null);
    refocusPrompt();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (prompt.trim() && !starting) onStart();
    }
  }

  return {
    pendingName: pendingTemplate == null ? null : API_TEMPLATES[pendingTemplate].name,
    chooseTemplate,
    applyPending,
    keepDraft: () => { setPendingTemplate(null); refocusPrompt(); },
    handleKeyDown,
  };
}

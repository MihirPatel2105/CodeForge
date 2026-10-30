"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GenerateButton } from "@/components/ui/vengeance/generate-button";
import { API_TEMPLATES } from "@/lib/workspace-storage";

const MAX_PROMPT = 12000;
const VISIBLE_TEMPLATES = 6;
const PIPELINE = [
  { label: "PM" },
  { label: "you approve", checkpoint: true },
  { label: "Architect" },
  { label: "you approve", checkpoint: true },
  { label: "Coder ⇄ Reviewer" },
  { label: "Sandbox tests" },
];

export interface PromptStudioProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  ragEnabled: boolean;
  onRagChange: (enabled: boolean) => void;
  parentRunId: string | null;
  onDetachParent: () => void;
  draftStatus: string;
  error: string | null;
  starting: boolean;
  onStart: () => void;
}

/** The prompt is the hero: one large box, starter chips, and a single build action. */
export function PromptStudio({
  prompt,
  onPromptChange,
  ragEnabled,
  onRagChange,
  parentRunId,
  onDetachParent,
  draftStatus,
  error,
  starting,
  onStart,
}: PromptStudioProps) {
  const [pendingTemplate, setPendingTemplate] = useState<number | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  function chooseTemplate(index: number) {
    const draft = prompt.trim();
    // A typed draft is never overwritten silently.
    if (draft && draft !== API_TEMPLATES[index].prompt) {
      setPendingTemplate(index);
      return;
    }
    onPromptChange(API_TEMPLATES[index].prompt);
    onDetachParent();
  }

  function applyPending() {
    if (pendingTemplate == null) return;
    onPromptChange(API_TEMPLATES[pendingTemplate].prompt);
    onDetachParent();
    setPendingTemplate(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (prompt.trim() && !starting) onStart();
    }
  }

  return (
    <section className="cf-prompt-studio overflow-hidden rounded-3xl border border-border bg-surface lg:sticky lg:top-[88px]" aria-labelledby="prompt-studio-heading">
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 id="prompt-studio-heading" className="font-display text-[22px] font-[700] tracking-[-0.04em] text-fg">
            What should this API do?
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-fg-muted">
            Describe one or two entities, their fields, and the rules. The agents handle the rest.
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 font-mono text-[11px] text-fg-faint sm:inline-flex" aria-hidden>
          ⌘<CornerDownLeft className="size-3" /> to build
        </span>
      </div>

      <div className="px-6 pt-4">
        <div className="cf-prompt-box rounded-2xl border border-border-strong bg-bg/60 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
          <label htmlFor="prompt" className="sr-only">Describe the API</label>
          <Textarea
            id="prompt"
            maxLength={MAX_PROMPT}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="A contact directory with name, phone, email and a favourite flag. Email must be unique."
            className="min-h-[148px] resize-y border-0 bg-transparent px-4 py-3.5 text-[16px] leading-[1.6] shadow-none focus-visible:ring-0 md:text-[15px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label htmlFor="rag-enabled" className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-[600] text-fg-muted">
                <BookOpen className="size-3.5" aria-hidden />
                <span>{ragEnabled ? "Agents see 6 similar APIs" : "Agents use this prompt alone"}</span>
                <Switch id="rag-enabled" checked={ragEnabled} onCheckedChange={onRagChange} aria-label="Use example library" />
              </label>
              <span className="font-mono text-[11.5px] tabular-nums text-fg-faint">
                {prompt.length.toLocaleString()} / {MAX_PROMPT.toLocaleString()}
              </span>
            </div>
            <GenerateButton onClick={onStart} disabled={!prompt.trim()} isGenerating={starting} />
          </div>
        </div>

        {pendingTemplate != null && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-warn-bd bg-warn-soft px-3 py-2.5 text-[13px] text-warn" role="alert">
            <span className="min-w-0 flex-1">Replace your draft with the {API_TEMPLATES[pendingTemplate].name} template?</span>
            <Button size="sm" onClick={applyPending}>Replace draft</Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingTemplate(null)}>Keep my draft</Button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Start from a template">
          <span className="mr-1 text-[12px] font-[600] text-fg-faint">Start from</span>
          {API_TEMPLATES.slice(0, showAllTemplates ? undefined : VISIBLE_TEMPLATES).map((template, index) => (
            <button
              key={template.name}
              type="button"
              onClick={() => chooseTemplate(index)}
              className="cf-template-chip rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] font-[550] text-fg-muted transition-colors hover:border-accent-bd hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {template.name}
            </button>
          ))}
          {API_TEMPLATES.length > VISIBLE_TEMPLATES && (
            <button
              type="button"
              aria-expanded={showAllTemplates}
              onClick={() => setShowAllTemplates((current) => !current)}
              className="rounded-full px-2.5 py-1.5 text-[12.5px] font-[600] text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {showAllTemplates ? "Fewer templates" : `More templates (${API_TEMPLATES.length - VISIBLE_TEMPLATES})`}
            </button>
          )}
        </div>

        {parentRunId && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-accent-bd bg-accent-soft px-3 py-2.5 text-[13px]">
            <Link href={`/runs/${parentRunId}`} className="font-[600] text-accent underline-offset-2 hover:underline">Revising an existing API</Link>
            <Button variant="ghost" size="sm" onClick={onDetachParent}>Start independently instead</Button>
          </div>
        )}

        {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      </div>

      <div className="mt-5 border-t border-rule bg-surface-2/55 px-6 py-4">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]" aria-label="What happens next">
          <li className="mr-1 font-[600] text-fg-faint">Then</li>
          {PIPELINE.map((step, index) => (
            <li key={`${step.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="size-3 text-fg-faint" aria-hidden />}
              <span className={step.checkpoint ? "font-[600] text-warn" : "font-mono text-fg-muted"}>{step.label}</span>
            </li>
          ))}
        </ol>
        <p role="status" className="mt-2 min-h-[1.25rem] text-[11.5px] text-fg-faint">{draftStatus}</p>
      </div>
    </section>
  );
}

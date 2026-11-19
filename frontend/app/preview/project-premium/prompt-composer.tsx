"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GenerateButton } from "@/components/ui/vengeance/generate-button";
import { API_TEMPLATES } from "@/lib/workspace-storage";
import type { PromptStudioProps } from "@/components/dashboard/prompt-studio";
import { usePromptActions } from "./use-prompt-actions";

const MAX_PROMPT = 12000;
// The count only earns attention near the limit.
const COUNT_VISIBLE_FROM = 0.8 * MAX_PROMPT;
const VISIBLE_TEMPLATES = 6;

/**
 * The prompt card as one editor surface: heading, the text, and a single toolbar (examples,
 * build). Drafts still save silently; only a failed save is shown.
 */
export function PromptComposer({
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
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const draftFailed = /could not/i.test(draftStatus);
  const { pendingName, chooseTemplate, applyPending, keepDraft, handleKeyDown } =
    usePromptActions({ prompt, onPromptChange, onDetachParent, starting, onStart });

  return (
    <section className="pp-card pp-composer" aria-labelledby="prompt-studio-heading">
      <header className="pp-composer-head">
        <p className="pp-eyebrow">New run</p>
        <h2 id="prompt-studio-heading" className="pp-title">What should this API do?</h2>
        <p className="pp-lede">Describe one or two entities, their fields and the rules. The agents handle the rest.</p>
      </header>

      {parentRunId && (
        <div className="pp-banner">
          <Link href={`/runs/${parentRunId}`}>Revising an existing API</Link>
          <button type="button" onClick={onDetachParent}>Start independently instead</button>
        </div>
      )}

      <div className="pp-editor">
        <label htmlFor="prompt" className="sr-only">Describe the API</label>
        <Textarea
          id="prompt"
          maxLength={MAX_PROMPT}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="A contact directory with name, phone, email and a favourite flag. Email must be unique."
          className="pp-textarea"
        />
        <div className="pp-toolbar">
          <label htmlFor="rag-enabled" className="pp-examples">
            <BookOpen className="size-3.5" aria-hidden />
            <span>{ragEnabled ? "6 example APIs on" : "Examples off"}</span>
            <Switch id="rag-enabled" checked={ragEnabled} onCheckedChange={onRagChange} aria-label="Use example library" />
          </label>
          <div className="pp-toolbar-end">
            {prompt.length >= COUNT_VISIBLE_FROM && (
              <span className="pp-count">{prompt.length.toLocaleString()} / {MAX_PROMPT.toLocaleString()}</span>
            )}
            <kbd className="pp-kbd" title="Command + Enter starts the run">⌘↵</kbd>
            <GenerateButton onClick={onStart} disabled={!prompt.trim()} isGenerating={starting} className="pp-start" />
          </div>
        </div>
      </div>

      {/* Problems sit right under the editor, next to the action they block. */}
      {(error || draftFailed) && (
        <div className="pp-notices">
          {error && <Notice>{error}</Notice>}
          {draftFailed && <Notice>{draftStatus}</Notice>}
        </div>
      )}

      {pendingName && (
        <div className="pp-confirm" role="alert">
          <span>Replace your draft with the {pendingName} template?</span>
          <Button size="sm" onClick={applyPending}>Replace draft</Button>
          <Button size="sm" variant="ghost" onClick={keepDraft}>Keep my draft</Button>
        </div>
      )}

      <div className="pp-templates" role="group" aria-label="Start from a template">
        <span className="pp-templates-label">Start from</span>
        {API_TEMPLATES.slice(0, showAllTemplates ? undefined : VISIBLE_TEMPLATES).map((template, index) => (
          <button key={template.name} type="button" onClick={() => chooseTemplate(index)} className="pp-template">
            {template.name}
          </button>
        ))}
        {API_TEMPLATES.length > VISIBLE_TEMPLATES && (
          <button type="button" aria-expanded={showAllTemplates} onClick={() => setShowAllTemplates((shown) => !shown)} className="pp-more-templates">
            {showAllTemplates ? "Fewer" : `${API_TEMPLATES.length - VISIBLE_TEMPLATES} more`}
          </button>
        )}
      </div>

    </section>
  );
}

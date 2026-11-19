"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { API_TEMPLATES } from "@/lib/workspace-storage";
import { usePromptActions } from "./use-prompt-actions";

const MAX_PROMPT = 12000;
// The count only earns attention near the limit.
const COUNT_VISIBLE_FROM = 0.8 * MAX_PROMPT;
const SUGGESTED_TEMPLATES = 4;

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

/**
 * The prompt card, editorial: a serif question set on the page, one soft writing surface, and
 * starting points as a quiet line of text. Drafts save silently; only a failed save is shown.
 */
export function PromptStudio({
  prompt, onPromptChange, ragEnabled, onRagChange, parentRunId, onDetachParent, draftStatus, error, starting, onStart,
}: PromptStudioProps) {
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const { pendingName, chooseTemplate, applyPending, keepDraft, handleKeyDown } =
    usePromptActions({ prompt, onPromptChange, onDetachParent, starting, onStart });
  const draftFailed = /could not/i.test(draftStatus);

  return (
    <section className="ax-composer" aria-labelledby="prompt-studio-heading">
      <h2 id="prompt-studio-heading" className="ax-heading">What should this API do?</h2>
      <p className="ax-lede">Describe one or two entities, their fields and the rules. The agents handle the rest.</p>

      {parentRunId && (
        <p className="ax-revising">
          <Link href={`/runs/${parentRunId}`}>Revising an existing API</Link>
          <span aria-hidden>·</span>
          <button type="button" onClick={onDetachParent}>Start independently instead</button>
        </p>
      )}

      <div className="ax-input">
        <label htmlFor="prompt" className="sr-only">Describe the API</label>
        <Textarea
          id="prompt"
          maxLength={MAX_PROMPT}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="A contact directory with name, phone, email and a favourite flag. Email must be unique."
          className="ax-textarea"
        />
        <div className="ax-input-bar">
          <label htmlFor="rag-enabled" className="ax-examples">
            <BookOpen aria-hidden />
            <span>{ragEnabled ? "Learning from example APIs" : "Not using examples"}</span>
            <Switch id="rag-enabled" checked={ragEnabled} onCheckedChange={onRagChange} aria-label="Use example library" />
          </label>
          <div className="ax-input-end">
            {prompt.length >= COUNT_VISIBLE_FROM && (
              <span className="ax-count">{prompt.length.toLocaleString()} / {MAX_PROMPT.toLocaleString()}</span>
            )}
            <Button onClick={onStart} disabled={!prompt.trim() || starting} aria-busy={starting} className="ax-start" title="Start run (⌘ Enter)">
              {starting ? "Starting…" : "Start run"}
              <ArrowUp aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {/* Problems sit right under the writing surface, next to the action they block. */}
      {(error || draftFailed) && (
        <div className="ax-notices">
          {error && <Notice>{error}</Notice>}
          {draftFailed && <Notice>{draftStatus}</Notice>}
        </div>
      )}

      {pendingName && (
        <div className="ax-confirm" role="alert">
          <span>Replace your draft with the {pendingName} template?</span>
          <Button size="sm" onClick={applyPending}>Replace draft</Button>
          <Button size="sm" variant="ghost" onClick={keepDraft}>Keep my draft</Button>
        </div>
      )}

      <div className="ax-starts" role="group" aria-label="Start from a template">
        <span>Or start from</span>
        {API_TEMPLATES.slice(0, showAllTemplates ? undefined : SUGGESTED_TEMPLATES).map((template, index) => (
          <button key={template.name} type="button" onClick={() => chooseTemplate(index)}>{template.name}</button>
        ))}
        {API_TEMPLATES.length > SUGGESTED_TEMPLATES && (
          <button type="button" className="ax-starts-more" aria-expanded={showAllTemplates} onClick={() => setShowAllTemplates((shown) => !shown)}>
            {showAllTemplates ? "fewer" : `${API_TEMPLATES.length - SUGGESTED_TEMPLATES} more`}
          </button>
        )}
      </div>
    </section>
  );
}

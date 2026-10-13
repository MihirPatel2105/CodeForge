"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import { Input } from "@/components/ui/input";

export function ResponseBody({ text, pending }: { text: string; pending: boolean }) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState({ text: "", query: "", index: 0 });
  const [feedback, setFeedback] = useState<{ text: string; message: string } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const copied = copiedText === text;
  const highlight = useRef<HTMLElement>(null);
  const matches = useMemo(() => {
    if (!query) return [];
    const literal = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return Array.from(text.matchAll(new RegExp(literal, "gi")), match => ({
      start: match.index!, end: match.index! + match[0].length,
    }));
  }, [query, text]);
  const index = matches.length && selection.text === text && selection.query === query
    ? selection.index % matches.length : 0;
  const match = matches[index];

  useEffect(() => {
    highlight.current?.scrollIntoView({ block: "nearest" });
  }, [index, query, text]);

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  function navigate(direction: number) {
    if (!matches.length) return;
    setSelection({ text, query, index: (index + direction + matches.length) % matches.length });
  }

  async function copy() {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      copyTimer.current = window.setTimeout(() => setCopiedText(null), 1600);
      setFeedback(null);
    } catch {
      setCopiedText(null);
      setFeedback({ text, message: "Could not copy. Select the response text and copy it." });
    }
  }

  return (
    <div className="mt-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="search" aria-label="Search response" placeholder="Search response…"
          value={query} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              navigate(event.shiftKey ? -1 : 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setQuery("");
            }
          }} className="h-9 min-w-0 w-full flex-none text-xs sm:w-auto sm:flex-1" />
        <div role="group" aria-label="Search navigation" className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous match"
            disabled={!matches.length} onClick={() => navigate(-1)}><ChevronUp aria-hidden /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Next match"
            disabled={!matches.length} onClick={() => navigate(1)}><ChevronDown aria-hidden /></Button>
        </div>
        <Button variant="outline" size="sm" disabled={pending || !text} onClick={copy}
          aria-label={copied ? "Response copied" : "Copy response"}>
          <CopyFeedback copied={copied} label="Copy response" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-fg-muted">
        <span role="status" aria-live="polite">{query ? matches.length ? `${index + 1} of ${matches.length} matches` : "No matches" : ""}</span>
        {feedback?.text === text && <span role="status">{feedback.message}</span>}
      </div>
      <pre className="mt-3 max-h-[32rem] overflow-auto rounded-lg bg-term-bg p-4 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all text-term-fg">
        {match ? <>{text.slice(0, match.start)}<mark ref={highlight} className="rounded-sm bg-term-fg text-term-bg">{text.slice(match.start, match.end)}</mark>{text.slice(match.end)}</> : text || "No response body"}
      </pre>
    </div>
  );
}

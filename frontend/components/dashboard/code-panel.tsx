"use client";

import { MotionButton } from "@/components/ui/motion-button";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DynamicToolbar } from "@/components/ui/dynamic-toolbar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { toast } from "sonner";
import { CodeFileTree } from "./code-file-tree";
import { FileCode2, WrapText } from "lucide-react";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import { tokenizePythonLine } from "@/lib/python-highlight";
import { buildHunks } from "@/lib/diff";
import type { FileSnapshot } from "@/lib/run-reducer";
import type { CodeLocation } from "@/lib/run-problems";

export interface CodeVersion {
  content: string;
  /** 1-indexed lines this version changed, for the Current view's loop-soft marks. */
  changedLines?: number[];
  /** Added and removed lines in the prior-version comparison. */
  changedLineCount?: number;
}

export interface CodePanelProps {
  location?: CodeLocation | null;
  files: FileSnapshot[];
  /** Looks up a file's content at a given iteration. Content isn't part of the SSE
   * contract (`FileWrittenEvent` carries only path + bytes) — the caller supplies it,
   * whether from `lib/mock-files.ts` (dev playback) or a live `GET /runs/{id}/files`
   * fetch (the real Live Run screen). */
  getVersion: (path: string, iteration: number) => CodeVersion | null;
  /** Omit for a source with no historical content. The live page reads archived
   * versions from `GET /runs/{id}/file-history`. */
  getPreviousVersion?: (path: string, iteration: number) => CodeVersion | null;
}

function subscribeCompact(change: () => void) {
  const media = window.matchMedia("(max-width:639px)");
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}

const TOKEN_CLASS: Record<string, string> = {
  kw: "text-code-kw",
  str: "text-code-str",
  com: "text-code-com",
  fn: "text-code-fn",
  num: "text-code-num",
};

function CodeLine({ text }: { text: string }) {
  return (
    <>
      {tokenizePythonLine(text).map((token, i) => (
        <span key={i} className={token.cls ? TOKEN_CLASS[token.cls] : undefined}>
          {token.text}
        </span>
      ))}
      {text.length === 0 && " "}
    </>
  );
}

/**
 * File rail + code viewer (design_handoff/README.md "Code and output"). File content
 * isn't part of the SSE contract (`FileWrittenEvent` carries only path + bytes) — it's
 * joined here from mock data during dev playback or the REST file endpoints on a live run.
 */
export function CodePanel({ files, getVersion, getPreviousVersion, location }: CodePanelProps) {
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia("(max-width:639px)").matches, () => false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [view, setView] = useState<"current" | "diff">("current");
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastSeenPath = useRef<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const [problemLocation, setProblemLocation] = useState<CodeLocation | null>(null);

  useEffect(() => {
    if (!location) return;
    setSelectedPath(location.path); setPinned(true); setView("current"); setProblemLocation(location);
  }, [location]);

  useEffect(() => {
    const latest = files[files.length - 1];
    if (!latest) {
      lastSeenPath.current = null;
      return;
    }
    if (latest.path !== lastSeenPath.current) {
      lastSeenPath.current = latest.path;
      if (!pinned) {
        setSelectedPath(latest.path);
        setView("current");
      }
    }
  }, [files, pinned]);

  const selected = files.find((f) => f.path === selectedPath) ?? null;
  const version = selected ? getVersion(selected.path, selected.iteration) : null;
  const prevVersion =
    selected && getPreviousVersion ? getPreviousVersion(selected.path, selected.iteration) : null;
  const canDiff = selected?.status === "updated" && prevVersion != null;

  useEffect(() => {
    setCopied(false);
  }, [selectedPath]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  async function copyCurrentFile() {
    if (!version) return;
    try {
      await navigator.clipboard.writeText(version.content);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      toast.error("Couldn’t copy the code. Try again.");
    }
  }

  return (
    <ResizablePanelGroup orientation={compact ? "vertical" : "horizontal"} className="cf-evidence-code h-full overflow-hidden rounded-3xl border border-border bg-surface">
      {/* File rail */}
      <ResizablePanel id="generated-file-rail" defaultSize={compact ? "138px" : "22%"} minSize={compact ? "120px" : "150px"} maxSize={compact ? "160px" : "45%"} disabled={compact} className="cf-file-rail flex min-h-0 flex-col border-b border-border bg-bg sm:border-b-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="text-[12px] font-[650] text-fg-muted">Generated files</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-[650] text-fg-faint" aria-label={`${files.length} ${files.length === 1 ? "file" : "files"}`}>{files.length}</span>
        </div>
        {files.length === 0 ? (
          <div className="space-y-2 px-4 py-4" aria-hidden>
            <div className="h-7 rounded-lg border border-dashed border-border bg-surface/60" />
            <div className="h-7 rounded-lg border border-dashed border-border bg-surface/60" />
            <div className="hidden h-7 rounded-lg border border-dashed border-border bg-surface/60 sm:block" />
          </div>
        ) : (
          <ScrollArea className="cf-file-list-cue min-h-0 flex-1">
            <CodeFileTree files={files} selectedPath={selectedPath} revealRequestId={location?.requestId} getContent={file => getVersion(file.path, file.iteration)?.content ?? null}
              onSelect={path => {
                setProblemLocation(null);
                setSelectedPath(path);
                setPinned(true);
                setView("current");
              }} />
          </ScrollArea>
        )}
      </ResizablePanel>
      <ResizableHandle withHandle aria-label="Resize file sidebar" className="cf-file-resizer" />
      {/* Code viewer */}
      <ResizablePanel id="generated-code-canvas" minSize={compact ? "280px" : "45%"} className="flex min-h-0 min-w-0 flex-col bg-code-bg">
        {selected && version ? (
          <>
            <div className="cf-code-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileCode2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 truncate font-mono text-[13px] font-[650] text-fg">{selected.path}</span>
                <span className="min-w-0 truncate text-[12.5px] text-fg-muted">
                  {selected.status === "new"
                    ? `${selected.bytes.toLocaleString()} bytes · written in the first pass`
                    : `${selected.bytes.toLocaleString()} bytes · rewritten in iteration ${selected.iteration} · ${
                        version.changedLineCount ?? version.changedLines?.length ?? 0
                      } ${(version.changedLineCount ?? version.changedLines?.length ?? 0) === 1 ? "line" : "lines"} changed`}
                </span>
              </div>
              <DynamicToolbar primary={
                <MotionButton
                  type="button"
                  onClick={copyCurrentFile}
                  aria-label={copied ? "Code copied" : "Copy code"}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 font-mono text-[12px] font-[650] uppercase tracking-[0.08em] text-fg-muted hover:border-border-strong hover:text-fg"
                >
                  <CopyFeedback copied={copied} label="Copy" />
                </MotionButton>
              }>
                {canDiff && (
                  <div className="flex gap-[2px] rounded-2xl bg-surface-2 p-[2px]">
                  {(["current", "diff"] as const).map((v) => (
                    <MotionButton
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-pressed={view === v}
                      className={cn(
                        "rounded-lg px-[10px] py-[3px] text-[12.5px] font-[650] capitalize",
                        view === v ? "bg-fg text-surface" : "text-fg-muted",
                      )}
                    >
                      {v}
                    </MotionButton>
                  ))}
                  </div>
                )}
                <MotionButton
                  type="button"
                  onClick={() => setWrap((value) => !value)}
                  aria-pressed={wrap}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-lg border px-2 font-mono text-[12px] font-[650] uppercase tracking-[0.08em]",
                    wrap
                      ? "border-accent-bd bg-accent-soft text-accent"
                      : "border-border bg-surface text-fg-muted hover:border-border-strong",
                  )}
                >
                  <WrapText className="h-3.5 w-3.5" aria-hidden />
                  Wrap
                </MotionButton>
              </DynamicToolbar>
            </div>

            <ScrollArea className="cf-run-scroll min-h-0 flex-1 bg-code-bg">
              {view === "current" || !canDiff ? (
                <CurrentView content={version.content} changedLines={version.changedLines ?? []} wrap={wrap}
                  highlightedLine={problemLocation?.path === selected.path && problemLocation.iteration === selected.iteration && problemLocation.content === version.content ? problemLocation.line : null}
                  navigationId={problemLocation?.requestId} />
              ) : (
                <DiffView oldContent={prevVersion!.content} newContent={version.content} wrap={wrap} />
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent-bd bg-accent-soft text-accent">
              <FileCode2 className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-[15px] font-[650] text-fg">
              {files.length === 0 ? "Waiting for generated code" : "Loading file preview"}
            </p>
            <p className="mt-1.5 max-w-[36ch] text-[13px] leading-5 text-fg-muted">
              {files.length === 0
                ? "Files will appear here as the Coder writes them."
                : "The file has been written. Its contents will appear shortly."}
            </p>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function CurrentView({ content, changedLines, wrap, highlightedLine, navigationId }: { content: string; changedLines: number[]; wrap: boolean; highlightedLine?: number | null; navigationId?: number }) {
  const code = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const line = code.current?.querySelector<HTMLElement>("[data-problem-line]");
    if (!line) return;
    line.focus({ preventScroll: true });
    line.scrollIntoView({ block: "nearest" });
  }, [content, highlightedLine, navigationId]);
  const lines = content.split("\n");
  const changed = new Set(changedLines);
  return (
    <div ref={code} className={cn(typeScale.code, "p-4 text-code-fg")}>
      {lines.map((line, i) => {
        const n = i + 1;
        const isChanged = changed.has(n);
        return (
          <div
            key={n}
            data-problem-line={highlightedLine === n ? n : undefined}
            tabIndex={highlightedLine === n ? -1 : undefined}
            aria-label={highlightedLine === n ? `Line ${n}` : undefined}
            className={cn(
              "grid grid-cols-[46px_14px_minmax(0,1fr)]",
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              isChanged && "border-l-2 border-loop bg-loop-soft",
              highlightedLine === n && "bg-accent-soft outline-2 outline-accent",
            )}
          >
            <span className="select-none pr-2 text-right font-mono text-[12px] text-fg-faint">{n}</span>
            <span className={cn("select-none text-loop", !isChanged && "invisible")}>▍</span>
            <span>
              <CodeLine text={line} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DiffView({ oldContent, newContent, wrap }: { oldContent: string; newContent: string; wrap: boolean }) {
  const hunks = buildHunks(oldContent, newContent);
  if (hunks.length === 0) {
    return <p className="p-3 text-[13px] text-fg-faint">No changes.</p>;
  }
  return (
    <div className={cn(typeScale.code, "p-4 text-code-fg")}>
      {hunks.map((hunk, hi) => (
        <div key={hi}>
          {hi > 0 && (
            <div className={cn("grid grid-cols-[46px_14px_minmax(0,1fr)] text-fg-faint", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>
              <span />
              <span />
              <span>⋯</span>
            </div>
          )}
          {hunk.lines.map((line, li) => (
            <div
              key={li}
              className={cn(
                "grid grid-cols-[46px_14px_minmax(0,1fr)]",
                wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                line.kind === "removed" && "bg-danger-soft",
                line.kind === "added" && "bg-ok-soft",
              )}
            >
              <span className="select-none pr-2 text-right font-mono text-[12px] text-fg-faint">
                {line.newLine ?? line.oldLine}
              </span>
              <span
                className={cn(
                  "select-none",
                  line.kind === "removed" && "text-danger",
                  line.kind === "added" && "text-ok",
                )}
              >
                {line.kind === "removed" ? "−" : line.kind === "added" ? "+" : ""}
              </span>
              <span>
                <CodeLine text={line.text} />
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

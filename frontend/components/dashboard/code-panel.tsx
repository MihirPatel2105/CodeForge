"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileCode2, WrapText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import { tokenizePythonLine } from "@/lib/python-highlight";
import { buildHunks } from "@/lib/diff";
import type { FileSnapshot } from "@/lib/run-reducer";

export interface CodeVersion {
  content: string;
  /** 1-indexed lines this version changed, for the Current view's loop-soft marks. */
  changedLines?: number[];
  /** Added and removed lines in the prior-version comparison. */
  changedLineCount?: number;
}

export interface CodePanelProps {
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
export function CodePanel({ files, getVersion, getPreviousVersion }: CodePanelProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [view, setView] = useState<"current" | "diff">("current");
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastSeenPath = useRef<string | null>(null);
  const copyTimer = useRef<number | null>(null);

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
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_16px_45px_rgba(34,48,78,0.06)] sm:flex-row">
      {/* File rail */}
      <div className="flex h-[138px] w-full shrink-0 flex-col border-b border-border bg-[#f7f9fd] sm:h-auto sm:w-[208px] sm:border-r sm:border-b-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="text-[12px] font-[650] text-fg-muted">Generated files</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-[650] text-fg-faint" aria-label={`${files.length} ${files.length === 1 ? "file" : "files"}`}>{files.length}</span>
        </div>
        {files.length === 0 ? (
          <div className="space-y-2 px-4 py-4" aria-hidden>
            <div className="h-7 rounded-lg border border-dashed border-border bg-white/60" />
            <div className="h-7 rounded-lg border border-dashed border-border bg-white/60" />
            <div className="hidden h-7 rounded-lg border border-dashed border-border bg-white/60 sm:block" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <ul className="flex flex-col gap-1 p-2">
              {files.map((f) => {
                const isSelected = f.path === selectedPath;
                return (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPath(f.path);
                        setPinned(true);
                        setView("current");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left",
                        "font-mono text-[12px] text-fg-muted transition-[border-color,background-color,box-shadow,color] hover:bg-white hover:text-fg",
                        isSelected && "border-accent-bd bg-white font-bold text-accent shadow-[0_2px_9px_rgba(35,50,81,0.07)]",
                      )}
                    >
                      <span className="truncate">{f.path}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-[700]",
                          f.status === "new" ? "bg-ok-soft text-ok" : "bg-loop-soft text-loop",
                        )}
                      >
                        {f.status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </div>

      {/* Code viewer */}
      <div className="flex min-w-0 flex-1 flex-col bg-code-bg">
        {selected && version ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
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
              <div className="flex shrink-0 items-center gap-1.5">
                {canDiff && (
                  <div className="flex gap-[2px] rounded-xl bg-surface-2 p-[2px]">
                  {(["current", "diff"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={cn(
                        "rounded-lg px-[10px] py-[3px] text-[12.5px] font-[650] capitalize",
                        view === v ? "bg-fg text-surface" : "text-fg-muted",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setWrap((value) => !value)}
                  aria-pressed={wrap}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 font-mono text-[10px] font-[650] uppercase tracking-[0.08em]",
                    wrap
                      ? "border-accent-bd bg-accent-soft text-accent"
                      : "border-border bg-surface text-fg-muted hover:border-border-strong",
                  )}
                >
                  <WrapText className="h-3.5 w-3.5" aria-hidden />
                  Wrap
                </button>
                <button
                  type="button"
                  onClick={copyCurrentFile}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 font-mono text-[10px] font-[650] uppercase tracking-[0.08em] text-fg-muted hover:border-border-strong hover:text-fg"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-ok" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <ScrollArea className="cf-run-scroll flex-1 bg-code-bg">
              {view === "current" || !canDiff ? (
                <CurrentView content={version.content} changedLines={version.changedLines ?? []} wrap={wrap} />
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
      </div>
    </div>
  );
}

function CurrentView({ content, changedLines, wrap }: { content: string; changedLines: number[]; wrap: boolean }) {
  const lines = content.split("\n");
  const changed = new Set(changedLines);
  return (
    <div className={cn(typeScale.code, "p-4 text-code-fg")}>
      {lines.map((line, i) => {
        const n = i + 1;
        const isChanged = changed.has(n);
        return (
          <div
            key={n}
            className={cn(
              "grid grid-cols-[46px_14px_minmax(0,1fr)]",
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              isChanged && "border-l-2 border-loop bg-loop-soft",
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

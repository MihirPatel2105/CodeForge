"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, WrapText } from "lucide-react";
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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_16px_45px_rgba(22,24,28,0.045)] sm:flex-row">
      {/* File rail */}
      <div className="flex h-[138px] w-full shrink-0 flex-col border-b border-border bg-surface-2 sm:h-auto sm:w-[196px] sm:border-r sm:border-b-0">
        <div className={cn("border-b border-border px-3 py-[11px]", typeScale.label, "text-fg-faint")}>
          GENERATED CODE
        </div>
        {files.length === 0 ? (
          <p className="px-3 py-3 text-[13px] text-fg-faint">
            No files yet — the Coder writes them one by one.
          </p>
        ) : (
          <ScrollArea className="flex-1">
            <ul className="flex flex-col gap-[2px] p-[6px]">
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
                        "flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-[6px] text-left",
                        "font-mono text-[13px] text-fg",
                        isSelected && "border-border-strong bg-surface font-bold",
                      )}
                    >
                      <span className="truncate">{f.path}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-lg px-[5px] py-[1px] text-[10px] font-extrabold tracking-[0.06em] uppercase",
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
      <div className="flex min-w-0 flex-1 flex-col">
        {selected && version ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[13px] py-[10px]">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 font-mono text-[13.5px] font-[650] text-fg">{selected.path}</span>
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
                  <div className="flex gap-[2px] rounded-lg bg-surface-2 p-[2px]">
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
          <div className="flex flex-1 items-center justify-center text-[13px] text-fg-faint">
            No files yet — the Coder writes them one by one.
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
    <div className={cn(typeScale.code, "text-code-fg")}>
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
    <div className={cn(typeScale.code, "text-code-fg")}>
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

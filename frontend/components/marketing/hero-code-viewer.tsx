"use client";

import { FileCode2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tokenizePythonLine } from "@/lib/python-highlight";
import type { FileSnapshot } from "@/lib/run-reducer";

export interface HeroFileVersion {
  content: string;
  /** Lines the Coder rewrote in a repair pass, 0-based. */
  changed: ReadonlySet<number>;
}

function CodeLines({ version }: { version: HeroFileVersion }) {
  return (
    <code className="ol-hero-code-lines">
      {version.content.trimEnd().split("\n").map((line, index) => (
        <span key={index} data-changed={version.changed.has(index) || undefined}>
          <i aria-hidden>{String(index + 1).padStart(2, "0")}</i>
          {tokenizePythonLine(line).map((token, tokenIndex) =>
            token.cls ? <b key={tokenIndex} className={`tok-${token.cls}`}>{token.text}</b> : token.text,
          )}
        </span>
      ))}
    </code>
  );
}

/** An editor-style viewer: file tabs in the header, code, then a one-line status bar. */
export function HeroCodeViewer({
  files,
  file,
  onFileChange,
  written,
  versionOf,
}: {
  files: readonly string[];
  file: string;
  onFileChange: (path: string) => void;
  written: ReadonlyMap<string, FileSnapshot>;
  versionOf: (path: string, iteration: number) => HeroFileVersion;
}) {
  const current = written.get(file);
  const version = current ? versionOf(file, current.iteration) : null;
  const lineCount = version ? version.content.trimEnd().split("\n").length : 0;

  return (
    <Tabs value={file} onValueChange={(value) => onFileChange(String(value))} className="ol-hero-editor">
      <TabsList variant="line" aria-label="Generated files">
        {files.map((path) => (
          <TabsTrigger key={path} value={path} data-written={written.has(path) || undefined}>
            {path}
          </TabsTrigger>
        ))}
      </TabsList>
      {files.map((path) => {
        const entry = written.get(path);
        return (
          <TabsContent key={path} value={path} className="ol-hero-code">
            {entry ? (
              <>
                {entry.iteration > 0 && <span className="ol-hero-code-note">Updated in pass {entry.iteration + 1}</span>}
                <CodeLines version={versionOf(path, entry.iteration)} />
              </>
            ) : (
              <span className="ol-hero-code-empty"><FileCode2 size={15} aria-hidden />Not written yet</span>
            )}
          </TabsContent>
        );
      })}
      <p className="ol-hero-editor-status" aria-hidden>
        <span>Python</span>
        <span>{current ? `${lineCount} lines` : "waiting"}</span>
        <span>{current ? `pass ${current.iteration + 1}` : "—"}</span>
      </p>
    </Tabs>
  );
}

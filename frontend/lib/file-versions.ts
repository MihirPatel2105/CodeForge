import type { CodeVersion } from "@/components/dashboard/code-panel";
import { buildHunks } from "./diff";
import type { FileHistoryVersion } from "./types";

/** The newest archived copy of `path` from a pass before `iteration`, if one was saved. */
export function previousVersion(
  history: readonly FileHistoryVersion[],
  path: string,
  iteration: number,
): CodeVersion | null {
  const previous = history
    .filter((version) => version.iteration < iteration)
    .sort((a, b) => b.iteration - a.iteration) // sorts the filtered copy, not `history`
    .find((version) => version.files.some((file) => file.path === path));
  const content = previous?.files.find((file) => file.path === path)?.content;
  return content != null ? { content } : null;
}

/** Current content, marked with the lines it changed relative to `previous`. */
export function versionWithChanges(content: string, previous: CodeVersion | null): CodeVersion {
  if (!previous) return { content };
  const changed = buildHunks(previous.content, content, 0).flatMap((hunk) => hunk.lines);
  return {
    content,
    changedLines: changed.flatMap((line) =>
      line.kind === "added" && line.newLine != null ? [line.newLine] : [],
    ),
    changedLineCount: changed.filter((line) => line.kind !== "context").length,
  };
}

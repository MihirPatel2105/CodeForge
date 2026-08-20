/**
 * Line-based diff for the code panel's Diff view (design_handoff/README.md "Code and
 * output" — "the changed hunks only, with three lines of context"). A classic LCS diff
 * over lines, not bytes, since Python's meaningful unit here is the line.
 */

export type DiffLineKind = "context" | "removed" | "added";

export interface DiffLine {
  kind: DiffLineKind;
  /** 1-indexed line number in the old file; absent for added lines. */
  oldLine: number | null;
  /** 1-indexed line number in the new file; absent for removed lines. */
  newLine: number | null;
  text: string;
}

export interface DiffHunk {
  lines: DiffLine[];
}

function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/** Full line-by-line diff, every line tagged context/removed/added — no hunk splitting yet. */
function diffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  const table = lcsTable(oldLines, newLines);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      out.push({ kind: "context", oldLine: i + 1, newLine: j + 1, text: oldLines[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ kind: "removed", oldLine: i + 1, newLine: null, text: oldLines[i] });
      i++;
    } else {
      out.push({ kind: "added", oldLine: null, newLine: j + 1, text: newLines[j] });
      j++;
    }
  }
  while (i < oldLines.length) {
    out.push({ kind: "removed", oldLine: i + 1, newLine: null, text: oldLines[i] });
    i++;
  }
  while (j < newLines.length) {
    out.push({ kind: "added", oldLine: null, newLine: j + 1, text: newLines[j] });
    j++;
  }
  return out;
}

/** Collapses a full diff into hunks, keeping `context` lines of unchanged text around
 * each change and dropping (eliding) the rest. */
export function buildHunks(oldContent: string, newContent: string, context = 3): DiffHunk[] {
  const all = diffLines(oldContent.split("\n"), newContent.split("\n"));
  const changedIndices = all.reduce<number[]>((acc, line, idx) => {
    if (line.kind !== "context") acc.push(idx);
    return acc;
  }, []);
  if (changedIndices.length === 0) return [];

  const ranges: Array<[number, number]> = [];
  for (const idx of changedIndices) {
    const start = Math.max(0, idx - context);
    const end = Math.min(all.length - 1, idx + context);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      ranges.push([start, end]);
    }
  }

  return ranges.map((range) => ({ lines: all.slice(range[0], range[1] + 1) }));
}

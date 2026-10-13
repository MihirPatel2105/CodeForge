import type { FileSnapshot } from "./run-reducer";

export interface CodeLocation { path: string; line: number; iteration: number; requestId: number; content: string }
export interface RunProblem {
  id: string;
  source: "Reviewer" | "Tests";
  severity: "blocking" | "warning" | "nit" | "test";
  message: string;
  location: { path: string; line: number; iteration: number; content: string } | null;
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function sourcePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.replace(/^\/app\//, "").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes(":") || path.split("/").some(part => !part || part === ".." || part === ".")) return null;
  return path;
}

export function runProblems(state: Record<string, unknown>): RunProblem[] {
  const files = [...(Array.isArray(state.files) ? state.files : []), ...(Array.isArray(state.test_files) ? state.test_files : [])].map(object);
  const iteration = state.loop_count;
  function location(file: unknown, line: unknown): RunProblem["location"] {
    const path = sourcePath(file);
    if (!path || typeof line !== "number" || !Number.isSafeInteger(line) || line < 1 || typeof iteration !== "number" || !Number.isSafeInteger(iteration) || iteration < 0) return null;
    const candidates = files.filter(file => file.path === path);
    if (candidates.length !== 1 || typeof candidates[0].content !== "string") return null;
    const content = candidates[0].content;
    return line <= content.split("\n").length ? { path, line, content, iteration } : null;
  }
  const problems: RunProblem[] = [];
  const findings = object(state.review).findings;
  if (Array.isArray(findings)) findings.forEach((value, index) => {
    const finding = object(value);
    if (typeof finding.issue !== "string" || !finding.issue.trim() || !["blocking", "warning", "nit"].includes(String(finding.severity))) return;
    problems.push({ id: `review-${index}`, source: "Reviewer", severity: finding.severity as RunProblem["severity"], message: finding.issue.slice(0, 1500), location: location(finding.file, finding.line) });
  });
  const failures = object(state.tests).failures;
  if (Array.isArray(failures)) failures.forEach((value, index) => {
    const failure = object(value);
    if (typeof failure.test_name !== "string") return;
    const name = failure.test_name.split("::").slice(1).join("::");
    let target: RunProblem["location"] = null;
    if (typeof failure.traceback_tail === "string") {
      // Test names never imply a line; use only captured locations in known generated files.
      for (const match of failure.traceback_tail.matchAll(/^\s*([^\s:]+\.py):(\d+)(?::|\s*$)|File "([^"]+\.py)", line (\d+)/gm)) {
        const candidate = location(match[1] ?? match[3], Number(match[2] ?? match[4]));
        if (candidate) target = candidate;
      }
    }
    problems.push({ id: `test-${index}`, source: "Tests", severity: "test", message: name && /^[\w.\[\]-]+$/.test(name) ? `${name.slice(0, 200)} failed` : "A generated API test failed", location: target });
  });
  return problems;
}

export function canOpenProblem(problem: RunProblem, files: FileSnapshot[], contents: Record<string, string>, iteration: number): boolean {
  const target = problem.location;
  return target !== null && target.iteration === iteration && contents[target.path] === target.content
    && files.some(file => file.path === target.path && file.iteration === target.iteration);
}

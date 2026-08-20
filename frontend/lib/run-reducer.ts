/**
 * Folds `CodeForgeEvent[]` into the view snapshot the dashboard renders.
 *
 * The reference is design_handoff/README.md "State management": no view state is
 * stored independently of the event stream. This is a pure function — no timers, no
 * subscriptions — so the same logic drives mock playback (fold events up to an index)
 * and live SSE (append one event at a time via `applyEvent`).
 */

import type { CodeForgeEvent, LoopTrigger, AgentCardState } from "./types";
import { PIPELINE_STAGES, isPipelineStage, stageName, type PipelineStageId } from "./pipeline";
import { formatTime } from "./format";
import type { TimelineEntryData } from "@/components/dashboard/timeline-entry";

export interface AgentSnapshot {
  state: AgentCardState;
  iteration: number;
  durationMs: number | null;
  summary: string | null;
  model: string | null;
}

export interface FileSnapshot {
  path: string;
  bytes: number;
  status: "new" | "updated";
  /** The loop iteration that produced this version — drives the UPDATED badge and the
   * code panel's "rewritten in iteration N" caption. */
  iteration: number;
}

export interface TestsSnapshot {
  total: number;
  failed: number;
  passed: number;
  ok: boolean;
}

export interface ApprovalSnapshot {
  /** The wire event's `phase` is a plain string, not the narrower ApprovalPhase — kept
   * loose here to match. */
  phase: string;
  payload: Record<string, unknown>;
}

export interface LoopSnapshot {
  iteration: number;
  trigger: LoopTrigger;
  blockingFindings: number;
  failedTests: number;
  at: string;
}

export interface RunSnapshot {
  runId: string | null;
  prompt: string | null;
  status: string;
  iterations: number;
  agents: Record<PipelineStageId, AgentSnapshot>;
  timeline: TimelineEntryData[];
  files: FileSnapshot[];
  terminalLines: { text: string; stream: "stdout" | "stderr" }[];
  tests: TestsSnapshot | null;
  approval: ApprovalSnapshot | null;
  lastLoop: LoopSnapshot | null;
  startedAt: string | null;
  endedAt: string | null;
  failureReason: string | null;
  /** The agent currently attributed to `file.written` events. Not in the wire
   * contract — `FileWrittenEvent` carries no agent field, but both the Coder and the
   * Tester write files, so the reducer has to remember who is active. */
  currentAgent: PipelineStageId | null;
}

function idleAgent(): AgentSnapshot {
  return { state: "idle", iteration: 0, durationMs: null, summary: null, model: null };
}

export function initialSnapshot(): RunSnapshot {
  const agents = {} as Record<PipelineStageId, AgentSnapshot>;
  for (const stage of PIPELINE_STAGES) agents[stage.id] = idleAgent();
  return {
    runId: null,
    prompt: null,
    status: "queued",
    iterations: 0,
    agents,
    timeline: [],
    files: [],
    terminalLines: [],
    tests: null,
    approval: null,
    lastLoop: null,
    startedAt: null,
    endedAt: null,
    failureReason: null,
    currentAgent: null,
  };
}

// --------------------------------------------------------------------------- //
// Per-agent summary copy — the exact strings in docs/UI_BRIEF.md §"pipeline strip",
// not a generic stringification of output_summary. A generic `"${v} ${k}"` join would
// produce "1 entities, 4 operations" (wrong plural) and "1 findings ... — passed"
// wouldn't happen at all (the design's own copy keeps "findings" plural even at 1;
// matched here verbatim rather than "corrected").
// --------------------------------------------------------------------------- //

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

/**
 * Condenses a provider failure into the one line an agent card has room for.
 *
 * `agent.failed` carries up to 400 characters of raw provider JSON. Rendered verbatim
 * into the card's summary it stretched the Tester stage until it pushed Sandbox off the
 * right edge of the screen — breaking the pipeline, which docs/UI_BRIEF.md §4.1 calls
 * the hero element and the thing the demo is built around. The full message is still
 * shown in the timeline entry, where there is room for it.
 */
function briefFailure(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  // These read "Every model failed for agent 'tester': groq/... -> InstructorRetry...".
  // Everything past the first arrow is transport detail nobody can act on from a card.
  const head = firstLine.split(" -> ")[0].trim();
  return head.length > 96 ? `${head.slice(0, 95).trimEnd()}…` : head;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function pmSummary(s: Record<string, unknown>): string | null {
  const entities = num(s.entities);
  const operations = num(s.operations);
  if (entities == null || operations == null) return null;
  return `${entities} ${plural(entities, "entity", "entities")}, ${operations} operations`;
}

function architectSummary(s: Record<string, unknown>): string | null {
  const endpoints = num(s.endpoints);
  const collections = num(s.collections);
  if (endpoints == null || collections == null) return null;
  return `${endpoints} endpoints, ${collections} ${plural(collections, "collection", "collections")}`;
}

function coderSummary(s: Record<string, unknown>): string | null {
  const files = num(s.files);
  if (files == null) return null;
  const changelog = Array.isArray(s.changelog) ? s.changelog : null;
  const noun = plural(files, "file", "files");
  if (changelog && changelog.length > 0) {
    return `${files} ${noun} rewritten — ${String(changelog[0])}`;
  }
  return `${files} ${noun} written`;
}

function reviewerSummary(s: Record<string, unknown>): string | null {
  const findings = num(s.findings);
  const blocking = num(s.blocking);
  if (findings == null || blocking == null) return null;
  const base = `${findings} findings, ${blocking} blocking`;
  return s.passed === true ? `${base} — passed` : base;
}

function testerSummary(s: Record<string, unknown>): string | null {
  const tests = num(s.tests);
  if (tests == null) return null;
  return `${tests} ${plural(tests, "test", "tests")} written`;
}

const AGENT_SUMMARY: Partial<
  Record<PipelineStageId, (s: Record<string, unknown>) => string | null>
> = {
  pm: pmSummary,
  architect: architectSummary,
  coder: coderSummary,
  reviewer: reviewerSummary,
  tester: testerSummary,
};

// --------------------------------------------------------------------------- //
// Reviewer messages: "text matching a known finding renders as the finding kind"
// (design_handoff/README.md, event -> state map). The wire format carries only a
// plain string, so this is a documented heuristic, not a certainty:
//   - "path.py: issue" is a specific finding -> render with file/line.
//   - a short summary line ("3 findings, 2 blocking", "No issues found") is the
//     Reviewer's own recap -> render as an ordinary message, never as a finding.
//   - anything else is finding-shaped prose without a file prefix -> still rendered
//     as a finding (file omitted), favouring the severity treatment over silently
//     downgrading a substantive remark to a plain line.
// --------------------------------------------------------------------------- //

const FILE_PREFIXED = /^([\w./-]+\.py):\s*(.+)$/;
const SUMMARY_LINE = /findings?|no issues found/i;

function reviewerMessageEntry(time: string, text: string): TimelineEntryData {
  const match = text.match(FILE_PREFIXED);
  if (match) {
    const [, file, issue] = match;
    return { kind: "finding", time, agent: "Reviewer", file, issue };
  }
  if (SUMMARY_LINE.test(text)) {
    return { kind: "message", time, agent: "Reviewer", text, variant: "default" };
  }
  return { kind: "finding", time, agent: "Reviewer", issue: text };
}

/**
 * Settles any stage still mid-flight when the run ends.
 *
 * A terminal event does not necessarily arrive with every stage resolved: cancelling a
 * run kills the graph wherever it happens to be, so the stage that was executing never
 * emits its own `agent.completed` or `agent.failed`. Without this the card kept its
 * live "working" treatment — pulsing away on a run that had already stopped, which was
 * visible on screen after a real cancel (2026-08-19).
 *
 * `stopped`, not `failed`: the stage produced no verdict, and dressing an interruption
 * in the error colour would misreport it (docs/UI_BRIEF.md §5).
 */
function settleWorkingAgents(
  agents: Record<PipelineStageId, AgentSnapshot>,
): Record<PipelineStageId, AgentSnapshot> {
  let changed = false;
  const next = {} as Record<PipelineStageId, AgentSnapshot>;
  for (const [id, agent] of Object.entries(agents) as [PipelineStageId, AgentSnapshot][]) {
    if (agent.state === "working") {
      next[id] = { ...agent, state: "stopped" };
      changed = true;
    } else {
      next[id] = agent;
    }
  }
  // Identity is preserved when nothing was mid-flight, so a normal finish does not
  // hand React a new object for every card and rerender the whole strip.
  return changed ? next : agents;
}

// --------------------------------------------------------------------------- //
// The reducer
// --------------------------------------------------------------------------- //

export function applyEvent(prev: RunSnapshot, event: CodeForgeEvent): RunSnapshot {
  const time = formatTime(event.at);

  switch (event.event) {
    case "run.started":
      return {
        ...prev,
        runId: event.run_id,
        prompt: event.prompt,
        status: "running",
        startedAt: event.at,
      };

    case "agent.started": {
      if (!isPipelineStage(event.agent)) return prev;
      return {
        ...prev,
        currentAgent: event.agent,
        agents: {
          ...prev.agents,
          [event.agent]: { ...prev.agents[event.agent], state: "working", iteration: event.iteration },
        },
      };
    }

    case "agent.message": {
      const entry: TimelineEntryData =
        event.agent === "reviewer"
          ? reviewerMessageEntry(time, event.text)
          : {
              kind: "message",
              time,
              agent: isPipelineStage(event.agent) ? stageName(event.agent) : event.agent,
              text: event.text,
              variant: "default",
            };
      return { ...prev, timeline: [...prev.timeline, entry] };
    }

    case "agent.completed": {
      if (!isPipelineStage(event.agent)) return prev;
      const summary = AGENT_SUMMARY[event.agent]?.(event.output_summary) ?? null;
      const model = typeof event.output_summary.model === "string" ? event.output_summary.model : null;
      const label = stageName(event.agent);
      const entry: TimelineEntryData = {
        kind: "message",
        time,
        agent: label,
        text: `Completed — ${summary ?? "done"}, ${(event.duration_ms / 1000).toFixed(1)}s`,
        variant: "completed",
      };
      return {
        ...prev,
        agents: {
          ...prev.agents,
          [event.agent]: {
            ...prev.agents[event.agent],
            state: "done",
            durationMs: event.duration_ms,
            summary,
            model,
          },
        },
        timeline: [...prev.timeline, entry],
      };
    }

    case "agent.failed": {
      if (!isPipelineStage(event.agent)) return prev;
      const label = stageName(event.agent);
      const entry: TimelineEntryData = {
        kind: "message",
        time,
        agent: label,
        text: `Failed — ${event.message} (${event.code})`,
        variant: "failed",
      };
      return {
        ...prev,
        agents: {
          ...prev.agents,
          [event.agent]: {
            ...prev.agents[event.agent],
            state: "failed",
            iteration: event.iteration,
            summary: briefFailure(event.message),
          },
        },
        timeline: [...prev.timeline, entry],
      };
    }

    case "approval.required": {
      const entry: TimelineEntryData = {
        kind: "message",
        time,
        agent: "—",
        text: "Waiting for your approval",
        variant: "approval-required",
      };
      return {
        ...prev,
        status: "awaiting_approval",
        approval: { phase: event.phase, payload: event.payload },
        timeline: [...prev.timeline, entry],
      };
    }

    case "approval.resolved": {
      const entry: TimelineEntryData = {
        kind: "message",
        time,
        agent: "—",
        text: event.approved ? "Approved" : "Rejected",
        variant: event.approved ? "approval-resolved" : "rejected",
      };
      return {
        ...prev,
        // A rejection ends the run; that terminal status arrives on run.failed, so this
        // only clears the paused state on approval — never assume "running" on reject.
        status: event.approved ? "running" : prev.status,
        approval: null,
        timeline: [...prev.timeline, entry],
      };
    }

    case "loop.iteration": {
      const subject =
        event.trigger === "reviewer"
          ? `${event.blocking_findings} blocking ${plural(event.blocking_findings, "finding", "findings")}`
          : `${event.failed_tests} failing ${plural(event.failed_tests, "test", "tests")}`;
      const entry: TimelineEntryData = {
        kind: "loop",
        time,
        text: `Iteration ${event.iteration} — sending ${subject} back to the Coder`,
      };
      // Reviewer / Tester / Sandbox reset to idle: they are about to run again, and
      // their previous done/failed verdict no longer describes the pass in progress.
      // Their iteration counter is preserved so a stale pass badge doesn't flash away
      // before the stage's own agent.started supplies the new one.
      const agents = { ...prev.agents };
      for (const id of ["reviewer", "tester", "sandbox"] as const) {
        agents[id] = { ...idleAgent(), iteration: agents[id].iteration };
      }
      return {
        ...prev,
        iterations: event.iteration,
        agents,
        lastLoop: {
          iteration: event.iteration,
          trigger: event.trigger,
          blockingFindings: event.blocking_findings,
          failedTests: event.failed_tests,
          at: event.at,
        },
        timeline: [...prev.timeline, entry],
      };
    }

    case "file.written": {
      const existing = prev.files.find((f) => f.path === event.path);
      const status: FileSnapshot["status"] = existing ? "updated" : "new";
      const nextFile: FileSnapshot = {
        path: event.path,
        bytes: event.bytes,
        status,
        iteration: prev.iterations,
      };
      const files = existing
        ? prev.files.map((f) => (f.path === event.path ? nextFile : f))
        : [...prev.files, nextFile];
      const agentLabel = prev.currentAgent ? stageName(prev.currentAgent) : "Coder";
      const entry: TimelineEntryData = {
        kind: "message",
        time,
        agent: agentLabel,
        text: `${status === "new" ? "Wrote" : "Rewrote"} ${event.path} (${event.bytes.toLocaleString()} bytes)`,
        variant: "file",
      };
      return { ...prev, files, timeline: [...prev.timeline, entry] };
    }

    case "sandbox.started":
      return {
        ...prev,
        currentAgent: "sandbox",
        agents: {
          ...prev.agents,
          sandbox: { ...prev.agents.sandbox, state: "working", model: event.image },
        },
      };

    case "sandbox.output": {
      const newLines = event.chunk
        .split("\n")
        .filter((line) => line.length > 0)
        .map((text) => ({ text, stream: event.stream }));
      if (newLines.length === 0) return prev;
      return { ...prev, terminalLines: [...prev.terminalLines, ...newLines] };
    }

    case "tests.result": {
      const passed = event.total - event.failed;
      const tests: TestsSnapshot = { total: event.total, failed: event.failed, passed, ok: event.passed };
      return {
        ...prev,
        tests,
        agents: {
          ...prev.agents,
          sandbox: {
            ...prev.agents.sandbox,
            state: event.passed ? "done" : "failed",
            summary: `${passed} of ${event.total} tests passed`,
          },
        },
      };
    }

    case "run.completed":
      // A finished run has nothing left to approve — normally `approval.resolved`
      // already cleared this, but a cancel skips straight from `awaiting_approval` to
      // `run.failed` with no resolution event in between, which left a stale approval
      // bar showing on an already-ended run. Clearing here for both terminal events
      // makes that true regardless of how the run ended.
      return {
        ...prev,
        status: event.status,
        endedAt: event.at,
        approval: null,
        agents: settleWorkingAgents(prev.agents),
        currentAgent: null,
      };

    case "run.failed":
      return {
        ...prev,
        status: event.status,
        endedAt: event.at,
        failureReason: event.reason,
        approval: null,
        agents: settleWorkingAgents(prev.agents),
        currentAgent: null,
      };

    default:
      return prev;
  }
}

export function reduceRun(events: CodeForgeEvent[]): RunSnapshot {
  return events.reduce(applyEvent, initialSnapshot());
}

/**
 * API and SSE contract types.
 *
 * Mirrors the backend Pydantic models:
 *   - backend/app/schemas/api.py
 *   - backend/app/events/schemas.py
 *
 * Keep in sync with those files. When a backend schema changes, this file changes in
 * the same commit — a silent drift here is the failure mode this contract exists to
 * prevent.
 */

// --------------------------------------------------------------------------- //
// Enums
// --------------------------------------------------------------------------- //

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed_max_loops"
  | "failed_sandbox"
  | "failed_llm"
  | "rejected"
  | "cancelled";

export type ApprovalPhase = "pm" | "architect" | "final";

export type AgentName = "pm" | "architect" | "coder" | "reviewer" | "tester";

export type LoopTrigger = "reviewer" | "tester";

export type Severity = "blocking" | "warning" | "nit";

/** Agent card state (FR-44). Derived from the event stream, not sent directly. */
export type AgentCardState = "idle" | "working" | "done" | "failed";

// --------------------------------------------------------------------------- //
// REST
// --------------------------------------------------------------------------- //

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  created_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface RunCreate {
  project_id: string;
  prompt: string;
  rag_enabled?: boolean;
}

export interface RunCreateResponse {
  run_id: string;
  status: RunStatus;
}

/** List view — omits the full state snapshot. */
export interface RunSummary {
  id: string;
  project_id: string;
  prompt: string;
  status: RunStatus;
  iterations: number;
  created_at: string;
  updated_at: string;
}

export interface RunResponse {
  id: string;
  project_id: string;
  prompt: string;
  status: RunStatus;
  state: Record<string, unknown>;
  metrics: RunMetrics | null;
  created_at: string;
  updated_at: string;
}

export interface RunMetrics {
  generation_succeeded: boolean;
  tests_passed: boolean;
  test_pass_ratio: number;
  iterations: number;
  blocking_findings_total: number;
  findings_fixed: number;
  rag_enabled: boolean;
  llm_calls: number;
  tokens_total: number;
  provider_fallbacks: number;
  end_to_end_ms: number;
  failure_category: string | null;
  prompt_id: string | null;
  notes: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface FileTreeResponse {
  run_id: string;
  files: GeneratedFile[];
}

export interface Finding {
  severity: Severity;
  file: string;
  line: number | null;
  issue: string;
  fix_hint: string;
}

export interface ApprovalRequest {
  phase: ApprovalPhase;
  approved: boolean;
  note?: string | null;
}

export interface ApprovalResponse {
  run_id: string;
  phase: ApprovalPhase;
  approved: boolean;
  status: RunStatus;
}

export interface ErrorResponse {
  error: { code: string; message: string; run_id: string | null };
}

// --------------------------------------------------------------------------- //
// SSE events — discriminated union on `event`
// --------------------------------------------------------------------------- //

interface EventBase {
  at: string;
}

export interface RunStartedEvent extends EventBase {
  event: "run.started";
  run_id: string;
  prompt: string;
}

export interface AgentStartedEvent extends EventBase {
  event: "agent.started";
  agent: string;
  iteration: number;
}

export interface AgentMessageEvent extends EventBase {
  event: "agent.message";
  agent: string;
  text: string;
}

export interface AgentCompletedEvent extends EventBase {
  event: "agent.completed";
  agent: string;
  output_summary: Record<string, unknown>;
  duration_ms: number;
}

export interface AgentFailedEvent extends EventBase {
  event: "agent.failed";
  agent: string;
  code: string;
  message: string;
  iteration: number;
}

export interface ApprovalRequiredEvent extends EventBase {
  event: "approval.required";
  phase: string;
  payload: Record<string, unknown>;
}

export interface ApprovalResolvedEvent extends EventBase {
  event: "approval.resolved";
  phase: string;
  approved: boolean;
  note: string | null;
}

export interface LoopIterationEvent extends EventBase {
  event: "loop.iteration";
  iteration: number;
  trigger: LoopTrigger;
  blocking_findings: number;
  failed_tests: number;
}

export interface FileWrittenEvent extends EventBase {
  event: "file.written";
  path: string;
  bytes: number;
}

export interface SandboxStartedEvent extends EventBase {
  event: "sandbox.started";
  image: string;
}

export interface SandboxOutputEvent extends EventBase {
  event: "sandbox.output";
  stream: "stdout" | "stderr";
  chunk: string;
}

export interface TestsResultEvent extends EventBase {
  event: "tests.result";
  passed: boolean;
  total: number;
  failed: number;
}

export interface RunCompletedEvent extends EventBase {
  event: "run.completed";
  status: string;
  iterations: number;
  duration_ms: number;
}

export interface RunFailedEvent extends EventBase {
  event: "run.failed";
  status: string;
  reason: string;
}

export type CodeForgeEvent =
  | RunStartedEvent
  | AgentStartedEvent
  | AgentMessageEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | ApprovalRequiredEvent
  | ApprovalResolvedEvent
  | LoopIterationEvent
  | FileWrittenEvent
  | SandboxStartedEvent
  | SandboxOutputEvent
  | TestsResultEvent
  | RunCompletedEvent
  | RunFailedEvent;

export type EventName = CodeForgeEvent["event"];

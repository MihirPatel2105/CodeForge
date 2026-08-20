import type { AgentName } from "./types";

/** The pipeline has one non-agent stage — execution — that shares the agent card's
 * visual language (docs/UI_BRIEF.md §4.1). Frontend-local: the backend's AgentName has
 * no such value, because the sandbox is not an LLM agent. */
export type PipelineStageId = AgentName | "sandbox";

export interface PipelineStageMeta {
  id: PipelineStageId;
  /** 1-6. Matches the numbered square on the card and the loop band's viewBox centres
   * (design_handoff/README.md §"The loop moment"). */
  index: number;
  name: string;
  job: string;
}

/** Job lines are fixed copy — docs/UI_BRIEF.md §5. */
export const PIPELINE_STAGES: PipelineStageMeta[] = [
  { id: "pm", index: 1, name: "PM", job: "Turns the request into structured requirements" },
  { id: "architect", index: 2, name: "Architect", job: "Designs the endpoints and data models" },
  { id: "coder", index: 3, name: "Coder", job: "Writes the application code" },
  { id: "reviewer", index: 4, name: "Reviewer", job: "Checks the code against a fixed checklist" },
  { id: "tester", index: 5, name: "Tester", job: "Writes the test suite" },
  { id: "sandbox", index: 6, name: "Sandbox", job: "Runs the code and its tests for real" },
];

const BY_ID = new Map(PIPELINE_STAGES.map((s) => [s.id, s]));

export function stageMeta(id: PipelineStageId): PipelineStageMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`Unknown pipeline stage: ${id}`);
  return meta;
}

export function stageName(id: PipelineStageId): string {
  return stageMeta(id).name;
}

export function isPipelineStage(agent: string): agent is PipelineStageId {
  return BY_ID.has(agent as PipelineStageId);
}

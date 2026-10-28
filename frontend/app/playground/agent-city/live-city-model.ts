import { isPipelineStage, PIPELINE_STAGES, stageName, type PipelineStageId } from "@/lib/pipeline";
import { applyEvent, initialSnapshot, type RunSnapshot } from "@/lib/run-reducer";
import type { CodeForgeEvent } from "@/lib/types";

const CITY_PLACES: Record<PipelineStageId, { place: string; color: string; artifactLabel: string }> = {
  pm: { place: "Idea office", color: "#e5ab67", artifactLabel: "Requirements" },
  architect: { place: "Blueprint studio", color: "#83b9d4", artifactLabel: "API design" },
  coder: { place: "Build workshop", color: "#aac78c", artifactLabel: "Application code" },
  reviewer: { place: "Review checkpoint", color: "#b7a1d2", artifactLabel: "Review findings" },
  tester: { place: "Test lab", color: "#dc969e", artifactLabel: "Test suite" },
  sandbox: { place: "Launch station", color: "#80c9ba", artifactLabel: "Execution output" },
};

export const CITY_STAGES = PIPELINE_STAGES.map(stage => ({ ...stage, ...CITY_PLACES[stage.id] }));

export function cityEventStage(event: CodeForgeEvent, previousStage: PipelineStageId | null = null): PipelineStageId | null {
  if ("agent" in event && isPipelineStage(event.agent)) return event.agent;
  if (event.event === "approval.required" || event.event === "approval.resolved") return isPipelineStage(event.phase) ? event.phase : null;
  if (event.event === "loop.iteration") return event.trigger === "reviewer" ? "reviewer" : "sandbox";
  if (event.event === "sandbox.started" || event.event === "sandbox.output" || event.event === "tests.result") return "sandbox";
  if (event.event === "file.written") return previousStage ?? (/(^|\/)test[^/]*\.py$/.test(event.path) ? "tester" : "coder");
  return null;
}

export function cityEventText(event: CodeForgeEvent): string {
  switch (event.event) {
    case "run.started": return "An idea arrived in the city.";
    case "run.retried": return `Retry ${event.attempt}: continuing from ${stageName(event.agent)}.`;
    case "agent.started": return `${isPipelineStage(event.agent) ? stageName(event.agent) : "Agent"} started ${event.iteration > 0 ? `pass ${event.iteration + 1}` : "working"}.`;
    case "agent.message": return event.text;
    case "agent.completed": return `${isPipelineStage(event.agent) ? stageName(event.agent) : "Agent"} completed this pass in ${(event.duration_ms / 1000).toFixed(1)}s.`;
    case "agent.failed": return `${isPipelineStage(event.agent) ? stageName(event.agent) : "This stage"} couldn’t finish. Open the run to review the next step.`;
    case "approval.required": return `${event.phase === "pm" ? "Requirements" : "Design"} ready for your approval.`;
    case "approval.resolved": return event.revision_requested ? "Changes requested. The team is revising this checkpoint." : event.approved ? "Approved. The next stage can begin." : "This checkpoint was rejected.";
    case "loop.iteration": return event.trigger === "reviewer"
      ? `Reviewer → Coder · ${event.blocking_findings} blocking ${event.blocking_findings === 1 ? "finding" : "findings"} · repair ${event.iteration}`
      : `Sandbox → Coder · ${event.failed_tests} failing ${event.failed_tests === 1 ? "test" : "tests"} · repair ${event.iteration}`;
    case "file.written": return `${event.path} · ${event.bytes.toLocaleString()} bytes written`;
    case "sandbox.started": return "The isolated execution environment started.";
    case "sandbox.output": return event.chunk.trim();
    case "tests.result": return `${event.total - event.failed} of ${event.total} tests passed${event.failed ? ` · ${event.failed} failed` : ""}.`;
    case "run.completed": return cityStatusLabel(event.status);
    case "run.failed": return cityStatusLabel(event.status);
  }
}

export function cityStatusLabel(status: string): string {
  switch (status) {
    case "queued": return "Waiting to start";
    case "running": return "Build in progress";
    case "awaiting_approval": return "Your approval is needed";
    case "succeeded": return "Build completed";
    case "partial": return "Build finished with failing tests";
    case "cancelled": return "Build cancelled";
    case "rejected": return "Build rejected";
    case "failed_max_loops": return "Repair limit reached";
    case "failed_llm": return "An agent couldn’t finish";
    case "failed_sandbox": return "Execution couldn’t finish";
    default: return "Build needs attention";
  }
}

export function cityStageFiles(stage: PipelineStageId, paths: string[]): string[] {
  if (stage === "coder") return paths.filter(path => !/(^|\/)(test[^/]*\.py|conftest\.py)$/.test(path));
  if (stage === "tester") return paths.filter(path => /(^|\/)(test[^/]*\.py|conftest\.py)$/.test(path));
  return [];
}

export function reduceCityEvents(events: CodeForgeEvent[], count = events.length): RunSnapshot {
  let snapshot = initialSnapshot();
  for (let index = 0; index < Math.min(Math.max(0, count), events.length); index++) {
    snapshot = { ...applyEvent(snapshot, events[index]), lastEventAt: events[index].at };
  }
  return snapshot;
}

import { expect, test } from "@playwright/test";
import { cityEventStage, cityEventText, cityStageFiles, reduceCityEvents } from "../../app/playground/agent-city/live-city-model";
import type { CodeForgeEvent } from "../../lib/types";

const at = "2026-10-27T08:00:00.000Z";
const recording: CodeForgeEvent[] = [
  { event: "run.started", run_id: "recorded-city", prompt: "Build a books API", at },
  { event: "agent.started", agent: "coder", iteration: 0, at },
  { event: "file.written", path: "main.py", bytes: 50, at },
  { event: "agent.completed", agent: "coder", output_summary: { files: 1 }, duration_ms: 100, at },
  { event: "agent.started", agent: "reviewer", iteration: 0, at },
  { event: "agent.completed", agent: "reviewer", output_summary: { findings: 1, blocking: 1, passed: false }, duration_ms: 100, at },
  { event: "loop.iteration", trigger: "reviewer", iteration: 1, blocking_findings: 1, failed_tests: 0, at },
  { event: "agent.started", agent: "coder", iteration: 1, at },
  { event: "run.failed", status: "cancelled", reason: "private infrastructure diagnostic", at },
];

test("city replay restores an earlier pass without retaining future repairs or files", () => {
  const latest = reduceCityEvents(recording);
  expect(latest.status).toBe("cancelled");
  expect(latest.agents.coder.state).toBe("stopped");
  expect(latest.lastLoop?.iteration).toBe(1);
  const beforeWriting = reduceCityEvents(recording, 2);
  expect(beforeWriting.agents.coder.state).toBe("working");
  expect(beforeWriting.agents.coder.iteration).toBe(0);
  expect(beforeWriting.lastLoop).toBeNull();
  expect(beforeWriting.files).toEqual([]);
  expect(beforeWriting.endedAt).toBeNull();
});

test("execution repair belongs to the Sandbox and test writes retain Tester attribution", () => {
  expect(cityEventStage({ event: "loop.iteration", trigger: "tester", iteration: 2, blocking_findings: 0, failed_tests: 3, at })).toBe("sandbox");
  expect(cityEventStage({ event: "file.written", path: "test_main.py", bytes: 50, at }, "tester")).toBe("tester");
  expect(cityEventStage({ event: "file.written", path: "test_main.py", bytes: 50, at })).toBe("tester");
  const paths = ["main.py", "models.py", "test_main.py", "tests/test_books.py", "tests/conftest.py"];
  expect(cityStageFiles("coder", paths)).toEqual(["main.py", "models.py"]);
  expect(cityStageFiles("tester", paths)).toEqual(["test_main.py", "tests/test_books.py", "tests/conftest.py"]);
});

test("city failure copy never exposes raw infrastructure diagnostics", () => {
  const text = cityEventText(recording[8]);
  expect(text).toBe("Build cancelled");
  expect(text).not.toContain("private infrastructure diagnostic");
  expect(cityEventText({ event: "agent.failed", agent: "coder", code: "provider_error", message: "provider key detail", iteration: 0, at })).not.toContain("provider key detail");
});

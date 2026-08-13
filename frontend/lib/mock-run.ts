/**
 * A complete recorded run, as SSE events.
 *
 * Lets the dashboard be built and demoed before the backend graph exists: replay this
 * array on a timer and every UI state appears — agent cards, an approval pause, a
 * review-triggered loop iteration, sandbox output, and a successful finish.
 *
 * This sequence is also the acceptance test for the event contract: if a component
 * cannot be rendered from these events alone, the contract is missing something.
 */

import type { CodeForgeEvent } from "./types";

export const MOCK_RUN: CodeForgeEvent[] = [
  {
    event: "run.started",
    at: "2026-08-13T10:00:00Z",
    run_id: "run_demo_1",
    prompt: "I want an API to manage my personal book collection.",
  },

  // --- PM -------------------------------------------------------------------
  { event: "agent.started", at: "2026-08-13T10:00:01Z", agent: "pm", iteration: 0 },
  {
    event: "agent.message",
    at: "2026-08-13T10:00:04Z",
    agent: "pm",
    text: "Identified entity: Book (title, author, year, genres)",
  },
  {
    event: "agent.completed",
    at: "2026-08-13T10:00:06Z",
    agent: "pm",
    output_summary: { entities: 1, operations: 4 },
    duration_ms: 5120,
  },
  {
    event: "approval.required",
    at: "2026-08-13T10:00:06Z",
    phase: "pm",
    payload: { project_name: "Book Collection API", entities: ["Book"] },
  },
  {
    event: "approval.resolved",
    at: "2026-08-13T10:00:20Z",
    phase: "pm",
    approved: true,
    note: null,
  },

  // --- Architect ------------------------------------------------------------
  { event: "agent.started", at: "2026-08-13T10:00:21Z", agent: "architect", iteration: 0 },
  {
    event: "agent.message",
    at: "2026-08-13T10:00:26Z",
    agent: "architect",
    text: "5 endpoints designed, all with explicit response models",
  },
  {
    event: "agent.completed",
    at: "2026-08-13T10:00:28Z",
    agent: "architect",
    output_summary: { collections: 1, endpoints: 5, files: 5 },
    duration_ms: 7010,
  },
  {
    event: "approval.required",
    at: "2026-08-13T10:00:28Z",
    phase: "architect",
    payload: { endpoints: 5 },
  },
  {
    event: "approval.resolved",
    at: "2026-08-13T10:00:41Z",
    phase: "architect",
    approved: true,
    note: null,
  },

  // --- Coder, first pass ----------------------------------------------------
  { event: "agent.started", at: "2026-08-13T10:00:42Z", agent: "coder", iteration: 0 },
  { event: "file.written", at: "2026-08-13T10:00:52Z", path: "database.py", bytes: 289 },
  { event: "file.written", at: "2026-08-13T10:00:53Z", path: "models.py", bytes: 214 },
  { event: "file.written", at: "2026-08-13T10:00:54Z", path: "schemas.py", bytes: 402 },
  { event: "file.written", at: "2026-08-13T10:00:56Z", path: "main.py", bytes: 2318 },
  {
    event: "agent.completed",
    at: "2026-08-13T10:00:57Z",
    agent: "coder",
    output_summary: { files: 4 },
    duration_ms: 15400,
  },

  // --- Reviewer finds blocking issues --------------------------------------
  { event: "agent.started", at: "2026-08-13T10:00:58Z", agent: "reviewer", iteration: 0 },
  {
    event: "agent.message",
    at: "2026-08-13T10:01:03Z",
    agent: "reviewer",
    text: "DELETE /books/{id} returns the Document directly - ObjectId is not serialisable",
  },
  {
    event: "agent.completed",
    at: "2026-08-13T10:01:04Z",
    agent: "reviewer",
    output_summary: { findings: 3, blocking: 2, passed: false },
    duration_ms: 6200,
  },

  // --- The loop: back to the Coder -----------------------------------------
  {
    event: "loop.iteration",
    at: "2026-08-13T10:01:04Z",
    iteration: 1,
    trigger: "reviewer",
    blocking_findings: 2,
    failed_tests: 0,
  },
  { event: "agent.started", at: "2026-08-13T10:01:05Z", agent: "coder", iteration: 1 },
  { event: "file.written", at: "2026-08-13T10:01:14Z", path: "main.py", bytes: 2402 },
  {
    event: "agent.completed",
    at: "2026-08-13T10:01:15Z",
    agent: "coder",
    output_summary: { files: 1, changelog: ["added BookResponse to DELETE route"] },
    duration_ms: 10100,
  },

  // --- Reviewer passes ------------------------------------------------------
  { event: "agent.started", at: "2026-08-13T10:01:16Z", agent: "reviewer", iteration: 1 },
  {
    event: "agent.completed",
    at: "2026-08-13T10:01:21Z",
    agent: "reviewer",
    output_summary: { findings: 1, blocking: 0, passed: true },
    duration_ms: 5300,
  },

  // --- Tester ---------------------------------------------------------------
  { event: "agent.started", at: "2026-08-13T10:01:22Z", agent: "tester", iteration: 1 },
  { event: "file.written", at: "2026-08-13T10:01:31Z", path: "test_main.py", bytes: 1877 },
  {
    event: "agent.completed",
    at: "2026-08-13T10:01:32Z",
    agent: "tester",
    output_summary: { tests: 8 },
    duration_ms: 9800,
  },

  // --- Sandbox --------------------------------------------------------------
  {
    event: "sandbox.started",
    at: "2026-08-13T10:01:33Z",
    image: "codeforge-sandbox:latest",
  },
  {
    event: "sandbox.output",
    at: "2026-08-13T10:01:36Z",
    stream: "stdout",
    chunk: "collected 8 items\n",
  },
  {
    event: "sandbox.output",
    at: "2026-08-13T10:01:39Z",
    stream: "stdout",
    chunk: "test_main.py ........                    [100%]\n",
  },
  {
    event: "sandbox.output",
    at: "2026-08-13T10:01:40Z",
    stream: "stdout",
    chunk: "8 passed in 1.42s\n",
  },
  { event: "tests.result", at: "2026-08-13T10:01:41Z", passed: true, total: 8, failed: 0 },

  {
    event: "run.completed",
    at: "2026-08-13T10:01:42Z",
    status: "succeeded",
    iterations: 1,
    duration_ms: 102000,
  },
];

/**
 * Failure-path fragment. Append to a truncated MOCK_RUN to exercise the failed states
 * that the happy path never reaches.
 */
export const MOCK_FAILURE_TAIL: CodeForgeEvent[] = [
  {
    event: "agent.failed",
    at: "2026-08-13T10:02:00Z",
    agent: "coder",
    code: "llm_exhausted",
    message: "All providers returned 429",
    iteration: 3,
  },
  {
    event: "run.failed",
    at: "2026-08-13T10:02:01Z",
    status: "failed_max_loops",
    reason: "Loop cap reached with 2 blocking findings outstanding",
  },
];

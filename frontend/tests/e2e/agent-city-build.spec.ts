import { expect, test } from "@playwright/test";

for (const status of ["succeeded", "failed_sandbox", "cancelled"]) {
  test(`Agent City settles the linked ${status} build`, async ({ page }) => {
    await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
    await page.route("**/api/backend/runs/build-42", route => route.fulfill({ json: { id: "build-42", project_id: "project", prompt: "Build a books API", state: {}, status } }));
    await page.route("**/api/backend/runs/build-42/files", route => route.fulfill({ json: { run_id: "build-42", files: [] } }));
    const events = [
      { event: "run.started", run_id: "build-42", prompt: "Build a books API" },
      { event: "agent.started", agent: "coder", iteration: 0 },
      ...(status === "succeeded" ? [
        { event: "agent.completed", agent: "coder", output_summary: { files: 1 }, duration_ms: 10 },
        { event: "tests.result", passed: true, total: 4, failed: 0 },
        { event: "run.completed", status, iterations: 0, duration_ms: 20 },
      ] : [{ event: "run.failed", status, reason: status }]),
    ];
    await page.route("**/api/backend/runs/build-42/stream", route => route.fulfill({ contentType: "text/event-stream", body: events.map((event, index) => `id: ${index + 1}\ndata: ${JSON.stringify({ ...event, at: new Date(Date.UTC(2026, 9, 27, 8, 0, index)).toISOString() })}\n\n`).join("") }));
    await page.goto("/playground/agent-city?run=build-42");
    await expect(page.getByRole("heading", { name: "Agent City", exact: true })).toBeVisible();
    await expect(page.locator('[data-city-stage="coder"]')).toHaveAttribute("data-state", status === "succeeded" ? "done" : "stopped");
    await expect(page.locator('[data-city-stage][data-state="working"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Replay run", exact: true })).toBeVisible();
  });
}

test("Agent City without a run sends visitors to their projects and watches nothing", async ({ page }) => {
  // The projects page loads its own data after the redirect; Agent City must never open a run stream.
  let streams = 0;
  await page.route("**/api/backend/runs/**", route => { if (route.request().url().includes("/stream")) streams++; return route.fulfill({ json: {} }); });
  await page.goto("/playground/agent-city");
  await expect(page).toHaveURL(/\/(projects|login)/);
  await expect(page.locator(".agent-city, .live-agent-city")).toHaveCount(0);
  expect(streams).toBe(0);
});

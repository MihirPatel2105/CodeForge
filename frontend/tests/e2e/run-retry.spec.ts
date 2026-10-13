import { expect, test, type Page } from "@playwright/test";
const runId = "retry-run";
const at = "2026-10-13T10:00:00Z";

async function fixture(page: Page, reject = false, eligible = true) {
  let retried = false;
  let submissions = 0;
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", first_name: "Regular", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route(`**/api/backend/runs/${runId}`, route => route.fulfill({ json: {
    id: runId, project_id: "p", prompt: "Build a contacts API", status: retried ? "succeeded" : "failed_llm",
    state: { files: [{ path: "main.py", content: "saved code" }], loop_count: 0 }, metrics: null, created_at: at, updated_at: at,
  } }));
  await page.route(`**/api/backend/runs/${runId}/files`, route => route.fulfill({ json: { run_id: runId, files: [{ path: "main.py", content: "saved code" }] } }));
  await page.route(`**/api/backend/runs/${runId}/file-history`, route => route.fulfill({ json: { run_id: runId, versions: [] } }));
  await page.route(`**/api/backend/runs/${runId}/retry`, async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { stage: eligible && !retried ? "reviewer" : null, remaining: 3 } });
    submissions++;
    if (reject) return route.fulfill({ status: 409, json: { error: { code: "conflict", message: "A retry is already being processed. Refresh the run." } } });
    retried = true;
    return route.fulfill({ status: 202, json: { run_id: runId, status: "running" } });
  });
  const original = [
    { event: "run.started", run_id: runId, prompt: "Build a contacts API", at },
    { event: "agent.completed", agent: "pm", output_summary: {}, duration_ms: 1, at },
    { event: "agent.completed", agent: "architect", output_summary: {}, duration_ms: 1, at },
    { event: "file.written", path: "main.py", bytes: 10, at },
    { event: "agent.completed", agent: "coder", output_summary: {}, duration_ms: 1, at },
    { event: "agent.failed", agent: "reviewer", code: "llm_exhausted", message: "provider unavailable", at },
  ];
  await page.route(`**/api/backend/runs/${runId}/stream`, route => {
    const events = retried ? [
      ...original,
      { event: "run.retried", agent: "reviewer", attempt: 1, at },
      { event: "agent.started", agent: "reviewer", iteration: 0, at },
      { event: "agent.completed", agent: "reviewer", output_summary: {}, duration_ms: 1, at },
      { event: "tests.result", passed: true, total: 4, failed: 0, at },
      { event: "run.completed", status: "succeeded", iterations: 0, duration_ms: 20, at },
    ] : [...original, { event: "run.failed", status: "failed_llm", reason: "provider unavailable", at }];
    return route.fulfill({ contentType: "text/event-stream", body: events.map((event, index) => `id: ${index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") });
  });
  return () => submissions;
}

test("retry resumes the same run and reconnects after its old terminal event", async ({ page }) => {
  const submissions = await fixture(page);
  await page.goto(`/runs/${runId}`);
  await page.getByRole("button", { name: "Retry Reviewer", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("retry-stage.png") });
  await page.getByRole("button", { name: "Retry Reviewer", exact: true }).click({ timeout: 5000 });
  await expect(page.getByRole("region", { name: "Run result" })).toContainText("Every test passed");
  await expect(page).toHaveURL(new RegExp(`/runs/${runId}$`));
  expect(submissions()).toBe(1);
  await expect(page.getByRole("button", { name: "Retry Reviewer", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Retry 1: continuing from Reviewer/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Run result" })).toContainText("Every test passed");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("retry rejection preserves the failed result and displays an actionable error", async ({ page }) => {
  const submissions = await fixture(page, true);
  await page.goto(`/runs/${runId}`);
  await page.getByRole("button", { name: "Retry Reviewer", exact: true }).click();
  await expect(page.getByText("This run cannot be retried right now. Refresh the run and check its status.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Run result" })).toContainText("This run couldn't finish");
  expect(submissions()).toBe(1);
});

test("unsupported failures retain Run again without advertising stage recovery", async ({ page }) => {
  await fixture(page, false, false);
  await page.goto(`/runs/${runId}`);
  await expect(page.getByRole("region", { name: "Run result" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Retry / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run again", exact: true })).toBeVisible();
});

test("recovery availability catches up after the terminal event precedes checkpoint persistence", async ({ page }) => {
  await fixture(page);
  let reads = 0;
  await page.route(`**/api/backend/runs/${runId}/retry`, route => {
    reads++;
    return route.fulfill({ json: { stage: reads > 1 ? "reviewer" : null, remaining: reads > 1 ? 3 : 0 } });
  });
  await page.goto(`/runs/${runId}`);
  await expect(page.getByRole("button", { name: "Retry Reviewer", exact: true })).toBeVisible();
  expect(reads).toBe(2);
});

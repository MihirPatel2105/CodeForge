import { expect, test, type Page } from "@playwright/test";

const runId = "problems-run";
const at = "2026-10-13T10:00:00Z";
const content = "from fastapi import FastAPI\napp = FastAPI()\nprice = -1\n";
const testContent = "def test_price():\n    assert False\n";

async function runFixture(page: Page, state: Record<string, unknown>, iteration = 0, live = false) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found" } } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", first_name: "Regular", email: "user@example.com", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route(`**/api/backend/runs/${runId}`, route => route.fulfill({ json: {
    id: runId, project_id: "project-1", prompt: "Build a products API", status: live ? "running" : "failed_max_loops", state,
    created_at: at, updated_at: at, metrics: null,
  } }));
  await page.route(`**/api/backend/runs/${runId}/files`, route => route.fulfill({ json: { run_id: runId,
    files: [{ path: "main.py", content }, { path: "test_main.py", content: testContent }],
  } }));
  await page.route(`**/api/backend/runs/${runId}/file-history`, route => route.fulfill({ json: { run_id: runId, versions: [] } }));
  const events = [
    { event: "run.started", run_id: runId, prompt: "Build a products API", at },
    ...(iteration ? [{ event: "loop.iteration", iteration, trigger: "reviewer", blocking_findings: 1, failed_tests: 0, at }] : []),
    { event: "agent.started", agent: "coder", iteration, at },
    { event: "file.written", path: "main.py", bytes: content.length, at },
    { event: "file.written", path: "test_main.py", bytes: testContent.length, at },
    { event: "agent.completed", agent: "coder", output_summary: { files: 2 }, duration_ms: 1, at },
    ...(!live ? [{ event: "run.completed", status: "failed_max_loops", iterations: iteration, at }] : []),
  ];
  await page.route(`**/api/backend/runs/${runId}/stream`, route => route.fulfill({ contentType: "text/event-stream",
    body: events.map((event, i) => `id: ${i + 1}\ndata: ${JSON.stringify(event)}\n\n`).join(""),
  }));
}

function stateWith(findings: unknown[]) {
  return { loop_count: 0, files: [{ path: "main.py", content }], test_files: [{ path: "test_main.py", content: testContent }], review: { findings }, tests: { failures: [] } };
}

test("reviewer findings navigate to and focus the recorded generated-code line", async ({ page }) => {
  await runFixture(page, stateWith([{ severity: "blocking", file: "main.py", line: 3, issue: "Reject negative prices", fix_hint: "Validate the price" }]));
  await page.goto(`/runs/${runId}`);
  const problems = page.getByRole("region", { name: "Problems", exact: true });
  await expect(problems.getByText("Reject negative prices", { exact: true })).toBeVisible();
  await problems.getByRole("button", { name: "View main.py line 3" }).click();
  const line = page.locator('[data-problem-line="3"]');
  await expect(line).toContainText("price = -1");
  await expect(line).toBeFocused();
  await problems.getByRole("button", { name: "View main.py line 3" }).click();
  await expect(line).toBeFocused();
  await page.getByRole("button", { name: /test_main.py/ }).click();
  await expect(page.locator("[data-problem-line]")).toHaveCount(0);
});

test("a captured pytest location opens code on mobile without exposing raw traceback", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = { ...stateWith([]), tests: { failures: [{ test_name: "test_main.py::test_price", assertion: "AssertionError: internal detail", traceback_tail: "test_main.py:2: AssertionError" }] } };
  await runFixture(page, state);
  await page.goto(`/runs/${runId}`);
  await page.getByRole("region", { name: "Problems", exact: true }).getByRole("button", { name: "View test_main.py line 2" }).click();
  await expect(page.getByRole("region", { name: "Generated code", exact: true })).toBeVisible();
  await expect(page.locator('[data-problem-line="2"]')).toContainText("assert False");
  await expect(page.locator('[data-problem-line="2"]')).toBeFocused();
  await expect(page.getByText("AssertionError: internal detail", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("unknown, invalid, and stale source locations are not clickable", async ({ page }) => {
  const state = stateWith([
    { severity: "warning", file: "missing.py", line: 1, issue: "Missing source" },
    { severity: "blocking", file: "main.py", line: 999, issue: "Outside file" },
    { severity: "warning", file: "main.py", line: null, issue: "No recorded line" },
    { severity: "warning", file: "../main.py", line: 1, issue: "Unsafe path" },
    { severity: "blocking", file: "test_main.py", line: 1, issue: "Old file content" },
  ]);
  state.test_files[0].content = "old content\n";
  await runFixture(page, state);
  await page.goto(`/runs/${runId}`);
  const problems = page.getByRole("region", { name: "Problems", exact: true });
  await expect(problems.getByText("Old file content", { exact: true })).toBeVisible();
  await expect(problems.getByRole("button", { name: /^View / })).toHaveCount(0);
});

test("findings from an older iteration stay unlinked even when code is identical", async ({ page }) => {
  await runFixture(page, stateWith([{ severity: "blocking", file: "main.py", line: 3, issue: "Previous iteration finding" }]), 1);
  await page.goto(`/runs/${runId}`);
  const problems = page.getByRole("region", { name: "Problems", exact: true });
  await expect(problems.getByText("Previous iteration finding", { exact: true })).toBeVisible();
  await expect(problems.getByRole("button", { name: /^View / })).toHaveCount(0);
});

test("the live Problems list refreshes when recorded findings are cleared", async ({ page }) => {
  const state = stateWith([{ severity: "blocking", file: "main.py", line: 3, issue: "Live finding" }]);
  await runFixture(page, state, 0, true);
  await page.goto(`/runs/${runId}`);
  const problems = page.getByRole("region", { name: "Problems", exact: true });
  await expect(problems.getByText("Live finding", { exact: true })).toBeVisible();
  state.review.findings = [];
  await expect(problems).toHaveCount(0, { timeout: 8000 });
});

for (const width of [1440, 375]) {
  test(`long generated files scroll to the final line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await runFixture(page, stateWith([]));
    const longCode = Array.from({ length: 120 }, (_, i) => `value_${i + 1} = ${i + 1}`).join("\n");
    await page.route(`**/api/backend/runs/${runId}/files`, route => route.fulfill({ json: {
      run_id: runId, files: [{ path: "main.py", content: longCode }, { path: "test_main.py", content: testContent }],
    } }));
    await page.goto(`/runs/${runId}`);
    await page.getByRole("button", { name: /^main.py/ }).click();
    const viewport = page.locator('[data-slot="scroll-area-viewport"]').filter({ hasText: "value_120" });
    await expect(viewport).toBeVisible();
    const dimensions = await viewport.evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight }));
    expect(dimensions.content).toBeGreaterThan(dimensions.height);
    await viewport.hover();
    await page.mouse.wheel(0, 10000);
    await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(viewport.getByText("value_120", { exact: false }).last()).toBeInViewport();
    await expect(page.getByRole("button", { name: "Copy code" })).toBeInViewport();
    await page.getByRole("button", { name: "Wrap", exact: true }).click();
    await expect(viewport.getByText("value_120", { exact: false }).last()).toBeInViewport();
  });
}

import { expect, test, type Page } from "@playwright/test";
const runId = "timeline-filter-run";
const at = "2026-10-13T10:00:00Z";

async function fixture(page: Page, live = false, additions: Record<string, unknown>[] = []) {
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", first_name: "Regular", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route(`**/api/backend/runs/${runId}`, route => route.fulfill({ json: {
    id: runId, project_id: "p", prompt: "Build an items API", status: live ? "running" : "failed_llm",
    state: {}, metrics: null, created_at: at, updated_at: at,
  } }));
  await page.route(`**/api/backend/runs/${runId}/files`, route => route.fulfill({ json: { run_id: runId, files: [] } }));
  await page.route(`**/api/backend/runs/${runId}/file-history`, route => route.fulfill({ json: { run_id: runId, versions: [] } }));
  const events = [
    { event: "run.started", run_id: runId, prompt: "Build an items API", at },
    { event: "agent.message", agent: "pm", text: "Selected the items entity", at },
    { event: "agent.started", agent: "coder", iteration: 0, at },
    { event: "agent.message", agent: "coder", text: "Writing main.py with literal a.b validation", at },
    { event: "agent.message", agent: "coder", text: "Writing aXb helper", at },
    { event: "agent.message", agent: "reviewer", text: "main.py: Reject negative prices", at },
    { event: "agent.failed", agent: "tester", code: "llm_exhausted", message: "private upstream details", at },
    { event: "loop.iteration", iteration: 1, trigger: "reviewer", blocking_findings: 1, failed_tests: 0, at },
    { event: "loop.iteration", iteration: 2, trigger: "tester", blocking_findings: 0, failed_tests: 1, at },
    ...(live ? Array.from({ length: 30 }, (_, i) => ({ event: "agent.message", agent: "coder", text: `Saved progress ${i}`, at })) : [{ event: "run.failed", status: "failed_llm", reason: "provider", at }]),
  ];
  await page.route(`**/api/backend/runs/${runId}/stream`, route => route.fulfill({ contentType: "text/event-stream", body: [...events, ...additions].map((event, index) => `id: ${index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") }));
  await page.goto(`/runs/${runId}`);
  return page.getByRole("log", { name: "Live timeline", exact: true });
}

test("timeline combines literal search, agent and activity filters without losing history", async ({ page }) => {
  const log = await fixture(page);
  await expect(log).toContainText("Selected the items entity");
  await page.getByRole("searchbox", { name: "Search timeline", exact: true }).fill("A.B");
  await expect(log).toContainText("literal a.b");
  await expect(log).not.toContainText("aXb helper");
  await expect(page.getByRole("status", { name: "Timeline results" })).toHaveText("1 of 7 events");
  await page.getByRole("searchbox", { name: "Search timeline", exact: true }).fill("main.py");
  await page.getByLabel("Timeline agent", { exact: true }).selectOption("Reviewer");
  await expect(log).toContainText("Reject negative prices");
  await expect(log).not.toContainText("Writing main.py");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(log).toContainText("Writing aXb helper");
  await page.getByRole("button", { name: "Failures", exact: true }).click();
  await expect(log).toContainText("Reject negative prices");
  await expect(log).toContainText("This step couldn't finish");
  await expect(log).not.toContainText("Writing main.py");
  await expect(log).not.toContainText("private upstream details");
  await page.getByRole("button", { name: "Repair loops", exact: true }).click();
  await expect(log).toContainText("Iteration 1");
  await expect(log).toContainText("Iteration 2");
  await page.getByLabel("Timeline agent", { exact: true }).selectOption("Reviewer");
  await expect(log).toContainText("Iteration 1");
  await expect(log).not.toContainText("Iteration 2");
  await page.getByLabel("Timeline agent", { exact: true }).selectOption("Sandbox");
  await expect(log).toContainText("Iteration 2");
  await expect(log).not.toContainText("Iteration 1");
});

test("empty filter results explain how to recover and remain usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const log = await fixture(page);
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search timeline", exact: true });
  await search.fill("no match here");
  await expect(log.getByText("No matching activity", { exact: true })).toBeVisible();
  await expect(log.getByText("Waiting for activity", { exact: true })).toHaveCount(0);
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(log).toContainText("Selected the items entity");
  await expect(page.getByRole("button", { name: "Clear filters", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});


test("only matching live events count as unread while reading earlier filtered activity", async ({ page }) => {
  const additions: Record<string, unknown>[] = [];
  const log = await fixture(page, true, additions);
  await expect(log).toHaveCSS("scroll-behavior", "auto");
  await page.getByRole("searchbox", { name: "Search timeline", exact: true }).fill("Saved progress");
  await expect(page.getByRole("status", { name: "Timeline results" })).toHaveText("30 of 37 events");
  await expect.poll(() => log.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(48);
  await log.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
  additions.push({ event: "agent.message", agent: "pm", text: "Hidden live update", at });
  await expect(page.getByRole("status", { name: "Timeline results" })).toHaveText("30 of 38 events");
  await expect(page.getByRole("button", { name: /new event/i })).toHaveCount(0);
  expect(await log.evaluate(element => element.scrollTop)).toBeLessThan(4);
  additions.push({ event: "agent.message", agent: "coder", text: "Saved progress 30", at });
  await expect(page.getByRole("button", { name: "1 new event", exact: true })).toBeVisible();
  expect(await log.evaluate(element => element.scrollTop)).toBeLessThan(4);
  await page.getByRole("button", { name: "1 new event", exact: true }).click();
  await expect.poll(() => log.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(48);
  await expect(page.getByRole("button", { name: /new event/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(log).toContainText("Hidden live update");
});

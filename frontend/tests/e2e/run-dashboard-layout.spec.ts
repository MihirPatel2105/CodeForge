import { expect, test } from "@playwright/test";

const runId = "layout-run";
const at = "2026-10-14T04:00:00Z";

test("stage inspection stays stable while live execution advances", async ({ page }) => {
  let release!: () => void;
  const nextStage = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  let mutations = 0;
  page.on("request", request => { if (request.url().includes("/api/backend") && request.method() !== "GET") mutations++; });
  await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", first_name: "Regular", is_admin: false } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.route(`**/api/backend/runs/${runId}`, route => route.fulfill({ json: { id: runId, project_id: "p", prompt: "Build a library API", status: "running", state: {}, metrics: null, created_at: at, updated_at: at } }));
  await page.route(`**/api/backend/runs/${runId}/files`, route => route.fulfill({ json: { run_id: runId, files: [] } }));
  await page.route(`**/api/backend/runs/${runId}/file-history`, route => route.fulfill({ json: { run_id: runId, versions: [] } }));
  await page.route(`**/api/backend/runs/${runId}/stream`, async route => {
    reads++;
    if (reads > 1) await nextStage;
    const events = reads === 1 ? [
      { event: "run.started", run_id: runId, prompt: "Build a library API", at },
      { event: "agent.completed", agent: "pm", output_summary: { model: "sample/pm-model" }, duration_ms: 800, at },
      { event: "agent.started", agent: "coder", iteration: 0, at },
      { event: "agent.message", agent: "coder", text: "Writing application files", at },
    ] : reads === 2 ? [
      { event: "agent.completed", agent: "coder", output_summary: { files: 5, model: "sample/coder-model" }, duration_ms: 1200, at },
      { event: "agent.started", agent: "reviewer", iteration: 0, at },
      { event: "agent.message", agent: "reviewer", text: "Checking validation", at },
    ] : [];
    const offset = reads === 1 ? 0 : 4;
    await route.fulfill({ contentType: "text/event-stream", body: events.map((event, index) => `id: ${offset + index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") });
  });
  await page.goto(`/runs/${runId}`);
  const details = page.getByRole("region", { name: "Selected stage details" });
  await expect(page.locator('[data-stage="coder"]')).toHaveAttribute("aria-pressed", "true");
  await expect(details).toContainText("Writes the application code");
  await page.getByRole("button", { name: "Inspect Architect, idle", exact: true }).click();
  await expect(details).toContainText("This stage has not started yet.");
  await page.getByRole("button", { name: "Inspect PM, done", exact: true }).click();
  await expect(details).toContainText("sample/pm-model");
  release();
  await expect(page.locator('[data-stage="reviewer"]')).toHaveAttribute("data-state", "working");
  await expect(page.locator('[data-stage="pm"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Follow active stage", exact: true }).click();
  await expect(page.locator('[data-stage="reviewer"]')).toHaveAttribute("aria-pressed", "true");
  await expect(details).toContainText("Checks the code against a fixed checklist");
  await page.getByRole("button", { name: "Inspect Coder, done", exact: true }).click();
  await expect(details).toContainText("sample/coder-model");
  expect(mutations).toBe(0);
});

for (const width of [1440, 1024, 375, 320]) {
  test(`pipeline stays readable without horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/demo/library");
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    const overview = page.getByRole("group", { name: "Inspect pipeline stages" });
    await expect(overview.locator("[data-stage]")).toHaveCount(6);
    expect(await overview.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const reviewer = page.locator('[data-stage="reviewer"]');
    await reviewer.click();
    await expect(reviewer).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Selected stage details" })).toContainText("Checks the code against a fixed checklist");
    if (width === 1440) {
      await expect(page.locator(".cf-agent-step-loop")).toHaveCount(0);
      await page.locator(".cf-run-pipeline").screenshot({ path: "/tmp/codeforge-run-pipeline-refined.png" });
    }
    await page.screenshot({ path: `/tmp/codeforge-run-dashboard-${width}.png`, fullPage: true });
    if (width === 1440) {
      await page.getByRole("button", { name: "Dark mode for agent dashboard", exact: true }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.screenshot({ path: "/tmp/codeforge-run-dashboard-dark.png", fullPage: true });
    }
  });
}

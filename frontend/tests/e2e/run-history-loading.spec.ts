import { expect, test } from "@playwright/test";

for (const savedStatus of ["succeeded", "failed_llm", "running"]) {
  test(`${savedStatus} run distinguishes saved history from live execution`, async ({ page }) => {
    const id = "history-run";
    const at = "2026-10-13T10:00:00Z";
    let finish!: () => void;
    const released = new Promise<void>(resolve => { finish = resolve; });
    let streamReads = 0;
    let submissions = 0;
    page.on("request", request => {
      if (request.method() === "POST" && request.url().includes("/runs")) submissions++;
    });
    await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
    await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: {} }));
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user-1", first_name: "Regular", is_admin: false } }));
    await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
    await page.route(`**/api/backend/runs/${id}`, route => route.fulfill({ json: {
      id, project_id: "p", prompt: "Build an items API", status: savedStatus,
      state: {}, metrics: null, created_at: at, updated_at: at,
    } }));
    await page.route(`**/api/backend/runs/${id}/files`, route => route.fulfill({ json: { run_id: id, files: [] } }));
    await page.route(`**/api/backend/runs/${id}/file-history`, route => route.fulfill({ json: { run_id: id, versions: [] } }));
    const initial = [
      { event: "run.started", run_id: id, prompt: "Build an items API", at },
      { event: "agent.started", agent: "coder", iteration: 0, at },
      { event: "agent.message", agent: "coder", text: "Saved coder activity", at },
    ];
    const terminal = savedStatus === "failed_llm"
      ? { event: "run.failed", status: "failed_llm", reason: "provider unavailable", at }
      : { event: "run.completed", status: "succeeded", iterations: 0, at };
    await page.route(`**/api/backend/runs/${id}/stream`, async route => {
      streamReads++;
      const events = streamReads === 1 ? initial : [terminal];
      if (streamReads > 1) await released;
      const offset = streamReads === 1 ? 0 : initial.length;
      await route.fulfill({ contentType: "text/event-stream", body: events.map((event, index) => `id: ${offset + index + 1}\ndata: ${JSON.stringify(event)}\n\n`).join("") });
    });
    await page.goto(`/runs/${id}`);
    await expect.poll(() => streamReads).toBeGreaterThanOrEqual(1);
    const pipeline = page.getByRole("region", { name: "Agent pipeline" });
    if (savedStatus === "running") {
      await expect(pipeline).toBeVisible();
      await expect(page.getByRole("log", { name: "Live timeline", exact: true })).toContainText("Saved coder activity");
    } else {
      await expect(page.getByRole("status", { name: "Loading run", exact: true })).toBeVisible();
      await expect(pipeline).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Cancel run", exact: true })).toHaveCount(0);
      await expect(page.getByText("Preparing the agent workflow…", { exact: true })).toHaveCount(0);
    }
    finish();
    await expect(page.getByRole("region", { name: "Run result" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading run", exact: true })).toHaveCount(0);
    await expect(page.getByRole("log", { name: "Live timeline", exact: true })).toContainText("Saved coder activity");
    expect(submissions).toBe(0);
  });
}

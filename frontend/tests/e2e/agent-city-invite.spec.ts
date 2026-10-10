import { expect, test } from "@playwright/test";

for (const scenario of ["first-approval", "revised", "building", "finished"]) {
  test(`Agent City invite: ${scenario}`, async ({ page }) => {
    const id = `invite-${scenario}`;
    await page.addInitScript(() => { document.cookie = "codeforge_session_present=1; Path=/"; });
    await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Unavailable" } } }));
    await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "invite-user", first_name: "Test", email: "test@example.com", is_admin: false } }));
    await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
    await page.route(`**/api/backend/runs/${id}`, route => route.fulfill({ json: { id, project_id: "project", status: "running" } }));
    const events: Record<string, unknown>[] = [
      { event: "run.started", run_id: id, prompt: "Build a books API" },
      { event: "approval.resolved", phase: "pm", approved: true },
    ];
    if (scenario !== "first-approval") events.push({ event: "approval.resolved", phase: "architect", approved: true, revision_requested: scenario === "revised" });
    events.push({ event: "agent.started", agent: "coder", iteration: 0 });
    if (scenario === "finished") events.push({ event: "run.failed", reason: "cancelled" });
    await page.addInitScript(({ id, events }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (String(input).endsWith(`/runs/${id}/stream`)) {
          const body = events.map((event, i) => `id: ${i + 1}\ndata: ${JSON.stringify({ ...event, at: new Date().toISOString() })}\n\n`).join("");
          return Promise.resolve(new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); } }), { headers: { "Content-Type": "text/event-stream" } }));
        }
        return originalFetch(input, init);
      };
    }, { id, events });
    await page.goto(`/runs/${id}`);
    const invite = page.getByRole("complementary", { name: "Agent City invitation" });
    if (scenario === "building") {
      await expect(invite).toBeVisible();
      await expect(invite.getByRole("link", { name: "Play Agent City" })).toHaveAttribute("target", "_blank");
      await page.setViewportSize({ width: 375, height: 812 });
      expect(await invite.evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(375);
      await page.getByRole("button", { name: "Dismiss Agent City invitation" }).click();
      await expect(invite).not.toBeVisible();
      await page.reload();
      await page.waitForTimeout(2000);
      await expect(invite).not.toBeVisible();
    } else {
      await page.waitForTimeout(2000);
      await expect(invite).not.toBeVisible();
    }
  });
}

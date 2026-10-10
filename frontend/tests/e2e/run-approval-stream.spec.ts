import { expect, test } from "@playwright/test";

test("both approvals update the live pipeline without leaving the page", async ({ page }) => {
  await page.addInitScript(() => {
    document.cookie = "codeforge_session_present=1; Path=/";
    const original = window.fetch.bind(window);
    let phase = 0;
    const events = [
      { event: "run.started", run_id: "approval-live", prompt: "Build books" },
      { event: "agent.started", agent: "pm", iteration: 0 },
      { event: "agent.completed", agent: "pm", output_summary: { entities: 1, operations: 4 }, duration_ms: 100 },
      { event: "approval.required", phase: "pm", payload: { project_name: "Books" } },
      { event: "approval.resolved", phase: "pm", approved: true },
      { event: "agent.started", agent: "architect", iteration: 0 },
      { event: "agent.completed", agent: "architect", output_summary: { endpoints: 4 }, duration_ms: 100 },
      { event: "approval.required", phase: "architect", payload: {} },
      { event: "approval.resolved", phase: "architect", approved: true },
      { event: "agent.started", agent: "coder", iteration: 0 },
    ];
    window.fetch = (input, init) => {
      const url = String(input);
      if (url.endsWith("/approval-live/approve")) { phase++; return Promise.resolve(Response.json({ approved: true, status: "running" })); }
      if (url.endsWith("/approval-live/stream")) {
        const after = Number(new Headers(init?.headers).get("Last-Event-ID") ?? 0);
        const until = phase === 0 ? 4 : phase === 1 ? 8 : 10;
        // The old connection stays open but never emits new events, reproducing a stale feed.
        const body = events.slice(after, until).map((event, i) => `id: ${after+i+1}\ndata: ${JSON.stringify({ ...event, at: new Date().toISOString() })}\n\n`).join("");
        return Promise.resolve(new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError"))); } }), { headers: { "Content-Type": "text/event-stream" } }));
      }
      return original(input, init);
    };
  });
  await page.route("**/api/backend/**", route => route.fulfill({ status: 404, json: { error: { code: "not_found" } } }));
  await page.route("**/api/backend/auth/me", route => route.fulfill({ json: { id: "user", first_name: "Test", email: "test@example.com" } }));
  await page.route("**/api/backend/runs/attention", route => route.fulfill({ json: [] }));
  await page.goto("/runs/approval-live");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator('[data-stage="architect"]')).toHaveAttribute("data-state", "done");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator('[data-stage="coder"]')).toHaveAttribute("data-state", "working");
  await expect(page.locator('[data-stage="pm"]')).toHaveAttribute("data-state", "done");
  await expect(page.locator('[data-stage="architect"]')).toHaveAttribute("data-state", "done");
  await expect(page.getByRole("button", { name: "Approve", exact: true })).not.toBeVisible();
});
